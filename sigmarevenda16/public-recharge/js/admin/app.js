// public-recharge/js/admin/app.js - COMPLETO COM DASHBOARDBZ
// Gerenciamento geral do admin

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Admin App iniciando...');

    // Verificar sessão
    AdminAuth.checkSession();

    // Event listener de login
    document.getElementById('adminLoginBtn')?.addEventListener('click', () => {
        AdminAuth.login();
    });

    // Event listener de logout
    document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
        AdminAuth.logout();
    });

    // ========================================
    // PAINÉIS - EVENT LISTENERS
    // ========================================
    
    // Sigma
    document.getElementById('addPanelBtn')?.addEventListener('click', () => {
        AdminPanels.openModal();
    });

    // Koffice
    document.getElementById('addKofficePanelBtn')?.addEventListener('click', () => {
        AdminKofficePanels.openModal();
    });

    // GesOffice (UNIPLAY)
    document.getElementById('addGesOfficePanelBtn')?.addEventListener('click', () => {
        AdminGesOfficePanels.openModal();
    });

    // P2BRAS
    document.getElementById('addP2brasPanelBtn')?.addEventListener('click', () => {
        AdminP2brasPanels.openModal();
    });

    // RushPlay
    document.getElementById('addRushPlayPanelBtn')?.addEventListener('click', () => {
        console.log('🟡 Botão RushPlay Panel clicado');
        AdminRushPlayPanels.openModal();
    });

    // PainelFoda
    document.getElementById('addPainelFodaPanelBtn')?.addEventListener('click', () => {
        console.log('🟢 Botão PainelFoda Panel clicado');
        AdminPainelFodaPanels.openModal();
    });

    // ⭐ DashboardBz (NOVO)
    document.getElementById('addDashboardBzPanelBtn')?.addEventListener('click', () => {
        console.log('🟡 Botão DashboardBz Panel clicado');
        AdminDashboardBzPanels.openModal();
    });

    // ========================================
    // REVENDEDORES - EVENT LISTENERS
    // ========================================
    
    // Sigma
    document.getElementById('addResellerBtn')?.addEventListener('click', () => {
        AdminResellers.openModal();
    });

    // Koffice
    document.getElementById('addKofficeResellerBtn')?.addEventListener('click', () => {
        AdminKofficeResellers.openModal();
    });

    // GesOffice (UNIPLAY)
    document.getElementById('addGesOfficeResellerBtn')?.addEventListener('click', () => {
        AdminGesOfficeResellers.openModal();
    });

    // P2BRAS
    document.getElementById('addP2brasResellerBtn')?.addEventListener('click', () => {
        AdminP2brasResellers.openModal();
    });

    // RushPlay
    document.getElementById('addRushPlayResellerBtn')?.addEventListener('click', () => {
        console.log('🟡 Botão RushPlay Reseller clicado');
        AdminRushPlayResellers.openModal();
    });

    // PainelFoda
    document.getElementById('addPainelFodaResellerBtn')?.addEventListener('click', () => {
        console.log('🟢 Botão PainelFoda Reseller clicado');
        AdminPainelFodaResellers.openModal();
    });

    // ⭐ DashboardBz (NOVO)
    document.getElementById('addDashboardBzResellerBtn')?.addEventListener('click', () => {
        console.log('🟡 Botão DashboardBz Reseller clicado');
        AdminDashboardBzResellers.openModal();
    });

    // ========================================
    // CONFIGURAÇÕES
    // ========================================
    document.getElementById('saveConfigBtn')?.addEventListener('click', () => {
        AdminDashboard.saveConfig();
    });

    console.log('✅ Event listeners registrados!');
});

// ========================================
// FUNÇÕES GLOBAIS
// ========================================

// Mostrar tab específica
function showTab(tabName) {
    console.log(`[showTab] Tentando mostrar tab: ${tabName}`);
    
    // Remover active de todas as tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    // Adicionar active na tab clicada
    const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (clickedTab) {
        clickedTab.classList.add('active');
        console.log(`[showTab] Tab button encontrado: ${tabName}`);
    } else {
        console.warn(`[showTab] Tab button NÃO encontrado: ${tabName}`);
    }
    
    // Mostrar conteúdo correspondente
    const tabId = `tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
    const tabContent = document.getElementById(tabId);
    
    if (tabContent) {
        tabContent.classList.add('active');
        console.log(`[showTab] Tab content encontrado: ${tabId}`);
    } else {
        console.error(`[showTab] Tab content NÃO encontrado: ${tabId}`);
        console.log(`[showTab] Procurando por ID: ${tabId}`);
    }

    // Carregar dados da tab
    const tabManagers = {
        'dashboard': AdminDashboard,
        'config': AdminDashboard,
        'panels': AdminPanels,
        'resellers': AdminResellers,
        'koffice-panels': AdminKofficePanels,
        'koffice-resellers': AdminKofficeResellers,
        'gesoffice-panels': AdminGesOfficePanels,
        'gesoffice-resellers': AdminGesOfficeResellers,
        'p2bras-panels': AdminP2brasPanels,
        'p2bras-resellers': AdminP2brasResellers,
        'rushplay-panels': AdminRushPlayPanels,
        'rushplay-resellers': AdminRushPlayResellers,
        'painelfoda-panels': AdminPainelFodaPanels,
        'painelfoda-resellers': AdminPainelFodaResellers,
        'dashboardbz-panels': AdminDashboardBzPanels,        // ⭐ NOVO
        'dashboardbz-resellers': AdminDashboardBzResellers,  // ⭐ NOVO
        'payments': AdminPayments,
        'transactions': AdminPayments
    };

    const manager = tabManagers[tabName];
    
    if (manager) {
        console.log(`[showTab] Gerenciador encontrado para: ${tabName}`);
        
        // Chamar método apropriado
        if (tabName === 'config') {
            manager.loadConfig();
        } else if (tabName === 'transactions') {
            manager.loadTransactions();
        } else if (tabName === 'payments') {
            manager.loadPayments();
        } else {
            manager.load();
        }
    } else {
        console.warn(`[showTab] Nenhum gerenciador encontrado para: ${tabName}`);
    }
}

// ========================================
// NAVEGAÇÃO
// ========================================

// Desktop: Sidebar navigation
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sidebar .single-item, .sidebar .menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            if (tabName) {
                showTab(tabName);
                
                // Update active state
                document.querySelectorAll('.sidebar .single-item, .sidebar .menu-item').forEach(i => {
                    i.classList.remove('active');
                });
                this.classList.add('active');
            }
        });
    });

    // Desktop: Group toggle
    document.querySelectorAll('.group-header').forEach(header => {
        header.addEventListener('click', function() {
            const group = this.parentElement;
            group.classList.toggle('expanded');
        });
    });

    // Mobile: Dropdown navigation
    document.getElementById('mobileNavSelect')?.addEventListener('change', function() {
        showTab(this.value);
    });
});

// Exportar para uso global
window.showTab = showTab;
