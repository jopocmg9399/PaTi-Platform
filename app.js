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
window.loginAsOwner = async function() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    
    if (!username || !password) {
        alert('Por favor, ingresa usuario y contraseña');
        return;
    }
    
    const email = username === 'propietario' ? 'propietario@pati.com' : username;
    
    // 1. PRIMERO: Cerrar el modal MANUALMENTE
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        // Método directo que SIEMPRE funciona
        modal.style.display = 'none';
        modal.classList.remove('show');
        
        // Quitar el fondo oscuro
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        
        // Devolver el scroll a la página
        document.body.classList.remove('modal-open');
        document.body.style.overflow = 'auto';
        document.body.style.paddingRight = '';
    }
    
    // 2. LUEGO: Hacer el login
    try {
        const result = await userLogin(email, password, 'propietario', null);
        
        if (!result.success) {
            // Si falla el login, mostrar el modal de nuevo
            const modalInstance = new bootstrap.Modal(document.getElementById('adminLoginModal'));
            modalInstance.show();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
        
        // Si hay error, mostrar modal de nuevo
        const modalInstance = new bootstrap.Modal(document.getElementById('adminLoginModal'));
        modalInstance.show();
    }
};

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

// El resto del código permanece igual...