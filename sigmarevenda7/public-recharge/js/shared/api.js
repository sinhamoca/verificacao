// js/shared/api.js - COM SUPORTE KOFFICE
// Cliente API para comunicação com o backend

const API = {
    baseUrl: '',

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok && response.status !== 404) {
                const error = await response.json().catch(() => ({
                    error: `Erro HTTP: ${response.status}`
                }));
                throw new Error(error.error || error.message || 'Erro na requisição');
            }

            return response;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async get(endpoint) {
        const response = await this.request(endpoint, { method: 'GET' });
        return response.json();
    },

    async post(endpoint, data) {
        const response = await this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async put(endpoint, data) {
        const response = await this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async delete(endpoint) {
        const response = await this.request(endpoint, { method: 'DELETE' });
        return response.json();
    },

    // ===== ENDPOINTS PÚBLICOS =====
    
    public: {
        getAccessQuestion: () => API.get('/api/public/access-question'),
        verifyAccess: (answer) => API.post('/api/public/verify-access', { answer }),
        login: (username) => API.post('/api/public/login', { username }),
        getPackages: (resellerId, type) => API.get(`/api/public/packages/${resellerId}?type=${type}`),
        createPayment: (resellerId, packageId, resellerType) => 
            API.post('/api/public/create-payment', { resellerId, packageId, resellerType }),
        getPaymentStatus: (paymentId) => API.get(`/api/public/payment-status/${paymentId}`),
        checkPayment: (paymentId) => API.post(`/api/public/check-payment/${paymentId}`, {}),
        getDashboard: (resellerId, type) => API.get(`/api/public/dashboard/${resellerId}?type=${type}`),
        retryRecharge: (paymentId) => API.post(`/api/public/retry-recharge/${paymentId}`, {}),
        retryAllErrors: (resellerId, type) => API.post(`/api/public/retry-all-errors/${resellerId}?type=${type}`, {})
    },

    // ===== ENDPOINTS ADMIN =====
    
    admin: {
        login: (username, password) => API.post('/api/admin/login', { username, password }),
        
        // Config
        getConfig: () => API.get('/api/admin/config'),
        updateConfig: (key, value) => API.put(`/api/admin/config/${key}`, { value }),
        
        // Painéis Sigma
        getPanels: () => API.get('/api/admin/panels'),
        createPanel: (data) => API.post('/api/admin/panels', data),
        updatePanel: (id, data) => API.put(`/api/admin/panels/${id}`, data),
        deletePanel: (id) => API.delete(`/api/admin/panels/${id}`),
        
        // Painéis Koffice (NOVO)
        getKofficePanels: () => API.get('/api/admin/koffice-panels'),
        createKofficePanel: (data) => API.post('/api/admin/koffice-panels', data),
        updateKofficePanel: (id, data) => API.put(`/api/admin/koffice-panels/${id}`, data),
        deleteKofficePanel: (id) => API.delete(`/api/admin/koffice-panels/${id}`),
        
        // Revendedores Sigma
        getResellers: () => API.get('/api/admin/resellers'),
        createReseller: (data) => API.post('/api/admin/resellers', data),
        updateReseller: (id, data) => API.put(`/api/admin/resellers/${id}`, data),
        deleteReseller: (id) => API.delete(`/api/admin/resellers/${id}`),
        
        // Revendedores Koffice (NOVO)
        getKofficeResellers: () => API.get('/api/admin/koffice-resellers'),
        createKofficeReseller: (data) => API.post('/api/admin/koffice-resellers', data),
        updateKofficeReseller: (id, data) => API.put(`/api/admin/koffice-resellers/${id}`, data),
        deleteKofficeReseller: (id) => API.delete(`/api/admin/koffice-resellers/${id}`),
        
        // Packages (unificado, precisa do type)
        getPackages: (resellerId, type) => API.get(`/api/admin/packages/${resellerId}?type=${type}`),
        createPackage: (data) => API.post('/api/admin/packages', data),
        updatePackage: (id, data) => API.put(`/api/admin/packages/${id}`, data),
        deletePackage: (id) => API.delete(`/api/admin/packages/${id}`),
        
        // Payments
        getPayments: () => API.get('/api/admin/payments'),
        deletePayment: (id) => API.delete(`/api/admin/payments/${id}`),
        deleteAllPending: () => API.delete('/api/admin/payments/pending'),
        retryRecharge: (paymentId) => API.post(`/api/admin/retry-recharge/${paymentId}`, {}),
        retryAllErrors: () => API.post('/api/admin/retry-all-errors', {}),
        
        // Stats & Transactions
        getStats: () => API.get('/api/admin/stats'),
        getTransactions: () => API.get('/api/admin/transactions')
    }
};

window.API = API;
