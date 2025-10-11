// public-recharge/js/admin/painelfoda-panels.js
// Gerenciamento de painéis PainelFoda

const AdminPainelFodaPanels = {
    panels: [],

    async init() {
        await this.loadPanels();
        this.setupEventListeners();
    },

    setupEventListeners() {
        const createBtn = document.getElementById('createPainelFodaPanelBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openCreateModal());
        }
    },

    async loadPanels() {
        try {
            this.panels = await API.admin.getPainelFodaPanels();
            this.renderPanels();
        } catch (error) {
            console.error('Erro ao carregar painéis PainelFoda:', error);
            alert('Erro ao carregar painéis PainelFoda');
        }
    },

    renderPanels() {
        const container = document.getElementById('painelFodaPanelsList');
        if (!container) return;

        if (this.panels.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum painel PainelFoda cadastrado</div>';
            return;
        }

        container.innerHTML = '';
        this.panels.forEach(panel => {
            const card = this.createPanelCard(panel);
            container.appendChild(card);
        });
    },

    createPanelCard(panel) {
        const card = document.createElement('div');
        card.className = 'panel-card';
        
        const statusClass = panel.status === 'active' ? 'status-active' : 'status-inactive';
        const statusText = panel.status === 'active' ? 'Ativo' : 'Inativo';

        card.innerHTML = `
            <div class="panel-header">
                <h3>${panel.name}</h3>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="panel-info">
                <div class="info-row">
                    <span class="label">Domínio:</span>
                    <span class="value">${panel.domain}</span>
                </div>
                <div class="info-row">
                    <span class="label">Admin:</span>
                    <span class="value">${panel.admin_username}</span>
                </div>
                <div class="info-row">
                    <span class="label">Cadastrado:</span>
                    <span class="value">${new Date(panel.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
            <div class="panel-actions">
                <button onclick="AdminPainelFodaPanels.openEditModal(${panel.id})" class="btn-edit">
                    ✏️ Editar
                </button>
                <button onclick="AdminPainelFodaPanels.deletePanel(${panel.id})" class="btn-delete">
                    🗑️ Excluir
                </button>
            </div>
        `;

        return card;
    },

    openCreateModal() {
        const modalHtml = `
            <div class="modal-header">
                <h2>Cadastrar Painel PainelFoda</h2>
                <div class="close-modal" onclick="AdminPainelFodaPanels.closeModal()">×</div>
            </div>
            
            <div class="form-group">
                <label>Nome do Painel</label>
                <input type="text" id="panelName" placeholder="Ex: P2Like Principal">
                <small>Nome identificador do painel</small>
            </div>

            <div class="form-group">
                <label>Domínio</label>
                <input type="text" id="panelDomain" placeholder="Ex: p2like.painel.tech">
                <small>Apenas o domínio, sem https://</small>
            </div>

            <div class="form-group">
                <label>Usuário Admin</label>
                <input type="text" id="panelAdminUsername" placeholder="Ex: admin">
            </div>

            <div class="form-group">
                <label>Senha Admin</label>
                <input type="password" id="panelAdminPassword">
            </div>

            <div class="modal-actions">
                <button onclick="AdminPainelFodaPanels.createPanel()" class="btn-success">
                    Cadastrar Painel
                </button>
                <button onclick="AdminPainelFodaPanels.closeModal()" class="btn-secondary">
                    Cancelar
                </button>
            </div>
        `;

        const modal = Components.createModal('painelFodaPanelModal', 'Novo Painel', modalHtml);
        modal.classList.add('show');
    },

    async createPanel() {
        const name = document.getElementById('panelName').value.trim();
        const domain = document.getElementById('panelDomain').value.trim();
        const admin_username = document.getElementById('panelAdminUsername').value.trim();
        const admin_password = document.getElementById('panelAdminPassword').value;

        if (!name || !domain || !admin_username || !admin_password) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            await API.admin.createPainelFodaPanel({
                name,
                domain,
                admin_username,
                admin_password
            });

            alert('✅ Painel cadastrado com sucesso!');
            this.closeModal();
            await this.loadPanels();
        } catch (error) {
            alert('❌ Erro ao cadastrar painel: ' + error.message);
        }
    },

    openEditModal(panelId) {
        const panel = this.panels.find(p => p.id === panelId);
        if (!panel) return;

        const modalHtml = `
            <div class="modal-header">
                <h2>Editar Painel PainelFoda</h2>
                <div class="close-modal" onclick="AdminPainelFodaPanels.closeModal()">×</div>
            </div>
            
            <div class="form-group">
                <label>Nome do Painel</label>
                <input type="text" id="editPanelName" value="${panel.name}">
            </div>

            <div class="form-group">
                <label>Domínio</label>
                <input type="text" id="editPanelDomain" value="${panel.domain}">
            </div>

            <div class="form-group">
                <label>Usuário Admin</label>
                <input type="text" id="editPanelAdminUsername" value="${panel.admin_username}">
            </div>

            <div class="form-group">
                <label>Senha Admin</label>
                <input type="password" id="editPanelAdminPassword" value="${panel.admin_password}">
            </div>

            <div class="form-group">
                <label>Status</label>
                <select id="editPanelStatus">
                    <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                    <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                </select>
            </div>

            <div class="modal-actions">
                <button onclick="AdminPainelFodaPanels.updatePanel(${panel.id})" class="btn-success">
                    Salvar Alterações
                </button>
                <button onclick="AdminPainelFodaPanels.closeModal()" class="btn-secondary">
                    Cancelar
                </button>
            </div>
        `;

        const modal = Components.createModal('painelFodaPanelModal', 'Editar Painel', modalHtml);
        modal.classList.add('show');
    },

    async updatePanel(panelId) {
        const name = document.getElementById('editPanelName').value.trim();
        const domain = document.getElementById('editPanelDomain').value.trim();
        const admin_username = document.getElementById('editPanelAdminUsername').value.trim();
        const admin_password = document.getElementById('editPanelAdminPassword').value;
        const status = document.getElementById('editPanelStatus').value;

        if (!name || !domain || !admin_username || !admin_password) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            await API.admin.updatePainelFodaPanel(panelId, {
                name,
                domain,
                admin_username,
                admin_password,
                status
            });

            alert('✅ Painel atualizado com sucesso!');
            this.closeModal();
            await this.loadPanels();
        } catch (error) {
            alert('❌ Erro ao atualizar painel: ' + error.message);
        }
    },

    async deletePanel(panelId) {
        if (!confirm('Tem certeza que deseja excluir este painel? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            await API.admin.deletePainelFodaPanel(panelId);
            alert('✅ Painel excluído com sucesso!');
            await this.loadPanels();
        } catch (error) {
            alert('❌ Erro ao excluir painel: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('painelFodaPanelModal');
        if (modal) {
            modal.remove();
        }
    }
};

// Inicializar quando a página carregar
window.AdminPainelFodaPanels = AdminPainelFodaPanels;
