// js/shared/components.js
// Componentes reutilizáveis

const Components = {
    // Criar card de pacote
    createPackageCard(pkg, onSelect) {
        const unitPrice = (pkg.price / pkg.credits).toFixed(2);
        const card = document.createElement('div');
        card.className = 'package-card';
        card.onclick = () => onSelect(pkg, card);
        card.innerHTML = `
            <h3>${pkg.credits} Créditos</h3>
            <div class="price">R$ ${pkg.price.toFixed(2)}</div>
            <div class="unit-price">R$ ${unitPrice} por crédito</div>
        `;
        return card;
    },

    // Criar badge de status
    createStatusBadge(status) {
        const statusMap = {
            'active': { class: 'badge-success', text: 'Ativo' },
            'inactive': { class: 'badge-danger', text: 'Inativo' },
            'paid': { class: 'badge-success', text: 'Pago' },
            'pending': { class: 'badge-warning', text: 'Pendente' },
            'expired': { class: 'badge-danger', text: 'Expirado' },
            'error': { class: 'badge-warning', text: 'Erro na Recarga', style: 'background: #ff9800; color: white;' } // NOVO
        };
        
        const config = statusMap[status] || { class: '', text: status };
        const styleAttr = config.style ? ` style="${config.style}"` : '';
        
        return `<span class="badge ${config.class}"${styleAttr}>${config.text}</span>`;
    },

    // Criar modal genérico
    createModal(id, title, content) {
        const modal = document.getElementById(id) || document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <div class="close-modal" onclick="document.getElementById('${id}').classList.remove('show')">×</div>
                </div>
                ${content}
            </div>
        `;
        if (!document.getElementById(id)) {
            document.body.appendChild(modal);
        }
        return modal;
    },

    // Mostrar loading
    showLoading(message = 'Carregando...') {
        const loading = document.getElementById('loading') || document.createElement('div');
        loading.id = 'loading';
        loading.className = 'loading';
        loading.textContent = message;
        document.body.appendChild(loading);
    },

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.remove();
    }
};

window.Components = Components;
