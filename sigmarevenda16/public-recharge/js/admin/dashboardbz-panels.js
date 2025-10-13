// public-recharge/js/admin/dashboardbz-panels.js
// Gerenciamento de Painéis DashboardBz

const AdminDashboardBzPanels = {
    currentEditingId: null,

    async load() {
        try {
            const panels = await API.admin.getDashboardBzPanels();
            this.renderTable(panels);
            this.attachEventListeners();
        } catch (error) {
            console.error('Erro ao carregar painéis DashboardBz:', error);
            alert('Erro ao carregar painéis: ' + error.message);
        }
    },

    attachEventListeners() {
        const addBtn = document.getElementById('addDashboardBzPanelBtn');
        if (addBtn) {
            addBtn.onclick = () => this.openModal();
        }
    },

    renderTable(panels) {
        const tbody = document.getElementById('dashboardbzPanelsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (panels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">Nenhum painel cadastrado</td></tr>';
            return;
        }

        panels.forEach(panel => {
            const statusBadge = panel.status === 'active' 
                ? '<span class="badge badge-success">Ativo</span>' 
                : '<span class="badge badge-danger">Inativo</span>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${panel.name}</strong></td>
                <td><a href="${panel.url}" target="_blank" style="color: #007bff;">${panel.url}</a></td>
                <td><code>${panel.admin_username}</code></td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button class="btn-small btn-primary" onclick="AdminDashboardBzPanels.edit(${panel.id})">
                        Editar
                    </button>
                    <button class="btn-small btn-danger" onclick="AdminDashboardBzPanels.delete(${panel.id})">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    openModal() {
        this.currentEditingId = null;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>➕ Adicionar Painel DashboardBz</h2>
                <div class="close-modal" onclick="AdminDashboardBzPanels.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Nome do Painel *</label>
                <input type="text" id="dashboardbzPanelName" placeholder="Ex: Dashboard Principal">
                <small style="color: #888; display: block; margin-top: 5px;">
                    Nome identificador do painel
                </small>
            </div>
            <div class="form-group">
                <label>URL do Painel *</label>
                <input type="url" id="dashboardbzPanelUrl" placeholder="https://dashboard.bz">
                <small style="color: #888; display: block; margin-top: 5px;">
                    URL completa do painel (geralmente https://dashboard.bz)
                </small>
            </div>
            <div class="form-group">
                <label>Usuário Admin *</label>
                <input type="text" id="dashboardbzPanelUsername" placeholder="usuario_admin">
                <small style="color: #888; display: block; margin-top: 5px;">
                    Usuário de acesso administrativo ao painel
                </small>
            </div>
            <div class="form-group">
                <label>Senha Admin *</label>
                <input type="password" id="dashboardbzPanelPassword" placeholder="senha_admin">
                <small style="color: #888; display: block; margin-top: 5px;">
                    Senha de acesso administrativo ao painel
                </small>
            </div>
            <div class="form-group">
                <label>Site Key (reCAPTCHA) *</label>
                <input type="text" id="dashboardbzPanelSiteKey" placeholder="6LccpnkaAAAAAOQEVXtaiWamqx0E4Lr-PutDCH4r">
                <small style="color: #888; display: block; margin-top: 5px;">
                    Site key do reCAPTCHA v2 do painel. Configure o Anti-Captcha API Key nas configurações do tenant.
                </small>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="dashboardbzPanelStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminDashboardBzPanels.save()">Salvar</button>
        `;

        const modal = Components.createModal('dashboardbzPanelModal', 'Adicionar Painel DashboardBz', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const panels = await API.admin.getDashboardBzPanels();
            const panel = panels.find(p => p.id === id);

            const modalHtml = `
                <div class="modal-header">
                    <h2>✏️ Editar Painel DashboardBz</h2>
                    <div class="close-modal" onclick="AdminDashboardBzPanels.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Nome do Painel *</label>
                    <input type="text" id="dashboardbzPanelName" value="${panel.name}">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Nome identificador do painel
                    </small>
                </div>
                <div class="form-group">
                    <label>URL do Painel *</label>
                    <input type="url" id="dashboardbzPanelUrl" value="${panel.url}">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        URL completa do painel
                    </small>
                </div>
                <div class="form-group">
                    <label>Usuário Admin *</label>
                    <input type="text" id="dashboardbzPanelUsername" value="${panel.admin_username}">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Usuário de acesso administrativo ao painel
                    </small>
                </div>
                <div class="form-group">
                    <label>Senha Admin *</label>
                    <input type="password" id="dashboardbzPanelPassword" value="${panel.admin_password}">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Senha de acesso administrativo ao painel
                    </small>
                </div>
                <div class="form-group">
                    <label>Site Key (reCAPTCHA) *</label>
                    <input type="text" id="dashboardbzPanelSiteKey" value="${panel.site_key}">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Site key do reCAPTCHA v2 do painel
                    </small>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="dashboardbzPanelStatus">
                        <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminDashboardBzPanels.save()">Salvar</button>
            `;

            const modal = Components.createModal('dashboardbzPanelModal', 'Editar Painel DashboardBz', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar painel');
        }
    },

    async save() {
        const data = {
            name: document.getElementById('dashboardbzPanelName').value,
            url: document.getElementById('dashboardbzPanelUrl').value,
            admin_username: document.getElementById('dashboardbzPanelUsername').value,
            admin_password: document.getElementById('dashboardbzPanelPassword').value,
            site_key: document.getElementById('dashboardbzPanelSiteKey').value,
            status: document.getElementById('dashboardbzPanelStatus').value
        };

        if (!data.name || !data.url || !data.admin_username || !data.admin_password || !data.site_key) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        // Validar URL
        try {
            new URL(data.url);
        } catch (e) {
            alert('URL inválida. Use o formato: https://dashboard.bz');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateDashboardBzPanel(this.currentEditingId, data);
            } else {
                await API.admin.createDashboardBzPanel(data);
            }

            this.closeModal();
            this.load();
            alert('Painel DashboardBz salvo com sucesso!');
        } catch (error) {
            alert('Erro ao salvar painel: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('⚠️ Tem certeza que deseja excluir este painel DashboardBz?\n\nTodos os revendedores vinculados também serão excluídos!')) return;

        try {
            await API.admin.deleteDashboardBzPanel(id);
            this.load();
            alert('Painel DashboardBz excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir painel: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('dashboardbzPanelModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminDashboardBzPanels = AdminDashboardBzPanels;
