// js/admin/rushplay-panels.js
// Gerenciamento de painéis RushPlay

const AdminRushPlayPanels = {
    currentEditingId: null,

    async load() {
        try {
            const panels = await API.admin.getRushPlayPanels();
            this.render(panels);
        } catch (error) {
            console.error('Erro ao carregar painéis RushPlay:', error);
        }
    },

    render(panels) {
        const tbody = document.getElementById('rushplayPanelsTableBody');
        tbody.innerHTML = '';

        if (panels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum painel RushPlay cadastrado</td></tr>';
            return;
        }

        panels.forEach(panel => {
            const statusBadge = Components.createStatusBadge(panel.status);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${panel.name}</td>
                <td><code>${panel.url}</code></td>
                <td>${panel.admin_username}</td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminRushPlayPanels.edit(${panel.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminRushPlayPanels.delete(${panel.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    openModal() {
        this.currentEditingId = null;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Painel RushPlay</h2>
                <div class="close-modal" onclick="AdminRushPlayPanels.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Nome do Painel</label>
                <input type="text" id="rushplayPanelName" placeholder="Ex: RushPlay Principal">
            </div>
            <div class="form-group">
                <label>URL da API</label>
                <input type="text" id="rushplayPanelUrl" placeholder="https://api-new.paineloffice.click">
                <small style="color: #888; display: block; margin-top: 5px;">
                    URL base da API RushPlay
                </small>
            </div>
            <div class="form-group">
                <label>Usuário Admin</label>
                <input type="text" id="rushplayPanelUsername" placeholder="usuario_admin">
            </div>
            <div class="form-group">
                <label>Senha Admin</label>
                <input type="password" id="rushplayPanelPassword" placeholder="senha_admin">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="rushplayPanelStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminRushPlayPanels.save()">Salvar</button>
        `;

        const modal = Components.createModal('rushplayPanelModal', 'Adicionar Painel RushPlay', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        const panels = await API.admin.getRushPlayPanels();
        const panel = panels.find(p => p.id === id);
        
        if (!panel) return;

        this.currentEditingId = id;

        const modalHtml = `
            <div class="modal-header">
                <h2>Editar Painel RushPlay</h2>
                <div class="close-modal" onclick="AdminRushPlayPanels.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Nome do Painel</label>
                <input type="text" id="rushplayPanelName" value="${panel.name}">
            </div>
            <div class="form-group">
                <label>URL da API</label>
                <input type="text" id="rushplayPanelUrl" value="${panel.url}">
            </div>
            <div class="form-group">
                <label>Usuário Admin</label>
                <input type="text" id="rushplayPanelUsername" value="${panel.admin_username}">
            </div>
            <div class="form-group">
                <label>Senha Admin</label>
                <input type="password" id="rushplayPanelPassword" value="${panel.admin_password}">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="rushplayPanelStatus">
                    <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                    <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                </select>
            </div>
            <button onclick="AdminRushPlayPanels.save()">Salvar</button>
        `;

        const modal = Components.createModal('rushplayPanelModal', 'Editar Painel RushPlay', modalHtml);
        modal.classList.add('show');
    },

    async save() {
        const data = {
            name: document.getElementById('rushplayPanelName').value,
            url: document.getElementById('rushplayPanelUrl').value,
            admin_username: document.getElementById('rushplayPanelUsername').value,
            admin_password: document.getElementById('rushplayPanelPassword').value,
            status: document.getElementById('rushplayPanelStatus').value
        };

        if (!data.name || !data.url || !data.admin_username || !data.admin_password) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateRushPlayPanel(this.currentEditingId, data);
                alert('Painel RushPlay atualizado com sucesso!');
            } else {
                await API.admin.createRushPlayPanel(data);
                alert('Painel RushPlay criado com sucesso!');
            }

            this.closeModal();
            this.load();
        } catch (error) {
            alert('Erro ao salvar painel RushPlay: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este painel RushPlay?')) return;

        try {
            await API.admin.deleteRushPlayPanel(id);
            alert('Painel RushPlay excluído com sucesso!');
            this.load();
        } catch (error) {
            alert('Erro ao excluir painel RushPlay: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('rushplayPanelModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }
};

window.AdminRushPlayPanels = AdminRushPlayPanels;
