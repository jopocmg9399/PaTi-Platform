// ====== CONFIGURACIÓN INICIAL ======
const PB_URL = 'https://pati-platform.onrender.com';
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

console.log('Conectando a PocketBase:', PB_URL);

// Variables globales
let currentUser = null;
let currentStoreId = null;
let cart = [];
let stores = []; // Cache local de tiendas
let categories = []; // Cache local de categorías
let products = []; // Cache local de productos

// Agrega esto ANTES de cargar datos:
async function initApp() {
  try {
    // Autenticar
    await pb.collection('users').authWithPassword(
      'propietario@ejemplo.com',
      'propietario123'
    );
    
    // Ahora cargar datos
    const products = await loadInitialData();
    console.log('Productos:', products);
    
    // Renderizar en la página...
  } catch (error) {
    console.error('Error iniciando app:', error);
  }
}

// Ejecutar
initApp();

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada, conectando a:', PB_URL);
    checkAuth();
    loadInitialData();
    setupEventListeners();
    
    // Si estamos en la página principal, cargar tiendas destacadas
    if (document.getElementById('featuredStores')) {
        loadFeaturedStores();
    }
});

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
        if (authButtons) authButtons.classList.add('d-none');
        if (logoutButton) logoutButton.classList.remove('d-none');
    } else {
        if (authButtons) authButtons.classList.remove('d-none');
        if (logoutButton) logoutButton.classList.add('d-none');
    }
}

async function userLogin(email, password, role, storeId) {
    try {
        // 1. Autenticar con PocketBase
        const authData = await pb.collection('users').authWithPassword(email, password);
        currentUser = authData.record;
        
        // 2. Verificar rol
        if (role && currentUser.role !== role) {
            alert(`Tu cuenta no tiene el rol de "${role}". Tu rol es: ${currentUser.role}`);
            pb.authStore.clear();
            currentUser = null;
            return { success: false };
        }
        
        // 3. Guardar storeId si existe
        if (storeId) currentStoreId = storeId;
        
        // 4. Actualizar UI
        updateUIForLoggedInUser();
        
        // 5. Cerrar modal
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (loginModal) loginModal.hide();
        
        // 6. Redirigir según rol
        if (['admin', 'propietario', 'dependiente'].includes(currentUser.role)) {
            document.getElementById('mainContent').classList.add('d-none');
            document.getElementById('adminPanel').classList.remove('d-none');
            loadAdminData();
            showNotification(`Has iniciado sesión como ${currentUser.role}`);
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
    
    if (document.getElementById('mainContent')) {
        document.getElementById('mainContent').classList.remove('d-none');
    }
    if (document.getElementById('adminPanel')) {
        document.getElementById('adminPanel').classList.add('d-none');
    }
    
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
// REEMPLAZA lo que tienes actualmente con ESTO:
async function loadInitialData() {
  try {
    console.log('🔐 Intentando autenticar...');
    
    // 1. AUTENTICAR con el usuario que SÍ existe
    const authData = await pb.collection('users').authWithPassword(
      'propietario',          // ← USUARIO/EMAIL (probablemente 'propietario' o 'propietario@pati.com')
      'propietario123'        // ← CONTRASEÑA
    );
    
    console.log('✅ Autenticado como:', authData.record);
    
    // 2. AHORA cargar productos
    console.log('📦 Cargando productos...');
    const products = await pb.collection('products').getFullList({
      sort: '-created'
    });
    
    console.log(`✅ ${products.length} productos cargados`);
    return products;
    
  } catch (error) {
    console.error('❌ Error en loadInitialData:', error);
    
    // Información de diagnóstico:
    console.log('🔍 Estado de autenticación:', pb.authStore.isValid);
    console.log('🔍 Token:', pb.authStore.token);
    
    return []; // Retorna array vacío en lugar de fallar
  }
}

// ====== FUNCIONES DE PRODUCTOS ======
async function loadProducts() {
    try {
        const productsList = document.getElementById('productsList');
        if (!productsList) return;
        
        productsList.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-primary"></div><p>Cargando productos...</p></div>';
        
        // Si no hay productos cargados, cargarlos
        if (products.length === 0) {
            products = await pb.collection('products').getFullList({
                expand: 'store,category',
                sort: '-created'
            });
        }
        
        // Construir filtros si hay storeId
        let filteredProducts = products;
        if (currentStoreId) {
            filteredProducts = products.filter(p => p.store === currentStoreId);
        }
        
        displayProducts(filteredProducts);
        
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

function displayProducts(productsToShow) {
    const productsList = document.getElementById('productsList');
    if (!productsList) return;
    
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
        const storeName = product.expand?.store?.name || 'Sin tienda';
        const categoryName = product.expand?.category?.name || 'Sin categoría';
        
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

function filterProductsAdvanced() {
    const searchText = document.getElementById('searchProduct')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const storeFilter = document.getElementById('storeFilter')?.value || '';
    const priceMin = parseFloat(document.getElementById('priceMin')?.value) || 0;
    const priceMax = parseFloat(document.getElementById('priceMax')?.value) || Infinity;
    
    let filteredProducts = products;
    
    // Aplicar filtros
    if (searchText) {
        filteredProducts = filteredProducts.filter(p => 
            p.name.toLowerCase().includes(searchText) || 
            (p.description && p.description.toLowerCase().includes(searchText))
        );
    }
    
    if (categoryFilter) {
        filteredProducts = filteredProducts.filter(p => p.category === categoryFilter);
    }
    
    if (storeFilter) {
        filteredProducts = filteredProducts.filter(p => p.store === storeFilter);
    }
    
    if (priceMin > 0 || priceMax < Infinity) {
        filteredProducts = filteredProducts.filter(p => {
            const price = p.price1 || 0;
            return price >= priceMin && price <= priceMax;
        });
    }
    
    displayProducts(filteredProducts);
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
        const quantity = parseInt(quantityInput.value);
        
        if (!quantity || quantity <= 0) {
            alert('Por favor, selecciona una cantidad mayor a cero');
            return;
        }
        
        // Buscar producto en cache o cargarlo
        let product = products.find(p => p.id === productId);
        if (!product) {
            product = await pb.collection('products').getOne(productId, {
                expand: 'store,category'
            });
        }
        
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
            cart.push({
                id: product.id,
                name: product.name,
                unitPrice: unitPrice,
                quantity: quantity,
                storeId: product.store,
                storeName: product.expand?.store?.name || 'Sin tienda',
                image: product.image
            });
        }
        
        // Resetear cantidad y actualizar carrito
        quantityInput.value = 0;
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
    
    if (cartCount) cartCount.textContent = cart.reduce((total, item) => total + item.quantity, 0);
    if (cartItems) cartItems.innerHTML = '';
    if (cartTotal) cartTotal.textContent = '$0.00';
    
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.unitPrice * item.quantity;
        total += itemTotal;
        
        if (cartItems) {
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
        }
    });
    
    if (cartTotal) cartTotal.textContent = `$${total.toFixed(2)}`;
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    showNotification('Producto eliminado del carrito');
}

// ====== FUNCIONES DE TIENDAS ======
async function loadStores() {
    try {
        const storesList = document.getElementById('storesList');
        if (!storesList) return;
        
        storesList.innerHTML = '';
        
        // Si no hay tiendas cargadas, cargarlas
        if (stores.length === 0) {
            stores = await pb.collection('stores').getFullList({
                filter: 'status = "active"',
                sort: '-created'
            });
        }
        
        stores.forEach(store => {
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

function loadFeaturedStores() {
    const featuredStores = document.getElementById('featuredStores');
    if (!featuredStores) return;
    
    featuredStores.innerHTML = '';
    
    // Tomar las primeras 4 tiendas activas
    const featured = stores.slice(0, 4);
    
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

function filterStores() {
    const searchText = document.getElementById('searchStore')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryStoreFilter')?.value || '';
    
    const storesList = document.getElementById('storesList');
    if (!storesList) return;
    
    storesList.innerHTML = '';
    
    const filteredStores = stores.filter(store => {
        const matchesSearch = store.name.toLowerCase().includes(searchText) || 
                            (store.description && store.description.toLowerCase().includes(searchText));
        const matchesCategory = !categoryFilter || store.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
    
    filteredStores.forEach(store => {
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

// ====== FUNCIONES DE ADMINISTRACIÓN ======
async function loadAdminData() {
    try {
        // Configurar menú según rol
        const isOwner = currentUser && currentUser.role === 'propietario';
        const isAdmin = currentUser && currentUser.role === 'admin';
        const isDependiente = currentUser && currentUser.role === 'dependiente';
        
        const adminMenu = document.getElementById('adminMenu');
        if (adminMenu) {
            if (isOwner) {
                adminMenu.innerHTML = `
                    <div class="admin-menu-item active" onclick="showAdminTab('adminDashboardTab')">
                        <i class="fas fa-tachometer-alt"></i> Dashboard
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminStoresTab')">
                        <i class="fas fa-store"></i> Tiendas
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminCategoriesTab')">
                        <i class="fas fa-tags"></i> Categorías
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminCommissionsTab')">
                        <i class="fas fa-percentage"></i> Comisiones
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminReportsTab')">
                        <i class="fas fa-chart-bar"></i> Informes
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminSettingsTab')">
                        <i class="fas fa-cog"></i> Configuración
                    </div>
                `;
            } else if (isAdmin) {
                adminMenu.innerHTML = `
                    <div class="admin-menu-item active" onclick="showAdminTab('adminDashboardTab')">
                        <i class="fas fa-tachometer-alt"></i> Dashboard
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminProductsTab')">
                        <i class="fas fa-box"></i> Productos
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminCategoriesTab')">
                        <i class="fas fa-tags"></i> Categorías
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminCustomersTab')">
                        <i class="fas fa-users"></i> Clientes
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminAffiliatesTab')">
                        <i class="fas fa-handshake"></i> Afiliados
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminOrdersTab')">
                        <i class="fas fa-shopping-cart"></i> Pedidos
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminReportsTab')">
                        <i class="fas fa-chart-bar"></i> Reportes
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminImportsTab')">
                        <i class="fas fa-file-import"></i> Importar Datos
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminSettingsTab')">
                        <i class="fas fa-cog"></i> Configuración
                    </div>
                `;
            } else if (isDependiente) {
                adminMenu.innerHTML = `
                    <div class="admin-menu-item active" onclick="showAdminTab('adminProductsTab')">
                        <i class="fas fa-box"></i> Productos
                    </div>
                    <div class="admin-menu-item" onclick="showAdminTab('adminOrdersTab')">
                        <i class="fas fa-shopping-cart"></i> Pedidos
                    </div>
                `;
            }
        }
        
        // Mostrar dashboard inicialmente
        showAdminTab('adminDashboardTab');
        
    } catch (error) {
        console.error('Error cargando datos de admin:', error);
    }
}

function showAdminTab(tabId) {
    // Ocultar todas las pestañas
    const tabs = document.querySelectorAll('.admin-tab-content');
    tabs.forEach(tab => {
        if (tab) tab.style.display = 'none';
    });
    
    // Quitar clase active de todos los items del menú
    const menuItems = document.querySelectorAll('.admin-menu-item');
    menuItems.forEach(item => {
        if (item) item.classList.remove('active');
    });
    
    // Mostrar la pestaña seleccionada
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Activar el item del menú correspondiente
    const activeMenuItem = document.querySelector(`[onclick*="${tabId}"]`);
    if (activeMenuItem) {
        activeMenuItem.classList.add('active');
    }
}

function viewSite() {
    if (document.getElementById('adminPanel')) {
        document.getElementById('adminPanel').classList.add('d-none');
    }
    if (document.getElementById('mainContent')) {
        document.getElementById('mainContent').classList.remove('d-none');
    }
    showSection('home');
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

// ====== EXPORTAR FUNCIONES AL ÁMBITO GLOBAL ======
window.showSection = showSection;
window.showStoreSelection = () => showSection('storeSelection');
window.showCreateStoreForm = () => showSection('createStore');
window.showStoreLogin = (storeId) => {
    currentStoreId = storeId;
    const store = stores.find(s => s.id === storeId);
    if (store) {
        const storeLoginName = document.getElementById('storeLoginName');
        if (storeLoginName) {
            storeLoginName.textContent = store.name;
        }
    }
    showSection('storeLogin');
};
window.showLoginForm = (role = 'customer') => {
    const loginRole = document.getElementById('loginRole');
    const loginStoreId = document.getElementById('loginStoreId');
    
    if (loginRole) loginRole.value = role;
    if (loginStoreId) loginStoreId.value = currentStoreId || '';
    
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
};
window.showRegisterForm = (role = 'customer') => {
    const registerRole = document.getElementById('registerRole');
    const registerStoreId = document.getElementById('registerStoreId');
    const affiliateFields = document.getElementById('affiliateFields');
    
    if (registerRole) registerRole.value = role;
    if (registerStoreId) registerStoreId.value = currentStoreId || '';
    
    if (affiliateFields) {
        affiliateFields.style.display = role === 'affiliate' ? 'block' : 'none';
    }
    
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    registerModal.show();
};
window.showAdminLogin = () => {
    const adminLoginModal = document.getElementById('adminLoginModal');
    if (adminLoginModal) {
        const modal = new bootstrap.Modal(adminLoginModal);
        modal.show();
    }
};
window.loginAsOwner = () => {
    const username = document.getElementById('adminUsername')?.value.trim();
    const password = document.getElementById('adminPassword')?.value.trim();
    
    if (username === 'propietario' && password === 'propietario123') {
        // Usar las credenciales reales del usuario propietario en PocketBase
        userLogin('propietario@pati.com', 'propietario123', 'propietario', null);
    } else {
        alert('Credenciales incorrectas. Usa: propietario / propietario123');
    }
};
// ====== EXPORTAR FUNCIONES CON NOMBRES ESPECÍFICOS ======
// Usamos prefijo "app" para diferenciarlas de las funciones "puente"
window.appShowSection = showSection;
window.appShowLoginForm = showLoginForm;
window.appShowRegisterForm = showRegisterForm;
window.appShowStoreSelection = function() { showSection('storeSelection'); };
window.appLoginAsOwner = loginAsOwner;
window.appLogout = logout;
window.appShowStoreLogin = showStoreLogin;

// Funciones del carrito (ya están en window directamente en app.js)
// window.increaseQuantity = increaseQuantity;  // YA DEBE ESTAR
// window.decreaseQuantity = decreaseQuantity;  // YA DEBE ESTAR
// window.addToCart = addToCart;               // YA DEBE ESTAR
// window.removeFromCart = removeFromCart;     // YA DEBE ESTAR
// window.checkout = checkout;                 // YA DEBE ESTAR
// window.filterProductsAdvanced = filterProductsAdvanced; // YA DEBE ESTAR

console.log('Funciones de app.js exportadas correctamente');

// Funciones de admin
window.showAdminTab = showAdminTab;

console.log('app.js cargado correctamente');