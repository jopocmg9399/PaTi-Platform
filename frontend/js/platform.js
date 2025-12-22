// platform.js - Funciones específicas para la plataforma PaTí

// Cargar tiendas destacadas desde backend
async function loadFeaturedStores() {
    try {
        const storesContainer = document.getElementById('stores-container');
        if (!storesContainer) return;
        
        // Obtener tiendas (ejemplo: 8 más recientes o con más productos)
        const stores = await PATI_CONFIG.pb.collection('stores').getList(1, 8, {
            sort: '-created',
            expand: 'owner'
        });
        
        // Si no hay tiendas reales, mostrar placeholders
        if (stores.items.length === 0) {
            showStorePlaceholders();
            return;
        }
        
        // Limpiar contenedor
        storesContainer.innerHTML = '';
        
        // Crear cards para cada tienda
        stores.items.forEach(store => {
            const storeCard = createStoreCard(store);
            storesContainer.appendChild(storeCard);
        });
        
    } catch (error) {
        console.error('Error cargando tiendas:', error);
        showStorePlaceholders();
    }
}

// Crear card de tienda
function createStoreCard(store) {
    const card = document.createElement('div');
    card.className = 'store-card p-4 bg-white text-center cursor-pointer hover:shadow-xl transition';
    card.onclick = () => openStore(store.id);
    
    // Intentar obtener logo de store_settings
    const storeLogo = store.expand?.store_settings?.[0]?.store_logo || 
                      'https://via.placeholder.com/150x150?text=Tienda';
    
    card.innerHTML = `
        <img src="${storeLogo}" 
             alt="${store.name}" 
             class="h-24 w-24 rounded-full mx-auto mb-4 object-cover border-2 border-[#F5DEB3]">
        <h3 class="font-bold text-lg text-[#8B4513] mb-2">${store.name}</h3>
        <p class="text-gray-600 text-sm mb-3">${store.description || 'Tienda en PaTí'}</p>
        <div class="flex justify-center space-x-2">
            <span class="bg-[#F5DEB3] text-[#8B4513] px-3 py-1 rounded-full text-xs">
                ${store.expand?.owner?.username || 'Admin'}
            </span>
        </div>
    `;
    
    return card;
}

// Mostrar placeholders si no hay tiendas
function showStorePlaceholders() {
    const storesContainer = document.getElementById('stores-container');
    if (!storesContainer) return;
    
    const placeholderStores = [
        { name: 'Amazon', logo: 'https://logos-world.net/wp-content/uploads/2020/04/Amazon-Logo.png' },
        { name: 'Temu', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Temu_logo.svg/2560px-Temu_logo.svg.png' },
        { name: 'AliExpress', logo: 'https://logos-world.net/wp-content/uploads/2021/02/Aliexpress-Logo.png' },
        { name: 'eBay', logo: 'https://logos-world.net/wp-content/uploads/2020/11/eBay-Logo.png' }
    ];
    
    storesContainer.innerHTML = '';
    placeholderStores.forEach(store => {
        const card = document.createElement('div');
        card.className = 'store-card p-4 bg-white text-center';
        card.innerHTML = `
            <img src="${store.logo}" 
                 alt="${store.name}" 
                 class="h-20 mx-auto mb-4 object-contain">
            <h3 class="font-bold text-lg text-gray-700">${store.name}</h3>
            <p class="text-gray-500 text-sm">Tienda de ejemplo</p>
        `;
        storesContainer.appendChild(card);
    });
}

// Abrir página de tienda
function openStore(storeId) {
    // Guardar storeId en localStorage para la siguiente página
    localStorage.setItem('currentStoreId', storeId);
    window.location.href = `tienda.html?id=${storeId}`;
}

// Modal para seleccionar tienda
function openStoreSelector() {
    // Si el usuario no está autenticado, pedir login
    if (!PATI_CONFIG.currentUser) {
        window.location.href = 'login.html?redirect=select-store';
        return;
    }
    
    // Crear modal dinámico
    const modalHTML = `
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <!-- Header -->
                <div class="bg-[#8B4513] text-white p-4 flex justify-between items-center">
                    <h3 class="text-xl font-bold">Seleccionar Tienda</h3>
                    <button onclick="closeModal('store-selector')" class="text-white hover:text-gray-200">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- Contenido -->
                <div class="p-6">
                    <div id="user-stores-list" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <!-- Tiendas del usuario se cargarán aquí -->
                        <div class="text-center py-8">
                            <i class="fas fa-spinner fa-spin text-[#8B4513] text-2xl mb-2"></i>
                            <p class="text-gray-600">Cargando tiendas...</p>
                        </div>
                    </div>
                    
                    <div class="text-center">
                        <button onclick="openCreateStore()" class="bg-[#A0522D] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#8B4513] transition">
                            <i class="fas fa-plus mr-2"></i> Crear Nueva Tienda
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insertar modal en el DOM
    const modalContainer = document.createElement('div');
    modalContainer.id = 'store-selector-modal';
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Cargar tiendas del usuario
    loadUserStores();
}

// Cargar tiendas del usuario actual
async function loadUserStores() {
    try {
        const container = document.getElementById('user-stores-list');
        if (!container) return;
        
        // Obtener tiendas donde el usuario es owner o admin
        const stores = await PATI_CONFIG.pb.collection('stores').getList(1, 20, {
            filter: `owner.id = "${PATI_CONFIG.currentUser.id}"`,
            expand: 'store_settings'
        });
        
        container.innerHTML = '';
        
        if (stores.items.length === 0) {
            container.innerHTML = `
                <div class="col-span-2 text-center py-8">
                    <i class="fas fa-store text-gray-400 text-4xl mb-4"></i>
                    <p class="text-gray-600 mb-4">No tienes tiendas creadas</p>
                </div>
            `;
            return;
        }
        
        // Mostrar cada tienda
        stores.items.forEach(store => {
            const storeElement = document.createElement('div');
            storeElement.className = 'border border-gray-200 rounded-lg p-4 hover:border-[#8B4513] cursor-pointer transition';
            storeElement.onclick = () => {
                localStorage.setItem('currentStoreId', store.id);
                window.location.href = `admin-tienda.html?store=${store.id}`;
            };
            
            storeElement.innerHTML = `
                <div class="flex items-center space-x-3">
                    <img src="${store.expand?.store_settings?.[0]?.store_logo || 'https://via.placeholder.com/50x50?text=Tienda'}" 
                         alt="${store.name}" 
                         class="h-12 w-12 rounded-full object-cover">
                    <div>
                        <h4 class="font-bold text-[#8B4513]">${store.name}</h4>
                        <p class="text-sm text-gray-600">${store.products_count || 0} productos</p>
                    </div>
                </div>
            `;
            
            container.appendChild(storeElement);
        });
        
    } catch (error) {
        console.error('Error cargando tiendas del usuario:', error);
    }
}

// Modal para crear tienda
function openCreateStore() {
    const modalHTML = `
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl max-w-md w-full">
                <!-- Header -->
                <div class="bg-[#8B4513] text-white p-4 flex justify-between items-center">
                    <h3 class="text-xl font-bold">Crear Nueva Tienda</h3>
                    <button onclick="closeModal('create-store')" class="text-white hover:text-gray-200">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- Formulario -->
                <form id="create-store-form" class="p-6">
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">Clave de Invitación</label>
                        <input type="text" 
                               id="invite-key" 
                               required
                               placeholder="Ingresa la clave proporcionada por el propietario"
                               class="w-full p-3 border border-gray-300 rounded-lg focus:border-[#8B4513] focus:ring-2 focus:ring-[#8B4513]/20">
                        <p class="text-sm text-gray-500 mt-1">Necesitas una clave de invitación para crear una tienda.</p>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">Nombre de la Tienda</label>
                        <input type="text" 
                               id="store-name" 
                               required
                               placeholder="Ej: Mi Tienda Online"
                               class="w-full p-3 border border-gray-300 rounded-lg focus:border-[#8B4513] focus:ring-2 focus:ring-[#8B4513]/20">
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 mb-2">Descripción</label>
                        <textarea id="store-description" 
                                  rows="3"
                                  placeholder="Describe tu tienda..."
                                  class="w-full p-3 border border-gray-300 rounded-lg focus:border-[#8B4513] focus:ring-2 focus:ring-[#8B4513]/20"></textarea>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button type="button" 
                                onclick="closeModal('create-store')"
                                class="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition">
                            Cancelar
                        </button>
                        <button type="submit"
                                class="flex-1 bg-[#8B4513] text-white px-4 py-3 rounded-lg font-bold hover:bg-[#654321] transition">
                            Crear Tienda
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.id = 'create-store-modal';
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);
    
    // Agregar handler al formulario
    document.getElementById('create-store-form').addEventListener('submit', handleCreateStore);
}

// Manejar creación de tienda
async function handleCreateStore(e) {
    e.preventDefault();
    
    const inviteKey = document.getElementById('invite-key').value;
    const storeName = document.getElementById('store-name').value;
    const storeDescription = document.getElementById('store-description').value;
    
    try {
        // Crear la tienda
        const storeData = {
            name: storeName,
            description: storeDescription,
            invite_key: inviteKey  // Esto será validado por las reglas API
        };
        
        const newStore = await PATI_CONFIG.pb.collection('stores').create(storeData);
        
        // Crear configuración por defecto para la tienda
        const storeSettings = {
            store: newStore.id,
            store_primary_currency: 'USD',
            accept_multiple_currencies: true,
            store_commission_rate: PATI_CONFIG.platformSettings?.affiliate_default_rate || 10
        };
        
        await PATI_CONFIG.pb.collection('store_settings').create(storeSettings);
        
        // Cerrar modal y redirigir
        closeModal('create-store');
        alert('¡Tienda creada exitosamente!');
        window.location.href = `admin-tienda.html?store=${newStore.id}`;
        
    } catch (error) {
        console.error('Error creando tienda:', error);
        alert('Error: ' + error.message);
    }
}

// Cerrar modales
function closeModal(modalType) {
    const modal = document.getElementById(`${modalType}-modal`);
    if (modal) {
        modal.remove();
    }
}