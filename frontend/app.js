// ====== CONFIGURACIÓN INICIAL ======
// pb ya está definido globalmente desde index.html
// Asegurarnos de que PB_URL está definida
if (typeof PB_URL === 'undefined') {
    console.warn('PB_URL no definida, usando valor por defecto');
    window.PB_URL = 'https://pati-platform.onrender.com';
}

// Verificar que pb existe
if (typeof pb === 'undefined') {
    console.error('ERROR: PocketBase no está inicializado. Creando instancia...');
    window.pb = new PocketBase(PB_URL);
}

console.log('Conectando a PocketBase:', PB_URL);

// Instancia única de PocketBase
pb.autoCancellation(false);

// Variables globales (sin redeclarar si ya existen)
if (typeof currentUser === 'undefined') window.currentUser = null;
if (typeof currentStoreId === 'undefined') window.currentStoreId = null;
if (typeof currentStored === 'undefined') window.currentStored = null;
if (typeof currentStore === 'undefined') window.currentStore = null;
if (typeof cart === 'undefined') window.cart = [];
if (typeof stores === 'undefined') window.stores = []; // Cache local de tiendas
if (typeof categories === 'undefined') window.categories = []; // Cache local de categorías
if (typeof products === 'undefined') window.products = []; // Cache local de productos

// ====== FUNCIONES DE AUTENTICACIÓN ======
async function checkAuth() {
    try {
        if (pb.authStore.isValid) {
            currentUser = pb.authStore.model;
            updateUIForLoggedInUser();
            console.log('Usuario autenticado:', currentUser.email);
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
    }
}

function updateUIForLoggedInUser() {
    const authButtons = document.getElementById('authButtons');
    const logoutButton = document.getElementById('logoutButton');
    
    if (currentUser) {
        authButtons.classList.add('d-none');
        logoutButton.classList.remove('d-none');
    } else {
        authButtons.classList.remove('d-none');
        logoutButton.classList.add('d-none');
    }
}

async function userLogin(email, password, role, storeId) {
    try {
        // 1. Autenticar con PocketBase
        const authData = await pb.collection('users').authWithPassword(email, password);
        currentUser = authData.record;
        
        // 2. Verificar rol
        if (currentUser.role !== role) {
            alert(`Tu cuenta no tiene el rol de "${role}". Tu rol es: ${currentUser.role}`);
            pb.authStore.clear();
            currentUser = null;
            return { success: false };
        }
        
        // 3. Guardar storeId si existe
        if (storeId) currentStoreId = storeId;
        
        // 4. Actualizar UI
        updateUIForLoggedInUser();
        
        // 5. Cerrar modal y redirigir
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (loginModal) loginModal.hide();
        
        if (['admin', 'propietario', 'dependiente'].includes(role)) {
            document.getElementById('mainContent').classList.add('d-none');
            document.getElementById('adminPanel').classList.remove('d-none');
            loadAdminData();
            showNotification(`Has iniciado sesión como ${role}`);
        } else {
            showSection('products');
            showNotification('Has iniciado sesión correctamente');
        }
        
        return { success: true, user: currentUser };
        
    } catch (error) {
        console.error('Error en login:', error);
        alert('Credenciales incorrectas o error de conexión. Verifica tu email y contraseña.');
        return { success: false, error: error.message };
    }
}

function logout() {
    pb.authStore.clear();
    currentUser = null;
    currentStoreId = null;
    cart = [];
    updateCart();
    updateUIForLoggedInUser();
    
    document.getElementById('mainContent').classList.remove('d-none');
    document.getElementById('adminPanel').classList.add('d-none');
    
    showSection('home');
    showNotification('Has cerrado sesión correctamente');
}

async function userRegister(userData) {
    try {
        // Preparar datos para PocketBase
        const recordData = {
            "username": userData.email,
            "email": userData.email,
            "emailVisibility": true,
            "password": userData.password,
            "passwordConfirm": userData.password,
            "role": userData.role,
            "profile": JSON.stringify({
                "nombre": userData.name,
                "telefono": userData.phone,
                "direccion": userData.address
            })
        };
        
        // Añadir campos específicos de afiliado
        if (userData.role === 'affiliate') {
            const profileObj = JSON.parse(recordData.profile);
            profileObj.tarjetaUSD = userData.affiliateCardUSD || '';
            profileObj.tarjetaCUP = userData.affiliateCardCUP || '';
            recordData.profile = JSON.stringify(profileObj);
        }
        
        // Crear usuario
        const record = await pb.collection('users').create(recordData);
        
        // Iniciar sesión automáticamente
        await userLogin(userData.email, userData.password, userData.role, userData.storeId);
        
        return { success: true, user: record };
        
    } catch (error) {
        console.error('Error en registro:', error);
        alert('Error creando la cuenta: ' + error.message);
        return { success: false, error: error.message };
    }
}

// ====== FUNCIONES DE CARGA INICIAL ======
async function loadInitialData() {
    try {
        console.log('📦 Cargando datos iniciales...');
        
        // 1. CARGAR CATEGORÍAS PRIMERO (generalmente públicas)
        try {
            const categoriesResult = await pb.collection('categories').getFullList({
                sort: 'name'
            });
            categories = categoriesResult;
            console.log(`✅ Categorías cargadas: ${categories.length}`);
        } catch (catError) {
            console.warn('⚠️ No se pudieron cargar categorías:', catError.message);
            categories = [
                { id: 'C001', name: 'Electrónica' },
                { id: 'C002', name: 'Hogar' },
                { id: 'C003', name: 'Ropa' },
                { id: 'C004', name: 'Deportes' }
            ];
        }
        
        // 2. CARGAR TIENDAS con filtro más permisivo
        try {
            // Intenta primero con filtro que no requiera superusuario
            stores = await pb.collection('stores').getFullList({
                filter: 'active = true',
                sort: '-created'
            });
            
            // Si falla, intenta sin filtro
            if (stores.length === 0) {
                stores = await pb.collection('stores').getFullList({
                    sort: '-created'
                });
            }
            
            console.log(`✅ Tiendas cargadas: ${stores.length}`);
        } catch (storeError) {
            console.warn('⚠️ No se pudieron cargar tiendas:', storeError.message);
            
            // Verifica si es error de permisos (403)
            if (storeError.status === 403) {
                console.log('🔐 Acceso denegado a tiendas - usando datos de demostración');
                stores = [
                    { 
                        id: 'demo1', 
                        name: "TechZone", 
                        category: "C001", 
                        status: "active", 
                        image: "https://images.unsplash.com/photo-1561154464-82e9adf32764?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", 
                        description: "La mejor tecnología en electrónica",
                        active: true
                    },
                    { 
                        id: 'demo2', 
                        name: "HomeStyle", 
                        category: "C002", 
                        status: "active", 
                        image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", 
                        description: "Todo para tu hogar",
                        active: true
                    }
                ];
            }
        }
        
        // 3. CARGAR PRODUCTOS con manejo de errores específico
        try {
            // Primero intenta con filtro básico
            products = await pb.collection('products').getFullList({
                filter: 'available = true',
                sort: '-created',
                limit: 50
            });
            
            console.log(`✅ Productos cargados: ${products.length}`);
            
        } catch (productError) {
            console.warn('⚠️ No se pudieron cargar productos:', productError.message);
            
            // Datos de demostración si hay error
            products = [
                { 
                    id: 'prod1', 
                    name: "Smartphone X10", 
                    store: "demo1", 
                    category: "C001", 
                    price1: 299.99, 
                    price2: 279.99, 
                    price3: 259.99, 
                    stock: 100, 
                    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", 
                    description: "Último modelo con cámara 108MP",
                    available: true
                },
                { 
                    id: 'prod2', 
                    name: "Sofá Moderno", 
                    store: "demo2", 
                    category: "C002", 
                    price1: 499.99, 
                    price2: 449.99, 
                    price3: 399.99, 
                    stock: 50, 
                    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", 
                    description: "Sofá ergonómico de 3 plazas",
                    available: true
                }
            ];
        }
        
        console.log('✅ Datos iniciales cargados:', { 
            stores: stores?.length || 0, 
            categories: categories?.length || 0,
            products: products?.length || 0 
        });
        
        return { stores, categories, products };
        
    } catch (error) {
        console.error('❌ Error general en loadInitialData:', error);
        
        // Fallback completo si todo falla
        return {
            stores: [
                { 
                    id: 'demo1', 
                    name: "Tienda Demo", 
                    category: "C001", 
                    status: "active", 
                    image: "https://images.unsplash.com/photo-1561154464-82e9adf32764?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", 
                    description: "Tienda de demostración",
                    active: true
                }
            ],
            categories: [
                { id: 'C001', name: 'Electrónica' },
                { id: 'C002', name: 'Hogar' }
            ],
            products: [
                { 
                    id: 'prod1', 
                    name: "Producto Demo", 
                    store: "demo1", 
                    category: "C001", 
                    price1: 29.99, 
                    price2: 27.99, 
                    price3: 25.99, 
                    stock: 100, 
                    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", 
                    description: "Descripción de producto demo",
                    available: true
                }
            ]
        };
    }
}

async function loadFeaturedStores() {
    const featuredStores = document.getElementById('featuredStores');
    if (!featuredStores) return;
    
    featuredStores.innerHTML = '';
    
    const featured = stores.slice(0, 4);
    
    if (featured.length === 0) {
        featuredStores.innerHTML = '<div class="col-12 text-center"><p>No hay tiendas destacadas</p></div>';
        return;
    }
    
    featured.forEach(store => {
        const storeCard = `
            <div class="col-md-6 col-lg-3 mb-4">
                <div class="card store-card h-100">
                    <img src="${store.image || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}" 
                         class="card-img-top" alt="${store.name}" style="height: 180px; object-fit: cover;">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${store.name}</h5>
                        <p class="card-text flex-grow-1">${store.description || 'Sin descripción'}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="store-status ${store.status === 'active' ? 'status-active' : 'status-inactive'}">
                                ${store.status === 'active' ? 'Activo' : 'Inactivo'}
                            </span>
                            <button class="btn btn-primary" onclick="showStoreLogin('${store.id}')">
                                <i class="fas fa-sign-in-alt"></i> Entrar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        featuredStores.innerHTML += storeCard;
    });
}

// ====== FUNCIONES DE PRODUCTOS ======
async function loadProducts(storeId = null) {
    try {
        const productsList = document.getElementById('productsList');
        if (!productsList) return;
        
        productsList.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-primary"></div><p>Cargando productos...</p></div>';
        
        // Construir filtros
        let filter = '';
        if (currentStoreId) {
            filter = `store = "${currentStoreId}"`;
        }
        
        // Obtener productos desde cache o API
        let productsToShow = products;
        if (filter) {
            productsToShow = products.filter(p => p.store === currentStoreId);
        }
        
        productsList.innerHTML = '';
        
        if (productsToShow.length === 0) {
            productsList.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
                    <h4>No hay productos disponibles</h4>
                    <p>Pronto agregaremos nuevos productos.</p>
                </div>
            `;
            return;
        }
        
        productsToShow.forEach(product => {
            const store = stores.find(s => s.id === product.store);
            const category = categories.find(c => c.id === product.category);
            const storeName = store ? store.name : 'Sin tienda';
            const categoryName = category ? category.name : 'Sin categoría';
            
            const productCard = `
                <div class="col-md-6 col-lg-4 col-xl-3 mb-4">
                    <div class="card product-card h-100">
                        <span class="category-badge badge bg-primary">${categoryName}</span>
                        <img src="${product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}" 
                             class="card-img-top product-image" alt="${product.name}">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${product.name}</h5>
                            <p class="card-text flex-grow-1">${product.description || 'Sin descripción'}</p>
                            <div class="price-tier">
                                <span>1-10: </span><span>$${product.price1?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div class="price-tier">
                                <span>11-50: </span><span>$${product.price2?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div class="price-tier">
                                <span>51+: </span><span>$${product.price3?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div class="quantity-control">
                                <button type="button" onclick="decreaseQuantity('${product.id}')">-</button>
                                <input type="number" id="quantity-${product.id}" value="0" min="0" readonly>
                                <button type="button" onclick="increaseQuantity('${product.id}')">+</button>
                            </div>
                            <button class="btn btn-primary mt-2 w-100" onclick="addToCart('${product.id}')">
                                <i class="fas fa-cart-plus"></i> Agregar
                            </button>
                        </div>
                    </div>
                </div>
            `;
            productsList.innerHTML += productCard;
        });
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        const productsList = document.getElementById('productsList');
        if (productsList) {
            productsList.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <h4>Error cargando productos</h4>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

function filterProductsAdvanced() {
    const searchText = document.getElementById('searchProduct')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const storeFilter = document.getElementById('storeFilter')?.value || '';
    const priceMin = parseFloat(document.getElementById('priceMin')?.value) || 0;
    const priceMax = parseFloat(document.getElementById('priceMax')?.value) || Infinity;
    
    const productsList = document.getElementById('productsList');
    if (!productsList) return;
    
    productsList.innerHTML = '';
    
    const filteredProducts = products.filter(product => {
        // Filtro por texto de búsqueda
        const matchesSearch = searchText === '' || 
                            product.name.toLowerCase().includes(searchText) || 
                            (product.description || '').toLowerCase().includes(searchText);
        
        // Filtro por categoría
        const matchesCategory = categoryFilter === '' || product.category === categoryFilter;
        
        // Filtro por tienda
        const matchesStore = storeFilter === '' || product.store === storeFilter;
        
        // Filtro por rango de precios
        const productPrice = product.price1 || 0;
        const matchesPrice = productPrice >= priceMin && productPrice <= priceMax;
        
        return matchesSearch && matchesCategory && matchesStore && matchesPrice;
    });
    
    if (filteredProducts.length === 0) {
        productsList.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-search fa-3x text-muted mb-3"></i>
                <h4>No se encontraron productos</h4>
                <p>Intenta con otros filtros de búsqueda</p>
            </div>
        `;
        return;
    }
    
    filteredProducts.forEach(product => {
        const store = stores.find(s => s.id === product.store);
        const category = categories.find(c => c.id === product.category);
        const storeName = store ? store.name : 'Sin tienda';
        const categoryName = category ? category.name : 'Sin categoría';
        
        const productCard = `
            <div class="col-md-6 col-lg-4 col-xl-3 mb-4">
                <div class="card product-card h-100">
                    <span class="category-badge badge bg-primary">${categoryName}</span>
                    <img src="${product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}" 
                         class="card-img-top product-image" alt="${product.name}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${product.name}</h5>
                        <p class="card-text flex-grow-1">${product.description || 'Sin descripción'}</p>
                        <div class="price-tier">
                            <span>1-10: </span><span>$${product.price1?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div class="price-tier">
                            <span>11-50: </span><span>$${product.price2?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div class="price-tier">
                            <span>51+: </span><span>$${product.price3?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div class="quantity-control">
                            <button type="button" onclick="decreaseQuantity('${product.id}')">-</button>
                            <input type="number" id="quantity-${product.id}" value="0" min="0" readonly>
                            <button type="button" onclick="increaseQuantity('${product.id}')">+</button>
                        </div>
                        <button class="btn btn-primary mt-2 w-100" onclick="addToCart('${product.id}')">
                            <i class="fas fa-cart-plus"></i> Agregar
                        </button>
                    </div>
                </div>
            </div>
        `;
        productsList.innerHTML += productCard;
    });
}

// ====== FUNCIONES DEL CARRITO ======
function increaseQuantity(productId) {
    const quantityInput = document.getElementById(`quantity-${productId}`);
    if (quantityInput) {
        quantityInput.value = parseInt(quantityInput.value) + 1;
    }
}

function decreaseQuantity(productId) {
    const quantityInput = document.getElementById(`quantity-${productId}`);
    if (quantityInput && parseInt(quantityInput.value) > 0) {
        quantityInput.value = parseInt(quantityInput.value) - 1;
    }
}

async function addToCart(productId) {
    try {
        const quantityInput = document.getElementById(`quantity-${productId}`);
        const quantity = parseInt(quantityInput?.value || 0);
        
        if (!quantity || quantity <= 0) {
            alert('Por favor, selecciona una cantidad mayor a cero');
            return;
        }
        
        // Buscar producto en cache
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            alert('Producto no encontrado');
            return;
        }
        
        // Calcular precio según cantidad
        let unitPrice = product.price1;
        if (quantity >= 51) {
            unitPrice = product.price3;
        } else if (quantity >= 11) {
            unitPrice = product.price2;
        }
        
        // Agregar al carrito
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.unitPrice = unitPrice;
        } else {
            const store = stores.find(s => s.id === product.store);
            cart.push({
                id: product.id,
                name: product.name,
                unitPrice: unitPrice,
                quantity: quantity,
                storeId: product.store,
                storeName: store ? store.name : 'Sin tienda',
                image: product.image
            });
        }
        
        // Resetear cantidad y actualizar carrito
        if (quantityInput) quantityInput.value = 0;
        updateCart();
        showNotification(`${product.name} agregado al carrito`);
        
    } catch (error) {
        console.error('Error agregando al carrito:', error);
        alert('Error al agregar el producto al carrito');
    }
}

function updateCart() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    
    if (!cartCount || !cartItems || !cartTotal) return;
    
    // Actualizar contador
    cartCount.textContent = cart.reduce((total, item) => total + item.quantity, 0);
    
    // Actualizar lista
    cartItems.innerHTML = '';
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.unitPrice * item.quantity;
        total += itemTotal;
        
        const cartItem = `
            <div class="card mb-2">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h6 class="my-0">${item.name}</h6>
                            <small class="text-muted">${item.storeName}</small><br>
                            <small class="text-muted">$${item.unitPrice.toFixed(2)} x ${item.quantity}</small>
                        </div>
                        <div class="d-flex align-items-center">
                            <span class="text-muted">$${itemTotal.toFixed(2)}</span>
                            <button class="btn btn-sm btn-outline-danger ms-2" onclick="removeFromCart('${item.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        cartItems.innerHTML += cartItem;
    });
    
    // Actualizar total
    cartTotal.textContent = `$${total.toFixed(2)}`;
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    showNotification('Producto eliminado del carrito');
}

function checkout() {
    if (cart.length === 0) {
        alert('Tu carrito está vacío');
        return;
    }
    
    if (!currentUser) {
        alert('Debes iniciar sesión para realizar un pedido');
        showLoginForm('customer');
        return;
    }
    
    alert('¡Pedido realizado con éxito! (Función checkout en desarrollo)');
    cart = [];
    updateCart();
    
    const offcanvas = document.getElementById('cartOffcanvas');
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas);
    if (bsOffcanvas) bsOffcanvas.hide();
}

// ====== FUNCIONES DE TIENDAS ======
async function loadStores() {
    try {
        const storesList = document.getElementById('storesList');
        if (!storesList) return;
        
        storesList.innerHTML = '';
        
        stores.forEach(store => {
            const category = categories.find(c => c.id === store.category);
            const categoryName = category ? category.name : 'Sin categoría';
            
            const storeCard = `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card store-card h-100">
                        <img src="${store.image || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}" 
                             class="card-img-top" alt="${store.name}" style="height: 180px; object-fit: cover;">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${store.name}</h5>
                            <p class="card-text flex-grow-1">${store.description || 'Sin descripción'}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="store-status ${store.status === 'active' ? 'status-active' : 'status-inactive'}">
                                    ${store.status === 'active' ? 'Activo' : 'Inactivo'}
                                </span>
                                <button class="btn btn-primary" onclick="showStoreLogin('${store.id}')">
                                    <i class="fas fa-sign-in-alt"></i> Entrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            storesList.innerHTML += storeCard;
        });
        
    } catch (error) {
        console.error('Error cargando tiendas:', error);
    }
}

// ====== FUNCIONES DE UI ======
function showSection(section) {
    // Ocultar todas las secciones
    const sections = ['home', 'products', 'about', 'contact', 'storeSelection', 'createStore', 'storeLogin'];
    sections.forEach(sec => {
        const el = document.getElementById(sec + 'Section');
        if (el) el.style.display = 'none';
    });
    
    // Mostrar sección seleccionada
    const sectionElement = document.getElementById(section + 'Section');
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    
    // Acciones específicas por sección
    if (section === 'products') {
        loadProducts();
        // Configurar filtro de tiendas
        const storeFilterContainer = document.getElementById('storeFilterContainer');
        const storeFilter = document.getElementById('storeFilter');
        
        if (storeFilterContainer && storeFilter) {
            if (currentStoreId) {
                // Estamos en una tienda específica
                storeFilterContainer.style.display = 'none';
            } else {
                // Estamos en la plataforma principal
                storeFilterContainer.style.display = 'block';
                
                // Llenar filtro de tiendas
                storeFilter.innerHTML = '<option value="">Todas las tiendas</option>';
                stores.forEach(store => {
                    if (store.status === 'active') {
                        const option = document.createElement('option');
                        option.value = store.id;
                        option.textContent = store.name;
                        storeFilter.appendChild(option);
                    }
                });
            }
        }
    } else if (section === 'storeSelection') {
        loadStores();
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `position-fixed bottom-0 end-0 m-3 alert alert-${type} alert-dismissible fade show`;
    notification.style.zIndex = '1050';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// ====== SETUP DE EVENT LISTENERS ======
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const role = document.getElementById('loginRole').value;
            const storeId = document.getElementById('loginStoreId').value;
            
            await userLogin(email, password, role, storeId);
        });
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const userData = {
                name: document.getElementById('registerName').value,
                email: document.getElementById('registerEmail').value,
                password: document.getElementById('registerPassword').value,
                confirmPassword: document.getElementById('registerConfirmPassword').value,
                role: document.getElementById('registerRole').value,
                phone: document.getElementById('registerPhone').value,
                address: document.getElementById('registerAddress').value,
                storeId: document.getElementById('registerStoreId').value,
                affiliateCardUSD: document.getElementById('affiliateCardUSD')?.value || '',
                affiliateCardCUP: document.getElementById('affiliateCardCUP')?.value || ''
            };
            
            if (userData.password !== userData.confirmPassword) {
                alert('Las contraseñas no coinciden');
                return;
            }
            
            await userRegister(userData);
        });
    }
}

// ====== INICIALIZACIÓN ======
function initializeApp() {
    console.log('App iniciada, conectando a:', PB_URL);
    checkAuth();
    loadInitialData();
    setupEventListeners();
    
    // Inicializar carrito
    updateCart();
    
    // Cargar tiendas destacadas
    loadFeaturedStores();
}

// ====== FUNCIONES GLOBALES (para onclick en HTML) ======
window.showSection = showSection;
window.showStoreSelection = function() {
    console.log('Mostrando selección de tienda');
    showSection('storeSelection');
};
window.showCreateStoreForm = function() {
    console.log('Mostrando formulario de tienda');
    showSection('createStore');
};
window.showStoreLogin = function(storeId) {
    currentStoreId = storeId;
    const store = stores.find(s => s.id === storeId);
    if (store) {
        const storeLoginNameElement = document.getElementById('storeLoginName');
        if (storeLoginNameElement) {
            storeLoginNameElement.textContent = store.name;
        }
    }
    showSection('storeLogin');
};
window.showLoginForm = function(role = 'customer') {
    document.getElementById('loginRole').value = role;
    document.getElementById('loginStoreId').value = currentStoreId || '';
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
};
window.showRegisterForm = function(role = 'customer') {
    document.getElementById('registerRole').value = role;
    document.getElementById('registerStoreId').value = currentStoreId || '';
    
    const affiliateFields = document.getElementById('affiliateFields');
    if (affiliateFields) {
        affiliateFields.style.display = role === 'affiliate' ? 'block' : 'none';
    }
    
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    registerModal.show();
};
window.showAdminLogin = function() {
    console.log('Mostrando login admin');
    const adminLoginModal = document.getElementById('adminLoginModal');
    if (adminLoginModal) {
        const modal = new bootstrap.Modal(adminLoginModal);
        modal.show();
    }
};
window.loginAsOwner = function() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    
    if (username === 'propietario' && password === 'propietario123') {
        userLogin('propietario@pati.com', 'propietario123', 'propietario', null);
    } else {
        alert('Credenciales incorrectas. Usa: propietario / propietario123');
    }
};
window.logout = logout;
window.increaseQuantity = increaseQuantity;
window.decreaseQuantity = decreaseQuantity;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.checkout = checkout;
window.filterProductsAdvanced = filterProductsAdvanced;
window.loadProducts = loadProducts;
window.filterStores = function() {
    // Función temporal
    console.log('Filtrando tiendas...');
};

// ====== INICIALIZAR APP ======
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

console.log('app.js cargado correctamente');