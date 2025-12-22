// js/auth.js - Sistema de Autenticación Completo
class AuthSystem {
    constructor() {
        this.currentStep = 1;
        this.selectedRole = null;
        this.isAuthenticated = false;
        this.userData = null;
    }

    // ==================== MÉTODOS PÚBLICOS ====================

    /**
     * Iniciar sesión
     */
    async login(email, password) {
        try {
            // Autenticar con PocketBase
            const authData = await PATI_CONFIG.pb.collection('users').authWithPassword(email, password);
            
            // Guardar usuario en configuración global
            PATI_CONFIG.currentUser = authData.record;
            this.isAuthenticated = true;
            this.userData = authData.record;
            
            // Guardar token en localStorage
            localStorage.setItem('pati_auth_token', authData.token);
            localStorage.setItem('pati_user', JSON.stringify(authData.record));
            
            // Mostrar notificación
            this.showNotification('success', '¡Bienvenido! Sesión iniciada correctamente.');
            
            // Redirigir según rol
            this.redirectByRole(authData.record.role);
            
            return authData;
        } catch (error) {
            console.error('Error en login:', error);
            this.showNotification('error', 'Credenciales incorrectas. Intenta nuevamente.');
            throw error;
        }
    }

    /**
     * Registrar nuevo usuario
     */
    async register(userData) {
        try {
            // Validar datos básicos
            if (!this.validateRegistrationData(userData)) {
                throw new Error('Datos de registro inválidos');
            }

            // Preparar datos para PocketBase
            const pbUserData = {
                username: userData.email.split('@')[0],
                email: userData.email,
                emailVisibility: true,
                password: userData.password,
                passwordConfirm: userData.passwordConfirm,
                name: userData.name,
                role: userData.role,
                phone: userData.phone
            };

            // Agregar campos específicos según rol
            if (userData.role === 'cliente') {
                pbUserData.preferredCurrency = userData.preferredCurrency || 'CUP';
                pbUserData.walletBalance = 0;
            } else if (userData.role === 'afiliado') {
                pbUserData.bankAccount = userData.bankAccount;
                pbUserData.idNumber = userData.idNumber;
                pbUserData.affiliateCode = this.generateAffiliateCode();
                pbUserData.totalCommissions = 0;
                pbUserData.pendingCommissions = 0;
            } else if (userData.role === 'dependiente') {
                // Validar código de tienda
                const store = await this.validateStoreCode(userData.storeCode);
                if (!store) {
                    throw new Error('Código de tienda inválido');
                }
                pbUserData.store = store.id;
                pbUserData.employeeId = userData.employeeId;
                pbUserData.permissions = ['view_orders', 'update_orders'];
            }

            // Crear usuario en PocketBase
            const record = await PATI_CONFIG.pb.collection('users').create(pbUserData);
            
            // Si es afiliado, crear registro inicial de comisiones
            if (userData.role === 'afiliado') {
                await this.setupAffiliateAccount(record.id, userData.referralCode);
            }

            // Si es dependiente, vincular a tienda
            if (userData.role === 'dependiente') {
                await this.linkEmployeeToStore(record.id, userData.storeCode);
            }

            // Auto-login después del registro
            const authData = await this.login(userData.email, userData.password);
            
            // Mostrar notificación
            this.showNotification('success', '¡Cuenta creada exitosamente!');
            
            return authData;
        } catch (error) {
            console.error('Error en registro:', error);
            this.showNotification('error', error.message || 'Error al crear la cuenta');
            throw error;
        }
    }

    /**
     * Cerrar sesión
     */
    async logout() {
        try {
            // Limpiar PocketBase auth
            PATI_CONFIG.pb.authStore.clear();
            
            // Limpiar configuración global
            PATI_CONFIG.currentUser = null;
            this.isAuthenticated = false;
            this.userData = null;
            
            // Limpiar localStorage
            localStorage.removeItem('pati_auth_token');
            localStorage.removeItem('pati_user');
            localStorage.removeItem('pati_cart'); // También limpiar carrito
            
            // Redirigir a inicio
            window.location.href = 'index.html';
            
            this.showNotification('info', 'Sesión cerrada correctamente');
        } catch (error) {
            console.error('Error en logout:', error);
        }
    }

    /**
     * Verificar sesión activa
     */
    async checkAuth() {
        try {
            // Verificar token en localStorage
            const token = localStorage.getItem('pati_auth_token');
            const userStr = localStorage.getItem('pati_user');
            
            if (!token || !userStr) {
                this.isAuthenticated = false;
                return false;
            }
            
            // Verificar con PocketBase
            PATI_CONFIG.pb.authStore.save(token, JSON.parse(userStr));
            
            // Verificar validez del token
            await PATI_CONFIG.pb.collection('users').authRefresh();
            
            // Actualizar configuración global
            PATI_CONFIG.currentUser = PATI_CONFIG.pb.authStore.model;
            this.isAuthenticated = true;
            this.userData = PATI_CONFIG.pb.authStore.model;
            
            return true;
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            this.logout();
            return false;
        }
    }

    /**
     * Recuperar contraseña
     */
    async recoverPassword(email) {
        try {
            await PATI_CONFIG.pb.collection('users').requestPasswordReset(email);
            this.showNotification('success', 'Se ha enviado un enlace de recuperación a tu email');
            return true;
        } catch (error) {
            this.showNotification('error', 'Error al solicitar recuperación de contraseña');
            throw error;
        }
    }

    /**
     * Actualizar perfil de usuario
     */
    async updateProfile(userId, data) {
        try {
            const updated = await PATI_CONFIG.pb.collection('users').update(userId, data);
            PATI_CONFIG.currentUser = updated;
            this.userData = updated;
            
            // Actualizar localStorage
            localStorage.setItem('pati_user', JSON.stringify(updated));
            
            this.showNotification('success', 'Perfil actualizado correctamente');
            return updated;
        } catch (error) {
            this.showNotification('error', 'Error al actualizar el perfil');
            throw error;
        }
    }

    // ==================== MÉTODOS PRIVADOS ====================

    /**
     * Validar datos de registro
     */
    validateRegistrationData(data) {
        if (!data.name || !data.email || !data.password || !data.phone) {
            return false;
        }
        
        if (data.password !== data.passwordConfirm) {
            return false;
        }
        
        if (data.password.length < 8) {
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            return false;
        }
        
        return true;
    }

    /**
     * Generar código de afiliado único
     */
    generateAffiliateCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return 'AFILIADO-' + code;
    }

    /**
     * Configurar cuenta de afiliado
     */
    async setupAffiliateAccount(userId, referralCode = null) {
        try {
            // Crear registro inicial de comisiones
            const commissionData = {
                user: userId,
                affiliateCode: this.generateAffiliateCode(),
                totalEarnings: 0,
                pendingEarnings: 0,
                referralCode: referralCode,
                status: 'active'
            };
            
            // Aquí podrías crear un registro en una colección de comisiones
            // await PATI_CONFIG.pb.collection('affiliate_commissions').create(commissionData);
            
            console.log('Cuenta de afiliado configurada:', commissionData);
        } catch (error) {
            console.error('Error configurando cuenta de afiliado:', error);
        }
    }

    /**
     * Validar código de tienda para empleados
     */
    async validateStoreCode(storeCode) {
        try {
            const stores = await PATI_CONFIG.pb.collection('stores').getFullList({
                filter: `storeCode = "${storeCode}"`
            });
            
            return stores.length > 0 ? stores[0] : null;
        } catch (error) {
            console.error('Error validando código de tienda:', error);
            return null;
        }
    }

    /**
     * Vincular empleado a tienda
     */
    async linkEmployeeToStore(userId, storeCode) {
        try {
            const store = await this.validateStoreCode(storeCode);
            if (store) {
                // Actualizar usuario con referencia a la tienda
                await PATI_CONFIG.pb.collection('users').update(userId, {
                    store: store.id
                });
                
                // Aquí podrías crear un registro en store_employees si tienes esa colección
                console.log('Empleado vinculado a tienda:', store.name);
            }
        } catch (error) {
            console.error('Error vinculando empleado a tienda:', error);
        }
    }

    /**
     * Redirigir según rol del usuario
     */
    redirectByRole(role) {
        const redirects = {
            'propietario': '/admin-platform.html',
            'administrador': '/admin-tienda.html',
            'dependiente': '/admin-tienda.html?view=orders',
            'afiliado': '/afiliado-dashboard.html',
            'cliente': '/index.html'
        };
        
        const redirectUrl = redirects[role] || '/index.html';
        
        // Pequeño delay para mostrar la notificación
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1500);
    }

    /**
     * Mostrar notificaciones
     */
    showNotification(type, message) {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Estilos básicos para notificación
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 10000;
            display: flex;
            justify-content: space-between;
            align-items: center;
            min-width: 300px;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        
        // Colores según tipo
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3',
            warning: '#ff9800'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        
        // Agregar al documento
        document.body.appendChild(notification);
        
        // Botón para cerrar
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Obtener datos del usuario actual
     */
    getCurrentUser() {
        return this.userData || PATI_CONFIG.currentUser;
    }

    /**
     * Verificar si el usuario tiene un rol específico
     */
    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    }

    /**
     * Verificar si el usuario tiene permiso para una acción
     */
    hasPermission(permission) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        // Lógica de permisos según rol
        const rolePermissions = {
            'propietario': ['all'],
            'administrador': ['manage_store', 'view_reports', 'manage_products'],
            'dependiente': ['view_orders', 'update_orders', 'view_products'],
            'afiliado': ['view_commissions', 'generate_links'],
            'cliente': ['purchase', 'view_orders']
        };
        
        const permissions = rolePermissions[user.role] || [];
        return permissions.includes('all') || permissions.includes(permission);
    }
}

// Inicializar sistema de autenticación
window.AuthSystem = new AuthSystem();

// Verificar autenticación al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    await AuthSystem.checkAuth();
    
    // Actualizar UI según estado de autenticación
    updateAuthUI();
});

/**
 * Actualizar interfaz según estado de autenticación
 */
function updateAuthUI() {
    const user = AuthSystem.getCurrentUser();
    const authElements = document.querySelectorAll('[data-auth]');
    
    authElements.forEach(element => {
        const authState = element.dataset.auth;
        
        if (authState === 'authenticated' && !user) {
            element.style.display = 'none';
        } else if (authState === 'authenticated' && user) {
            element.style.display = '';
            
            // Actualizar datos del usuario si existen campos específicos
            if (element.dataset.userField === 'name') {
                element.textContent = user.name;
            }
            if (element.dataset.userField === 'email') {
                element.textContent = user.email;
            }
            if (element.dataset.userField === 'role') {
                element.textContent = user.role;
            }
        }
        
        if (authState === 'not-authenticated' && user) {
            element.style.display = 'none';
        } else if (authState === 'not-authenticated' && !user) {
            element.style.display = '';
        }
    });
    
    // Actualizar menú de usuario si existe
    const userMenu = document.querySelector('.user-menu');
    if (userMenu) {
        if (user) {
            userMenu.innerHTML = `
                <div class="user-dropdown">
                    <button class="user-toggle">
                        <i class="fas fa-user-circle"></i>
                        <span>${user.name}</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="dropdown-menu">
                        <a href="perfil.html" class="dropdown-item">
                            <i class="fas fa-user"></i> Mi Perfil
                        </a>
                        ${user.role === 'afiliado' ? `
                            <a href="afiliado-dashboard.html" class="dropdown-item">
                                <i class="fas fa-chart-line"></i> Dashboard
                            </a>
                        ` : ''}
                        ${user.role === 'administrador' || user.role === 'dependiente' ? `
                            <a href="admin-tienda.html" class="dropdown-item">
                                <i class="fas fa-store"></i> Panel Tienda
                            </a>
                        ` : ''}
                        <div class="dropdown-divider"></div>
                        <button class="dropdown-item logout-btn">
                            <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                        </button>
                    </div>
                </div>
            `;
            
            // Agregar evento para logout
            userMenu.querySelector('.logout-btn').addEventListener('click', () => {
                AuthSystem.logout();
            });
        } else {
            userMenu.innerHTML = `
                <a href="login.html" class="btn btn-outline">Iniciar Sesión</a>
                <a href="registro.html" class="btn btn-primary">Registrarse</a>
            `;
        }
    }
}

// Exportar funciones para uso global
window.updateAuthUI = updateAuthUI;