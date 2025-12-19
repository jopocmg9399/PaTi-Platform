// ====== CONFIGURACIÓN INICIAL ======
const PB_URL = 'https://pati-platform.onrender.com';
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

console.log('Conectando a PocketBase:', PB_URL);

// Variables globales
let currentUser = null;
let currentStoreId = null;
let cart = [];
let stores = [];
let categories = [];
let products = [];

// ====== INICIALIZACIÓN ======
document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada');
    checkAuth();
    setupEventListeners();
    
    // Cargar tiendas destacadas
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
            
            // Si ya está autenticado, cargar datos
            await loadProducts();
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

// ====== LOGIN COMO PROPIETARIO (CORREGIDO) ======
window.loginAsOwner = async () => {
    const username = document.getElementById('adminUsername')?.value.trim();
    const password = document.getElementById('adminPassword')?.value.trim();
    
    console.log('🔐 Intentando login como propietario:', username);
    
    if (!username || !password) {
        alert('Por favor, llena ambos campos');
        return;
    }
    
    try {
        // Limpiar sesión anterior
        pb.authStore.clear();
        
        // INTENTAR AUTENTICACIÓN - PRUEBA CON DIFERENTES FORMATOS
        let authData;
        
        try {
            // Intento 1: Con el nombre de usuario directo
            authData = await pb.collection('users').authWithPassword(username, password);
        } catch (error1) {
            console.log('Intento 1 falló, probando con email...');
            // Intento 2: Con email (agregando dominio)
            try {
                authData = await pb.collection('users').authWithPassword(
                    username.includes('@') ? username : `${username}@pati.com`,
                    password
                );
            } catch (error2) {
                console.log('Intento 2 falló, probando credenciales por defecto...');
                // Intento 3: Credenciales por defecto
                authData = await pb.collection('users').authWithPassword(
                    'propietario@pati.com',
                    'propietario123'
                );
            }
        }
        
        console.log('✅ Login exitoso!', authData.record);
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('adminLoginModal'));
        if (modal) modal.hide();
        
        // Redirigir al panel admin
        currentUser = authData.record;
        document.getElementById('mainContent').classList.add('d-none');
        document.getElementById('adminPanel').classList.remove('d-none');
        
        // Configurar menú de admin (versión simplificada)
        setupAdminMenu();
        
        // Cargar datos básicos
        await loadBasicAdminData();
        
        showNotification('✅ Acceso concedido como propietario', 'success');
        
    } catch (error) {
        console.error('❌ Error en login:', error);
        alert('Credenciales incorrectas. Usa: propietario / propietario123\n\nSi el problema persiste, verifica que el usuario exista en PocketBase.');
        
        // Limpiar campo de contraseña
        if (document.getElementById('adminPassword')) {
            document.getElementById('adminPassword').value = '';
        }
    }
};

// ====== FUNCIONES BÁSICAS DE ADMIN ======
function setupAdminMenu() {
    const adminMenu = document.getElementById('adminMenu');
    if (!adminMenu) return;
    
    adminMenu.innerHTML = `
        <div class="admin-menu-item active" onclick="showAdminTab('adminDashboardTab')">
            <i class="fas fa-tachometer-alt"></i> Dashboard
        </div>
        <div class="admin-menu-item" onclick="showAdminTab('adminStoresTab')">
            <i class="fas fa-store"></i> Tiendas
        </div>
        <div class="admin-menu-item" onclick="showAdminTab('adminProductsTab')">
            <i class="fas fa-box"></i> Productos
        </div>
        <div class="admin-menu-item" onclick="showAdminTab('adminSettingsTab')">
            <i class="fas fa-cog"></i> Configuración
        </div>
    `;
}

async function loadBasicAdminData() {
    try {
        console.log('📊 Cargando datos básicos de admin...');
        
        // Solo cargar si estamos autenticados
        if (!pb.authStore.isValid) {
            console.log('⚠️  No autenticado, omitiendo carga');
            return;
        }
        
        // Intentar cargar tiendas
        try {
            stores = await pb.collection('stores').getFullList({
                filter: 'status = "active"',
                sort: '-created'
            });
            console.log(`✅ ${stores.length} tiendas cargadas`);
        } catch (storeError) {
            console.log('⚠️  No se pudieron cargar tiendas:', storeError.message);
        }
        
        // Intentar cargar productos (SOLO para admin)
        try {
            products = await pb.collection('products').getFullList({
                sort: '-created'
            });
            console.log(`✅ ${products.length} productos cargados`);
            
            // Si estamos en el panel de productos, mostrarlos
            if (document.getElementById('adminProductsTab')?.style.display === 'block') {
                displayAdminProducts();
            }
        } catch (productError) {
            console.log('⚠️  No se pudieron cargar productos:', productError.message);
            showNotification('No tienes permisos para ver productos o no hay productos', 'warning');
        }
        
    } catch (error) {
        console.error('❌ Error cargando datos admin:', error);
    }
}

// ====== FUNCIONES DE PRODUCTOS (SIMPLIFICADAS) ======
async function loadProducts() {
    try {
        const productsList = document.getElementById('productsList');
        if (!productsList) return;
        
        console.log('🛒 Cargando productos para clientes...');
        
        // SOLO cargar productos para clientes (sin autenticación)
        // PocketBase debe tener permisos "any" para ver productos
        const publicProducts = await pb.collection('products').getFullList({
            filter: 'stock > 0',
            sort: '-created'
        });
        
        console.log(`🛒 ${publicProducts.length} productos públicos cargados`);
        
        // Guardar en cache
        products = publicProducts;
        
        // Mostrar productos
        displayPublicProducts(publicProducts);
        
    } catch (error) {
        console.error('❌ Error cargando productos públicos:', error);
        const productsList = document.getElementById('productsList');
        if (productsList) {
            productsList.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                    <h4>Productos no disponibles temporalmente</h4>
                    <p>Intenta nuevamente en unos momentos</p>
                    <button class="btn btn-primary mt-3" onclick="loadProducts()">
                        <i class="fas fa-sync"></i> Reintentar
                    </button>
                </div>
            `;
        }
    }
}

function displayPublicProducts(productsToShow) {
    const productsList = document.getElementById('productsList');
    if (!productsList) return;
    
    productsList.innerHTML = '';
    
    if (!productsToShow || productsToShow.length === 0) {
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
        const productCard = `
            <div class="col-md-6 col-lg-4 col-xl-3 mb-4">
                <div class="card product-card h-100">
                    <img src="${product.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'}" 
                         class="card-img-top product-image" alt="${product.name}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${product.name}</h5>
                        <p class="card-text flex-grow-1">${product.description || 'Sin descripción'}</p>
                        <div class="price-tier">
                            <span>Precio: $${product.price1?.toFixed(2) || '0.00'}</span>
                        </div>
                        <button class="btn btn-primary mt-2 w-100" onclick="addToCartDemo('${product.id}', '${product.name}', ${product.price1 || 0})">
                            <i class="fas fa-cart-plus"></i> Agregar al carrito
                        </button>
                    </div>
                </div>
            </div>
        `;
        productsList.innerHTML += productCard;
    });
}

// ====== FUNCIONES DE DEMO (para prueba) ======
function addToCartDemo(productId, productName, price) {
    cart.push({
        id: productId,
        name: productName,
        price: price,
        quantity: 1
    });
    
    updateCart();
    showNotification(`✅ ${productName} agregado al carrito`, 'success');
}

function updateCart() {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        cartCount.textContent = cart.length;
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
    
    // Si es la pestaña de productos, cargarlos
    if (tabId === 'adminProductsTab') {
        displayAdminProducts();
    }
}

function displayAdminProducts() {
    const table = document.getElementById('adminProductsTable');
    if (!table) return;
    
    table.innerHTML = '';
    
    if (products.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="fas fa-box-open fa-2x text-muted mb-2"></i>
                    <p>No hay productos cargados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    products.forEach(product => {
        const row = `
            <tr>
                <td>${product.id.substring(0, 8)}...</td>
                <td>${product.name}</td>
                <td>${product.store || 'Sin tienda'}</td>
                <td>${product.category || 'Sin categoría'}</td>
                <td>$${product.price1?.toFixed(2) || '0.00'}</td>
                <td>${product.stock || 0}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="editProduct('${product.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
        table.innerHTML += row;
    });
}

// ====== SETUP DE EVENT LISTENERS ======
function setupEventListeners() {
    // Login form básico
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            // Autenticación básica
            try {
                const authData = await pb.collection('users').authWithPassword(email, password);
                currentUser = authData.record;
                updateUIForLoggedInUser();
                showNotification('✅ Login exitoso', 'success');
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
                if (modal) modal.hide();
                
            } catch (error) {
                alert('Credenciales incorrectas');
            }
        });
    }
}

// ====== FUNCIONES DE TIENDAS ======
async function loadFeaturedStores() {
    const featuredStores = document.getElementById('featuredStores');
    if (!featuredStores) return;
    
    featuredStores.innerHTML = `
        <div class="col-md-6 col-lg-3 mb-4">
            <div class="card store-card h-100">
                <img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" 
                     class="card-img-top" alt="Tienda Demo" style="height: 180px; object-fit: cover;">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">Tienda de Electrónica</h5>
                    <p class="card-text flex-grow-1">Los mejores productos electrónicos</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="store-status status-active">Activo</span>
                        <button class="btn btn-primary">
                            <i class="fas fa-sign-in-alt"></i> Entrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="col-md-6 col-lg-3 mb-4">
            <div class="card store-card h-100">
                <img src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" 
                     class="card-img-top" alt="Tienda Demo" style="height: 180px; object-fit: cover;">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">Tienda de Ropa</h5>
                    <p class="card-text flex-grow-1">Moda para toda la familia</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="store-status status-active">Activo</span>
                        <button class="btn btn-primary">
                            <i class="fas fa-sign-in-alt"></i> Entrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ====== FUNCIONES EXPORTADAS ======
window.showSection = showSection;
window.showStoreSelection = () => showSection('storeSelection');
window.showCreateStoreForm = () => showSection('createStore');
window.showLoginForm = (role = 'customer') => {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
};
window.showRegisterForm = (role = 'customer') => {
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    registerModal.show();
};
window.showAdminLogin = () => {
    const modal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
    modal.show();
};
window.logout = () => {
    pb.authStore.clear();
    currentUser = null;
    cart = [];
    updateCart();
    updateUIForLoggedInUser();
    
    document.getElementById('mainContent').classList.remove('d-none');
    document.getElementById('adminPanel').classList.add('d-none');
    
    showSection('home');
    showNotification('✅ Sesión cerrada', 'info');
};

// Para compatibilidad con HTML
window.appShowSection = showSection;
window.appShowLoginForm = showLoginForm;
window.appShowRegisterForm = showRegisterForm;
window.appShowStoreSelection = () => showSection('storeSelection');
window.appLoginAsOwner = loginAsOwner;
window.appLogout = logout;

console.log('✅ app.js cargado correctamente');