// js/shared/api.js - COMPLETO COM RUSHPLAY
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
        getAccessQuestion: () => {
            const url = typeof TenantUtils !== 'undefined' ? 
                TenantUtils.getAPIURL('/api/public/access-question') : 
                '/api/public/access-question';
            return API.get(url);
        },
        
        verifyAccess: (answer) => {
            const url = typeof TenantUtils !== 'undefined' ? 
                TenantUtils.getAPIURL('/api/public/verify-access') : 
                '/api/public/verify-access';
            return API.post(url, { answer });
        },
        
        verifyReseller: (username) => {
            const url = typeof TenantUtils !== 'undefined' ? 
                TenantUtils.getAPIURL('/api/public/verify-reseller') : 
                '/api/public/verify-reseller';
            return API.post(url, { username });
        },
        
        getPackages: (resellerId, type) => {
            const url = typeof TenantUtils !== 'undefined' ? 
                TenantUtils.getAPIURL(`/api/public/packages/${resellerId}?type=${type}`) : 
                `/api/public/packages/${resellerId}?type=${type}`;
            return API.get(url);
        },
        
        createPayment: (resellerId, packageId, resellerType) => {
            const url = typeof TenantUtils !== 'undefined' ? 
                TenantUtils.getAPIURL('/api/public/create-payment') : 
                '/api/public/create-payment';
            return API.post(url, { resellerId, packageId, resellerType });
        },
        
        getPaymentStatus: (paymentId) => API.get(`/api/public/payment-status/${paymentId}`),
        
        checkPayment: (paymentId) => API.post(`/api/public/check-payment/${paymentId}`, {}),
        
        getDashboard: (resellerId, type) => {
            const url = typeof TenantUtils !== 'undefined' ? 
                TenantUtils.getAPIURL(`/api/public/dashboard/${resellerId}?type=${type}`) : 
                `/api/public/dashboard/${resellerId}?type=${type}`;
            return API.get(url);
        },
        
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
        
        // Painéis Koffice
        getKofficePanels: () => API.get('/api/admin/koffice-panels'),
        createKofficePanel: (data) => API.post('/api/admin/koffice-panels', data),
        updateKofficePanel: (id, data) => API.put(`/api/admin/koffice-panels/${id}`, data),
        deleteKofficePanel: (id) => API.delete(`/api/admin/koffice-panels/${id}`),
        
        // Painéis GesOffice (UNIPLAY)
        getGesOfficePanels: () => API.get('/api/admin/gesoffice-panels'),
        createGesOfficePanel: (data) => API.post('/api/admin/gesoffice-panels', data),
        updateGesOfficePanel: (id, data) => API.put(`/api/admin/gesoffice-panels/${id}`, data),
        deleteGesOfficePanel: (id) => API.delete(`/api/admin/gesoffice-panels/${id}`),
        
        // ⭐ Painéis P2BRAS (Controle.VIP)
        getP2brasPanels: () => API.get('/api/admin/p2bras-panels'),
        createP2brasPanel: (data) => API.post('/api/admin/p2bras-panels', data),
        updateP2brasPanel: (id, data) => API.put(`/api/admin/p2bras-panels/${id}`, data),
        deleteP2brasPanel: (id) => API.delete(`/api/admin/p2bras-panels/${id}`),
        
        // ⭐ Painéis RushPlay (NOVO)
        getRushPlayPanels: () => API.get('/api/admin/rushplay-panels'),
        createRushPlayPanel: (data) => API.post('/api/admin/rushplay-panels', data),
        updateRushPlayPanel: (id, data) => API.put(`/api/admin/rushplay-panels/${id}`, data),
        deleteRushPlayPanel: (id) => API.delete(`/api/admin/rushplay-panels/${id}`),
        
        // Revendedores Sigma
        getResellers: () => API.get('/api/admin/resellers'),
        createReseller: (data) => API.post('/api/admin/resellers', data),
        updateReseller: (id, data) => API.put(`/api/admin/resellers/${id}`, data),
        deleteReseller: (id) => API.delete(`/api/admin/resellers/${id}`),
        
        // Revendedores Koffice
        getKofficeResellers: () => API.get('/api/admin/koffice-resellers'),
        createKofficeReseller: (data) => API.post('/api/admin/koffice-resellers', data),
        updateKofficeReseller: (id, data) => API.put(`/api/admin/koffice-resellers/${id}`, data),
        deleteKofficeReseller: (id) => API.delete(`/api/admin/koffice-resellers/${id}`),
        
        // Revendedores GesOffice (UNIPLAY)
        getGesOfficeResellers: () => API.get('/api/admin/gesoffice-resellers'),
        createGesOfficeReseller: (data) => API.post('/api/admin/gesoffice-resellers', data),
        updateGesOfficeReseller: (id, data) => API.put(`/api/admin/gesoffice-resellers/${id}`, data),
        deleteGesOfficeReseller: (id) => API.delete(`/api/admin/gesoffice-resellers/${id}`),
        
        // ⭐ Revendedores P2BRAS (Controle.VIP)
        getP2brasResellers: () => API.get('/api/admin/p2bras-resellers'),
        createP2brasReseller: (data) => API.post('/api/admin/p2bras-resellers', data),
        updateP2brasReseller: (id, data) => API.put(`/api/admin/p2bras-resellers/${id}`, data),
        deleteP2brasReseller: (id) => API.delete(`/api/admin/p2bras-resellers/${id}`),
        
        // ⭐ Revendedores RushPlay (NOVO)
        getRushPlayResellers: () => API.get('/api/admin/rushplay-resellers'),
        createRushPlayReseller: (data) => API.post('/api/admin/rushplay-resellers', data),
        updateRushPlayReseller: (id, data) => API.put(`/api/admin/rushplay-resellers/${id}`, data),
        deleteRushPlayReseller: (id) => API.delete(`/api/admin/rushplay-resellers/${id}`),

        // ⭐ Painéis PainelFoda (NOVO)
        getPainelFodaPanels: () => API.get('/api/admin/painelfoda-panels'),
        createPainelFodaPanel: (data) => API.post('/api/admin/painelfoda-panels', data),
        updatePainelFodaPanel: (id, data) => API.put(`/api/admin/painelfoda-panels/${id}`, data),
        deletePainelFodaPanel: (id) => API.delete(`/api/admin/painelfoda-panels/${id}`),

        // ⭐ Revendedores PainelFoda (NOVO)
        getPainelFodaResellers: () => API.get('/api/admin/painelfoda-resellers'),
        createPainelFodaReseller: (data) => API.post('/api/admin/painelfoda-resellers', data),
        updatePainelFodaReseller: (id, data) => API.put(`/api/admin/painelfoda-resellers/${id}`, data),
        deletePainelFodaReseller: (id) => API.delete(`/api/admin/painelfoda-resellers/${id}`),
        
        // Packages (unificado - funciona para todos os tipos)
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
