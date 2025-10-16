// /js/admin/theme-manager.js
// Gerenciador único e definitivo do tema escuro/claro

const ThemeManager = {
    init() {
        console.log('🎨 [ThemeManager] Inicializando...');
        
        // Carregar tema salvo
        this.loadSavedTheme();
        
        // Configurar botão
        this.setupToggleButton();
        
        console.log('✅ [ThemeManager] Inicializado com sucesso!');
    },

    loadSavedTheme() {
        const savedTheme = localStorage.getItem('adminTheme') || 'light';
        console.log(`📂 [ThemeManager] Tema salvo: ${savedTheme}`);
        this.applyTheme(savedTheme, false);
    },

    setupToggleButton() {
        const themeToggle = document.getElementById('themeToggle');
        
        if (!themeToggle) {
            console.error('❌ [ThemeManager] Botão #themeToggle não encontrado!');
            return;
        }

        // Remove listeners antigos (se houver)
        const newButton = themeToggle.cloneNode(true);
        themeToggle.parentNode.replaceChild(newButton, themeToggle);

        // Adiciona novo listener
        newButton.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            console.log(`🔄 [ThemeManager] Alternando: ${currentTheme} → ${newTheme}`);
            this.applyTheme(newTheme, true);
        });

        console.log('✓ [ThemeManager] Botão configurado');
    },

    applyTheme(theme, save = true) {
        // Aplica no HTML (importante!)
        document.documentElement.setAttribute('data-theme', theme);
        
        // Aplica no body também (compatibilidade)
        document.body.setAttribute('data-theme', theme);

        // Atualiza o ícone do botão
        this.updateIcon(theme);

        // Salva no localStorage
        if (save) {
            localStorage.setItem('adminTheme', theme);
            console.log(`💾 [ThemeManager] Tema salvo: ${theme}`);
        }

        console.log(`✨ [ThemeManager] Tema aplicado: ${theme}`);
    },

    updateIcon(theme) {
        const themeIcon = document.querySelector('#themeToggle .theme-icon');
        
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    },

    // Método público para alternar tema programaticamente
    toggle() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme, true);
    },

    // Método público para obter tema atual
    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }
};

// Auto-inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
    });
} else {
    // DOM já está pronto
    ThemeManager.init();
}

// Exportar para uso global
window.ThemeManager = ThemeManager;
