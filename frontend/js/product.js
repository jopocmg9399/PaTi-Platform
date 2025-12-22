// product.js - Funciones para página detalle de producto

// Variables globales
let currentProduct = null;
let currentStoreData = null;
let selectedCurrency = 'USD';
let selectedQuantity = 1;

// Inicializar página de producto
async function initProductPage() {
    try {
        // Obtener ID de producto de la URL
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        
        if (!productId) {
            redirectToHome();
            return;
        }
        
        // Cargar datos del producto
        await loadProductData(productId);
        
        // Inicializar Swiper para galería
        initSwiper();
        
        // Configurar eventos
        setupEventListeners();
        
    } catch (error) {
        console.error('Error inicializando página de producto:', error);
        showError('No se pudo cargar el producto');
    }
}

// Cargar datos del producto
async function loadProductData(productId) {
    try {
        // Obtener producto con expansión de store y categorías
        currentProduct = await PATI_CONFIG.pb.collection('products').getOne(productId, {
            expand: 'store,categories'
        });
        
        // Cargar datos de la tienda
        await loadStoreData(currentProduct.store);
        
        // Actualizar UI con datos del producto
        updateProductUI();
        
        // Cargar productos relacionados
        await loadRelatedProducts(currentProduct.store, productId);
        
    } catch (error) {
        console.error('Error cargando producto:', error);
        throw error;
    }
}

// Cargar datos de la tienda
async function loadStoreData(storeId) {
    try {
        currentStoreData = await PATI_CONFIG.pb.collection('stores').getOne(storeId, {
            expand: 'store_settings'
        });
        
        // Actualizar UI con datos de la tienda
        updateStoreUI();
        
    } catch (error) {
        console.error('Error cargando tienda:', error);
    }
}

// Actualizar UI con datos del producto
function updateProductUI() {
    if (!currentProduct) return;
    
    // Título
    document.title = `${currentProduct.name} - PaTí`;
    
    // Nombre y descripción
    document.getElementById('product-name').textContent = currentProduct.name;
    document.getElementById('product-description').textContent = currentProduct.description || 'Sin descripción disponible';
    
    // Precios
    updatePrices();
    
    // Stock
    updateStockInfo();
    
    // Categorías
    updateCategories();
    
    // Especificaciones
    updateSpecifications();
    
    // Imágenes
    updateProductImages();
    
    // Comisión para afiliados
    updateAffiliateCommission();
}

// Actualizar precios según moneda seleccionada
function updatePrices() {
    if (!currentProduct) return;
    
    const priceElement = document.getElementById('product-price');
    const currencyElement = document.getElementById('product-currency');
    
    let price = currentProduct.price_base || 0;
    let currency = currentProduct.currency || 'USD';
    
    // Si el producto tiene precios específicos para USD y CUP
    if (currentProduct.price_usd && currentProduct.price_cup) {
        price = selectedCurrency === 'USD' ? currentProduct.price_usd : currentProduct.price_cup;
        currency = selectedCurrency;
    } else if (currentProduct.currency && currentProduct.currency !== selectedCurrency) {
        // TODO: Implementar conversión de moneda si es necesario
        console.log('Conversión de moneda no implementada');
    }
    
    const currencySymbol = currency === 'USD' ? '$' : 'CUP $';
    
    if (priceElement) priceElement.textContent = `${currencySymbol} ${price.toFixed(2)}`;
    if (currencyElement) currencyElement.textContent = currency;
}

// Actualizar información de stock
function updateStockInfo() {
    if (!currentProduct) return;
    
    const stockElement = document.getElementById('product-stock');
    if (!stockElement) return;
    
    const stock = currentProduct.stock || 0;
    
    if (stock > 10) {
        stockElement.innerHTML = `<i class="fas fa-check-circle mr-1"></i> En stock (${stock} disponibles)`;
        stockElement.className = 'inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm';
    } else if (stock > 0) {
        stockElement.innerHTML = `<i class="fas fa-exclamation-triangle mr-1"></i> Últimas unidades (${stock})`;
        stockElement.className = 'inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm';
    } else {
        stockElement.innerHTML = `<i class="fas fa-times-circle mr-1"></i> Agotado`;
        stockElement.className = 'inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm';
    }
}

// Actualizar categorías
function updateCategories() {
    if (!currentProduct) return;
    
    const categoriesContainer = document.getElementById('product-categories');
    if (!categoriesContainer) return;
    
    categoriesContainer.innerHTML = '';
    
    if (currentProduct.expand?.categories) {
        currentProduct.expand.categories.forEach(category => {
            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm';
            categoryBadge.textContent = category.name;
            categoriesContainer.appendChild(categoryBadge);
        });
    }
}

// Actualizar especificaciones
function updateSpecifications() {
    if (!currentProduct) return;
    
    const specsContainer = document.getElementById('product-specs');
    if (!specsContainer) return;
    
    specsContainer.innerHTML = '';
    
    // Especificaciones predeterminadas
    const defaultSpecs = {
        'SKU': currentProduct.id?.substring(0, 8) || 'N/A',
        'Marca': currentProduct.brand || 'No especificada',
        'Peso': currentProduct.weight ? `${currentProduct.weight} kg` : 'N/A',
        'Dimensiones': currentProduct.dimensions || 'N/A',
        'Color': currentProduct.color || 'N/A'
    };
    
    // Si hay especificaciones en JSON
    if (currentProduct.specs) {
        try {
            const customSpecs = JSON.parse(currentProduct.specs);
            Object.assign(defaultSpecs, customSpecs);
        } catch (error) {
            console.error('Error parseando specs:', error);
        }
    }
    
    // Crear filas de tabla
    Object.entries(defaultSpecs).forEach(([key, value]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${key}</td>
            <td>${value}</td>
        `;
        specsContainer.appendChild(row);
    });
}

// Actualizar imágenes del producto
function updateProductImages() {
    if (!currentProduct) return;
    
    const imagesContainer = document.getElementById('product-images');
    const thumbnailsContainer = document.getElementById('product-thumbnails');
    
    if (!imagesContainer || !thumbnailsContainer) return;
    
    imagesContainer.innerHTML = '';
    thumbnailsContainer.innerHTML = '';
    
    // Si hay imágenes en el producto
    if (currentProduct.images && currentProduct.images.length > 0) {
        currentProduct.images.forEach((image, index) => {
            const imageUrl = PATI_CONFIG.pb.getFileUrl(currentProduct, image);
            
            // Slide principal
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `<img src="${imageUrl}" alt="${currentProduct.name} - Imagen ${index + 1}">`;
            imagesContainer.appendChild(slide);
            
            // Miniatura
            const thumbnail = document.createElement('div');
            thumbnail.className = 'swiper-slide cursor-pointer opacity-50 hover:opacity-100 transition';
            thumbnail.innerHTML = `<img src="${imageUrl}" alt="Miniatura ${index + 1}" class="h-20 object-cover rounded">`;
            thumbnail.onclick = () => gallerySwiper.slideTo(index);
            thumbnailsContainer.appendChild(thumbnail);
        });
    } else {
        // Imagen por defecto
        const defaultImage = 'https://via.placeholder.com/600x400?text=Producto+Sin+Imagen';
        
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `<img src="${defaultImage}" alt="${currentProduct.name}">`;
        imagesContainer.appendChild(slide);
        
        const thumbnail = document.createElement('div');
        thumbnail.className = 'swiper-slide';
        thumbnail.innerHTML = `<img src="${defaultImage}" alt="Miniatura" class="h-20 object-cover rounded">`;
        thumbnailsContainer.appendChild(thumbnail);
    }
    
    // Reinicializar Swiper después de agregar imágenes
    if (gallerySwiper) {
        gallerySwiper.update();
    }
}

// Actualizar comisión para afiliados
function updateAffiliateCommission() {
    if (!currentProduct || !currentStoreData) return;
    
    const commissionElement = document.getElementById('affiliate-commission');
    if (!commissionElement) return;
    
    // Obtener tasa de comisión de store_settings o usar default
    let commissionRate = 10; // Default
    
    if (currentStoreData.expand?.store_settings?.[0]?.store_commission_rate) {
        commissionRate = currentStoreData.expand.store_settings[0].store_commission_rate;
    }
    
    commissionElement.textContent = `${commissionRate}%`;
}

// Actualizar UI con datos de la tienda
function updateStoreUI() {
    if (!currentStoreData) return;
    
    // Nombre de la tienda
    const storeNameElements = document.querySelectorAll('[id*="store-name"]');
    storeNameElements.forEach(element => {
        element.textContent = currentStoreData.name;
    });
    
    // Logo de la tienda
    const storeLogoElements = document.querySelectorAll('[id*="store-logo"]');
    storeLogoElements.forEach(element => {
        if (currentStoreData.expand?.store_settings?.[0]?.store_logo) {
            element.src = PATI_CONFIG.pb.getFileUrl(
                currentStoreData.expand.store_settings[0], 
                currentStoreData.expand.store_settings[0].store_logo
            );
        }
    });
    
    // Actualizar enlace de regreso
    const backButton = document.getElementById('back-to-store');
    if (backButton) {
        backButton.href = `tienda.html?id=${currentStoreData.id}`;
    }
}

// Cargar productos relacionados
async function loadRelatedProducts(storeId, excludeProductId) {
    try {
        const relatedContainer = document.getElementById('related-products');
        if (!relatedContainer) return;
        
        // Obtener productos de la misma tienda (excluyendo el actual)
        const products = await PATI_CONFIG.pb.collection('products').getList(1, 4, {
            filter: `store="${storeId}" && id!="${excludeProductId}"`,
            sort: '-created'
        });
        
        relatedContainer.innerHTML = '';
        
        if (products.items.length === 0) {
            relatedContainer.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-500">
                    No hay productos relacionados disponibles
                </div>
            `;
            return;
        }
        
        // Crear cards para productos relacionados
        products.items.forEach(product => {
            const productCard = createRelatedProductCard(product);
            relatedContainer.appendChild(productCard);
        });
        
    } catch (error) {
        console.error('Error cargando productos relacionados:', error);
    }
}

// Crear card de producto relacionado
function createRelatedProductCard(product) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer';
    card.onclick = () => openProduct(product.id);
    
    // Obtener primera imagen
    const productImage = product.images && product.images.length > 0 
        ? PATI_CONFIG.pb.getFileUrl(product, product.images[0])
        : 'https://via.placeholder.com/300x200?text=Producto';
    
    const price = product.price_base || 0;
    const currency = product.currency || 'USD';
    const currencySymbol = currency === 'USD' ? '$' : 'CUP $';
    
    card.innerHTML = `
        <div class="relative">
            <img src="${productImage}" 
                 alt="${product.name}" 
                 class="w-full h-48 object-cover">
            <div class="absolute bottom-2 right-2 bg-[#8B4513] text-white px-2 py-1 rounded text-sm font-bold">
                ${currencySymbol} ${price.toFixed(2)}
            </div>
        </div>
        <div class="p-4">
            <h4 class="font-bold text-gray-800 mb-2 line-clamp-2">${product.name}</h4>
            <p class="text-gray-600 text-sm line-clamp-2">${product.description || ''}</p>
        </div>
    `;
    
    return card;
}

// Inicializar Swiper
let gallerySwiper;
let thumbnailSwiper;

function initSwiper() {
    gallerySwiper = new Swiper('.product-gallery', {
        spaceBetween: 10,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        thumbs: {
            swiper: thumbnailSwiper,
        },
    });
    
    thumbnailSwiper = new Swiper('.thumbnails', {
        spaceBetween: 10,
        slidesPerView: 4,
        freeMode: true,
        watchSlidesProgress: true,
    });
    
    gallerySwiper.controller.control = thumbnailSwiper;
    thumbnailSwiper.controller.control = gallerySwiper;
}

// Configurar event listeners
function setupEventListeners() {
    // Selector de moneda
    document.querySelectorAll('.currency-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.currency-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            selectedCurrency = this.dataset.currency;
            updatePrices();
        });
    });
    
    // Selector de cantidad
    document.getElementById('decrease-qty')?.addEventListener('click', () => {
        const quantityInput = document.getElementById('product-quantity');
        let value = parseInt(quantityInput.value) || 1;
        if (value > 1) {
            quantityInput.value = value - 1;
            selectedQuantity = quantityInput.value;
        }
    });
    
    document.getElementById('increase-qty')?.addEventListener('click', () => {
        const quantityInput = document.getElementById('product-quantity');
        let value = parseInt(quantityInput.value) || 1;
        const maxStock = currentProduct?.stock || 100;
        if (value < maxStock) {
            quantityInput.value = value + 1;
            selectedQuantity = quantityInput.value;
        }
    });
    
    document.getElementById('product-quantity')?.addEventListener('change', function() {
        let value = parseInt(this.value) || 1;
        const maxStock = currentProduct?.stock || 100;
        if (value < 1) value = 1;
        if (value > maxStock) value = maxStock;
        this.value = value;
        selectedQuantity = value;
    });
    
    // Botón Añadir al Carrito
    document.getElementById('add-to-cart-btn')?.addEventListener('click', addToCart);
    
    // Botón Comprar Ahora
    document.getElementById('buy-now-btn')?.addEventListener('click', buyNow);
    
    // Botón Ver Tienda
    const viewStoreBtn = document.querySelector('[onclick="viewStore()"]');
    if (viewStoreBtn) {
        viewStoreBtn.onclick = viewStore;
    }
    
    // FAQs toggle
    document.querySelectorAll('.faq-item').forEach(item => {
        const header = item.querySelector('.cursor-pointer');
        const content = item.querySelector('p');
        
        if (header && content) {
            header.addEventListener('click', () => {
                content.classList.toggle('hidden');
                const icon = header.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            });
        }
    });
}

// Funciones de acción
function addToCart() {
    if (!currentProduct) return;
    
    const quantity = selectedQuantity;
    const currency = selectedCurrency;
    
    // Usar el sistema de carrito global
    const success = cart.addItem(currentProduct, quantity, currency);
    
    if (success) {
        // Cerrar cualquier modal de carrito abierto
        cart.closeCartModal();
        
        // Opcional: abrir el modal del carrito
        setTimeout(() => {
            cart.openCartModal();
        }, 500);
    }
}

function buyNow() {
    if (!currentProduct) return;
    
    // Añadir al carrito y redirigir a checkout
    addToCart();
    
    // TODO: Redirigir a página de checkout
    showToast('Redirigiendo a checkout...', 'info');
    setTimeout(() => {
        // window.location.href = 'checkout.html';
    }, 1000);
}

function viewStore() {
    if (!currentStoreData) return;
    window.location.href = `tienda.html?id=${currentStoreData.id}`;
}

function openProduct(productId) {
    window.location.href = `producto.html?id=${productId}`;
}

// Utilidades
function showToast(message, type = 'info') {
    // Crear toast
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`;
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function updateCartCount() {
    const cartCountElements = document.querySelectorAll('.cart-count');
    if (cartCountElements.length > 0) {
        const cart = JSON.parse(localStorage.getItem('pati_cart') || '[]');
        const count = cart.reduce((total, item) => total + item.quantity, 0);
        
        cartCountElements.forEach(element => {
            element.textContent = count;
            element.classList.toggle('hidden', count === 0);
        });
    }
}

function showError(message) {
    const main = document.querySelector('main');
    if (main) {
        main.innerHTML = `
            <div class="container mx-auto px-4 py-16 text-center">
                <i class="fas fa-exclamation-triangle text-red-500 text-5xl mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Error al cargar el producto</h2>
                <p class="text-gray-600 mb-6">${message}</p>
                <a href="index.html" class="bg-[#8B4513] text-white px-6 py-3 rounded-lg font-bold">
                    Volver al Inicio
                </a>
            </div>
        `;
    }
}

function redirectToHome() {
    window.location.href = 'index.html';
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initProductPage);