// js/client/tenant-utils.js - Utilitários para Multi-Tenant

const TenantUtils = {
    // Pegar tenant da URL
    getTenantFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('tenant') || urlParams.get('t');
    },
    
    // Salvar tenant no localStorage
    saveTenant(tenantSlug) {
        if (tenantSlug) {
            localStorage.setItem('tenantSlug', tenantSlug);
            console.log(`[TenantUtils] Tenant salvo: ${tenantSlug}`);
        }
    },
    
    // Recuperar tenant salvo
    getSavedTenant() {
        return localStorage.getItem('tenantSlug');
    },
    
    // Garantir que tenant está na URL
    ensureTenantInURL() {
        const currentTenant = this.getTenantFromURL();
        const savedTenant = this.getSavedTenant();
        
        if (!currentTenant && savedTenant) {
            const url = new URL(window.location);
            url.searchParams.set('tenant', savedTenant);
            window.history.replaceState({}, '', url);
        }
    },
    
    // Adicionar tenant em URLs de API
    getAPIURL(endpoint) {
        const tenant = this.getTenantFromURL() || this.getSavedTenant();
        
        if (!tenant) {
            console.warn('[TenantUtils] Nenhum tenant encontrado!');
            return endpoint;
        }
        
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `${endpoint}${separator}tenant=${tenant}`;
        
        console.log(`[TenantUtils] URL da API: ${url}`);
        return url;
    }
};

window.TenantUtils = TenantUtils;

// Auto-detectar tenant ao carregar
document.addEventListener('DOMContentLoaded', () => {
    const tenant = TenantUtils.getTenantFromURL();
    if (tenant) {
        TenantUtils.saveTenant(tenant);
        console.log(`[TenantUtils] 🏢 Tenant detectado: ${tenant}`);
    } else {
        console.warn('[TenantUtils] ⚠️ Nenhum tenant na URL');
    }
});
