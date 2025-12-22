// Configuración global de PaTí
// js/app.js - Configuración extendida
const PATI_CONFIG = {
    pb: new PocketBase('http://127.0.0.1:8090'),
    currentUser: null,
    currentStore: null,
    platformSettings: null,
    
    // Inicializar configuración
    async init() {
        try {
            // Cargar configuración de plataforma
            this.platformSettings = await this.loadPlatformSettings();
            
            // Verificar autenticación
            if (window.AuthSystem) {
                await AuthSystem.checkAuth();
            }
            
            // Inicializar otras funcionalidades
            this.initEventListeners();
            
            console.log('PaTí configurado correctamente');
        } catch (error) {
            console.error('Error inicializando PaTí:', error);
        }
    },
    
    async loadPlatformSettings() {
        try {
            const settings = await this.pb.collection('platform_settings').getFirstListItem('');
            return settings;
        } catch (error) {
            console.warn('No se pudo cargar configuración de plataforma:', error);
            return null;
        }
    },
    
    initEventListeners() {
        // Eventos globales aquí
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    PATI_CONFIG.init();
});

// Inicializar aplicación
async function initApp() {
    try {
        // Verificar autenticación
        if (PATI_CONFIG.pb.authStore.isValid) {
            PATI_CONFIG.currentUser = PATI_CONFIG.pb.authStore.model;
            updateAuthUI();
        }
        
        // Cargar configuración de plataforma
        await loadPlatformSettings();
        
        // Cargar tiendas destacadas
        await loadFeaturedStores();
        
    } catch (error) {
        console.error('Error inicializando app:', error);
    }
}

// Cargar configuración de plataforma
async function loadPlatformSettings() {
    try {
        const settings = await PATI_CONFIG.pb.collection('platform_settings').getFirstListItem('');
        PATI_CONFIG.platformSettings = settings;
        updatePlatformUI(settings);
    } catch (error) {
        console.log('Configuración de plataforma no cargada:', error);
    }
}

// Actualizar UI con datos de plataforma
function updatePlatformUI(settings) {
    if (settings.platform_name) {
        document.title = settings.platform_name + ' - PaTí';
        const logoElement = document.querySelector('.logo-text');
        if (logoElement) logoElement.textContent = settings.platform_name;
    }
}

// Actualizar UI de autenticación
function updateAuthUI() {
    const authContainer = document.getElementById('auth-buttons');
    if (!authContainer) return;
    
    if (PATI_CONFIG.currentUser) {
        authContainer.innerHTML = `
            <div class="flex items-center space-x-4">
                <span class="text-[#8B4513]">Hola, ${PATI_CONFIG.currentUser.username}</span>
                <a href="admin-tienda.html" class="bg-[#8B4513] text-white px-4 py-2 rounded-lg">
                    Mi Panel
                </a>
                <button onclick="logout()" class="text-gray-700 hover:text-[#8B4513]">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        `;
    } else {
        authContainer.innerHTML = `
            <a href="login.html" class="text-[#8B4513] hover:text-[#654321]">Login</a>
            <a href="registro.html" class="bg-[#8B4513] text-white px-4 py-2 rounded-lg">
                Registrarse
            </a>
        `;
    }
}

// Manejar parámetros de URL para redirección a tienda
function handleStoreRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('store');
    
    if (storeId) {
        localStorage.setItem('currentStoreId', storeId);
        // Limpiar parámetro de URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Llamar en initApp
async function initApp() {
    try {
        // ... código existente ...
        
        // Manejar redirección de tienda
        handleStoreRedirect();
        
    } catch (error) {
        console.error('Error inicializando app:', error);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);