// ====== CONFIGURACIÓN INICIAL ======
const PB_URL = 'https://pati-platform.onrender.com';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

console.log('Conectando a PocketBase:', PB_URL);
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

console.log('Conectando a PocketBase:', PB_URL);

// ====== REST OF YOUR CODE ======
// ... (tu código existente sigue aquí)
const PB_URL = 'https://pati-platform.onrender.com';
    ? 'http://127.0.0.1:8090'  // Local
  //  : 'https://tu-pocketbase-en-render.onrender.com'; // ← TU NUEVA URL de PocketBase en Render
const pb = new PocketBase(PB_URL);
// Configurar CORS si es necesario
pb.autoCancellation(false);
// Variables globales
let currentUser = null;
let currentStoreId = null;
let cart = [];
let stores = []; // Cache local de tiendas
let categories = []; // Cache local de categorías

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada, conectando a:', PB_URL);
    checkAuth();
    loadInitialData();
    setupEventListeners();
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
            "username": userData.email, // Obligatorio en PocketBase
            "email": userData.email,
            "emailVisibility": true,
            "password": userData.password,
            "passwordConfirm": userData.password,
            "role": userData.role,
            "profile": JSON.stringify({ // Campo JSON como string
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
        // Cargar tiendas activas
        stores = await pb.collection('stores').getFullList({
            filter: 'status = "active"',
            sort: '-created'
        });
        
        // Cargar categorías
        categories = await pb.collection('categories').getFullList({
            sort: 'name'
        });
        
        console.log('Datos iniciales cargados:', { stores: stores.length, categories: categories.length });
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        // Usar datos de prueba si hay error
        stores = stores.length ? stores : [
            { id: 'demo1', name: "TechZone", category: "C001", status: "active", image: "https://images.unsplash.com/photo-1561154464-82e9adf32764?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", description: "La mejor tecnología" }
        ];
        categories = categories.length ? categories : [
            { id: 'C001', name: 'Electrónica' },
            { id: 'C002', name: 'Hogar' }
        ];
    }
}
// Función para cargar configuración del hero
async function loadHeroSettings() {
    try {
        const result = await pb.collection('hero_settings').getFirstListItem('');
        return result;
    } catch (error) {
        console.error('Error cargando hero settings:', error);
        return null;
    }
}

// Función para guardar configuración del hero
async function saveHeroSettings(data) {
    try {
        // Primero obtén el registro existente
        const existing = await pb.collection('hero_settings').getFirstListItem('');
        
        // Actualiza
        const result = await pb.collection('hero_settings').update(existing.id, {
            ...data,
            updated_at: new Date().toISOString()
        });
        return result;
    } catch (error) {
        console.error('Error guardando hero settings:', error);
        throw error;
    }
}

// Funciones similares para about_settings y contact_settings
async function loadAboutSettings() {
    try {
        return await pb.collection('about_settings').getFirstListItem('');
    } catch (error) {
        console.error('Error cargando about settings:', error);
        return null;
    }
}

async function saveAboutSettings(data) {
    try {
        const existing = await pb.collection('about_settings').getFirstListItem('');
        return await pb.collection('about_settings').update(existing.id, {
            ...data,
            updated_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error guardando about settings:', error);
        throw error;
    }
}
// ====== FUNCIONES DE PRODUCTOS ======
async function loadProducts() {
    try {
        const productsList = document.getElementById('productsList');
        productsList.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-primary"></div><p>Cargando productos...</p></div>';
        
        // Construir filtros
        let filter = '';
        if (currentStoreId) {
            filter = `store = "${currentStoreId}"`;
        }
        
        // Obtener productos
        const records = await pb.collection('products').getFullList({
            filter: filter,
            expand: 'store,category',
            sort: '-created'
        });
        
        productsList.innerHTML = '';
        
        if (records.length === 0) {
            productsList.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
                    <h4>No hay productos disponibles</h4>
                    <p>Pronto agregaremos nuevos productos.</p>
                </div>
            `;
            return;
        }
        
        records.forEach(product => {
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
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        const productsList = document.getElementById('productsList');
        productsList.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h4>Error cargando productos</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
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
        
        // Obtener producto desde PocketBase
        const product = await pb.collection('products').getOne(productId, {
            expand: 'store,category'
        });
        
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

// ====== FUNCIONES DE TIENDAS ======
async function loadStores() {
    try {
        const storesList = document.getElementById('storesList');
        if (!storesList) return;
        
        // Si ya cargamos las tiendas, usarlas
        if (stores.length === 0) {
            stores = await pb.collection('stores').getFullList({
                filter: 'status = "active"',
                sort: '-created'
            });
        }
        
        storesList.innerHTML = '';
        
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

// ====== EXPORTAR FUNCIONES AL ÁMBITO GLOBAL ======
// Esto permite que las funciones sean llamadas desde los atributos onclick en el HTML
window.showSection = showSection;
window.showStoreSelection = () => showSection('storeSelection');
window.showCreateStoreForm = () => showSection('createStore');
window.showStoreLogin = (storeId) => {
    currentStoreId = storeId;
    const store = stores.find(s => s.id === storeId);
    if (store) {
        document.getElementById('storeLoginName').textContent = store.name;
    }
    showSection('storeLogin');
};
window.showLoginForm = (role = 'customer') => {
    document.getElementById('loginRole').value = role;
    document.getElementById('loginStoreId').value = currentStoreId || '';
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
};
window.showRegisterForm = (role = 'customer') => {
    document.getElementById('registerRole').value = role;
    document.getElementById('registerStoreId').value = currentStoreId || '';
    
    const affiliateFields = document.getElementById('affiliateFields');
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
window.checkout = () => {
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
};

console.log('app.js cargado correctamente');