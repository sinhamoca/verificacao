// js/admin/panels.js
// Gerenciamento de painéis Sigma

const AdminPanels = {
    currentEditingId: null,

    // Carregar painéis
    async load() {
        try {
            const panels = await API.admin.getPanels();
            this.render(panels);
        } catch (error) {
            console.error('Erro ao carregar painéis:', error);
        }
    },

    // Renderizar tabela
    render(panels) {
        const tbody = document.getElementById('panelsTableBody');
        tbody.innerHTML = '';

        if (panels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum painel cadastrado</td></tr>';
            return;
        }

        panels.forEach(panel => {
            const statusBadge = Components.createStatusBadge(panel.status);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${panel.name}</td>
                <td>${panel.url}</td>
                <td>${panel.admin_username}</td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminPanels.edit(${panel.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminPanels.delete(${panel.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    // Abrir modal (criar)
    openModal() {
        this.currentEditingId = null;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Painel</h2>
                <div class="close-modal" onclick="AdminPanels.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Nome do Painel</label>
                <input type="text" id="panelName" placeholder="Ex: StarPlay">
            </div>
            <div class="form-group">
                <label>URL</label>
                <input type="text" id="panelUrl" placeholder="https://starplay.sigma.st">
            </div>
            <div class="form-group">
                <label>Usuário Admin</label>
                <input type="text" id="panelUsername" placeholder="usuario_admin">
            </div>
            <div class="form-group">
                <label>Senha Admin</label>
                <input type="password" id="panelPassword" placeholder="senha_admin">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="panelStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminPanels.save()">Salvar</button>
        `;

        const modal = Components.createModal('panelModal', 'Adicionar Painel', modalHtml);
        modal.classList.add('show');
    },

    // Editar painel
    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const panels = await API.admin.getPanels();
            const panel = panels.find(p => p.id === id);

            const modalHtml = `
                <div class="modal-header">
                    <h2>Editar Painel</h2>
                    <div class="close-modal" onclick="AdminPanels.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Nome do Painel</label>
                    <input type="text" id="panelName" value="${panel.name}">
                </div>
                <div class="form-group">
                    <label>URL</label>
                    <input type="text" id="panelUrl" value="${panel.url}">
                </div>
                <div class="form-group">
                    <label>Usuário Admin</label>
                    <input type="text" id="panelUsername" value="${panel.admin_username}">
                </div>
                <div class="form-group">
                    <label>Senha Admin</label>
                    <input type="password" id="panelPassword" value="${panel.admin_password}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="panelStatus">
                        <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminPanels.save()">Salvar</button>
            `;

            const modal = Components.createModal('panelModal', 'Editar Painel', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar painel');
        }
    },

    // Salvar painel
    async save() {
        const data = {
            name: document.getElementById('panelName').value,
            url: document.getElementById('panelUrl').value,
            admin_username: document.getElementById('panelUsername').value,
            admin_password: document.getElementById('panelPassword').value,
            status: document.getElementById('panelStatus').value
        };

        if (!data.name || !data.url || !data.admin_username || !data.admin_password) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updatePanel(this.currentEditingId, data);
            } else {
                await API.admin.createPanel(data);
            }

            this.closeModal();
            this.load();
            alert('Painel salvo com sucesso!');
        } catch (error) {
            alert('Erro ao salvar painel');
        }
    },

    // Excluir painel
    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este painel?')) return;

        try {
            await API.admin.deletePanel(id);
            this.load();
            alert('Painel excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir painel');
        }
    },

    // Fechar modal
    closeModal() {
        const modal = document.getElementById('panelModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminPanels = AdminPanels;
