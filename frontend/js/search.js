// js/search.js - Sistema de búsqueda avanzada
const SearchSystem = {
    // Búsqueda de productos con filtros avanzados
    async searchProducts(query, filters = {}) {
        try {
            let filterString = '';
            
            // Filtro de texto
            if (query) {
                filterString += `(name ~ '${query}' || description ~ '${query}')`;
            }
            
            // Filtro por tienda
            if (filters.storeId) {
                filterString += filterString ? ` && store = '${filters.storeId}'` : `store = '${filters.storeId}'`;
            }
            
            // Filtro por categoría
            if (filters.categoryId) {
                filterString += filterString ? ` && category = '${filters.categoryId}'` : `category = '${filters.categoryId}'`;
            }
            
            // Filtro por precio
            if (filters.minPrice) {
                filterString += filterString ? ` && price1 >= ${filters.minPrice}` : `price1 >= ${filters.minPrice}`;
            }
            if (filters.maxPrice) {
                filterString += filterString ? ` && price1 <= ${filters.maxPrice}` : `price1 <= ${filters.maxPrice}`;
            }
            
            // Filtro por moneda
            if (filters.currency) {
                filterString += filterString ? ` && currency = '${filters.currency}'` : `currency = '${filters.currency}'`;
            }
            
            // Realizar búsqueda
            const products = await PATI_CONFIG.pb.collection('products').getList(1, 50, {
                filter: filterString,
                sort: filters.sort || '-created',
                $autoCancel: false
            });
            
            return products.items;
        } catch (error) {
            console.error('Error en búsqueda de productos:', error);
            return [];
        }
    },
    
    // Búsqueda de tiendas
    async searchStores(query, filters = {}) {
        try {
            let filterString = '';
            
            // Filtro de texto
            if (query) {
                filterString += `(name ~ '${query}' || description ~ '${query}')`;
            }
            
            // Filtro por categoría
            if (filters.categoryId) {
                filterString += filterString ? ` && category = '${filters.categoryId}'` : `category = '${filters.categoryId}'`;
            }
            
            // Filtro por estado
            if (filters.status) {
                filterString += filterString ? ` && status = '${filters.status}'` : `status = '${filters.status}'`;
            }
            
            // Realizar búsqueda
            const stores = await PATI_CONFIG.pb.collection('stores').getList(1, 50, {
                filter: filterString,
                sort: filters.sort || '-created',
                $autoCancel: false
            });
            
            return stores.items;
        } catch (error) {
            console.error('Error en búsqueda de tiendas:', error);
            return [];
        }
    },
    
    // Autocompletado para búsqueda
    async getSearchSuggestions(query, type = 'products') {
        try {
            if (!query || query.length < 2) return [];
            
            const collection = type === 'products' ? 'products' : 'stores';
            const results = await PATI_CONFIG.pb.collection(collection).getList(1, 5, {
                filter: `name ~ '${query}'`,
                $autoCancel: false
            });
            
            return results.items.map(item => item.name);
        } catch (error) {
            console.error('Error obteniendo sugerencias:', error);
            return [];
        }
    }
};