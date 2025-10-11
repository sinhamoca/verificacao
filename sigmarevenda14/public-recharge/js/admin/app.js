// js/admin/app.js - COMPLETO COM RUSHPLAY
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

    // ⭐ RushPlay (NOVO)
    document.getElementById('addRushPlayPanelBtn')?.addEventListener('click', () => {
        console.log('🟡 Botão RushPlay Panel clicado');
        AdminRushPlayPanels.openModal();
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

    // ⭐ RushPlay (NOVO)
    document.getElementById('addRushPlayResellerBtn')?.addEventListener('click', () => {
        console.log('🟡 Botão RushPlay Reseller clicado');
        AdminRushPlayResellers.openModal();
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
        case 'payments':
            AdminPayments.loadPayments();
            break;
        case 'transactions':
            AdminPayments.loadTransactions();
            break;
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

window.showTab = showTab;