// email.js - Sistema de notificaciones para PaTí

class EmailSystem {
    constructor() {
        this.templates = {
            // Para compras normales (cliente -> tienda)
            customer_purchase: {
                subject: 'Confirmación de tu compra en {store_name}',
                body: `
Hola {customer_name},

¡Gracias por tu compra en {store_name}!

Detalles de tu pedido:
Pedido: #{order_number}
Fecha: {order_date}
Total: {order_total}

Productos:
{order_items}

Información de envío:
{shipping_info}

Puedes seguir tu pedido desde tu cuenta en PaTí.

Saludos,
El equipo de {store_name}
                `
            },
            
            // Para dependientes/empleados de la tienda
            store_employee: {
                subject: 'Nueva orden recibida - #{order_number}',
                body: `
Nueva orden recibida en {store_name}

Detalles del pedido:
Pedido: #{order_number}
Cliente: {customer_name}
Email: {customer_email}
Teléfono: {customer_phone}
Total: {order_total}

Productos:
{order_items}

Dirección de entrega:
{shipping_info}

Por favor, procede con el procesamiento de esta orden.

Saludos,
Sistema PaTí
                `
            },
            
            // Para administrador de la tienda
            store_admin: {
                subject: 'Resumen de orden #{order_number} - {store_name}',
                body: `
Resumen administrativo - Orden #{order_number}

Cliente: {customer_name}
Email: {customer_email}
Teléfono: {customer_phone}
Fecha: {order_date}
Total: {order_total}
Método de pago: {payment_method}

Productos:
{order_items}

Comisiones generadas:
{commissions_summary}

Estado: Pendiente de procesamiento

Saludos,
Sistema PaTí
                `
            },
            
            // Para afiliados (cuando aplica)
            affiliate_notification: {
                subject: '¡Comisión generada por venta! - Orden #{order_number}',
                body: `
¡Felicitaciones {affiliate_name}!

Has generado una comisión por una venta referida.

Detalles de la venta:
Pedido: #{order_number}
Tienda: {store_name}
Fecha: {order_date}
Cliente referido: {customer_name}

Tu comisión:
Monto total de venta: {sale_total}
Porcentaje de comisión: {commission_rate}%
Comisión ganada: {commission_amount}

Esta comisión será procesada de acuerdo a los términos establecidos con la tienda.

Saludos,
Sistema PaTí
                `
            },
            
            // Para afiliados que hacen compras
            affiliate_purchase: {
                subject: 'Confirmación de tu compra como afiliado - #{order_number}',
                body: `
Hola {affiliate_name},

Confirmamos tu compra como afiliado en {store_name}.

Detalles del pedido:
Pedido: #{order_number}
Fecha: {order_date}
Total: {order_total}

Productos:
{order_items}

Información de envío:
{shipping_info}

Adicionalmente, como afiliado puedes acceder a tu panel para ver tus comisiones.

Saludos,
El equipo de {store_name}
                `
            }
        };
    }
    
    // Enviar notificaciones según el tipo de compra
    async sendOrderNotifications(orderData, orderType = 'normal') {
        try {
            const notifications = [];
            
            switch(orderType) {
                case 'normal': // Cliente normal
                    notifications.push(
                        this.sendToCustomer(orderData),
                        this.sendToStoreEmployees(orderData),
                        this.sendToStoreAdmin(orderData)
                    );
                    break;
                    
                case 'affiliate_sale': // Venta referida por afiliado
                    notifications.push(
                        this.sendToCustomer(orderData),
                        this.sendToStoreEmployees(orderData),
                        this.sendToStoreAdmin(orderData, true), // Con info de afiliado
                        this.sendToAffiliate(orderData)
                    );
                    break;
                    
                case 'affiliate_purchase': // Afiliado comprando
                    notifications.push(
                        this.sendToAffiliateAsCustomer(orderData),
                        this.sendToStoreEmployees(orderData, true), // Marcado como afiliado
                        this.sendToStoreAdmin(orderData, true) // Con info de afiliado
                    );
                    break;
            }
            
            // Ejecutar todas las notificaciones
            await Promise.all(notifications);
            
            console.log('Notificaciones enviadas exitosamente');
            return true;
            
        } catch (error) {
            console.error('Error enviando notificaciones:', error);
            return false;
        }
    }
    
    // Enviar al cliente
    async sendToCustomer(orderData) {
        const template = this.templates.customer_purchase;
        const emailData = this.prepareCustomerEmail(orderData, template);
        
        // Enviar usando PocketBase
        return this.sendEmail({
            to: orderData.customer.email,
            subject: emailData.subject,
            body: emailData.body
        });
    }
    
    // Enviar a empleados de la tienda
    async sendToStoreEmployees(orderData, isAffiliate = false) {
        // Obtener empleados/dependientes de la tienda
        const employees = await this.getStoreEmployees(orderData.store.id);
        
        const template = this.templates.store_employee;
        const emailData = this.prepareEmployeeEmail(orderData, template, isAffiliate);
        
        // Enviar a cada empleado
        const promises = employees.map(employee => 
            this.sendEmail({
                to: employee.email,
                subject: emailData.subject,
                body: emailData.body
            })
        );
        
        return Promise.all(promises);
    }
    
    // Enviar al administrador de la tienda
    async sendToStoreAdmin(orderData, hasAffiliate = false) {
        // Obtener administrador de la tienda
        const admin = await this.getStoreAdmin(orderData.store.id);
        if (!admin) return;
        
        const template = this.templates.store_admin;
        const emailData = this.prepareAdminEmail(orderData, template, hasAffiliate);
        
        return this.sendEmail({
            to: admin.email,
            subject: emailData.subject,
            body: emailData.body
        });
    }
    
    // Enviar al afiliado (por venta referida)
    async sendToAffiliate(orderData) {
        const affiliate = await this.getAffiliateData(orderData.affiliate.id);
        if (!affiliate) return;
        
        const template = this.templates.affiliate_notification;
        const emailData = this.prepareAffiliateEmail(orderData, template, affiliate);
        
        return this.sendEmail({
            to: affiliate.email,
            subject: emailData.subject,
            body: emailData.body
        });
    }
    
    // Enviar al afiliado cuando compra
    async sendToAffiliateAsCustomer(orderData) {
        const affiliate = await this.getAffiliateData(orderData.customer.id);
        if (!affiliate) return;
        
        const template = this.templates.affiliate_purchase;
        const emailData = this.prepareAffiliateAsCustomerEmail(orderData, template, affiliate);
        
        return this.sendEmail({
            to: affiliate.email,
            subject: emailData.subject,
            body: emailData.body
        });
    }
    
    // Preparar email para cliente
    prepareCustomerEmail(orderData, template) {
        return {
            subject: this.replacePlaceholders(template.subject, {
                store_name: orderData.store.name
            }),
            body: this.replacePlaceholders(template.body, {
                customer_name: orderData.customer.name,
                store_name: orderData.store.name,
                order_number: orderData.order_number,
                order_date: new Date().toLocaleDateString('es-ES'),
                order_total: this.formatPrice(orderData.total),
                order_items: this.formatOrderItems(orderData.items),
                shipping_info: this.formatShippingInfo(orderData.shipping)
            })
        };
    }
    
    // Preparar email para empleados
    prepareEmployeeEmail(orderData, template, isAffiliate) {
        let customerInfo = orderData.customer.name;
        if (isAffiliate) {
            customerInfo += ' (Afiliado)';
        }
        
        return {
            subject: this.replacePlaceholders(template.subject, {
                order_number: orderData.order_number
            }),
            body: this.replacePlaceholders(template.body, {
                store_name: orderData.store.name,
                order_number: orderData.order_number,
                customer_name: customerInfo,
                customer_email: orderData.customer.email,
                customer_phone: orderData.customer.phone,
                order_total: this.formatPrice(orderData.total),
                order_items: this.formatOrderItems(orderData.items),
                shipping_info: this.formatShippingInfo(orderData.shipping)
            })
        };
    }
    
    // Preparar email para administrador
    prepareAdminEmail(orderData, template, hasAffiliate) {
        let commissionsSummary = 'No aplican comisiones en esta venta.';
        
        if (hasAffiliate && orderData.affiliate) {
            commissionsSummary = `
Afiliado: ${orderData.affiliate.name}
Porcentaje: ${orderData.commission_rate}%
Comisión: ${this.formatPrice(orderData.commission_amount)}
            `;
        }
        
        return {
            subject: this.replacePlaceholders(template.subject, {
                order_number: orderData.order_number,
                store_name: orderData.store.name
            }),
            body: this.replacePlaceholders(template.body, {
                store_name: orderData.store.name,
                order_number: orderData.order_number,
                customer_name: orderData.customer.name,
                customer_email: orderData.customer.email,
                customer_phone: orderData.customer.phone,
                order_date: new Date().toLocaleDateString('es-ES'),
                order_total: this.formatPrice(orderData.total),
                payment_method: orderData.payment_method,
                order_items: this.formatOrderItems(orderData.items),
                commissions_summary: commissionsSummary
            })
        };
    }
    
    // Preparar email para afiliado
    prepareAffiliateEmail(orderData, template, affiliate) {
        return {
            subject: this.replacePlaceholders(template.subject, {
                order_number: orderData.order_number
            }),
            body: this.replacePlaceholders(template.body, {
                affiliate_name: affiliate.name,
                order_number: orderData.order_number,
                store_name: orderData.store.name,
                order_date: new Date().toLocaleDateString('es-ES'),
                customer_name: orderData.customer.name,
                sale_total: this.formatPrice(orderData.total),
                commission_rate: orderData.commission_rate,
                commission_amount: this.formatPrice(orderData.commission_amount)
            })
        };
    }
    
    // Preparar email para afiliado como cliente
    prepareAffiliateAsCustomerEmail(orderData, template, affiliate) {
        return {
            subject: this.replacePlaceholders(template.subject, {
                order_number: orderData.order_number
            }),
            body: this.replacePlaceholders(template.body, {
                affiliate_name: affiliate.name,
                store_name: orderData.store.name,
                order_number: orderData.order_number,
                order_date: new Date().toLocaleDateString('es-ES'),
                order_total: this.formatPrice(orderData.total),
                order_items: this.formatOrderItems(orderData.items),
                shipping_info: this.formatShippingInfo(orderData.shipping)
            })
        };
    }
    
    // Obtener empleados de la tienda
    async getStoreEmployees(storeId) {
        try {
            // Buscar usuarios con rol "dependiente" en esta tienda
            const employees = await PATI_CONFIG.pb.collection('users').getList(1, 50, {
                filter: `store = "${storeId}" && role = "dependiente"`
            });
            
            return employees.items;
        } catch (error) {
            console.error('Error obteniendo empleados:', error);
            return [];
        }
    }
    
    // Obtener administrador de la tienda
    async getStoreAdmin(storeId) {
        try {
            // Primero obtener el owner de la tienda
            const store = await PATI_CONFIG.pb.collection('stores').getOne(storeId);
            
            // Buscar al usuario owner
            const admin = await PATI_CONFIG.pb.collection('users').getOne(store.owner);
            
            return admin;
        } catch (error) {
            console.error('Error obteniendo administrador:', error);
            return null;
        }
    }
    
    // Obtener datos del afiliado
    async getAffiliateData(affiliateId) {
        try {
            const affiliate = await PATI_CONFIG.pb.collection('users').getOne(affiliateId);
            return affiliate;
        } catch (error) {
            console.error('Error obteniendo afiliado:', error);
            return null;
        }
    }
    
    // Enviar email usando PocketBase
    async sendEmail(emailData) {
        try {
            // PocketBase tiene un sistema de emails incorporado
            // Pero primero necesitamos configurarlo en el backend
            
            // Por ahora, simular envío
            console.log('📧 Email enviado:', {
                to: emailData.to,
                subject: emailData.subject
            });
            
            // Para producción, necesitarías configurar SMTP en PocketBase
            // y usar: await PATI_CONFIG.pb.sendEmail(to, subject, body)
            
            return true;
        } catch (error) {
            console.error('Error enviando email:', error);
            return false;
        }
    }
    
    // Funciones auxiliares
    replacePlaceholders(text, data) {
        let result = text;
        for (const [key, value] of Object.entries(data)) {
            result = result.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        return result;
    }
    
    formatPrice(amount) {
        const symbol = 'USD'; // Podría variar
        return `${symbol} ${amount.toFixed(2)}`;
    }
    
    formatOrderItems(items) {
        return items.map(item => 
            `- ${item.name} (x${item.quantity}): ${this.formatPrice(item.price * item.quantity)}`
        ).join('\n');
    }
    
    formatShippingInfo(shipping) {
        return `
${shipping.name} ${shipping.lastname}
${shipping.address}
${shipping.city}, ${shipping.state}
${shipping.phone}
${shipping.email}
        `.trim();
    }
}

// Crear instancia global
const emailSystem = new EmailSystem();
window.emailSystem = emailSystem;