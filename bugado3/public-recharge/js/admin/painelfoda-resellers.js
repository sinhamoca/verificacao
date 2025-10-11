// public-recharge/js/admin/painelfoda-resellers.js
// Gerenciamento de revendedores PainelFoda

const AdminPainelFodaResellers = {
    resellers: [],
    panels: [],

    async init() {
        await this.loadPanels();
        await this.loadResellers();
        this.setupEventListeners();
    },

    setupEventListeners() {
        const createBtn = document.getElementById('createPainelFodaResellerBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openCreateModal());
        }
    },

    async loadPanels() {
        try {
            this.panels = await API.admin.getPainelFodaPanels();
        } catch (error) {
            console.error('Erro ao carregar painéis:', error);
        }
    },

    async loadResellers() {
        try {
            this.resellers = await API.admin.getPainelFodaResellers();
            this.renderResellers();
        } catch (error) {
            console.error('Erro ao carregar revendedores:', error);
            alert('Erro ao carregar revendedores');
        }
    },

    renderResellers() {
        const container = document.getElementById('painelFodaResellersList');
        if (!container) return;

        if (this.resellers.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum revendedor PainelFoda cadastrado</div>';
            return;
        }

        container.innerHTML = '';
        this.resellers.forEach(reseller => {
            const card = this.createResellerCard(reseller);
            container.appendChild(card);
        });
    },

    createResellerCard(reseller) {
        const card = document.createElement('div');
        card.className = 'reseller-card';
        
        const statusClass = reseller.status === 'active' ? 'status-active' : 'status-inactive';
        const statusText = reseller.status === 'active' ? 'Ativo' : 'Inativo';

        card.innerHTML = `
            <div class="reseller-header">
                <h3>${reseller.username}</h3>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="reseller-info">
                <div class="info-row">
                    <span class="label">PainelFoda ID:</span>
                    <span class="value">${reseller.painelfoda_id}</span>
                </div>
                <div class="info-row">
                    <span class="label">Painel:</span>
                    <span class="value">${reseller.panel_name}</span>
                </div>
                <div class="info-row">
                    <span class="label">Domínio:</span>
                    <span class="value">${reseller.panel_domain}</span>
                </div>
                <div class="info-row">
                    <span class="label">Cadastrado:</span>
                    <span class="value">${new Date(reseller.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
            <div class="reseller-actions">
                <button onclick="AdminPainelFodaPackages.openModal(${reseller.id}, '${reseller.username}')" class="btn-primary">
                    💳 Pacotes
                </button>
                <button onclick="AdminPainelFodaResellers.openEditModal(${reseller.id})" class="btn-edit">
                    ✏️ Editar
                </button>
                <button onclick="AdminPainelFodaResellers.deleteReseller(${reseller.id})" class="btn-delete">
                    🗑️ Excluir
                </button>
            </div>
        `;

        return card;
    },

    openCreateModal() {
        if (this.panels.length === 0) {
            alert('Cadastre um painel PainelFoda primeiro!');
            return;
        }

        const panelOptions = this.panels
            .filter(p => p.status === 'active')
            .map(p => `<option value="${p.id}">${p.name} (${p.domain})</option>`)
            .join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Cadastrar Revendedor PainelFoda</h2>
                <div class="close-modal" onclick="AdminPainelFodaResellers.closeModal()">×</div>
            </div>
            
            <div class="form-group">
                <label>Username (Login na Interface)</label>
                <input type="text" id="resellerUsername" placeholder="Ex: joaosilva123">
                <small>Username que o cliente usará para fazer login</small>
            </div>

            <div class="form-group">
                <label>PainelFoda ID</label>
                <input type="number" id="resellerPainelFodaId" placeholder="Ex: 167517">
                <small>ID numérico do usuário no painel PainelFoda</small>
            </div>

            <div class="form-group">
                <label>Painel</label>
                <select id="resellerPanelId">
                    <option value="">Selecione um painel</option>
                    ${panelOptions}
                </select>
            </div>

            <div class="modal-actions">
                <button onclick="AdminPainelFodaResellers.createReseller()" class="btn-success">
                    Cadastrar Revendedor
                </button>
                <button onclick="AdminPainelFodaResellers.closeModal()" class="btn-secondary">
                    Cancelar
                </button>
            </div>
        `;

        const modal = Components.createModal('painelFodaResellerModal', 'Novo Revendedor', modalHtml);
        modal.classList.add('show');
    },

    async createReseller() {
        const username = document.getElementById('resellerUsername').value.trim();
        const painelfoda_id = parseInt(document.getElementById('resellerPainelFodaId').value);
        const panel_id = parseInt(document.getElementById('resellerPanelId').value);

        if (!username || !painelfoda_id || !panel_id) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            await API.admin.createPainelFodaReseller({
                username,
                painelfoda_id,
                panel_id
            });

            alert('✅ Revendedor cadastrado com sucesso!');
            this.closeModal();
            await this.loadResellers();
        } catch (error) {
            alert('❌ Erro ao cadastrar revendedor: ' + error.message);
        }
    },

    openEditModal(resellerId) {
        const reseller = this.resellers.find(r => r.id === resellerId);
        if (!reseller) return;

        const panelOptions = this.panels
            .filter(p => p.status === 'active')
            .map(p => `<option value="${p.id}" ${p.id === reseller.panel_id ? 'selected' : ''}>${p.name} (${p.domain})</option>`)
            .join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Editar Revendedor PainelFoda</h2>
                <div class="close-modal" onclick="AdminPainelFodaResellers.closeModal()">×</div>
            </div>
            
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="editResellerUsername" value="${reseller.username}">
            </div>

            <div class="form-group">
                <label>PainelFoda ID</label>
                <input type="number" id="editResellerPainelFodaId" value="${reseller.painelfoda_id}">
            </div>

            <div class="form-group">
                <label>Painel</label>
                <select id="editResellerPanelId">
                    ${panelOptions}
                </select>
            </div>

            <div class="form-group">
                <label>Status</label>
                <select id="editResellerStatus">
                    <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                    <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                </select>
            </div>

            <div class="modal-actions">
                <button onclick="AdminPainelFodaResellers.updateReseller(${reseller.id})" class="btn-success">
                    Salvar Alterações
                </button>
                <button onclick="AdminPainelFodaResellers.closeModal()" class="btn-secondary">
                    Cancelar
                </button>
            </div>
        `;

        const modal = Components.createModal('painelFodaResellerModal', 'Editar Revendedor', modalHtml);
        modal.classList.add('show');
    },

    async updateReseller(resellerId) {
        const username = document.getElementById('editResellerUsername').value.trim();
        const painelfoda_id = parseInt(document.getElementById('editResellerPainelFodaId').value);
        const panel_id = parseInt(document.getElementById('editResellerPanelId').value);
        const status = document.getElementById('editResellerStatus').value;

        if (!username || !painelfoda_id || !panel_id) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            await API.admin.updatePainelFodaReseller(resellerId, {
                username,
                painelfoda_id,
                panel_id,
                status
            });

            alert('✅ Revendedor atualizado com sucesso!');
            this.closeModal();
            await this.loadResellers();
        } catch (error) {
            alert('❌ Erro ao atualizar revendedor: ' + error.message);
        }
    },

    async deleteReseller(resellerId) {
        if (!confirm('Tem certeza que deseja excluir este revendedor? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            await API.admin.deletePainelFodaReseller(resellerId);
            alert('✅ Revendedor excluído com sucesso!');
            await this.loadResellers();
        } catch (error) {
            alert('❌ Erro ao excluir revendedor: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('painelFodaResellerModal');
        if (modal) {
            modal.remove();
        }
    }
};

window.AdminPainelFodaResellers = AdminPainelFodaResellers;
