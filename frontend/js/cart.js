// cart.js - Sistema de carrito simplificado para PaTí

console.log('Sistema de carrito cargado');

// Carrito en localStorage
let cart = JSON.parse(localStorage.getItem('pati_cart') || '[]');

// Actualizar badge del carrito
function updateCartCount() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    const badges = document.querySelectorAll('.cart-icon-badge');
    
    badges.forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    });
    
    return count;
}

// Agregar producto al carrito
function addToCart(product, quantity = 1, currency = 'USD') {
    // Buscar si el producto ya está en el carrito
    const existingIndex = cart.findIndex(item => 
        item.productId === product.id && item.currency === currency
    );
    
    if (existingIndex > -1) {
        // Actualizar cantidad
        cart[existingIndex].quantity += quantity;
    } else {
        // Agregar nuevo item
        const cartItem = {
            productId: product.id,
            storeId: product.store || null,
            name: product.name,
            price: product.price_base || product.price || 0,
            currency: currency,
            quantity: quantity,
            image: product.images?.[0] || null,
            addedAt: new Date().toISOString()
        };
        
        cart.push(cartItem);
    }
    
    // Guardar en localStorage
    localStorage.setItem('pati_cart', JSON.stringify(cart));
    
    // Actualizar UI
    updateCartCount();
    
    // Mostrar notificación
    showNotification(`¡${product.name} añadido al carrito!`, 'success');
    
    return true;
}

// Remover del carrito
function removeFromCart(productId, currency) {
    const initialLength = cart.length;
    cart = cart.filter(item => !(item.productId === productId && item.currency === currency));
    
    if (cart.length < initialLength) {
        localStorage.setItem('pati_cart', JSON.stringify(cart));
        updateCartCount();
        showNotification('Producto removido del carrito', 'info');
        return true;
    }
    return false;
}

// Vaciar carrito
function clearCart() {
    cart = [];
    localStorage.setItem('pati_cart', JSON.stringify(cart));
    updateCartCount();
    showNotification('Carrito vaciado', 'info');
}

// Mostrar notificación
function showNotification(message, type = 'info') {
    // Crear toast
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 transition-all duration-300 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`;
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Abrir modal del carrito
function openCartModal() {
    const modalHTML = `
        <div id="cart-modal" class="fixed inset-0 bg-black/50 z-50 flex justify-end">
            <div class="bg-white w-full max-w-md h-full flex flex-col">
                <!-- Header -->
                <div class="bg-[#8B4513] text-white p-4 flex justify-between items-center">
                    <h3 class="text-xl font-bold">
                        <i class="fas fa-shopping-cart mr-2"></i>
                        Mi Carrito
                        <span class="badge ml-2 bg-white/20 px-2 py-1 rounded-full text-sm">
                            ${updateCartCount()}
                        </span>
                    </h3>
                    <button onclick="closeCartModal()" class="text-white hover:text-gray-200">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- Contenido -->
                <div class="flex-grow overflow-y-auto p-4">
                    ${cart.length === 0 ? `
                        <div class="text-center py-12">
                            <i class="fas fa-shopping-cart text-gray-300 text-5xl mb-4"></i>
                            <p class="text-gray-500 mb-6">Tu carrito está vacío</p>
                            <button onclick="closeCartModal()" class="bg-[#8B4513] text-white px-6 py-3 rounded-lg">
                                Explorar Tiendas
                            </button>
                        </div>
                    ` : renderCartItems()}
                </div>
                
                <!-- Footer -->
                ${cart.length > 0 ? `
                <div class="border-t p-4">
                    <div class="flex justify-between mb-4">
                        <span class="font-bold">Total:</span>
                        <span class="font-bold text-[#8B4513]">$${calculateTotal().toFixed(2)}</span>
                    </div>
                    <a href="carrito.html" class="block w-full bg-[#8B4513] text-white text-center py-3 rounded-lg font-bold mb-2">
                        Ver Carrito Completo
                    </a>
                    <a href="checkout.html" class="block w-full border-2 border-[#8B4513] text-[#8B4513] text-center py-3 rounded-lg font-bold">
                        Proceder al Pago
                    </a>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Remover modal existente
    const existingModal = document.getElementById('cart-modal');
    if (existingModal) existingModal.remove();
    
    // Agregar nuevo modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Renderizar items del carrito en modal
function renderCartItems() {
    let html = '<div class="space-y-4">';
    
    // Mostrar solo primeros 3 items
    const itemsToShow = cart.slice(0, 3);
    
    itemsToShow.forEach(item => {
        const itemTotal = item.price * item.quantity;
        const currencySymbol = item.currency === 'USD' ? '$' : 'CUP $';
        
        html += `
            <div class="flex items-center border-b pb-4">
                <div class="flex-grow">
                    <h4 class="font-bold text-sm">${item.name}</h4>
                    <div class="flex justify-between text-sm text-gray-600">
                        <span>${item.quantity} x ${currencySymbol}${item.price.toFixed(2)}</span>
                        <span class="font-bold">${currencySymbol}${itemTotal.toFixed(2)}</span>
                    </div>
                </div>
                <button onclick="removeItemFromModal('${item.productId}', '${item.currency}')" 
                        class="ml-4 text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    if (cart.length > 3) {
        html += `
            <div class="text-center text-sm text-gray-500">
                +${cart.length - 3} productos más
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// Remover desde modal
function removeItemFromModal(productId, currency) {
    removeFromCart(productId, currency);
    
    // Si hay modal abierto, actualizarlo
    if (document.getElementById('cart-modal')) {
        openCartModal(); // Reabrir para actualizar
    }
}

// Cerrar modal del carrito
function closeCartModal() {
    const modal = document.getElementById('cart-modal');
    if (modal) {
        modal.remove();
    }
}

// Calcular total
function calculateTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    updateCartCount();
    
    // Configurar click en icono del carrito
    document.querySelectorAll('.cart-icon').forEach(icon => {
        icon.addEventListener('click', openCartModal);
    });
});

// Hacer funciones disponibles globalmente
window.cartSystem = {
    cart: cart,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    updateCartCount: updateCartCount,
    openCartModal: openCartModal,
    closeCartModal: closeCartModal
};

// Alias para compatibilidad
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.updateCartCount = updateCartCount;