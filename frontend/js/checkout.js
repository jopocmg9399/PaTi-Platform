/**
 * Proceso de Checkout completo
 * Integrado con PocketBase
 */

class CheckoutManager {
    constructor() {
        this.pb = PATI_CONFIG.pb;
        this.currentStep = 1;
        this.orderData = {};
        this.initCheckout();
    }

    // Inicializar checkout
    initCheckout() {
        if (!window.location.pathname.includes('checkout.html')) return;
        
        this.loadOrderData();
        this.renderCheckoutStep();
        this.setupEventListeners();
    }

    // Cargar datos de la orden desde localStorage
    loadOrderData() {
        try {
            const savedData = localStorage.getItem('pati_checkout_data');
            if (savedData) {
                this.orderData = JSON.parse(savedData);
            }
        } catch (error) {
            console.error('Error cargando datos del checkout:', error);
            this.orderData = {};
        }
    }

    // Guardar datos de la orden
    saveOrderData() {
        try {
            localStorage.setItem('pati_checkout_data', JSON.stringify(this.orderData));
        } catch (error) {
            console.error('Error guardando datos del checkout:', error);
        }
    }

    // Configurar event listeners
    setupEventListeners() {
        // Navegación entre pasos
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('next-step')) {
                this.validateCurrentStep();
            }
            
            if (e.target.classList.contains('prev-step')) {
                this.goToPreviousStep();
            }
            
            if (e.target.classList.contains('step-link')) {
                const step = parseInt(e.target.dataset.step);
                this.goToStep(step);
            }
        });

        // Formulario de envío
        const shippingForm = document.getElementById('shipping-form');
        if (shippingForm) {
            shippingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.validateCurrentStep();
            });
        }

        // Selección de método de pago
        document.querySelectorAll('input[name="payment-method"]').forEach(input => {
            input.addEventListener('change', (e) => {
                this.orderData.paymentMethod = e.target.value;
                this.saveOrderData();
                this.renderPaymentDetails();
            });
        });

        // Botón de confirmar orden
        const confirmBtn = document.getElementById('confirm-order');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.createOrder());
        }
    }

    // Validar paso actual
    validateCurrentStep() {
        switch (this.currentStep) {
            case 1: // Información de envío
                return this.validateShippingInfo();
            case 2: // Método de pago
                return this.validatePaymentInfo();
            case 3: // Revisar
                return true;
        }
        return false;
    }

    // Validar información de envío
    validateShippingInfo() {
        const requiredFields = [
            'name', 'email', 'phone', 'address', 'city', 'province'
        ];

        const errors = [];
        const shippingData = {};

        requiredFields.forEach(field => {
            const input = document.getElementById(`shipping-${field}`);
            if (input) {
                const value = input.value.trim();
                if (!value) {
                    errors.push(`El campo ${input.previousElementSibling?.textContent || field} es requerido`);
                    input.classList.add('error');
                } else {
                    input.classList.remove('error');
                    shippingData[field] = value;
                }
            }
        });

        if (errors.length > 0) {
            this.showStepErrors(errors);
            return false;
        }

        // Guardar datos
        this.orderData.shipping = shippingData;
        this.orderData.shippingType = document.getElementById('shipping-type')?.value || 'delivery';
        this.saveOrderData();

        // Ir al siguiente paso
        this.goToStep(2);
        return true;
    }

    // Validar información de pago
    validatePaymentInfo() {
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked');
        
        if (!paymentMethod) {
            this.showStepErrors(['Selecciona un método de pago']);
            return false;
        }

        this.orderData.paymentMethod = paymentMethod.value;
        this.orderData.paymentDetails = {};

        // Validaciones específicas por método
        switch (paymentMethod.value) {
            case 'card':
                const cardFields = ['card-number', 'card-name', 'card-expiry', 'card-cvv'];
                const cardErrors = [];
                const cardDetails = {};

                cardFields.forEach(field => {
                    const input = document.getElementById(field);
                    if (input) {
                        const value = input.value.trim();
                        if (!value) {
                            cardErrors.push(`El campo ${input.previousElementSibling?.textContent || field} es requerido`);
                            input.classList.add('error');
                        } else {
                            input.classList.remove('error');
                            cardDetails[field] = value;
                        }
                    }
                });

                if (cardErrors.length > 0) {
                    this.showStepErrors(cardErrors);
                    return false;
                }

                this.orderData.paymentDetails = cardDetails;
                break;

            case 'transfer':
                const transferName = document.getElementById('transfer-name')?.value;
                if (!transferName) {
                    this.showStepErrors(['Nombre en la transferencia es requerido']);
                    return false;
                }
                this.orderData.paymentDetails = { accountName: transferName };
                break;
        }

        this.saveOrderData();
        this.goToStep(3);
        return true;
    }

    // Ir a paso específico
    goToStep(step) {
        if (step < 1 || step > 3) return;
        
        this.currentStep = step;
        this.renderCheckoutStep();
    }

    // Ir al paso anterior
    goToPreviousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.renderCheckoutStep();
        }
    }

    // Renderizar paso actual
    renderCheckoutStep() {
        // Actualizar indicadores de paso
        document.querySelectorAll('.step-indicator').forEach(indicator => {
            const step = parseInt(indicator.dataset.step);
            indicator.classList.remove('active', 'completed');
            
            if (step === this.currentStep) {
                indicator.classList.add('active');
            } else if (step < this.currentStep) {
                indicator.classList.add('completed');
            }
        });

        // Mostrar paso actual
        document.querySelectorAll('.checkout-step').forEach(step => {
            step.classList.remove('active');
        });

        const currentStepElement = document.getElementById(`step-${this.currentStep}`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
        }

        // Renderizar contenido específico del paso
        switch (this.currentStep) {
            case 3:
                this.renderReviewStep();
                break;
        }
    }

    // Renderizar paso de revisión
    async renderReviewStep() {
        const reviewContainer = document.getElementById('review-container');
        if (!reviewContainer) return;

        try {
            // Obtener resumen del carrito
            const cartManager = window.cartManager;
            const cartByStore = cartManager.getCartByStore();
            const totals = cartManager.getCartTotal();

            let html = '<div class="review-section">';

            // Información de envío
            if (this.orderData.shipping) {
                html += `
                    <h3>Información de envío</h3>
                    <div class="review-info">
                        <p><strong>Nombre:</strong> ${this.orderData.shipping.name}</p>
                        <p><strong>Email:</strong> ${this.orderData.shipping.email}</p>
                        <p><strong>Teléfono:</strong> ${this.orderData.shipping.phone}</p>
                        <p><strong>Dirección:</strong> ${this.orderData.shipping.address}</p>
                        <p><strong>Ciudad:</strong> ${this.orderData.shipping.city}</p>
                        <p><strong>Tipo:</strong> ${this.orderData.shippingType === 'delivery' ? 'Entrega a domicilio' : 'Recoger en tienda'}</p>
                    </div>
                `;
            }

            // Productos
            html += '<h3>Productos</h3>';
            
            for (const storeGroup of cartByStore) {
                let storeName = 'Tienda';
                try {
                    const store = await this.pb.collection('stores').getOne(storeGroup.storeId);
                    storeName = store.name;
                } catch (error) {
                    console.error('Error obteniendo tienda:', error);
                }

                html += `
                    <div class="store-review">
                        <h4>${storeName}</h4>
                        <div class="review-items">
                            ${storeGroup.items.map(item => `
                                <div class="review-item">
                                    <span>${item.name} x ${item.quantity}</span>
                                    <span>${cartManager.formatPrice(item.price * item.quantity, item.currency)}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="store-review-total">
                            <span>Subtotal:</span>
                            <span>${cartManager.formatPrice(storeGroup.total, storeGroup.items[0].currency)}</span>
                        </div>
                    </div>
                `;
            }

            // Resumen de pago
            html += `
                <h3>Resumen de pago</h3>
                <div class="payment-review">
                    <p><strong>Método:</strong> ${this.getPaymentMethodName(this.orderData.paymentMethod)}</p>
                    ${Object.entries(totals).map(([currency, amount]) => `
                        <div class="total-review">
                            <span>Total (${currency}):</span>
                            <span>${cartManager.formatPrice(amount, currency)}</span>
                        </div>
                    `).join('')}
                </div>
            `;

            html += '</div>';
            reviewContainer.innerHTML = html;

        } catch (error) {
            console.error('Error renderizando revisión:', error);
            reviewContainer.innerHTML = '<p class="error">Error al cargar la revisión del pedido</p>';
        }
    }

    // Obtener nombre del método de pago
    getPaymentMethodName(method) {
        const methods = {
            'card': 'Tarjeta de crédito/débito',
            'transfer': 'Transferencia bancaria',
            'cash': 'Efectivo',
            'wallet': 'Monedero PaTí'
        };
        return methods[method] || method;
    }

    // Crear orden en PocketBase
    async createOrder() {
        const confirmBtn = document.getElementById('confirm-order');
        const btnText = confirmBtn.querySelector('.btn-text');
        const spinner = confirmBtn.querySelector('.spinner');

        try {
            // Mostrar loading
            confirmBtn.disabled = true;
            btnText.textContent = 'Procesando...';
            spinner.classList.remove('hidden');

            // Verificar que hay productos en el carrito
            const cartManager = window.cartManager;
            if (cartManager.cart.length === 0) {
                throw new Error('El carrito está vacío');
            }

            // Preparar datos de la orden
            const orderData = {
                user: PATI_CONFIG.currentUser?.id || null,
                status: 'pending',
                paymentMethod: this.orderData.paymentMethod,
                paymentStatus: 'pending',
                shippingInfo: this.orderData.shipping,
                shippingType: this.orderData.shippingType,
                notes: document.getElementById('order-notes')?.value || '',
                affiliate: this.getAffiliateInfo(),
                total: cartManager.getCartTotal()
            };

            // Crear orden principal
            const order = await this.pb.collection('orders').create(orderData);

            // Crear items de orden por tienda
            const cartByStore = cartManager.getCartByStore();
            const orderItems = [];

            for (const storeGroup of cartByStore) {
                // Podrías crear sub-órdenes por tienda aquí
                // Por ahora, guardamos todos los items en la misma orden
                
                for (const item of storeGroup.items) {
                    const orderItem = {
                        order: order.id,
                        product: item.productId,
                        store: storeGroup.storeId,
                        quantity: item.quantity,
                        price: item.price,
                        currency: item.currency,
                        subtotal: item.price * item.quantity
                    };

                    orderItems.push(orderItem);
                }
            }

            // Aquí podrías crear los items en una colección 'order_items'
            // Por ahora los guardamos en el campo expandido de la orden
            await this.pb.collection('orders').update(order.id, {
                items: orderItems
            });

            // Procesar comisiones si hay afiliado
            if (orderData.affiliate) {
                await this.processCommissions(order, orderData.affiliate);
            }

            // Vaciar carrito
            cartManager.clearCart();
            
            // Limpiar datos del checkout
            localStorage.removeItem('pati_checkout_data');
            this.orderData = {};

            // Mostrar confirmación
            this.showOrderConfirmation(order);

            // Enviar notificaciones por email
            await this.sendOrderNotifications(order);

        } catch (error) {
            console.error('Error creando orden:', error);
            this.showStepErrors(['Error al procesar el pedido. Por favor, intenta nuevamente.']);
            
            // Restaurar botón
            confirmBtn.disabled = false;
            btnText.textContent = 'Confirmar pedido';
            spinner.classList.add('hidden');
        }
    }

    // Obtener información de afiliado
    getAffiliateInfo() {
        // Aquí implementar lógica para detectar afiliado
        // Puede ser por URL, cookie, o usuario actual
        return null;
    }

    // Procesar comisiones
    async processCommissions(order, affiliateInfo) {
        try {
            // Calcular comisiones por tienda
            const cartByStore = window.cartManager.getCartByStore();
            
            for (const storeGroup of cartByStore) {
                // Obtener porcentaje de comisión para esta tienda
                const commissionRate = await this.getStoreCommissionRate(storeGroup.storeId);
                
                if (commissionRate > 0) {
                    const commissionAmount = (storeGroup.total * commissionRate) / 100;
                    
                    const commissionData = {
                        order: order.id,
                        store: storeGroup.storeId,
                        affiliate: affiliateInfo.id,
                        amount: commissionAmount,
                        rate: commissionRate,
                        status: 'pending'
                    };
                    
                    await this.pb.collection('commissions').create(commissionData);
                }
            }
        } catch (error) {
            console.error('Error procesando comisiones:', error);
        }
    }

    // Obtener tasa de comisión de tienda
    async getStoreCommissionRate(storeId) {
        try {
            const store = await this.pb.collection('stores').getOne(storeId);
            return store.commissionRate || PATI_CONFIG.platformSettings?.defaultCommission || 10;
        } catch (error) {
            console.error('Error obteniendo tasa de comisión:', error);
            return PATI_CONFIG.platformSettings?.defaultCommission || 10;
        }
    }

    // Mostrar confirmación de orden
    showOrderConfirmation(order) {
        const checkoutContent = document.querySelector('.checkout-content');
        
        checkoutContent.innerHTML = `
            <div class="order-confirmation">
                <div class="confirmation-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h2>¡Pedido Confirmado!</h2>
                <p class="order-number">Número de pedido: <strong>${order.id.substring(0, 8).toUpperCase()}</strong></p>
                <p>Hemos recibido tu pedido correctamente. Te hemos enviado un email de confirmación.</p>
                
                <div class="confirmation-details">
                    <h3>Detalles del pedido</h3>
                    <p><strong>Método de pago:</strong> ${this.getPaymentMethodName(order.paymentMethod)}</p>
                    <p><strong>Estado:</strong> <span class="status-pending">Pendiente de pago</span></p>
                    <p><strong>Total:</strong> ${this.formatOrderTotal(order.total)}</p>
                </div>
                
                <div class="confirmation-actions">
                    <a href="ordenes.html" class="btn btn-primary">Ver mis pedidos</a>
                    <a href="index.html" class="btn btn-outline">Seguir comprando</a>
                </div>
                
                <div class="confirmation-note">
                    <p><small>Si tienes alguna pregunta, contacta con nuestro soporte.</small></p>
                </div>
            </div>
        `;
    }

    // Formatear total de orden
    formatOrderTotal(totals) {
        if (typeof totals === 'object') {
            return Object.entries(totals).map(([currency, amount]) => 
                `$${amount.toFixed(2)} ${currency}`
            ).join(', ');
        }
        return `$${parseFloat(totals).toFixed(2)}`;
    }

    // Enviar notificaciones por email
    async sendOrderNotifications(order) {
        try {
            // Aquí iría la lógica para enviar emails
            // Por ahora solo registramos en consola
            console.log('📧 Notificaciones de orden enviadas:', order.id);
            
            // Podrías llamar a tu función de email.js aquí
            if (window.emailSystem) {
                await window.emailSystem.sendOrderConfirmation(order);
            }
            
        } catch (error) {
            console.error('Error enviando notificaciones:', error);
        }
    }

    // Mostrar errores del paso
    showStepErrors(errors) {
        const errorContainer = document.getElementById('step-errors');
        if (!errorContainer) return;

        errorContainer.innerHTML = `
            <div class="alert alert-error">
                <i class="fas fa-exclamation-circle"></i>
                <div>
                    <strong>Por favor corrige los siguientes errores:</strong>
                    <ul>
                        ${errors.map(error => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;

        // Auto-remover después de 10 segundos
        setTimeout(() => {
            errorContainer.innerHTML = '';
        }, 10000);
    }
}

// Inicializar cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.checkoutManager = new CheckoutManager();
});