/**
 * Configuración global de PaTí
 * Conexión completa con PocketBase
 */

// Configuración global
const PATI_CONFIG = {
    pb: null,
    currentUser: null,
    currentStore: null,
    platformSettings: null,
    cart: [],
    stores: [],
    categories: []
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Inicializar PocketBase
        PATI_CONFIG.pb = new PocketBase('http://127.0.0.1:8090');
        
        // Configurar auto-refresh del token
        PATI_CONFIG.pb.autoCancellation(false);
        
        // Cargar configuración de plataforma
        await loadPlatformSettings();
        
        // Cargar tiendas disponibles
        await loadStores();
        
        // Inicializar carrito desde localStorage
        loadCartFromStorage();
        
        // Actualizar contador de carrito
        updateCartCount();
        
        // Inicializar sistema de autenticación
        await initializeAuth();
        
        console.log('✅ PaTí inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando PaTí:', error);
        showError('Error de conexión con el servidor');
    }
});

// Cargar configuración de plataforma
async function loadPlatformSettings() {
    try {
        const settings = await PATI_CONFIG.pb.collection('platform_settings').getFirstListItem('');
        PATI_CONFIG.platformSettings = settings;
        console.log('⚙️ Configuración de plataforma cargada');
    } catch (error) {
        console.warn('No se encontró configuración de plataforma, usando valores por defecto');
        PATI_CONFIG.platformSettings = {
            platformName: 'PaTí',
            defaultCommission: 10,
            currencyRates: { USD: 1, CUP: 120 },
            emailNotifications: true,
            maintenanceMode: false
        };
    }
}

// Cargar tiendas
async function loadStores() {
    try {
        const stores = await PATI_CONFIG.pb.collection('stores').getFullList({
            sort: 'name',
            filter: 'active = true'
        });
        PATI_CONFIG.stores = stores;
        console.log(`🏪 ${stores.length} tiendas cargadas`);
    } catch (error) {
        console.error('Error cargando tiendas:', error);
        PATI_CONFIG.stores = [];
    }
}

// Cargar categorías de una tienda
async function loadStoreCategories(storeId) {
    try {
        const categories = await PATI_CONFIG.pb.collection('categories').getFullList({
            filter: `store = "${storeId}" && active = true`,
            sort: 'name'
        });
        return categories;
    } catch (error) {
        console.error('Error cargando categorías:', error);
        return [];
    }
}

// Inicializar autenticación
async function initializeAuth() {
    try {
        // Cargar sesión desde cookie
        PATI_CONFIG.pb.authStore.loadFromCookie(document.cookie);
        
        if (PATI_CONFIG.pb.authStore.isValid) {
            PATI_CONFIG.currentUser = PATI_CONFIG.pb.authStore.model;
            
            // Cargar datos adicionales del usuario
            await loadUserData();
            
            // Actualizar UI para usuario autenticado
            updateUIForLoggedInUser();
        }
    } catch (error) {
        console.error('Error en autenticación:', error);
    }
}

// Cargar datos del usuario
async function loadUserData() {
    if (!PATI_CONFIG.currentUser) return;
    
    try {
        // Si es admin/dependiente, cargar su tienda
        if (['administrador', 'dependiente'].includes(PATI_CONFIG.currentUser.role)) {
            const storeId = PATI_CONFIG.currentUser.store;
            if (storeId) {
                PATI_CONFIG.currentStore = await PATI_CONFIG.pb.collection('stores').getOne(storeId);
            }
        }
        
        // Si es afiliado, cargar comisiones
        if (PATI_CONFIG.currentUser.role === 'afiliado') {
            await loadAffiliateCommissions();
        }
        
    } catch (error) {
        console.error('Error cargando datos de usuario:', error);
    }
}

// Cargar comisiones de afiliado
async function loadAffiliateCommissions() {
    try {
        const commissions = await PATI_CONFIG.pb.collection('commissions').getFullList({
            filter: `affiliate = "${PATI_CONFIG.currentUser.id}"`,
            expand: 'order,store',
            sort: '-created'
        });
        
        PATI_CONFIG.currentUser.commissions = commissions;
        
    } catch (error) {
        console.error('Error cargando comisiones:', error);
        PATI_CONFIG.currentUser.commissions = [];
    }
}

// Función para mostrar errores
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'global-error';
    errorDiv.innerHTML = `
        <div class="error-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
            <button class="close-error">&times;</button>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => errorDiv.classList.add('show'), 100);
    
    // Auto-remover después de 10 segundos
    setTimeout(() => {
        errorDiv.classList.remove('show');
        setTimeout(() => errorDiv.remove(), 300);
    }, 10000);
    
    // Botón para cerrar
    errorDiv.querySelector('.close-error').addEventListener('click', () => {
        errorDiv.classList.remove('show');
        setTimeout(() => errorDiv.remove(), 300);
    });
}

// Exportar configuración global
window.PATI_CONFIG = PATI_CONFIG;
window.showError = showError;