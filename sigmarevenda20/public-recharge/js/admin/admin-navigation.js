// public-recharge/js/admin/admin-navigation.js
// Sistema de Navegação do Admin - Versão Profissional

const AdminNavigation = {
    // Inicializar navegação quando o DOM estiver pronto
    init() {
        console.log('🔧 [AdminNavigation] Inicializando sistema de navegação...');
        
        // Garantir que showTab existe
        if (typeof window.showTab !== 'function') {
            console.error('❌ [AdminNavigation] Função showTab não encontrada!');
            console.log('⚠️  [AdminNavigation] Aguardando carregamento...');
            
            // Tentar novamente após um pequeno delay
            setTimeout(() => this.init(), 100);
            return;
        }

        this.initDesktopNavigation();
        this.initMobileNavigation();
        this.initGroupToggles();

        console.log('✅ [AdminNavigation] Sistema de navegação inicializado');
    },

    // Navegação Desktop (Sidebar)
    initDesktopNavigation() {
        const navItems = document.querySelectorAll('.sidebar .single-item, .sidebar .menu-item');
        
        if (navItems.length === 0) {
            console.warn('⚠️  [AdminNavigation] Nenhum item de navegação encontrado');
            return;
        }

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const tabName = item.getAttribute('data-tab');
                
                if (!tabName) {
                    console.warn('⚠️  [AdminNavigation] Item sem data-tab:', item);
                    return;
                }

                // Chamar showTab
                if (typeof window.showTab === 'function') {
                    window.showTab(tabName);
                    
                    // Atualizar estado ativo
                    this.updateActiveState(item);
                    
                    console.log(`📍 [AdminNavigation] Navegou para: ${tabName}`);
                } else {
                    console.error('❌ [AdminNavigation] showTab não está disponível');
                }
            });
        });

        console.log(`✓ [AdminNavigation] ${navItems.length} itens de navegação desktop configurados`);
    },

    // Atualizar estado ativo
    updateActiveState(activeItem) {
        // Remover active de todos
        document.querySelectorAll('.sidebar .single-item, .sidebar .menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Adicionar active no item clicado
        activeItem.classList.add('active');
    },

    // Navegação Mobile (Dropdown)
    initMobileNavigation() {
        const mobileSelect = document.getElementById('mobileNavSelect');
        
        if (!mobileSelect) {
            console.log('ℹ️  [AdminNavigation] Dropdown mobile não encontrado (modo desktop?)');
            return;
        }

        mobileSelect.addEventListener('change', (e) => {
            const tabName = e.target.value;
            
            if (typeof window.showTab === 'function') {
                window.showTab(tabName);
                console.log(`📱 [AdminNavigation] Navegou (mobile) para: ${tabName}`);
            } else {
                console.error('❌ [AdminNavigation] showTab não está disponível');
            }
        });

        console.log('✓ [AdminNavigation] Navegação mobile configurada');
    },

    // Toggle de Grupos (Expandir/Colapsar)
    initGroupToggles() {
        const groupHeaders = document.querySelectorAll('.group-header');
        
        if (groupHeaders.length === 0) {
            console.log('ℹ️  [AdminNavigation] Nenhum grupo encontrado');
            return;
        }

        groupHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                // Não fazer nada se clicou em um item filho
                if (e.target.closest('.menu-item')) {
                    return;
                }

                const group = header.parentElement;
                const wasExpanded = group.classList.contains('expanded');
                
                group.classList.toggle('expanded');
                
                console.log(`${wasExpanded ? '📁' : '📂'} [AdminNavigation] Grupo ${wasExpanded ? 'colapsado' : 'expandido'}`);
            });
        });

        console.log(`✓ [AdminNavigation] ${groupHeaders.length} grupos configurados`);
    },


    // Método público para navegação programática
    navigateTo(tabName) {
        if (typeof window.showTab === 'function') {
            window.showTab(tabName);
            
            // Atualizar dropdown mobile se existir
            const mobileSelect = document.getElementById('mobileNavSelect');
            if (mobileSelect) {
                mobileSelect.value = tabName;
            }
            
            // Atualizar item ativo no desktop
            const desktopItem = document.querySelector(`[data-tab="${tabName}"]`);
            if (desktopItem) {
                this.updateActiveState(desktopItem);
            }
            
            console.log(`🔗 [AdminNavigation] Navegação programática para: ${tabName}`);
        } else {
            console.error('❌ [AdminNavigation] showTab não disponível');
        }
    }
};

// Auto-inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AdminNavigation.init();
    });
} else {
    // DOM já está pronto
    AdminNavigation.init();
}

// Exportar para uso global
window.AdminNavigation = AdminNavigation;
