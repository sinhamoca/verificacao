// js/admin/app.js - COMPLETO COM TODOS OS PAINÉIS + PAINELFODA
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

    // PainelFoda ⭐ NOVO
    document.getElementById('createPainelFodaPanelBtn')?.addEventListener('click', () => {
        console.log('🎯 Botão PainelFoda Panel clicado');
        AdminPainelFodaPanels.openCreateModal();
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

    // PainelFoda ⭐ NOVO
    document.getElementById('createPainelFodaResellerBtn')?.addEventListener('click', () => {
        console.log('🎯 Botão PainelFoda Reseller clicado');
        AdminPainelFodaResellers.openCreateModal();
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
        case 'rushplay-panels':
            console.log('🟡 Carregando painéis RushPlay...');
            AdminRushPlayPanels.load();
            break;
        case 'rushplay-resellers':
            console.log('🟡 Carregando revendedores RushPlay...');
            AdminRushPlayResellers.load();
            break;
        case 'painelfoda-panels':
            console.log('🎯 Carregando painéis PainelFoda...');
            AdminPainelFodaPanels.init();
            break;
        case 'painelfoda-resellers':
            console.log('🎯 Carregando revendedores PainelFoda...');
            AdminPainelFodaResellers.init();
            break;
        case 'payments':
            AdminPayments.loadPayments();
            break;
        case 'transactions':
            AdminPayments.loadTransactions();
            break;
    }
}

// ========================================
// NAVEGAÇÃO - COMPATIBILIDADE
// ========================================
window.showTab = showTab;
