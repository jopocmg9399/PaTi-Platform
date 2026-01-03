/**
 * Funciones para gestión de productos
 */

class ProductManager {
    constructor() {
        this.pb = PATI_CONFIG.pb;
    }

    // Obtener producto por ID
    async getProductById(productId) {
        try {
            const product = await this.pb.collection('products').getOne(productId, {
                expand: 'store,category'
            });
            return product;
        } catch (error) {
            console.error('Error obteniendo producto:', error);
            throw error;
        }
    }

    // Obtener productos destacados
    async getFeaturedProducts(limit = 10) {
        try {
            const products = await this.pb.collection('products').getFullList({
                filter: 'featured = true && active = true',
                sort: '-created',
                limit: limit,
                expand: 'store'
            });
            return products;
        } catch (error) {
            console.error('Error obteniendo productos destacados:', error);
            return [];
        }
    }

    // Obtener productos recientes
    async getRecentProducts(limit = 10) {
        try {
            const products = await this.pb.collection('products').getFullList({
                filter: 'active = true',
                sort: '-created',
                limit: limit,
                expand: 'store'
            });
            return products;
        } catch (error) {
            console.error('Error obteniendo productos recientes:', error);
            return [];
        }
    }

    // Crear producto (admin/owner)
    async createProduct(productData) {
        try {
            // Verificar permisos
            const canCreate = await this.canManageProduct(productData.store);
            if (!canCreate) {
                throw new Error('No tienes permisos para crear productos');
            }

            const product = await this.pb.collection('products').create(productData);
            return product;
        } catch (error) {
            console.error('Error creando producto:', error);
            throw error;
        }
    }

    // Actualizar producto
    async updateProduct(productId, productData) {
        try {
            // Obtener producto para verificar tienda
            const product = await this.getProductById(productId);
            
            // Verificar permisos
            const canUpdate = await this.canManageProduct(product.store);
            if (!canUpdate) {
                throw new Error('No tienes permisos para actualizar este producto');
            }

            const updatedProduct = await this.pb.collection('products').update(productId, productData);
            return updatedProduct;
        } catch (error) {
            console.error('Error actualizando producto:', error);
            throw error;
        }
    }

    // Eliminar producto (soft delete)
    async deleteProduct(productId) {
        try {
            const product = await this.getProductById(productId);
            
            // Verificar permisos
            const canDelete = await this.canManageProduct(product.store);
            if (!canDelete) {
                throw new Error('No tienes permisos para eliminar este producto');
            }

            // Soft delete: marcar como inactivo
            const deletedProduct = await this.pb.collection('products').update(productId, {
                active: false
            });
            
            return deletedProduct;
        } catch (error) {
            console.error('Error eliminando producto:', error);
            throw error;
        }
    }

    // Verificar permisos de gestión
    async canManageProduct(storeId) {
        const user = PATI_CONFIG.currentUser;
        if (!user) return false;

        if (user.role === 'propietario') return true;
        if (user.role === 'administrador' && user.store === storeId) return true;
        
        return false;
    }

    // Formatear precio según moneda
    formatPrice(price, currency) {
        const rates = PATI_CONFIG.platformSettings?.currencyRates || { USD: 1, CUP: 120 };
        
        if (currency === 'USD') {
            return `$${parseFloat(price).toFixed(2)} USD`;
        } else if (currency === 'CUP') {
            const cupPrice = parseFloat(price) * rates.CUP;
            return `$${cupPrice.toFixed(2)} CUP`;
        }
        
        return `$${parseFloat(price).toFixed(2)}`;
    }

    // Obtener conversión de moneda
    getCurrencyConversion(amount, fromCurrency, toCurrency) {
        const rates = PATI_CONFIG.platformSettings?.currencyRates || { USD: 1, CUP: 120 };
        
        if (fromCurrency === 'USD' && toCurrency === 'CUP') {
            return amount * rates.CUP;
        } else if (fromCurrency === 'CUP' && toCurrency === 'USD') {
            return amount / rates.CUP;
        }
        
        return amount;
    }

    // Renderizar producto en HTML
    renderProductCard(product) {
        return `
            <div class="product-card" data-id="${product.id}">
                <div class="product-image">
                    ${product.images && product.images.length > 0 ? 
                        `<img src="${this.pb.getFileUrl(product, product.images[0])}" alt="${product.name}">` :
                        `<div class="no-image">Sin imagen</div>`
                    }
                    ${product.featured ? '<span class="featured-badge">Destacado</span>' : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-description">${product.description?.substring(0, 100)}...</p>
                    <div class="product-price">
                        <span class="price">${this.formatPrice(product.price, product.currency)}</span>
                        ${product.originalPrice ? 
                            `<span class="original-price">${this.formatPrice(product.originalPrice, product.currency)}</span>` : ''
                        }
                    </div>
                    <div class="product-actions">
                        <button class="btn btn-outline btn-sm view-product" data-id="${product.id}">
                            Ver detalles
                        </button>
                        <button class="btn btn-primary btn-sm add-to-cart" data-id="${product.id}">
                            <i class="fas fa-cart-plus"></i> Añadir
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Inicializar cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.productManager = new ProductManager();
    
    // Event listeners para botones de producto
    document.addEventListener('click', async (e) => {
        // Ver detalles del producto
        if (e.target.classList.contains('view-product')) {
            const productId = e.target.dataset.id;
            window.location.href = `producto.html?id=${productId}`;
        }
        
        // Añadir al carrito
        if (e.target.classList.contains('add-to-cart') || e.target.closest('.add-to-cart')) {
            const button = e.target.classList.contains('add-to-cart') ? e.target : e.target.closest('.add-to-cart');
            const productId = button.dataset.id;
            
            try {
                const product = await window.productManager.getProductById(productId);
                window.cartManager.addToCart(product);
            } catch (error) {
                console.error('Error añadiendo al carrito:', error);
                showError('Error al añadir el producto al carrito');
            }
        }
    });
});