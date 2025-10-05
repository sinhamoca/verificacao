// js/admin/auth.js
// Autenticação do administrador

const AdminAuth = {
    isAuthenticated: false,

    // Fazer login
    async login() {
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;

        if (!username || !password) {
            this.showLoginAlert('Preencha todos os campos', 'error');
            return;
        }

        try {
            const data = await API.admin.login(username, password);
            
            if (data.success) {
                this.isAuthenticated = true;
                localStorage.setItem('adminSessionId', data.admin_id);
                this.showAdminPanel();
                AdminDashboard.load();
            } else {
                this.showLoginAlert('Credenciais inválidas', 'error');
            }
        } catch (error) {
            this.showLoginAlert('Erro ao fazer login', 'error');
        }
    },

    // Fazer logout
    logout() {
        this.isAuthenticated = false;
        localStorage.removeItem('adminSessionId');
        this.hideAdminPanel();
        this.clearLoginFields();
    },

    // Verificar sessão
    checkSession() {
        const sessionId = localStorage.getItem('adminSessionId');
        if (sessionId) {
            this.isAuthenticated = true;
            this.showAdminPanel();
            AdminDashboard.load();
        }
    },

    // Mostrar painel admin
    showAdminPanel() {
        // Adicionar classe no body para controle via CSS
        document.body.classList.add('authenticated');
        
        // Garantir visibilidade (fallback)
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
    },

    // Esconder painel admin
    hideAdminPanel() {
        // Remover classe do body
        document.body.classList.remove('authenticated');
        
        // Garantir visibilidade (fallback)
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
    },

    // Limpar campos de login
    clearLoginFields() {
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
    },

    // Mostrar alerta de login
    showLoginAlert(message, type) {
        const alert = document.getElementById('loginAlert');
        if (!alert) return;
        
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.style.display = 'block';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 5000);
    }
};

window.AdminAuth = AdminAuth;
