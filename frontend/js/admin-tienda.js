// js/admin-tienda.js - Funcionalidades específicas para administradores de tienda
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar que el usuario es administrador
    if (!PATI_CONFIG.currentUser || PATI_CONFIG.currentUser.role !== 'administrador') {
        window.location.href = 'login.html';
        return;
    }
    
    // Cargar datos de la tienda
    await loadStoreData();
    
    // Cargar estadísticas iniciales
    await loadDashboardStats();
    
    // Inicializar gráficos
    initCharts();
});

// Cargar datos de la tienda
async function loadStoreData() {
    try {
        const storeId = PATI_CONFIG.currentUser.store;
        const store = await PATI_CONFIG.pb.collection('stores').getOne(storeId);
        
        // Actualizar UI con datos de la tienda
        document.getElementById('storeName').textContent = store.name;
        document.getElementById('adminName').textContent = PATI_CONFIG.currentUser.name;
        
        PATI_CONFIG.currentStore = store;
        return store;
    } catch (error) {
        console.error('Error cargando datos de la tienda:', error);
        PATI_CONFIG.showNotification('Error al cargar datos de la tienda', 'danger');
        return null;
    }
}

// Cargar estadísticas del dashboard
async function loadDashboardStats() {
    try {
        const storeId = PATI_CONFIG.currentUser.store;
        
        // Contar productos
        const productsCount = await PATI_CONFIG.pb.collection('products').getList(1, 1, {
            filter: `store = '${storeId}'`,
            $autoCancel: false
        });
        
        // Contar pedidos de hoy
        const today = new Date().toISOString().split('T')[0];
        const ordersCount = await PATI_CONFIG.pb.collection('orders').getList(1, 1, {
            filter: `store = '${storeId}' && created >= '${today}T00:00:00Z' && created <= '${today}T23:59:59Z'`,
            $autoCancel: false
        });
        
        // Contar clientes
        const customersCount = await PATI_CONFIG.pb.collection('users').getList(1, 1, {
            filter: `store = '${storeId}' && role = 'cliente'`,
            $autoCancel: false
        });
        
        // Calcular ventas de hoy
        const orders = await PATI_CONFIG.pb.collection('orders').getFullList({
            filter: `store = '${storeId}' && created >= '${today}T00:00:00Z' && created <= '${today}T23:59:59Z'`,
            $autoCancel: false
        });
        
        const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
        
        // Actualizar UI
        document.getElementById('totalProducts').textContent = productsCount.totalItems;
        document.getElementById('totalOrders').textContent = ordersCount.totalItems;
        document.getElementById('totalCustomers').textContent = customersCount.totalItems;
        document.getElementById('totalSales').textContent = `$${totalSales.toFixed(2)}`;
        
        return {
            products: productsCount.totalItems,
            orders: ordersCount.totalItems,
            customers: customersCount.totalItems,
            sales: totalSales
        };
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        PATI_CONFIG.showNotification('Error al cargar estadísticas', 'danger');
        return null;
    }
}

// Inicializar gráficos
function initCharts() {
    // Gráfico de ventas
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
        new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
                datasets: [{
                    label: 'Ventas',
                    data: [120, 190, 150, 250, 220, 280, 200],
                    borderColor: '#D4AF37',
                    backgroundColor: 'rgba(212, 175, 55, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }
}

// Mostrar pestaña específica
function showTab(tabName) {
    // Ocultar todas las pestañas
    const tabs = document.querySelectorAll('.admin-tab-content');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar la pestaña seleccionada
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Actualizar navegación activa
    const menuItems = document.querySelectorAll('.admin-menu-item');
    menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick').includes(tabName)) {
            item.classList.add('active');
        }
    });
    
    // Actualizar título de página
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        const titles = {
            dashboard: 'Dashboard',
            products: 'Productos',
            orders: 'Pedidos',
            customers: 'Clientes',
            affiliates: 'Afiliados',
            settings: 'Configuración'
        };
        pageTitle.textContent = titles[tabName] || 'Panel de Administración';
    }
    
    // Cargar datos específicos de la pestaña
    switch(tabName) {
        case 'products':
            loadProducts();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'affiliates':
            loadAffiliates();
            break;
    }
}

// Cargar productos
async function loadProducts() {
    try {
        const storeId = PATI_CONFIG.currentUser.store;
        const products = await PATI_CONFIG.pb.collection('products').getList(1, 50, {
            filter: `store = '${storeId}'`,
            sort: '-created',
            $autoCancel: false
        });
        
        const productsTable = document.getElementById('productsTable');
        if (productsTable) {
            productsTable.innerHTML = '';
            
            products.items.forEach(product => {
                const row = `
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.currency || 'USD'} ${product.price1}</td>
                        <td>${product.stock}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editProduct('${product.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                productsTable.innerHTML += row;
            });
        }
        
        return products.items;
    } catch (error) {
        console.error('Error cargando productos:', error);
        PATI_CONFIG.showNotification('Error al cargar productos', 'danger');
        return [];
    }
}

// Funciones similares para orders, customers, affiliates...
// ...