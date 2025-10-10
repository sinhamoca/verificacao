// js/admin/app.js - COM SUPORTE KOFFICE
// Inicialização do app admin

document.addEventListener('DOMContentLoaded', () => {
    // Verificar sessão ao carregar
    AdminAuth.checkSession();

    // Event Listeners - Login
    document.getElementById('adminLoginBtn')?.addEventListener('click', () => AdminAuth.login());
    document.getElementById('adminLogoutBtn')?.addEventListener('click', () => AdminAuth.logout());

    // Event Listeners - Configurações
    document.getElementById('saveConfigBtn')?.addEventListener('click', () => AdminDashboard.saveConfig());

    // Event Listeners - Painéis Sigma
    document.getElementById('addPanelBtn')?.addEventListener('click', () => AdminPanels.openModal());

    // Event Listeners - Revendedores Sigma
    document.getElementById('addResellerBtn')?.addEventListener('click', () => AdminResellers.openModal());

    // Event Listeners - Painéis Koffice (NOVO)
    document.getElementById('addKofficePanelBtn')?.addEventListener('click', () => AdminKofficePanels.openModal());

    // Event Listeners - Revendedores Koffice (NOVO)
    document.getElementById('addKofficeResellerBtn')?.addEventListener('click', () => AdminKofficeResellers.openModal());

    // Event Listeners - Painéis GesOffice (ADICIONAR após Koffice)
    document.getElementById('addGesOfficePanelBtn')?.addEventListener('click', () => AdminGesOfficePanels.openModal());

    // Event Listeners - Revendedores GesOffice (ADICIONAR após Koffice)
    document.getElementById('addGesOfficeResellerBtn')?.addEventListener('click', () => AdminGesOfficeResellers.openModal());

    // P2BRAS Panels
    document.getElementById('addP2brasPanelBtn')?.addEventListener('click', () => {
        AdminP2brasPanels.openModal();
    });

    // P2BRAS Resellers
    document.getElementById('addP2brasResellerBtn')?.addEventListener('click', () => {
        AdminP2brasResellers.openModal();
    });

    // Event Listeners - Pagamentos
    document.getElementById('deleteAllPendingBtn')?.addEventListener('click', () => AdminPayments.deleteAllPending());

    // Event Listeners - Tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            showTab(tabName);
        });
    });

    // Permitir Enter nos campos de login
    document.getElementById('adminPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            AdminAuth.login();
        }
    });
});

// Mostrar tab específica
function showTab(tabName) {
    // Remover active de todas as tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    // Adicionar active na tab clicada
    const clickedTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (clickedTab) clickedTab.classList.add('active');
    
    // Mostrar conteúdo correspondente
    const tabContent = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (tabContent) tabContent.classList.add('active');

    // Carregar dados da tab
    switch(tabName) {
        case 'dashboard':
            AdminDashboard.load();
            break;
        case 'config':
            AdminDashboard.loadConfig();
            break;
        case 'panels':
            AdminPanels.load();
            break;
        case 'resellers':
            AdminResellers.load();
            break;
        case 'koffice-panels':
            AdminKofficePanels.load();
            break;
        case 'koffice-resellers':
            AdminKofficeResellers.load();
            break;
        case 'gesoffice-panels':
            AdminGesOfficePanels.load();
            break;
        case 'gesoffice-resellers':
            AdminGesOfficeResellers.load();
            break;
        case 'p2bras-panels':
            AdminP2brasPanels.load();
            break;
        case 'p2bras-resellers':
            AdminP2brasResellers.load();
            break;
        case 'payments':
            AdminPayments.loadPayments();
            break;
        case 'transactions':
            AdminPayments.loadTransactions();
            break;
    }
}

// Exportar para uso global
window.showTab = showTab;
