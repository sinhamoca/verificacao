// js/shared/utils.js
// Funções utilitárias compartilhadas

const Utils = {
    // Exibir mensagem de erro
    showError(message, elementId = 'error') {
        const errorDiv = document.getElementById(elementId);
        if (!errorDiv) return;
        
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        setTimeout(() => errorDiv.classList.remove('show'), 5000);
    },

    // Exibir mensagem de sucesso
    showSuccess(message, elementId = 'success') {
        const successDiv = document.getElementById(elementId);
        if (!successDiv) return;
        
        successDiv.textContent = message;
        successDiv.classList.add('show');
        setTimeout(() => successDiv.classList.remove('show'), 5000);
    },

    // Navegar entre steps
    goToStep(stepNumber) {
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        const targetStep = document.getElementById(`step${stepNumber}`);
        if (targetStep) {
            targetStep.classList.add('active');
        }
    },

    // Formatar moeda
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },

    // Formatar data
    formatDate(dateString) {
        return new Date(dateString).toLocaleString('pt-BR');
    },

    // Copiar texto para clipboard
    async copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                return this.fallbackCopyText(text);
            }
        } else {
            return this.fallbackCopyText(text);
        }
    },

    // Fallback para copiar texto
    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    },

    // Delay/Sleep
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // Validar email
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Criar elemento com classes
    createElement(tag, classes = [], content = '') {
        const element = document.createElement(tag);
        if (classes.length) element.className = classes.join(' ');
        if (content) element.textContent = content;
        return element;
    },

    // Mostrar/Esconder elemento
    show(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.style.display = 'block';
    },

    hide(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.style.display = 'none';
    },

    // Debounce
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Exportar para uso global
window.Utils = Utils;
