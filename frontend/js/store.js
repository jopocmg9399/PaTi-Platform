/**
 * Funciones para gestión de tiendas
 */

class StoreManager {
    constructor() {
        this.pb = PATI_CONFIG.pb;
    }

    // Obtener todas las tiendas activas
    async getAllStores() {
        try {
            const stores = await this.pb.collection('stores').getFullList({
                sort: 'name',
                filter: 'active = true',
                expand: 'owner'
            });
            return stores;
        } catch (error) {
            console.error('Error obteniendo tiendas:', error);
            return [];
        }
    }

    // Obtener tienda por ID
    async getStoreById(storeId) {
        try {
            const store = await this.pb.collection('stores').getOne(storeId, {
                expand: 'owner,categories'
            });
            return store;
        } catch (error) {
            console.error('Error obteniendo tienda:', error);
            throw error;
        }
    }

    // Obtener productos de una tienda
    async getStoreProducts(storeId, page = 1, perPage = 20) {
        try {
            const result = await this.pb.collection('products').getList(page, perPage, {
                filter: `store = "${storeId}" && active = true`,
                sort: '-created',
                expand: 'category'
            });
            return result;
        } catch (error) {
            console.error('Error obteniendo productos:', error);
            return { items: [], totalPages: 0, page: 1, perPage: 20, totalItems: 0 };
        }
    }

    // Obtener productos por categoría
    async getProductsByCategory(storeId, categoryId) {
        try {
            const products = await this.pb.collection('products').getFullList({
                filter: `store = "${storeId}" && category = "${categoryId}" && active = true`,
                sort: 'name',
                expand: 'category'
            });
            return products;
        } catch (error) {
            console.error('Error obteniendo productos por categoría:', error);
            return [];
        }
    }

    // Buscar productos
    async searchProducts(storeId, query) {
        try {
            const products = await this.pb.collection('products').getFullList({
                filter: `store = "${storeId}" && active = true && (name ~ "${query}" || description ~ "${query}")`,
                sort: 'name'
            });
            return products;
        } catch (error) {
            console.error('Error buscando productos:', error);
            return [];
        }
    }

    // Obtener categorías de tienda
    async getStoreCategories(storeId) {
        try {
            const categories = await this.pb.collection('categories').getFullList({
                filter: `store = "${storeId}" && active = true`,
                sort: 'name'
            });
            return categories;
        } catch (error) {
            console.error('Error obteniendo categorías:', error);
            return [];
        }
    }

    // Crear nueva tienda (solo propietario)
    async createStore(storeData) {
        try {
            // Verificar permisos
            if (PATI_CONFIG.currentUser?.role !== 'propietario') {
                throw new Error('No tienes permisos para crear tiendas');
            }

            const store = await this.pb.collection('stores').create(storeData);
            return store;
        } catch (error) {
            console.error('Error creando tienda:', error);
            throw error;
        }
    }

    // Actualizar tienda
    async updateStore(storeId, storeData) {
        try {
            // Verificar permisos
            const canUpdate = this.canManageStore(storeId);
            if (!canUpdate) {
                throw new Error('No tienes permisos para actualizar esta tienda');
            }

            const store = await this.pb.collection('stores').update(storeId, storeData);
            return store;
        } catch (error) {
            console.error('Error actualizando tienda:', error);
            throw error;
        }
    }

    // Verificar si usuario puede gestionar tienda
    canManageStore(storeId) {
        const user = PATI_CONFIG.currentUser;
        if (!user) return false;

        if (user.role === 'propietario') return true;
        if (user.role === 'administrador' && user.store === storeId) return true;
        
        return false;
    }

    // Obtener estadísticas de tienda
    async getStoreStats(storeId) {
        try {
            // Verificar permisos
            if (!this.canManageStore(storeId)) {
                throw new Error('No tienes permisos para ver estadísticas');
            }

            // Obtener estadísticas
            const [totalProducts, totalOrders, totalRevenue] = await Promise.all([
                this.getTotalProducts(storeId),
                this.getTotalOrders(storeId),
                this.getTotalRevenue(storeId)
            ]);

            return {
                totalProducts,
                totalOrders,
                totalRevenue,
                updatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            throw error;
        }
    }

    async getTotalProducts(storeId) {
        try {
            const result = await this.pb.collection('products').getList(1, 1, {
                filter: `store = "${storeId}" && active = true`
            });
            return result.totalItems;
        } catch (error) {
            return 0;
        }
    }

    async getTotalOrders(storeId) {
        try {
            const result = await this.pb.collection('orders').getList(1, 1, {
                filter: `store = "${storeId}" && status != "cancelled"`
            });
            return result.totalItems;
        } catch (error) {
            return 0;
        }
    }

    async getTotalRevenue(storeId) {
        try {
            // Este cálculo sería mejor hacerlo en el backend
            // Por ahora devolvemos 0
            return 0;
        } catch (error) {
            return 0;
        }
    }
}

// Inicializar cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.storeManager = new StoreManager();
});