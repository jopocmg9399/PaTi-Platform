// checkout.js - Sistema completo de checkout para PaTí

// Variables globales
let currentStep = 1;
let selectedPaymentMethod = null;
let selectedCurrency = 'USD';
let shippingInfo = {};
let paymentInfo = {};
let affiliateClientData = null;

// Inicializar checkout
async function initCheckout() {
    try {
        // Verificar que hay items en el carrito
        const cart = JSON.parse(localStorage.getItem('pati_cart') || '[]');
        if (cart.length === 0) {
            alert('Tu carrito está vacío. Agrega productos primero.');
            window.location.href = 'carrito.html';
            return;
        }
        
        // Verificar si es afiliado
        checkAffiliateStatus();
        
        // Cargar resumen del carrito
        loadCartSummary();
        
        // Configurar pasos
        setupSteps();
        
        // Generar referencia de transferencia
        generateTransferReference();
        
        // Configurar event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error inicializando checkout:', error);
        showError('Error al cargar el checkout');
    }
}

// Verificar si es afiliado
function checkAffiliateStatus() {
    if (PATI_CONFIG?.currentUser?.role === 'afiliado') {
        // Verificar si ya tiene datos de cliente guardados
        const savedClientData = localStorage.getItem('affiliate_client_data');
        if (!savedClientData) {
            // Mostrar modal para datos del cliente
            showAffiliateClientModal();
        } else {
            affiliateClientData = JSON.parse(savedClientData);
        }
    }
}

// Mostrar modal para datos del cliente (afiliados)
function showAffiliateClientModal() {
    const modalHTML = `
        <div id="affiliate-client-modal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-2xl max-w-md w-full">
                <div class="bg-[#8B4513] text-white p-6 rounded-t-2xl">
                    <h3 class="text-xl font-bold">Datos del Cliente Final</h3>
                    <p class="text-sm opacity-90 mt-1">Como afiliado, necesitamos los datos del cliente</p>
                </div>
                
                <form id="affiliate-client-form" class="p-6">
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">Nombre del Cliente *</label>
                        <input type="text" id="modal-client-name" required
                               class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">Apellidos *</label>
                        <input type="text" id="modal-client-lastname" required
                               class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-gray-700 mb-2">Email *</label>
                        <input type="email" id="modal-client-email" required
                               class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div class="mb-6">
                        <label class="block text-gray-700 mb-2">Teléfono *</label>
                        <input type="tel" id="modal-client-phone" required
                               class="w-full p-3 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div class="flex space-x-3">
                        <button type="button" onclick="closeAffiliateModal()"
                                class="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-lg">
                            Cancelar
                        </button>
                        <button type="submit"
                                class="flex-1 bg-[#8B4513] text-white px-4 py-3 rounded-lg font-bold">
                            Continuar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Configurar formulario
    document.getElementById('affiliate-client-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveAffiliateClientData();
    });
}

// Guardar datos del cliente (afiliados)
function saveAffiliateClientData() {
    const clientData = {
        name: document.getElementById('modal-client-name').value,
        lastname: document.getElementById('modal-client-lastname').value,
        email: document.getElementById('modal-client-email').value,
        phone: document.getElementById('modal-client-phone').value
    };
    
    // Validar
    if (!clientData.name || !clientData.lastname || !clientData.email || !clientData.phone) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    // Guardar
    localStorage.setItem('affiliate_client_data', JSON.stringify(clientData));
    affiliateClientData = clientData;
    
    // Cerrar modal
    closeAffiliateModal();
    
    // Continuar con checkout
    loadCartSummary();
}

// Cerrar modal de afiliado
function closeAffiliateModal() {
    const modal = document.getElementById('affiliate-client-modal');
    if (modal) modal.remove();
}

// Cargar resumen del carrito
function loadCartSummary() {
    const cart = JSON.parse(localStorage.getItem('pati_cart') || '[]');
    const cartItemsContainer = document.getElementById('checkout-cart-items');
    const subtotalElement = document.getElementById('checkout-subtotal');
    const shippingElement = document.getElementById('checkout-shipping');
    const totalElement = document.getElementById('checkout-total');
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="text-center py-4 text-gray-500">
                <i class="fas fa-shopping-cart text-2xl mb-2"></i>
                <p>Carrito vacío</p>
            </div>
        `;
        return;
    }
    
    // Calcular subtotal
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const shipping = calculateShipping(subtotal);
    const total = subtotal + shipping;
    
    // Actualizar precios
    subtotalElement.textContent = formatPrice(subtotal);
    shippingElement.textContent = formatPrice(shipping);
    totalElement.textContent = formatPrice(total);
    
    // Actualizar items
    let itemsHTML = '<div class="space-y-3">';
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        const currencySymbol = item.currency === 'USD' ? '$' : 'CUP $';
        
        itemsHTML += `
            <div class="flex justify-between items-center text-sm">
                <div class="flex-grow">
                    <div class="font-medium truncate">${item.name}</div>
                    <div class="text-gray-500 text-xs">
                        ${currencySymbol}${item.price.toFixed(2)} x ${item.quantity}
                    </div>
                </div>
                <div class="font-bold text-[#8B4513] whitespace-nowrap">
                    ${currencySymbol}${itemTotal.toFixed(2)}
                </div>
            </div>
        `;
    });
    
    itemsHTML += '</div>';
    cartItemsContainer.innerHTML = itemsHTML;
    
    // Actualizar resumen en paso 3
    updateOrderSummary();
    
    // Actualizar totales finales
    updateFinalTotals(subtotal, shipping, total);
}

// Calcular costo de envío
function calculateShipping(subtotal) {
    // Lógica simple: gratis sobre $50, de lo contrario $5
    if (subtotal >= 50) {
        return 0;
    }
    return 5;
}

// Formatear precio
function formatPrice(amount) {
    const symbol = selectedCurrency === 'USD' ? '$' : 'CUP $';
    return `${symbol}${amount.toFixed(2)}`;
}

// Configurar pasos del checkout
function setupSteps() {
    // Marcar paso 1 como activo
    document.querySelectorAll('.checkout-step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index === 0) {
            step.classList.add('active');
        }
    });
}

// Configurar event listeners
function setupEventListeners() {
    // Selector de moneda
    document.querySelectorAll('input[name="currency"]').forEach(radio => {
        radio.addEventListener('change', function() {
            selectedCurrency = this.value;
            loadCartSummary(); // Recalcular con nueva moneda
        });
    });
    
    // Botón de volver al carrito
    document.querySelector('a[href="carrito.html"]')?.addEventListener('click', function(e) {
        if (currentStep > 1) {
            e.preventDefault();
            if (confirm('¿Seguro que quieres volver al carrito? Perderás la información del checkout.')) {
                window.location.href = 'carrito.html';
            }
        }
    });
}

// Generar referencia de transferencia
function generateTransferReference() {
    const ref = 'PATI-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const element = document.getElementById('transfer-reference');
    if (element) {
        element.textContent = ref;
    }
}

// Navegar entre pasos
function goToStep(stepNumber) {
    // Validar formulario actual si estamos avanzando
    if (stepNumber > currentStep) {
        if (!validateCurrentStep()) {
            return;
        }
        
        // Guardar datos del paso actual
        saveStepData(currentStep);
    }
    
    // Ocultar todos los pasos
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.add('hidden');
    document.getElementById('step-3').classList.add('hidden');
    
    // Mostrar paso seleccionado
    document.getElementById(`step-${stepNumber}`).classList.remove('hidden');
    
    // Actualizar indicadores de pasos
    updateStepIndicators(stepNumber);
    
    currentStep = stepNumber;
    
    // Si vamos al paso 3, actualizar resumen
    if (stepNumber === 3) {
        updateOrderSummary();
        updateShippingSummary();
        updatePaymentSummary();
        updateFinalTotals();
    }
}

// Actualizar indicadores de pasos
function updateStepIndicators(currentStep) {
    document.querySelectorAll('.checkout-step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        
        if (index + 1 === currentStep) {
            step.classList.add('active');
        } else if (index + 1 < currentStep) {
            step.classList.add('completed');
        }
    });
}

// Validar paso actual
function validateCurrentStep() {
    if (currentStep === 1) {
        // Validar información de envío
        const requiredFields = [
            'shipping-name',
            'shipping-lastname', 
            'shipping-email',
            'shipping-phone',
            'shipping-address',
            'shipping-city',
            'shipping-state'
        ];
        
        for (const fieldId of requiredFields) {
            const field = document.getElementById(fieldId);
            if (!field.value.trim()) {
                alert(`Por favor completa el campo: ${field.previousElementSibling?.textContent || fieldId}`);
                field.focus();
                return false;
            }
        }
        
        // Validar email
        const email = document.getElementById('shipping-email').value;
        if (!isValidEmail(email)) {
            alert('Por favor ingresa un email válido');
            return false;
        }
        
    } else if (currentStep === 2) {
        // Validar método de pago seleccionado
        if (!selectedPaymentMethod) {
            alert('Por favor selecciona un método de pago');
            return false;
        }
        
        // Validar términos y condiciones
        const terms = document.getElementById('terms');
        if (!terms || !terms.checked) {
            alert('Debes aceptar los términos y condiciones');
            return false;
        }
    }
    
    return true;
}

// Validar email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Guardar datos del paso actual
function saveStepData(step) {
    if (step === 1) {
        shippingInfo = {
            name: document.getElementById('shipping-name').value,
            lastname: document.getElementById('shipping-lastname').value,
            email: document.getElementById('shipping-email').value,
            phone: document.getElementById('shipping-phone').value,
            address: document.getElementById('shipping-address').value,
            city: document.getElementById('shipping-city').value,
            state: document.getElementById('shipping-state').value,
            zip: document.getElementById('shipping-zip').value,
            notes: document.getElementById('shipping-notes').value
        };
    } else if (step === 2) {
        paymentInfo = {
            method: selectedPaymentMethod,
            currency: selectedCurrency
        };
    }
}

// Seleccionar método de pago
function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    
    // Remover selección previa
    document.querySelectorAll('.payment-method').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Agregar selección actual
    event.currentTarget.classList.add('selected');
    
    // Mostrar/ocultar formularios específicos
    document.getElementById('card-form').classList.add('hidden');
    document.getElementById('transfer-info').classList.add('hidden');
    
    if (method === 'card') {
        document.getElementById('card-form').classList.remove('hidden');
    } else if (method === 'transfer') {
        document.getElementById('transfer-info').classList.remove('hidden');
    }
}

// Actualizar moneda de pago
function updatePaymentCurrency(currency) {
    selectedCurrency = currency;
    loadCartSummary();
}

// Actualizar resumen de la orden
function updateOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('pati_cart') || '[]');
    const container = document.getElementById('order-summary');
    
    if (!container) return;
    
    let html = '<div class="space-y-3">';
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        const currencySymbol = item.currency === 'USD' ? '$' : 'CUP $';
        
        html += `
            <div class="flex justify-between items-center">
                <div>
                    <span class="font-medium">${item.name}</span>
                    <div class="text-sm text-gray-600">
                        ${currencySymbol}${item.price.toFixed(2)} x ${item.quantity}
                    </div>
                </div>
                <span class="font-bold">${currencySymbol}${itemTotal.toFixed(2)}</span>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Actualizar resumen de envío
function updateShippingSummary() {
    const container = document.getElementById('shipping-summary');
    if (!container) return;
    
    const html = `
        <div class="text-sm">
            <div class="font-bold">${shippingInfo.name} ${shippingInfo.lastname}</div>
            <div>${shippingInfo.address}</div>
            <div>${shippingInfo.city}, ${shippingInfo.state} ${shippingInfo.zip}</div>
            <div>${shippingInfo.phone}</div>
            <div>${shippingInfo.email}</div>
            ${shippingInfo.notes ? `<div class="mt-2 text-gray-600">Notas: ${shippingInfo.notes}</div>` : ''}
        </div>
    `;
    
    container.innerHTML = html;
}

// Actualizar resumen de pago
function updatePaymentSummary() {
    const container = document.getElementById('payment-summary');
    if (!container) return;
    
    const methodNames = {
        'card': 'Tarjeta de Crédito/Débito',
        'transfer': 'Transferencia Bancaria',
        'cash': 'Efectivo en Entrega',
        'wallet': 'Monedero Digital'
    };
    
    const html = `
        <div class="text-sm">
            <div class="font-bold">${methodNames[selectedPaymentMethod] || selectedPaymentMethod}</div>
            <div>Moneda: ${selectedCurrency}</div>
            ${selectedPaymentMethod === 'transfer' ? 
                `<div class="mt-2 text-gray-600">
                    Referencia: <span class="font-mono">${document.getElementById('transfer-reference')?.textContent || 'PATI-XXXXXXX'}</span>
                </div>` : ''}
        </div>
    `;
    
    container.innerHTML = html;
}

// Actualizar totales finales
function updateFinalTotals(subtotal, shipping, total) {
    // Si no se pasan valores, calcular
    if (subtotal === undefined) {
        const cart = JSON.parse(localStorage.getItem('pati_cart') || '[]');
        subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        shipping = calculateShipping(subtotal);
        total = subtotal + shipping;
    }
    
    // Actualizar elementos
    const subtotalElement = document.getElementById('final-subtotal');
    const shippingElement = document.getElementById('final-shipping');
    const totalElement = document.getElementById('final-total');
    
    if (subtotalElement) subtotalElement.textContent = formatPrice(subtotal);
    if (shippingElement) shippingElement.textContent = formatPrice(shipping);
    if (totalElement) totalElement.textContent = formatPrice(total);
}

// Procesar la orden
async function placeOrder() {
    try {
        // Validar paso final
        if (!validateCurrentStep()) {
            return;
        }
        
        // Mostrar loading
        showLoading();
        
        // Recopilar datos
        const orderData = collectOrderData();
        
        // Determinar tipo de orden
        const orderType = determineOrderType();
        
        // Crear orden en backend
        const orderResult = await createOrderInBackend(orderData);
        
        // Enviar notificaciones si el sistema de email está disponible
        if (window.emailSystem) {
            await sendOrderNotifications(orderData, orderType, orderResult.id);
        }
        
        // Limpiar datos temporales
        cleanupAfterOrder();
        
        // Mostrar confirmación
        showOrderConfirmation(orderResult);
        
    } catch (error) {
        console.error('Error procesando orden:', error);
        hideLoading();
        showError('Error al procesar la orden: ' + error.message);
    }
}

// Recopilar datos de la orden
function collectOrderData() {
    const cart = JSON.parse(localStorage.getItem('pati_cart') || '[]');
    
    // Determinar datos del cliente
    let customerData;
    if (affiliateClientData) {
        // Usar datos del cliente proporcionados por afiliado
        customerData = {
            ...affiliateClientData,
            isAffiliateClient: true,
            affiliateId: PATI_CONFIG?.currentUser?.id
        };
    } else {
        // Usar datos del formulario
        customerData = {
            name: shippingInfo.name,
            lastname: shippingInfo.lastname,
            email: shippingInfo.email,
            phone: shippingInfo.phone,
            isAffiliateClient: false
        };
    }
    
    return {
        customer: customerData,
        shipping: shippingInfo,
        payment: paymentInfo,
        items: cart.map(item => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            currency: item.currency,
            quantity: item.quantity
        })),
        subtotal: calculateSubtotal(),
        shippingCost: calculateShipping(calculateSubtotal()),
        total: calculateTotal(),
        affiliate: affiliateClientData ? {
            id: PATI_CONFIG?.currentUser?.id,
            name: PATI_CONFIG?.currentUser?.username
        } : null
    };
}

// Determinar tipo de orden
function determineOrderType() {
    if (affiliateClientData) {
        return 'affiliate_sale'; // Afiliado vendiendo a cliente
    } else if (PATI_CONFIG?.currentUser?.role === 'afiliado') {
        return 'affiliate_purchase'; // Afiliado comprando para sí mismo
    } else {
        return 'normal'; // Cliente normal
    }
}

// Calcular subtotal
function calculateSubtotal() {
    const cart = JSON.parse(localStorage.getItem('pati_cart') || '[]');
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Calcular total
function calculateTotal() {
    const subtotal = calculateSubtotal();
    const shipping = calculateShipping(subtotal);
    return subtotal + shipping;
}

// Crear orden en backend
async function createOrderInBackend(orderData) {
    try {
        // Si no hay usuario autenticado, crear orden como invitado
        if (!PATI_CONFIG?.currentUser) {
            return await createGuestOrder(orderData);
        }
        
        // Crear orden para usuario autenticado
        const orderRecord = {
            customer: PATI_CONFIG.currentUser.id,
            store: orderData.items[0]?.storeId || null,
            affiliate: orderData.affiliate?.id || null,
            items: JSON.stringify(orderData.items),
            subtotal: orderData.subtotal,
            shipping: orderData.shippingCost,
            total: orderData.total,
            currency: selectedCurrency,
            shipping_address: JSON.stringify(orderData.shipping),
            payment_method: orderData.payment.method,
            status: 'pending',
            notes: orderData.shipping.notes || ''
        };
        
        // Guardar en PocketBase
        const record = await PATI_CONFIG.pb.collection('orders').create(orderRecord);
        
        // Si hay afiliado, crear comisión
        if (orderData.affiliate) {
            await createCommission(record.id, orderData);
        }
        
        return {
            id: record.id,
            number: `ORD-${record.id.substring(0, 8).toUpperCase()}`,
            ...record
        };
        
    } catch (error) {
        console.error('Error creando orden:', error);
        throw new Error('No se pudo crear la orden en el sistema');
    }
}

// Crear orden como invitado
async function createGuestOrder(orderData) {
    // Para invitados, podríamos crear un usuario temporal
    // Por ahora, simular creación
    const orderId = 'guest-' + Date.now().toString(36);
    
    // Guardar en localStorage temporalmente
    const guestOrders = JSON.parse(localStorage.getItem('pati_guest_orders') || '[]');
    guestOrders.push({
        id: orderId,
        ...orderData,
        created: new Date().toISOString()
    });
    localStorage.setItem('pati_guest_orders', JSON.stringify(guestOrders));
    
    return {
        id: orderId,
        number: `GUEST-${orderId.substring(0, 8).toUpperCase()}`
    };
}

// Crear comisión para afiliado
async function createCommission(orderId, orderData) {
    try {
        // Calcular comisión (ejemplo: 10% del subtotal)
        const commissionRate = 10; // Esto debería venir de store_settings
        const commissionAmount = orderData.subtotal * (commissionRate / 100);
        
        const commissionRecord = {
            order: orderId,
            affiliate: orderData.affiliate.id,
            store: orderData.items[0]?.storeId || null,
            amount: commissionAmount,
            rate: commissionRate,
            status: 'pending',
            payment_date: null,
            notes: `Comisión por venta referida - Orden ${orderId}`
        };
        
        await PATI_CONFIG.pb.collection('commissions').create(commissionRecord);
        
        console.log('Comisión creada:', commissionAmount);
        
    } catch (error) {
        console.error('Error creando comisión:', error);
        // No lanzar error para no interrumpir el flujo de la orden
    }
}

// Enviar notificaciones por email
async function sendOrderNotifications(orderData, orderType, orderId) {
    try {
        // Solo si el sistema de email está disponible
        if (!window.emailSystem) {
            console.log('Sistema de email no disponible, omitiendo notificaciones');
            return;
        }
        
        // Preparar datos para email
        const emailData = {
            ...orderData,
            order_number: orderId,
            order_date: new Date().toLocaleDateString('es-ES'),
            order_total: formatPrice(orderData.total)
        };
        
        // Enviar notificaciones
        await emailSystem.sendOrderNotifications(emailData, orderType);
        
    } catch (error) {
        console.error('Error enviando notificaciones:', error);
        // No fallar la orden si fallan los emails
    }
}

// Limpiar después de la orden
function cleanupAfterOrder() {
    // Limpiar carrito
    localStorage.removeItem('pati_cart');
    
    // Limpiar datos temporales de afiliado
    localStorage.removeItem('affiliate_client_data');
    affiliateClientData = null;
    
    // Actualizar contador del carrito
    if (window.cartSystem?.updateCartCount) {
        cartSystem.updateCartCount();
    }
}

// Mostrar confirmación de orden
function showOrderConfirmation(orderResult) {
    hideLoading();
    
    const modal = document.getElementById('confirmation-modal');
    const orderNumberElement = document.getElementById('order-number');
    
    if (orderNumberElement) {
        orderNumberElement.textContent = `Orden #${orderResult.number}`;
    }
    
    // Guardar última orden para referencia
    localStorage.setItem('last_order', JSON.stringify({
        id: orderResult.id,
        number: orderResult.number,
        date: new Date().toISOString(),
        total: orderResult.total || calculateTotal()
    }));
    
    // Mostrar modal
    modal.classList.remove('hidden');
}

// Cerrar confirmación
function closeConfirmation() {
    const modal = document.getElementById('confirmation-modal');
    modal.classList.add('hidden');
    
    // Redirigir a inicio
    window.location.href = 'index.html';
}

// Ver detalles de la orden
function viewOrderDetails() {
    const lastOrder = JSON.parse(localStorage.getItem('last_order') || '{}');
    
    // Podríamos redirigir a una página de detalles
    // Por ahora, mostrar alerta
    alert(`Detalles de la orden:\n\nNúmero: ${lastOrder.number}\nTotal: ${formatPrice(lastOrder.total || 0)}\n\nGuarda este número para seguimiento.`);
    
    // Cerrar modal y redirigir
    closeConfirmation();
}

// Mostrar loading
function showLoading() {
    const button = document.querySelector('#step-3 button[onclick="placeOrder()"]');
    if (button) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Procesando...';
        button.disabled = true;
    }
}

// Ocultar loading
function hideLoading() {
    const button = document.querySelector('#step-3 button[onclick="placeOrder()"]');
    if (button) {
        button.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Confirmar Pedido';
        button.disabled = false;
    }
}

// Mostrar error
function showError(message) {
    alert('❌ ' + message);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initCheckout);

// Hacer funciones disponibles globalmente
window.goToStep = goToStep;
window.selectPaymentMethod = selectPaymentMethod;
window.updatePaymentCurrency = updatePaymentCurrency;
window.placeOrder = placeOrder;
window.closeConfirmation = closeConfirmation;
window.viewOrderDetails = viewOrderDetails;