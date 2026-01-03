// Mejora para js/auth.js
const AuthSystem = {
    // Función de login mejorada con manejo de errores específicos
    async login(email, password, role) {
        try {
            const authData = await PATI_CONFIG.pb.collection('users').authWithPassword(email, password);
            
            // Verificar si el rol coincide con el seleccionado
            if (authData.record.role !== role) {
                throw new Error('El rol seleccionado no coincide con el rol del usuario');
            }
            
            PATI_CONFIG.currentUser = authData.record;
            localStorage.setItem('pati_auth', JSON.stringify({
                token: authData.token,
                user: authData.record
            }));
            
            // Redirigir según el rol
            this.redirectByRole(role);
            
            return { success: true, user: authData.record };
        } catch (error) {
            console.error('Error en login:', error);
            return { 
                success: false, 
                error: error.message || 'Credenciales incorrectas' 
            };
        }
    },
    
    // Función para verificar sesión persistente
    async checkAuth() {
        const authData = localStorage.getItem('pati_auth');
        if (authData) {
            try {
                const { token, user } = JSON.parse(authData);
                PATI_CONFIG.pb.authStore.save(token, user);
                PATI_CONFIG.currentUser = user;
                this.redirectByRole(user.role);
                return true;
            } catch (error) {
                console.error('Error verificando autenticación:', error);
                localStorage.removeItem('pati_auth');
                return false;
            }
        }
        return false;
    },
    
    // Redirección según rol
    redirectByRole(role) {
        switch(role) {
            case 'propietario':
                window.location.href = 'admin-platform.html';
                break;
            case 'administrador':
                window.location.href = 'admin-tienda.html';
                break;
            case 'afiliado':
                window.location.href = 'panel-afiliado.html';
                break;
            case 'dependiente':
                window.location.href = 'panel-dependiente.html';
                break;
            default:
                // Cliente se queda en la página principal
                break;
        }
    },
    
    // Función de logout mejorada
    async logout() {
        try {
            PATI_CONFIG.pb.authStore.clear();
            PATI_CONFIG.currentUser = null;
            localStorage.removeItem('pati_auth');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error en logout:', error);
        }
    }
	async handleRegister(e) {
		e.preventDefault();
		
		const form = e.target;
		const data = {
			email: form.email.value,
			emailVisibility: true,
			password: form.password.value,
			passwordConfirm: form.confirmPassword.value,
			username: `${form.firstName.value}.${form.lastName.value}`.toLowerCase(),
			firstName: form.firstName.value,
			lastName: form.lastName.value,
			role: form.querySelector('#user-role').value,
			active: true
		};
		
		// Añadir campos opcionales si existen
		if (form.phone.value) {
			data.phone = form.phone.value;
		}
		
		// Si es afiliado, generar código único
		if (data.role === 'afiliado') {
			data.affiliateCode = this.generateAffiliateCode();
			data.paymentMethod = form.paymentMethod?.value || '';
			data.commissionRate = 0; // Se establecerá según tienda
		}
		
		try {
			// Crear usuario
			const userData = await this.pb.collection('users').create(data);
			
			// Si se proporcionó código de patrocinador
			const sponsorCode = form.affiliateCode?.value;
			if (sponsorCode && data.role === 'afiliado') {
				await this.assignSponsor(userData.id, sponsorCode);
			}
			
			// Autenticar automáticamente
			await this.pb.collection('users').authWithPassword(data.email, data.password);
			
			this.currentUser = this.pb.authStore.model;
			PATI_CONFIG.currentUser = this.currentUser;
			
			this.showNotification('¡Cuenta creada exitosamente!', 'success');
			
			setTimeout(() => {
				this.redirectBasedOnRole();
			}, 2000);
			
		} catch (error) {
			console.error('Registration error:', error);
			this.handleRegistrationError(error);
		}
	}

	// Función para generar código de afiliado único
	generateAffiliateCode() {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let code = '';
		for (let i = 0; i < 8; i++) {
			code += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return code;
	}

	// Función para asignar patrocinador
	async assignSponsor(userId, sponsorCode) {
		try {
			// Buscar afiliado por código
			const sponsor = await this.pb.collection('users').getFirstListItem(
				`affiliateCode="${sponsorCode}" && role="afiliado"`
			);
			
			// Aquí puedes crear una relación en otra colección si es necesario
			// Por ejemplo, en una colección 'affiliate_relations'
			console.log('Patrocinador asignado:', sponsor.id);
			
		} catch (error) {
			console.warn('No se pudo asignar patrocinador:', error);
		}
	}
};