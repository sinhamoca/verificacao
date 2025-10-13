// public-recharge/js/admin/painelfoda-panels.js
// Gerenciamento de Painéis PainelFoda

const AdminPainelFodaPanels = {
    currentPanel: null,

    async load() {
        try {
            const panels = await API.admin.getPainelFodaPanels();
            this.renderTable(panels);
        } catch (error) {
            console.error('Erro ao carregar painéis PainelFoda:', error);
            alert('Erro ao carregar painéis: ' + error.message);
        }
    },

    renderTable(panels) {
        const tbody = document.getElementById('painelfodaPanelsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (panels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">Nenhum painel cadastrado</td></tr>';
            return;
        }

        panels.forEach(panel => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${panel.name}</strong></td>
                <td><a href="${panel.url}" target="_blank" style="color: #667eea;">${panel.url}</a></td>
                <td>${panel.admin_username}</td>
                <td>
                    <span class="badge badge-${panel.status === 'active' ? 'success' : 'danger'}">
                        ${panel.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn-small btn-primary" onclick="AdminPainelFodaPanels.openModal(${JSON.stringify(panel).replace(/"/g, '&quot;')})">
                        Editar
                    </button>
                    <button class="btn-small btn-danger" onclick="AdminPainelFodaPanels.delete(${panel.id})">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openModal(panel = null) {
        this.currentPanel = panel;

        const modalHtml = `
            <div class="modal-overlay" id="painelfodaPanelModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${panel ? '✏️ Editar' : '➕ Adicionar'} Painel PainelFoda</h3>
                        <button class="modal-close" onclick="AdminPainelFodaPanels.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Nome do Painel *</label>
                            <input type="text" id="painelfodaPanelName" value="${panel?.name || ''}" placeholder="Ex: PainelFoda Principal">
                            <small>Nome identificador do painel</small>
                        </div>
                        <div class="form-group">
                            <label>URL do Painel *</label>
                            <input type="url" id="painelfodaPanelUrl" value="${panel?.url || ''}" placeholder="https://painel.exemplo.com">
                            <small>URL completa do painel (incluindo https://)</small>
                        </div>
                        <div class="form-group">
                            <label>Usuário Admin *</label>
                            <input type="text" id="painelfodaPanelAdminUser" value="${panel?.admin_username || ''}" placeholder="admin">
                            <small>Usuário de acesso administrativo ao painel</small>
                        </div>
                        <div class="form-group">
                            <label>Senha Admin *</label>
                            <input type="password" id="painelfodaPanelAdminPass" value="${panel?.admin_password || ''}" placeholder="********">
                            <small>Senha de acesso administrativo ao painel</small>
                        </div>
                        ${panel ? `
                        <div class="form-group">
                            <label>Status</label>
                            <select id="painelfodaPanelStatus">
                                <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                                <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                            </select>
                        </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="AdminPainelFodaPanels.closeModal()">Cancelar</button>
                        <button class="btn-success" onclick="AdminPainelFodaPanels.save()">
                            ${panel ? '💾 Salvar Alterações' : '✅ Criar Painel'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    closeModal() {
        const modal = document.getElementById('painelfodaPanelModal');
        if (modal) modal.remove();
        this.currentPanel = null;
    },

    async save() {
        const name = document.getElementById('painelfodaPanelName').value.trim();
        const url = document.getElementById('painelfodaPanelUrl').value.trim();
        const admin_username = document.getElementById('painelfodaPanelAdminUser').value.trim();
        const admin_password = document.getElementById('painelfodaPanelAdminPass').value.trim();
        const status = document.getElementById('painelfodaPanelStatus')?.value || 'active';

        if (!name || !url || !admin_username || !admin_password) {
            alert('Preencha todos os campos obrigatórios!');
            return;
        }

        try {
            const data = { name, url, admin_username, admin_password, status };

            if (this.currentPanel) {
                await API.admin.updatePainelFodaPanel(this.currentPanel.id, data);
                alert('Painel atualizado com sucesso!');
            } else {
                await API.admin.createPainelFodaPanel(data);
                alert('Painel criado com sucesso!');
            }

            this.closeModal();
            this.load();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este painel?\n\nTodos os revendedores vinculados também serão excluídos!')) {
            return;
        }

        try {
            await API.admin.deletePainelFodaPanel(id);
            alert('Painel excluído com sucesso!');
            this.load();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir: ' + error.message);
        }
    }
};

// Auto-load quando a aba for ativada
window.AdminPainelFodaPanels = AdminPainelFodaPanels;
