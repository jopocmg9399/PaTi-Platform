// store.js - Funciones para página individual de tienda

// Configuración de la tienda actual
let currentStore = null;
let currentStoreSettings = null;

// Inicializar página de tienda
async function initStorePage() {
    try {
        // Obtener ID de tienda de la URL
        const urlParams = new URLSearchParams(window.location.search);
        const storeId = urlParams.get('id') || localStorage.getItem('currentStoreId');
        
        if (!storeId) {
            window.location.href = 'index.html';
            return;
        }
        
        // Cargar datos de la tienda
        await loadStoreData(storeId);
        
        // Cargar configuración de la tienda
        await loadStoreSettings(storeId);
        
        // Cargar productos de la tienda
        await loadStoreProducts(storeId);
        
        // Cargar categorías de la tienda
        await loadStoreCategories(storeId);
        
    } catch (error) {
        console.error('Error inicializando página de tienda:', error);
        showError('No se pudo cargar la tienda');
    }
}

// Cargar datos principales de la tienda
async function loadStoreData(storeId) {
    try {
        currentStore = await PATI_CONFIG.pb.collection('stores').getOne(storeId, {
            expand: 'owner'
        });
        
        // Actualizar UI con datos de la tienda
        updateStoreUI();
        
    } catch (error) {
        console.error('Error cargando tienda:', error);
        throw error;
    }
}

// Cargar configuración de la tienda
async function loadStoreSettings(storeId) {
    try {
        const settings = await PATI_CONFIG.pb.collection('store_settings').getFirstListItem(`store="${storeId}"`);
        currentStoreSettings = settings;
        
        // Actualizar UI con configuración
        updateStoreSettingsUI();
        
    } catch (error) {
        console.log('No se encontró configuración de tienda:', error);
        currentStoreSettings = {};
    }
}

// Actualizar UI con datos de la tienda
function updateStoreUI() {
    if (!currentStore) return;
    
    // Título y nombre
    document.title = `${currentStore.name} - PaTí`;
    document.getElementById('store-name').textContent = currentStore.name;
    document.getElementById('store-tagline').textContent = currentStore.description || 'Tu tienda en línea';
    
    // Descripción
    const descElement = document.getElementById('store-description');
    if (descElement) {
        descElement.textContent = currentStore.description || 'Bienvenido a nuestra tienda en PaTí. Ofrecemos productos de calidad con los mejores precios.';
    }
}

// Actualizar UI con configuración de tienda
function updateStoreSettingsUI() {
    if (!currentStoreSettings) return;
    
    // Actualizar imagen de tienda si existe
    const bannerElement = document.getElementById('store-header');
    if (currentStoreSettings.store_banner && bannerElement) {
        bannerElement.style.setProperty('--store-banner', `url(${PATI_CONFIG.pb.getFileUrl(currentStoreSettings, currentStoreSettings.store_banner)})`);
    }
    
    // Actualizar imagen representativa
    const imgElement = document.getElementById('store-featured-image');
    if (currentStoreSettings.store_logo && imgElement) {
        imgElement.src = PATI_CONFIG.pb.getFileUrl(currentStoreSettings, currentStoreSettings.store_logo);
    }
    
    // Actualizar información de contacto
    updateContactInfo();
}

// Actualizar información de contacto
function updateContactInfo() {
    if (!currentStoreSettings) return;
    
    if (currentStoreSettings.store_email) {
        const emailElement = document.getElementById('store-email');
        if (emailElement) emailElement.textContent = currentStoreSettings.store_email;
    }
    
    if (currentStoreSettings.store_phone) {
        const phoneElement = document.getElementById('store-phone');
        if (phoneElement) phoneElement.textContent = currentStoreSettings.store_phone;
    }
    
    if (currentStoreSettings.store_address) {
        const addressElement = document.getElementById('store-address');
        if (addressElement) addressElement.textContent = currentStoreSettings.store_address;
    }
}

// Cargar productos de la tienda
async function loadStoreProducts(storeId, page = 1, perPage = 12) {
    try {
        const productsContainer = document.getElementById('products-grid');
        const featuredContainer = document.getElementById('featured-products');
        
        if (!productsContainer) return;
        
        // Mostrar loading
        if (page === 1) {
            productsContainer.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-spinner fa-spin text-[#8B4513] text-3xl mb-4"></i>
                    <p class="text-gray-600">Cargando productos...</p>
                </div>
            `;
        }
        
        // Obtener productos de la tienda
        const products = await PATI_CONFIG.pb.collection('products').getList(page, perPage, {
            filter: `store="${storeId}"`,
            sort: '-created',
            expand: 'categories'
        });
        
        // Si es primera página, limpiar contenedor
        if (page === 1) {
            productsContainer.innerHTML = '';
            
            // Mostrar productos destacados (primeros 4)
            if (featuredContainer && products.items.length > 0) {
                featuredContainer.innerHTML = '';
                const featuredProducts = products.items.slice(0, 4);
                featuredProducts.forEach(product => {
                    const productCard = createProductCard(product, true);
                    featuredContainer.appendChild(productCard);
                });
            }
        }
        
        // Mostrar mensaje si no hay productos
        if (products.items.length === 0 && page === 1) {
            productsContainer.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-box-open text-gray-400 text-4xl mb-4"></i>
                    <h3 class="text-xl text-gray-600 mb-2">No hay productos disponibles</h3>
                    <p class="text-gray-500">Esta tienda aún no ha agregado productos.</p>
                </div>
            `;
            return;
        }
        
        // Crear cards para cada producto
        products.items.forEach(product => {
            const productCard = createProductCard(product);
            productsContainer.appendChild(productCard);
        });
        
        // Configurar infinite scroll si hay más productos
        setupInfiniteScroll(products, storeId, page, perPage);
        
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

// Crear card de producto
function createProductCard(product, isFeatured = false) {
    const card = document.createElement('div');
    card.className = `product-card bg-white overflow-hidden ${isFeatured ? '' : 'h-full flex flex-col'}`;
    
    // Determinar precio y moneda
    const price = product.price_base || 0;
    const currency = product.currency || 'USD';
    const currencySymbol = currency === 'USD' ? '$' : 'CUP';
    
    // Obtener primera imagen del producto
    const productImage = product.images && product.images.length > 0 
        ? PATI_CONFIG.pb.getFileUrl(product, product.images[0])
        : 'https://via.placeholder.com/300x200?text=Producto';
    
    card.innerHTML = `
        <div class="relative">
            <img src="${productImage}" 
                 alt="${product.name}" 
                 class="w-full h-48 object-cover">
            <div class="absolute top-3 right-3">
                <span class="currency-badge">${currencySymbol} ${price.toFixed(2)}</span>
            </div>
            ${isFeatured ? '<div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">Más Vendido</div>' : ''}
        </div>
        <div class="p-4 ${isFeatured ? '' : 'flex-grow'}">
            <h3 class="font-bold text-lg text-gray-800 mb-2 line-clamp-2">${product.name}</h3>
            <p class="text-gray-600 text-sm mb-4 line-clamp-2">${product.description || 'Sin descripción'}</p>
            
            ${!isFeatured ? `
            <div class="mt-auto">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-2xl font-bold text-[#8B4513]">${currencySymbol} ${price.toFixed(2)}</span>
                    <span class="text-xs text-gray-500">${currency}</span>
                </div>
                <button onclick="addToCart('${product.id}')" 
                        class="w-full bg-[#8B4513] text-white py-2 rounded-lg font-bold hover:bg-[#654321] transition">
                    <i class="fas fa-cart-plus mr-2"></i> Agregar al Carrito
                </button>
            </div>
            ` : ''}
        </div>
    `;
    
    // Si es destacado, hacer clickable para ver detalle
    if (isFeatured) {
        card.style.cursor = 'pointer';
        card.onclick = () => openProductDetail(product.id);
    }
    
    return card;
}

// Cargar categorías de la tienda
async function loadStoreCategories(storeId) {
    try {
        const categories = await PATI_CONFIG.pb.collection('categories').getFullList({
            filter: `store="${storeId}" && status="active"`,
            sort: 'order'
        });
        
        const categorySelect = document.getElementById('category-filter');
        if (!categorySelect) return;
        
        // Limpiar opciones excepto la primera
        while (categorySelect.options.length > 1) {
            categorySelect.remove(1);
        }
        
        // Agregar categorías
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelect.appendChild(option);
        });
        
        // Agregar handler para filtrar
        categorySelect.addEventListener('change', filterProductsByCategory);
        
    } catch (error) {
        console.error('Error cargando categorías:', error);
    }
}

// Configurar infinite scroll
function setupInfiniteScroll(products, storeId, currentPage, perPage) {
    const loadingElement = document.getElementById('loading-more');
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && products.totalPages > currentPage) {
            loadMoreProducts(storeId, currentPage + 1, perPage);
        }
    }, { threshold: 0.5 });
    
    if (loadingElement) {
        observer.observe(loadingElement);
    }
}

// Cargar más productos (paginación)
async function loadMoreProducts(storeId, page, perPage) {
    const loadingElement = document.getElementById('loading-more');
    if (loadingElement) {
        loadingElement.classList.remove('hidden');
    }
    
    try {
        await loadStoreProducts(storeId, page, perPage);
    } finally {
        if (loadingElement) {
            loadingElement.classList.add('hidden');
        }
    }
}

// Filtrar productos por categoría
async function filterProductsByCategory() {
    const categoryId = document.getElementById('category-filter').value;
    const storeId = currentStore?.id;
    
    if (!storeId) return;
    
    const productsContainer = document.getElementById('products-grid');
    if (!productsContainer) return;
    
    // Mostrar loading
    productsContainer.innerHTML = `
        <div class="col-span-full text-center py-12">
            <i class="fas fa-spinner fa-spin text-[#8B4513] text-3xl mb-4"></i>
            <p class="text-gray-600">Filtrando productos...</p>
        </div>
    `;
    
    try {
        // Construir filtro
        let filter = `store="${storeId}"`;
        if (categoryId) {
            filter += ` && categories~"${categoryId}"`;
        }
        
        // Obtener orden
        const sortSelect = document.getElementById('sort-filter');
        let sort = '-created';
        if (sortSelect.value === 'price-low') sort = 'price_base';
        if (sortSelect.value === 'price-high') sort = '-price_base';
        
        // Obtener productos filtrados
        const products = await PATI_CONFIG.pb.collection('products').getList(1, 12, {
            filter: filter,
            sort: sort
        });
        
        // Mostrar productos
        productsContainer.innerHTML = '';
        if (products.items.length === 0) {
            productsContainer.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-search text-gray-400 text-4xl mb-4"></i>
                    <h3 class="text-xl text-gray-600 mb-2">No se encontraron productos</h3>
                    <p class="text-gray-500">Intenta con otra categoría o criterio de búsqueda.</p>
                </div>
            `;
            return;
        }
        
        products.items.forEach(product => {
            const productCard = createProductCard(product);
            productsContainer.appendChild(productCard);
        });
        
    } catch (error) {
        console.error('Error filtrando productos:', error);
    }
}

// Funciones de navegación
function scrollToProducts() {
    document.getElementById('inicio').scrollIntoView({ behavior: 'smooth' });
}

function scrollToContact() {
    document.getElementById('contactos').scrollIntoView({ behavior: 'smooth' });
}

function openProductDetail(productId) {
    window.location.href = `producto.html?id=${productId}`;
}

function addToCart(productId) {
    // TODO: Implementar carrito de compras
    alert('Funcionalidad de carrito en desarrollo');
}

// Mostrar error
function showError(message) {
    const main = document.querySelector('main');
    if (main) {
        main.innerHTML = `
            <div class="container mx-auto px-4 py-16 text-center">
                <i class="fas fa-exclamation-triangle text-red-500 text-5xl mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Error</h2>
                <p class="text-gray-600 mb-6">${message}</p>
                <a href="index.html" class="bg-[#8B4513] text-white px-6 py-3 rounded-lg font-bold">
                    Volver al Inicio
                </a>
            </div>
        `;
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initStorePage);