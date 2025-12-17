// ====== CONFIGURACIÓN INICIAL ======
const PB_URL = 'https://pati-platform.onrender.com';

// Variables globales
let currentUser = null;
let currentStoreId = null;
let cart = [];
let stores = [];
let categories = [];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('App iniciada, conectando a:', PB_URL);
    
    // Inicializar PocketBase
    window.pb = new PocketBase(PB_URL);
    pb.autoCancellation(false);
    
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
        console.log('Intentando login:', { email, role, storeId });
        
        // 1. Autenticar con PocketBase
        const authData = await pb.collection('users').authWithPassword(email, password);
        currentUser = authData.record;
        
        console.log('Usuario autenticado:', currentUser);
        
        // 2. Verificar rol si se especificó
        if (role && currentUser.role !== role) {
            alert(`Tu cuenta no tiene el rol de "${role}". Tu rol es: ${currentUser.role}`);
            pb.authStore.clear();
            currentUser = null;
            return { success: false };
        }
        
        // 3. Guardar storeId si existe y el usuario es de una tienda
        if (storeId && ['admin', 'dependiente', 'affiliate'].includes(currentUser.role)) {
            currentStoreId = storeId;
        }
        
        // 4. Actualizar UI
        updateUIForLoggedInUser();
        
        // 5. Cerrar modal si existe
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (loginModal) loginModal.hide();
        
        // 6. Redirigir según rol
        if (currentUser.role === 'propietario') {
            document.getElementById('mainContent').classList.add('d-none');
            document.getElementById('adminPanel').classList.remove('d-none');
            loadAdminData();
            showNotification('Has iniciado sesión como Propietario');
        } else if (currentUser.role === 'admin') {
            // Admin de tienda
            document.getElementById('mainContent').classList.add('d-none');
            document.getElementById('adminPanel').classList.remove('d-none');
            loadAdminData();
            showNotification(`Has iniciado sesión como Administrador de tienda`);
        } else if (currentUser.role === 'dependiente') {
            // Dependiente
            document.getElementById('mainContent').classList.add('d-none');
            document.getElementById('adminPanel').classList.remove('d-none');
            loadAdminData();
            showNotification('Has iniciado sesión como Dependiente');
        } else {
            // Cliente o Afiliado
            showSection('products');
            showNotification('Has iniciado sesión correctamente');
        }
        
        return { success: true, user: currentUser };
        
    } catch (error) {
        console.error('Error en login:', error);
        
        // Mensajes de error más específicos
        if (error.status === 400) {
            alert('Email o contraseña incorrectos');
        } else if (error.status === 0) {
            alert('Error de conexión. Verifica tu internet.');
        } else {
            alert('Error al iniciar sesión: ' + error.message);
        }
        
        return { success: false, error: error.message };
    }
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

window.loginAsOwner = () => {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    
    // Usar la misma función de login con credenciales del propietario
    userLogin(username, password, 'propietario', null);
};

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

// El resto del código permanece igual...