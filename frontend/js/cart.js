/**
 * Sistema de Carrito de Compras
 * Integrado con PocketBase
 */

class CartManager {
    constructor() {
        this.pb = PATI_CONFIG.pb;
        this.cart = [];
        this.loadCartFromStorage();
    }

    // Cargar carrito desde localStorage
    loadCartFromStorage() {
        try {
            const cartData = localStorage.getItem('pati_cart');
            if (cartData) {
                this.cart = JSON.parse(cartData);
                PATI_CONFIG.cart = this.cart;
            }
        } catch (error) {
            console.error('Error cargando carrito:', error);
            this.cart = [];
        }
    }

    // Guardar carrito en localStorage
    saveCartToStorage() {
        try {
            localStorage.setItem('pati_cart', JSON.stringify(this.cart));
            PATI_CONFIG.cart = this.cart;
        } catch (error) {
            console.error('Error guardando carrito:', error);
        }
    }

    // Añadir producto al carrito
    addToCart(product, quantity = 1) {
        try {
            // Verificar si el producto ya está en el carrito
            const existingItemIndex = this.cart.findIndex(item => 
                item.productId === product.id && item.storeId === product.store
            );

            if (existingItemIndex !== -1) {
                // Actualizar cantidad
                this.cart[existingItemIndex].quantity += quantity;
            } else {
                // Añadir nuevo item
                const cartItem = {
                    productId: product.id,
                    storeId: product.store,
                    name: product.name,
                    price: product.price,
                    currency: product.currency,
                    quantity: quantity,
                    image: product.images?.[0] || null,
                    productData: product // Guardar datos completos para checkout
                };

                this.cart.push(cartItem);
            }

            this.saveCartToStorage();
            this.updateCartUI();
            this.showAddToCartNotification(product.name);

            return true;
        } catch (error) {
            console.error('Error añadiendo al carrito:', error);
            return false;
        }
    }

    // Actualizar cantidad de producto
    updateQuantity(productId, quantity) {
        const itemIndex = this.cart.findIndex(item => item.productId === productId);
        
        if (itemIndex !== -1) {
            if (quantity <= 0) {
                this.cart.splice(itemIndex, 1);
            } else {
                this.cart[itemIndex].quantity = quantity;
            }
            
            this.saveCartToStorage();
            this.updateCartUI();
            return true;
        }
        
        return false;
    }

    // Eliminar producto del carrito
    removeFromCart(productId) {
        const initialLength = this.cart.length;
        this.cart = this.cart.filter(item => item.productId !== productId);
        
        if (this.cart.length !== initialLength) {
            this.saveCartToStorage();
            this.updateCartUI();
            return true;
        }
        
        return false;
    }

    // Vaciar carrito
    clearCart() {
        this.cart = [];
        this.saveCartToStorage();
        this.updateCartUI();
    }

    // Obtener total del carrito
    getCartTotal() {
        const totalsByCurrency = {};
        
        this.cart.forEach(item => {
            if (!totalsByCurrency[item.currency]) {
                totalsByCurrency[item.currency] = 0;
            }
            totalsByCurrency[item.currency] += item.price * item.quantity;
        });
        
        return totalsByCurrency;
    }

    // Obtener total de items
    getItemCount() {
        return this.cart.reduce((total, item) => total + item.quantity, 0);
    }

    // Agrupar por tienda
    getCartByStore() {
        const stores = {};
        
        this.cart.forEach(item => {
            if (!stores[item.storeId]) {
                stores[item.storeId] = {
                    storeId: item.storeId,
                    items: [],
                    total: 0
                };
            }
            
            stores[item.storeId].items.push(item);
            stores[item.storeId].total += item.price * item.quantity;
        });
        
        return Object.values(stores);
    }

    // Actualizar UI del carrito
    updateCartUI() {
        // Actualizar contador
        const cartCountElements = document.querySelectorAll('.cart-count');
        const count = this.getItemCount();
        
        cartCountElements.forEach(element => {
            element.textContent = count;
            element.style.display = count > 0 ? 'flex' : 'none';
        });

        // Actualizar modal del carrito si está abierto
        this.updateCartModal();

        // Actualizar página del carrito si estamos en ella
        if (window.location.pathname.includes('carrito.html')) {
            this.renderCartPage();
        }
    }

    // Mostrar notificación de producto añadido
    showAddToCartNotification(productName) {
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span><strong>${productName}</strong> añadido al carrito</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-remover después de 3 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Renderizar página del carrito
    async renderCartPage() {
        const cartContainer = document.getElementById('cart-container');
        if (!cartContainer) return;

        if (this.cart.length === 0) {
            cartContainer.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <h2>Tu carrito está vacío</h2>
                    <p>Añade algunos productos para continuar</p>
                    <a href="index.html" class="btn btn-primary">Ver tiendas</a>
                </div>
            `;
            return;
        }

        try {
            // Agrupar por tienda
            const cartByStore = this.getCartByStore();
            let html = '';

            for (const storeGroup of cartByStore) {
                // Obtener información de la tienda
                let storeName = 'Tienda';
                try {
                    const store = await this.pb.collection('stores').getOne(storeGroup.storeId);
                    storeName = store.name;
                } catch (error) {
                    console.error('Error obteniendo tienda:', error);
                }

                html += `
                    <div class="store-group">
                        <div class="store-header">
                            <h3>${storeName}</h3>
                        </div>
                        <div class="cart-items">
                            ${storeGroup.items.map(item => this.renderCartItem(item)).join('')}
                        </div>
                        <div class="store-total">
                            <span>Subtotal (${storeGroup.items.length} productos):</span>
                            <span class="price">${this.formatPrice(storeGroup.total, storeGroup.items[0].currency)}</span>
                        </div>
                    </div>
                `;
            }

            // Totales generales
            const totals = this.getCartTotal();
            const totalHtml = Object.entries(totals).map(([currency, amount]) => `
                <div class="total-line">
                    <span>Total (${currency}):</span>
                    <span class="price">${this.formatPrice(amount, currency)}</span>
                </div>
            `).join('');

            html += `
                <div class="cart-totals">
                    <h3>Resumen del pedido</h3>
                    ${totalHtml}
                    <div class="cart-actions">
                        <a href="index.html" class="btn btn-outline">Seguir comprando</a>
                        <a href="checkout.html" class="btn btn-primary">Proceder al pago</a>
                    </div>
                </div>
            `;

            cartContainer.innerHTML = html;

            // Añadir event listeners a los botones
            this.addCartEventListeners();

        } catch (error) {
            console.error('Error renderizando carrito:', error);
            cartContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>Error al cargar el carrito</h2>
                    <p>Por favor, intenta nuevamente</p>
                    <button class="btn btn-outline" onclick="location.reload()">Reintentar</button>
                </div>
            `;
        }
    }

    // Renderizar item del carrito
    renderCartItem(item) {
        return `
            <div class="cart-item" data-id="${item.productId}">
                <div class="item-image">
                    ${item.image ? 
                        `<img src="${this.pb.getFileUrl({ id: item.productId }, item.image)}" alt="${item.name}">` :
                        `<div class="no-image">Sin imagen</div>`
                    }
                </div>
                <div class="item-info">
                    <h4 class="item-title">${item.name}</h4>
                    <div class="item-price">${this.formatPrice(item.price, item.currency)}</div>
                </div>
                <div class="item-quantity">
                    <button class="quantity-btn minus" data-id="${item.productId}">-</button>
                    <input type="number" min="1" value="${item.quantity}" 
                           class="quantity-input" data-id="${item.productId}">
                    <button class="quantity-btn plus" data-id="${item.productId}">+</button>
                </div>
                <div class="item-total">
                    ${this.formatPrice(item.price * item.quantity, item.currency)}
                </div>
                <div class="item-actions">
                    <button class="remove-btn" data-id="${item.productId}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Formatear precio
    formatPrice(price, currency) {
        const productManager = window.productManager;
        if (productManager && productManager.formatPrice) {
            return productManager.formatPrice(price, currency);
        }
        
        if (currency === 'USD') {
            return `$${parseFloat(price).toFixed(2)} USD`;
        } else {
            return `$${parseFloat(price).toFixed(2)} CUP`;
        }
    }

    // Añadir event listeners
    addCartEventListeners() {
        // Botones de cantidad
        document.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                const isPlus = e.target.classList.contains('plus');
                
                const item = this.cart.find(item => item.productId === productId);
                if (item) {
                    const newQuantity = isPlus ? item.quantity + 1 : item.quantity - 1;
                    this.updateQuantity(productId, newQuantity);
                }
            });
        });

        // Inputs de cantidad
        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const productId = e.target.dataset.id;
                const newQuantity = parseInt(e.target.value) || 1;
                this.updateQuantity(productId, newQuantity);
            });
        });

        // Botones de eliminar
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.closest('.remove-btn').dataset.id;
                this.removeFromCart(productId);
            });
        });
    }
}

// Inicializar cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.cartManager = new CartManager();
    window.cartManager.updateCartUI();
});

// Función global para actualizar contador
window.updateCartCount = function() {
    if (window.cartManager) {
        window.cartManager.updateCartUI();
    }
};