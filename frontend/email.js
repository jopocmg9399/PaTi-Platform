// Configuración de EmailJS (gratis)
(function() {
    emailjs.init("YOUR_USER_ID"); // Obtén tu User ID de EmailJS
})();

async function sendOrderEmail(order, type) {
    try {
        let templateID = '';
        let templateParams = {};

        switch(type) {
            case 'customer':
                templateID = 'template_customer_order';
                templateParams = {
                    to_name: order.customer_name,
                    to_email: order.customer_email,
                    order_number: order.order_number,
                    order_date: order.created,
                    order_total: order.total,
                    order_items: JSON.stringify(order.items),
                    store_name: order.store_name
                };
                break;
                
            case 'admin':
                templateID = 'template_admin_order';
                templateParams = {
                    to_name: order.admin_name,
                    to_email: order.admin_email,
                    order_number: order.order_number,
                    customer_name: order.customer_name,
                    customer_email: order.customer_email,
                    order_total: order.total,
                    order_items: JSON.stringify(order.items)
                };
                break;
                
            case 'affiliate':
                templateID = 'template_affiliate_order';
                templateParams = {
                    to_name: order.affiliate_name,
                    to_email: order.affiliate_email,
                    order_number: order.order_number,
                    customer_name: order.customer_name,
                    commission_amount: order.commission,
                    order_total: order.total
                };
                break;
        }

        const response = await emailjs.send(
            'YOUR_SERVICE_ID', // Service ID de EmailJS
            templateID,
            templateParams
        );
        
        console.log('Email sent successfully:', response);
        return { success: true };
    } catch (error) {
        console.error('Email error:', error);
        return { success: false, error: error.message };
    }
}

// Exportar función
window.sendOrderEmail = sendOrderEmail;