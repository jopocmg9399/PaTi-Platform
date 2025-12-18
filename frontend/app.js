// ====== CONFIGURACIÓN INICIAL ======
const PB_URL = 'https://pati-platform.onrender.com';

// Variables globales
let currentUser = null;
let currentStoreId = null;
let cart = [];
let stores = [];
let products = [];
let categories = [];
let customers = [];
let affiliates = [];
let orders = [];
let isAdminLoggedIn = false; // ← AÑADE ESTA LÍNEA IMPORTANTE

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📱 Iniciando PaTí...');
    
    // Inicializar PocketBase
    window.pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    
    // Crear usuario propietario si no existe
    await createOwnerIfNotExists();
    
    // VERIFICAR SI YA HAY SESIÓN ACTIVA
    if (pb.authStore.isValid) {
        try {
            // Actualizar token si es necesario
            await pb.collection('users').authRefresh();
            currentUser = pb.authStore.model;
            isAdminLoggedIn = currentUser.role === 'propietario' || currentUser.role === 'admin';
            
            // Actualizar UI según el rol
            if (isAdminLoggedIn) {
                document.getElementById('mainContent').classList.add('d-none');
                document.getElementById('adminPanel').classList.remove('d-none');
                document.getElementById('logoutButton').classList.remove('d-none');
                document.getElementById('authButtons').classList.add('d-none');
                
                // Cargar datos del admin si la función existe
                if (typeof loadAdminData === 'function') {
                    loadAdminData();
                }
            } else if (currentUser) {
                // Usuario normal (cliente)
                document.getElementById('authButtons').classList.add('d-none');
                document.getElementById('logoutButton').classList.remove('d-none');
            }
            
            console.log('✅ Usuario ya autenticado:', currentUser.email, 'Rol:', currentUser.role);
        } catch (error) {
            console.log('Sesión expirada o inválida:', error);
            pb.authStore.clear();
        }
    }
    
    // Configurar event listeners
    setupEventListeners();
    
    // Inicializar gráficos
    if (typeof initializeCharts === 'function') {
        initializeCharts();
    }
    
    // Cargar datos iniciales
    if (typeof loadInitialData === 'function') {
        loadInitialData();
    }
    
    // Cargar datos reales si la función existe
    if (typeof loadRealData === 'function') {
        await loadRealData();
    }
    
    console.log('🚀 Aplicación lista!');
});
// ====== CREAR USUARIO PROPIETARIO SI NO EXISTE ======
async function createOwnerIfNotExists() {
    try {
        // Verificar si el usuario propietario existe
        const existing = await pb.collection('users').getFirstListItem('email="propietario@pati.com"');
        console.log('Usuario propietario ya existe:', existing.email);
    } catch (error) {
        if (error.status === 404) {
            console.log('Creando usuario propietario...');
            try {
                const ownerData = {
                    "username": "propietario",
                    "email": "propietario@pati.com",
                    "emailVisibility": true,
                    "password": "propietario123",
                    "passwordConfirm": "propietario123",
                    "role": "propietario",
                    "profile": JSON.stringify({
                        "nombre": "Propietario PaTí",
                        "telefono": "(123) 456-7890"
                    })
                };
                
                const owner = await pb.collection('users').create(ownerData);
                console.log('Usuario propietario creado:', owner.email);
            } catch (createError) {
                console.error('Error creando propietario:', createError);
            }
        }
    }
}

// Llamar esta función después de inicializar PocketBase
document.addEventListener('DOMContentLoaded', async function() {
    console.log('App iniciada, conectando a:', PB_URL);
    
    // Inicializar PocketBase
    window.pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    
    // Crear usuario propietario si no existe
    await createOwnerIfNotExists();
    
    checkAuth();
    loadInitialData();
    setupEventListeners();
});
// ====== FUNCIONES DE AUTENTICACIÓN MEJORADAS ======
async function checkAuth() {
    try {
        // Verificar si hay token válido
        if (pb.authStore.isValid) {
            // Refrescar la sesión
            await pb.collection('users').authRefresh();
            currentUser = pb.authStore.model;
            updateUIForLoggedInUser();
            console.log('Usuario autenticado:', currentUser.email, 'Rol:', currentUser.role);
        }
    } catch (error) {
        console.error('Error verificando autenticación:', error);
        pb.authStore.clear();
    }
}

async function userLogin(email, password, role, storeId) {
    try {
        console.log('=== INICIANDO LOGIN ===');
        
        // 1. Autenticar
        const authData = await pb.collection('users').authWithPassword(email, password);
        currentUser = authData.record;
        
        console.log('Login exitoso para:', currentUser.email, 'Rol:', currentUser.role);
        
        // 2. Verificar rol
        if (role && currentUser.role !== role) {
            alert(`Rol incorrecto. Esperabas "${role}" pero tienes "${currentUser.role}"`);
            pb.authStore.clear();
            currentUser = null;
            return { success: false };
        }
        
        // 3. CERRAR TODOS LOS MODALES ABIERTOS
        closeAllModals();
        
        // 4. Actualizar UI
        updateUIForLoggedInUser();
        
        // 5. Redirigir según rol
        if (currentUser.role === 'propietario') {
            console.log('Redirigiendo a panel de propietario');
            document.getElementById('mainContent').classList.add('d-none');
            document.getElementById('adminPanel').classList.remove('d-none');
            loadAdminData();
            showNotification('Has iniciado sesión como Propietario');
        } else if (currentUser.role === 'admin' || currentUser.role === 'dependiente') {
            console.log('Redirigiendo a panel de administración');
            document.getElementById('mainContent').classList.add('d-none');
            document.getElementById('adminPanel').classList.remove('d-none');
            loadAdminData();
            showNotification(`Has iniciado sesión como ${currentUser.role}`);
        } else {
            console.log('Redirigiendo a sección productos');
            showSection('products');
            showNotification('Has iniciado sesión correctamente');
        }
        
        return { success: true, user: currentUser };
        
    } catch (error) {
        console.error('Error en login:', error);
        
        let errorMsg = 'Error desconocido';
        if (error.status === 400) errorMsg = 'Email o contraseña incorrectos';
        else if (error.status === 0) errorMsg = 'Error de conexión';
        else errorMsg = error.message || 'Error al iniciar sesión';
        
        alert('Error: ' + errorMsg);
        return { success: false, error: error.message };
    }
}

// Función auxiliar para cerrar todos los modales
function closeAllModals() {
    console.log('Cerrando todos los modales...');
    
    // Método 1: Usar Bootstrap para cerrar modales visibles
    const modals = document.querySelectorAll('.modal.show');
    modals.forEach(modal => {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
            bsModal.hide();
            console.log('Modal cerrado:', modal.id);
        }
    });
    
    // Método 2: Eliminar backdrop manualmente
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => {
        backdrop.remove();
        console.log('Backdrop eliminado');
    });
    
    // Método 3: Restaurar el body
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    console.log('Todos los modales cerrados');
}

// ====== CREACIÓN DE TIENDAS CON AUTORIZACIÓN ======
async function createStoreWithAuthorization(storeData, authorizationKey) {
    try {
        // 1. Verificar que el usuario esté autenticado como propietario
        if (!currentUser || currentUser.role !== 'propietario') {
            alert('Solo el propietario puede crear tiendas');
            return { success: false, error: 'No autorizado' };
        }
        
        // 2. Verificar clave de autorización (puedes almacenarla en PocketBase)
        const authRecord = await pb.collection('authorization_keys').getFirstListItem(
            `key="${authorizationKey}" && used=false`
        );
        
        if (!authRecord) {
            alert('Clave de autorización inválida o ya usada');
            return { success: false, error: 'Clave inválida' };
        }
        
        // 3. Crear usuario administrador para la tienda
        const adminUserData = {
            "username": storeData.adminEmail,
            "email": storeData.adminEmail,
            "emailVisibility": true,
            "password": storeData.adminPassword,
            "passwordConfirm": storeData.adminPassword,
            "role": "admin",
            "profile": JSON.stringify({
                "nombre": storeData.adminName,
                "telefono": storeData.adminPhone,
                "tienda_asignada": storeData.name
            })
        };
        
        const adminUser = await pb.collection('users').create(adminUserData);
        
        // 4. Crear la tienda
        const storeRecord = await pb.collection('stores').create({
            "name": storeData.name,
            "category": storeData.category,
            "admin": storeData.adminEmail,
            "admin_user": adminUser.id,
            "status": "active",
            "image": storeData.image,
            "logo": storeData.logo,
            "description": storeData.description,
            "comision_global": 10, // Comisión por defecto
            "created_by": currentUser.id
        });
        
        // 5. Marcar clave como usada
        await pb.collection('authorization_keys').update(authRecord.id, {
            "used": true,
            "used_by": currentUser.id,
            "used_at": new Date().toISOString(),
            "store_created": storeRecord.id
        });
        
        // 6. Agregar tienda a la lista local
        stores.push({
            id: storeRecord.id,
            name: storeRecord.name,
            categoryId: storeRecord.category,
            admin: storeRecord.admin,
            status: storeRecord.status,
            image: storeRecord.image,
            description: storeRecord.description
        });
        
        return { success: true, store: storeRecord, admin: adminUser };
        
    } catch (error) {
        console.error('Error creando tienda:', error);
        alert('Error creando tienda: ' + error.message);
        return { success: false, error: error.message };
    }
}
window.checkCreateStorePermission = function() {
    if (currentUser && currentUser.role === 'propietario') {
        showSection('createStore');
    } else {
        // Mostrar modal de login para propietario
        showAdminLogin();
    }
};

// ====== FUNCIÓN MEJORADA PARA MOSTRAR SECCIONES ======
function showSection(section) {
    // Ocultar todas las secciones principales
    const mainSections = ['home', 'products', 'about', 'contact', 'storeSelection', 'createStore', 'storeLogin'];
    mainSections.forEach(sec => {
        const el = document.getElementById(sec + 'Section');
        if (el) el.style.display = 'none';
    });
    
    // Mostrar sección seleccionada
    const sectionElement = document.getElementById(section + 'Section');
    if (sectionElement) {
        sectionElement.style.display = 'block';
        
        // Acciones específicas por sección
        switch(section) {
            case 'products':
                loadProducts();
                break;
            case 'storeSelection':
                loadStores();
                break;
            case 'createStore':
                // Solo propietario puede ver esta sección
                if (!currentUser || currentUser.role !== 'propietario') {
                    showSection('home');
                    alert('Solo el propietario puede crear tiendas');
                    return;
                }
                break;
        }
    }
}

// ====== ACTUALIZAR FUNCIONES GLOBALES ======
window.showSection = showSection;
window.showStoreSelection = () => showSection('storeSelection');
window.showCreateStoreForm = () => {
    if (!currentUser || currentUser.role !== 'propietario') {
        showAdminLogin(); // Mostrar login de propietario
        return;
    }
    showSection('createStore');
};

window.showStoreLogin = async (storeId) => {
    currentStoreId = storeId;
    
    try {
        const store = await pb.collection('stores').getOne(storeId);
        if (store) {
            document.getElementById('storeLoginName').textContent = store.name;
            showSection('storeLogin');
        }
    } catch (error) {
        console.error('Error cargando tienda:', error);
        alert('Error al cargar la tienda');
    }
};

// La forma más limpia usando eventos de Bootstrap


// FUNCIÓN PARA CERRAR MODAL COMPLETAMENTE
function closeModalCompletely(modalId) {
    console.log('Cerrando modal:', modalId);
    
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.log('Modal no encontrado:', modalId);
        return;
    }
    
    // Paso 1: Ocultar el modal
    modal.classList.remove('show');
    modal.style.display = 'none';
    
    // Paso 2: Eliminar todos los backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => {
        console.log('Eliminando backdrop');
        backdrop.remove();
    });
    
    // Paso 3: Restaurar el body
    document.body.classList.remove('modal-open');
    document.body.style.overflow = 'auto';
    document.body.style.paddingRight = '';
    
    // Paso 4: Remover atributos
    modal.setAttribute('aria-hidden', 'true');
    modal.removeAttribute('aria-modal');
    modal.removeAttribute('role');
    modal.style.paddingRight = '';
    
    // Paso 5: Si hay una instancia de Bootstrap, destruirla
    const bsModal = bootstrap.Modal.getInstance(modal);
    if (bsModal) {
        bsModal.dispose();
        console.log('Instancia de Bootstrap eliminada');
    }
    
    // Paso 6: Disparar evento de cierre
    modal.dispatchEvent(new Event('hidden.bs.modal'));
    
    console.log('✅ Modal cerrado completamente');
}

// También actualiza userLogin para que no intente cerrar modales
async function userLogin(email, password, role, storeId) {
    try {
        console.log('=== INICIANDO LOGIN ===');
        
        // Autenticar
        const authData = await pb.collection('users').authWithPassword(email, password);
        currentUser = authData.record;
        
        console.log('✅ Login exitoso para:', currentUser.email);
        
        // Verificar rol
        if (role && currentUser.role !== role) {
            alert(`Rol incorrecto. Esperabas "${role}" pero tienes "${currentUser.role}"`);
            pb.authStore.clear();
            currentUser = null;
            return { success: false };
        }
        
        // Actualizar UI
        updateUIForLoggedInUser();
        
        // Redirigir según rol
        if (currentUser.role === 'propietario') {
            console.log('Redirigiendo a panel de propietario');
            document.getElementById('mainContent').classList.add('d-none');
            document.getElementById('adminPanel').classList.remove('d-none');
            loadAdminData();
            showNotification('Has iniciado sesión como Propietario');
        } else if (currentUser.role === 'admin' || currentUser.role === 'dependiente') {
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
        alert('Error: ' + (error.message || 'Error al iniciar sesión'));
        return { success: false, error: error.message };
    }
}

// Modificar la función createStore del index.html para usar autorización
window.createStore = async function() {
    const storeData = {
        name: document.getElementById('storeName').value,
        category: document.getElementById('storeCategory').value,
        adminName: document.getElementById('adminName').value,
        adminEmail: document.getElementById('adminEmail').value,
        adminPassword: document.getElementById('adminPassword').value,
        adminPhone: document.getElementById('adminPhone').value,
        description: document.getElementById('storeDescription').value,
        image: document.getElementById('storeImage').value || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
        logo: document.getElementById('storeLogo').value
    };
    
    // Solicitar clave de autorización
    const authKey = prompt('Ingresa la clave de autorización para crear tienda:');
    if (!authKey) {
        alert('Se requiere clave de autorización');
        return;
    }
    
    const result = await createStoreWithAuthorization(storeData, authKey);
    
    if (result.success) {
        alert(`Tienda "${storeData.name}" creada correctamente. El administrador ha sido notificado.`);
        document.getElementById('createStoreForm').reset();
        showSection('home');
        loadStores(); // Recargar lista de tiendas
    }
};
// ====== FUNCIONES AUXILIARES PARA EL INDEX.HTML ======

// Función para actualizar UI cuando un usuario inicia sesión
function updateUIForLoggedInUser() {
    if (currentUser) {
        document.getElementById('authButtons').classList.add('d-none');
        document.getElementById('logoutButton').classList.remove('d-none');
        
        // Mostrar nombre del usuario si hay un elemento para ello
        const userGreeting = document.getElementById('userGreeting');
        if (userGreeting) {
            userGreeting.textContent = `Hola, ${currentUser.name || currentUser.email}`;
        }
    }
}

// Función para mostrar notificaciones
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'position-fixed bottom-5 end-0 m-3 alert alert-success alert-dismissible fade show';
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

// Función para logout global
window.logout = function() {
    try {
        // Limpiar autenticación de PocketBase
        if (pb && pb.authStore) {
            pb.authStore.clear();
            console.log('✅ Sesión de PocketBase cerrada');
        }
    } catch (error) {
        console.error('Error al cerrar sesión en PocketBase:', error);
    }
    
    // Limpiar variables locales
    currentUser = null;
    isAdminLoggedIn = false;
    currentStoreId = null;
    cart = [];
    
    // Restaurar vista principal
    document.getElementById('mainContent').classList.remove('d-none');
    document.getElementById('adminPanel').classList.add('d-none');
    document.getElementById('logoutButton').classList.add('d-none');
    document.getElementById('authButtons').classList.remove('d-none');
    
    // Mostrar sección de inicio
    if (typeof showSection === 'function') {
        showSection('home');
    } else {
        // Si la función no existe, ocultar todas las secciones y mostrar home
        const sections = document.querySelectorAll('section');
        sections.forEach(section => section.style.display = 'none');
        document.getElementById('homeSection').style.display = 'block';
    }
    
    // Actualizar carrito
    if (typeof updateCart === 'function') {
        updateCart();
    }
    
    showNotification('Sesión cerrada correctamente');
};

// Función para mostrar login de admin
window.showAdminLogin = function() {
    // Limpiar campos
    const usernameField = document.getElementById('adminUsername');
    const passwordField = document.getElementById('adminPassword');
    
    if (usernameField) usernameField.value = '';
    if (passwordField) passwordField.value = '';
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
    modal.show();
};

// Handler para login de admin
window.handleAdminLogin = async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    
    if (!username || !password) {
        alert('Por favor, completa ambos campos');
        return false;
    }
    
    try {
        console.log('🔐 Intentando autenticar...');
        
        // Intentar autenticar con PocketBase
        const authData = await pb.collection('users').authWithPassword(username, password);
        
        // Verificar si es propietario
        const user = authData.record;
        console.log('Usuario autenticado:', user);
        
        if (user.role !== 'propietario') {
            alert('❌ Solo usuarios con rol "propietario" pueden acceder');
            pb.authStore.clear();
            return false;
        }
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('adminLoginModal'));
        if (modal) modal.hide();
        
        // Limpiar campos
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
        
        // Configurar usuario local
        currentUser = {
            id: user.id,
            name: user.name || user.username,
            email: user.email,
            role: user.role,
            profile: user
        };
        isAdminLoggedIn = true;
        
        // Actualizar UI
        document.getElementById('mainContent').classList.add('d-none');
        document.getElementById('adminPanel').classList.remove('d-none');
        document.getElementById('authButtons').classList.add('d-none');
        document.getElementById('logoutButton').classList.remove('d-none');
        
        // Cargar datos del admin
        if (typeof loadAdminData === 'function') {
            loadAdminData();
        }
        
        showNotification(`✅ Bienvenido, ${currentUser.name}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error de autenticación:', error);
        
        // Mostrar mensaje según el error
        if (error.message.includes('Failed to fetch')) {
            alert('❌ No se puede conectar al servidor. Verifica tu conexión a internet.');
        } else if (error.message.includes('invalid credentials')) {
            alert('❌ Credenciales incorrectas. Verifica usuario y contraseña.');
        } else {
            alert(`❌ Error: ${error.message}`);
        }
        
        // Limpiar contraseña
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
        
        return false;
    }
};

// Función para cargar datos reales desde PocketBase
async function loadRealData() {
    try {
        console.log('🔄 Cargando datos desde PocketBase...');
        
        // Cargar categorías
        try {
            const categoriesResult = await pb.collection('categories').getList(1, 50);
            categories = categoriesResult.items.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description || ''
            }));
            console.log(`✅ Categorías cargadas: ${categories.length}`);
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar categorías, usando datos de ejemplo');
            categories = [
                { id: 'C001', name: 'Electrónica', description: '' },
                { id: 'C002', name: 'Hogar', description: '' },
                { id: 'C003', name: 'Útiles y Herramientas', description: '' },
                { id: 'C004', name: 'Ropas', description: '' },
                { id: 'C005', name: 'Calzados', description: '' },
                { id: 'C006', name: 'Deportiva', description: '' }
            ];
        }
        
        // Cargar tiendas
        try {
            const storesResult = await pb.collection('stores').getList(1, 50);
            stores = storesResult.items.map(item => ({
                id: item.id,
                name: item.name,
                categoryId: item.category || 'C001',
                admin: item.admin_email || 'admin@tienda.com',
                status: item.status || 'Activo',
                image: item.image || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
                description: item.description || 'Tienda en línea'
            }));
            console.log(`✅ Tiendas cargadas: ${stores.length}`);
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar tiendas, usando datos de ejemplo');
            stores = [
                { id: 1, name: "TechZone", categoryId: 'C001', admin: "admin@techzone.com", status: "Activo", image: "https://images.unsplash.com/photo-1561154464-82e9adf32764?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", description: "La mejor tecnología" },
                { id: 2, name: "FashionStyle", categoryId: 'C004', admin: "admin@fashionstyle.com", status: "Activo", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", description: "Moda para todos" }
            ];
        }
        
        // Cargar productos
        try {
            const productsResult = await pb.collection('products').getList(1, 200);
            products = productsResult.items.map(item => ({
                id: item.id,
                name: item.name,
                store: item.store_name || 'Tienda General',
                storeId: item.store || 1,
                categoryId: item.category || 'C001',
                price1: parseFloat(item.price1) || 0,
                price2: parseFloat(item.price2) || 0,
                price3: parseFloat(item.price3) || 0,
                stock: parseInt(item.stock) || 0,
                image: item.image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
                description: item.description || ''
            }));
            console.log(`✅ Productos cargados: ${products.length}`);
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar productos, usando datos de ejemplo');
            products = [
                { id: 1, name: "Smartphone XYZ", store: "TechZone", storeId: 1, categoryId: 'C001', price1: 299.99, price2: 279.99, price3: 259.99, stock: 15, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80", description: "Smartphone de última generación." }
            ];
        }
        
        console.log('✅ Datos REALES cargados desde PocketBase');
        
        // Actualizar UI si las funciones existen
        if (typeof loadFeaturedStores === 'function') loadFeaturedStores();
        if (typeof loadProducts === 'function') loadProducts();
        if (typeof loadStores === 'function') loadStores();
        
    } catch (error) {
        console.error('❌ Error grave cargando datos:', error);
        alert('Error conectando con el servidor. Usando datos de ejemplo.');
    }
}

// Asegurar que las funciones estén disponibles globalmente
window.loadRealData = loadRealData;
window.showNotification = showNotification;
