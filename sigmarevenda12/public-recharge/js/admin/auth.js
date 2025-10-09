// js/admin/auth.js - VERSÃO COMPLETA COM GESOFFICE CORRIGIDA
// Autenticação do administrador

const AdminAuth = {
    token: null,
    isAuthenticated: false,
    adminData: null,

    // ========================================
    // LOGIN
    // ========================================
    async login() {
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;

        if (!username || !password) {
            this.showLoginAlert('Preencha todos os campos', 'error');
            return;
        }

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.token = data.token;
                this.adminData = data.admin;
                this.isAuthenticated = true;
                
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('adminData', JSON.stringify(data.admin));
                
                console.log('✅ Login bem-sucedido:', data.admin.username);
                
                this.showAdminPanel();
                
                if (typeof AdminDashboard !== 'undefined') {
                    AdminDashboard.load();
                }
            } else {
                this.showLoginAlert(data.error || 'Credenciais inválidas', 'error');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            this.showLoginAlert('Erro ao fazer login', 'error');
        }
    },

    // ========================================
    // LOGOUT
    // ========================================
    async logout() {
        try {
            if (this.token) {
                await fetch('/api/admin/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao fazer logout no servidor:', error);
        }
        
        this.token = null;
        this.adminData = null;
        this.isAuthenticated = false;
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminData');
        
        console.log('✅ Logout realizado');
        
        this.hideAdminPanel();
        this.clearLoginFields();
    },

    // ========================================
    // VERIFICAR SESSÃO
    // ========================================
    async checkSession() {
        const token = localStorage.getItem('adminToken');
        
        if (!token) {
            console.log('⚠️ Nenhum token encontrado');
            this.hideAdminPanel();
            return;
        }

        try {
            const response = await fetch('/api/admin/verify-session', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                this.token = token;
                this.adminData = data.admin;
                this.isAuthenticated = true;
                
                console.log('✅ Sessão restaurada:', data.admin.username);
                
                this.showAdminPanel();
                
                if (typeof AdminDashboard !== 'undefined') {
                    AdminDashboard.load();
                }
            } else {
                console.log('⚠️ Sessão inválida ou expirada');
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminData');
                this.hideAdminPanel();
            }
        } catch (error) {
            console.error('Erro ao verificar sessão:', error);
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminData');
            this.hideAdminPanel();
        }
    },

    // ========================================
    // HEADERS AUTENTICADOS
    // ========================================
    getAuthHeaders() {
        if (!this.token) {
            throw new Error('Não autenticado');
        }
        
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    },

    // ========================================
    // INTERFACE
    // ========================================
    showAdminPanel() {
        document.body.classList.add('authenticated');
        
        const loginContainer = document.getElementById('loginContainer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
    },

    hideAdminPanel() {
        document.body.classList.remove('authenticated');
        
        const loginContainer = document.getElementById('loginContainer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (loginContainer) loginContainer.style.display = 'flex';
        if (adminPanel) adminPanel.style.display = 'none';
    },

    clearLoginFields() {
        const usernameInput = document.getElementById('adminUsername');
        const passwordInput = document.getElementById('adminPassword');
        
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
    },

    showLoginAlert(message, type) {
        const alert = document.getElementById('loginAlert');
        if (!alert) return;
        
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.style.display = 'block';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 5000);
    },

    // ========================================
    // INTERCEPTOR DE REQUISIÇÕES
    // ========================================
    async fetchWithAuth(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.getAuthHeaders(),
                    ...options.headers
                }
            });

            if (response.status === 401) {
                console.log('⚠️ Sessão expirada durante requisição');
                this.showLoginAlert('Sessão expirada. Faça login novamente.', 'error');
                this.logout();
                throw new Error('Sessão expirada');
            }

            return response;
        } catch (error) {
            if (error.message === 'Sessão expirada') {
                throw error;
            }
            console.error('Erro na requisição:', error);
            throw error;
        }
    }
};

// ========================================
// ATUALIZAR API.admin PARA USAR TOKENS
// ✅ CORRIGIDO: CRIA VERSÕES AUTENTICADAS DAS FUNÇÕES GESOFFICE
// ========================================

if (typeof API !== 'undefined' && API.admin) {
    // 🔧 NÃO salvar as funções antigas - vamos criar versões autenticadas
    
    API.admin = {
        // Login e autenticação
        login: (username, password) => fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        }).then(r => r.json()),
        
        // Config
        async getConfig() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/config');
            return response.json();
        },
        
        async updateConfig(key, value) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/config/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ value })
            });
            return response.json();
        },
        
        // Painéis Sigma
        async getPanels() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/panels');
            return response.json();
        },
        
        async createPanel(data) {
            const response = await AdminAuth.fetchWithAuth('/api/admin/panels', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async updatePanel(id, data) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/panels/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async deletePanel(id) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/panels/${id}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        
        // Painéis Koffice
        async getKofficePanels() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/koffice-panels');
            return response.json();
        },
        
        async createKofficePanel(data) {
            const response = await AdminAuth.fetchWithAuth('/api/admin/koffice-panels', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async updateKofficePanel(id, data) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/koffice-panels/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async deleteKofficePanel(id) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/koffice-panels/${id}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        
        // ✅ Painéis GesOffice (UNIPLAY) - COM AUTENTICAÇÃO
        async getGesOfficePanels() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/gesoffice-panels');
            return response.json();
        },
        
        async createGesOfficePanel(data) {
            const response = await AdminAuth.fetchWithAuth('/api/admin/gesoffice-panels', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async updateGesOfficePanel(id, data) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/gesoffice-panels/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async deleteGesOfficePanel(id) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/gesoffice-panels/${id}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        
        // Revendedores Sigma
        async getResellers() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/resellers');
            return response.json();
        },
        
        async createReseller(data) {
            const response = await AdminAuth.fetchWithAuth('/api/admin/resellers', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async updateReseller(id, data) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/resellers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async deleteReseller(id) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/resellers/${id}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        
        // Revendedores Koffice
        async getKofficeResellers() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/koffice-resellers');
            return response.json();
        },
        
        async createKofficeReseller(data) {
            const response = await AdminAuth.fetchWithAuth('/api/admin/koffice-resellers', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async updateKofficeReseller(id, data) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/koffice-resellers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async deleteKofficeReseller(id) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/koffice-resellers/${id}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        
        // ✅ Revendedores GesOffice (UNIPLAY) - COM AUTENTICAÇÃO
        async getGesOfficeResellers() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/gesoffice-resellers');
            return response.json();
        },
        
        async createGesOfficeReseller(data) {
            const response = await AdminAuth.fetchWithAuth('/api/admin/gesoffice-resellers', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async updateGesOfficeReseller(id, data) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/gesoffice-resellers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async deleteGesOfficeReseller(id) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/gesoffice-resellers/${id}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        
        // Packages (unificado)
        async getPackages(resellerId, type) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/packages/${resellerId}?type=${type}`);
            return response.json();
        },
        
        async createPackage(data) {
            const response = await AdminAuth.fetchWithAuth('/api/admin/packages', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async updatePackage(id, data) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/packages/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            return response.json();
        },
        
        async deletePackage(id) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/packages/${id}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        
        // Payments
        async getPayments() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/payments');
            return response.json();
        },
        
        async deletePayment(id) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/payments/${id}`, {
                method: 'DELETE'
            });
            return response.json();
        },
        
        async deleteAllPending() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/payments/pending', {
                method: 'DELETE'
            });
            return response.json();
        },
        
        async retryRecharge(paymentId) {
            const response = await AdminAuth.fetchWithAuth(`/api/admin/retry-recharge/${paymentId}`, {
                method: 'POST'
            });
            return response.json();
        },
        
        async retryAllErrors() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/retry-all-errors', {
                method: 'POST'
            });
            return response.json();
        },
        
        // Stats & Transactions
        async getStats() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/stats');
            return response.json();
        },
        
        async getTransactions() {
            const response = await AdminAuth.fetchWithAuth('/api/admin/transactions');
            return response.json();
        }
    };
}

window.AdminAuth = AdminAuth;
