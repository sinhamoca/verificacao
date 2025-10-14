// js/admin/p2bras-panels.js
// Gerenciamento de painéis P2BRAS (Controle.VIP)

const AdminP2brasPanels = {
    currentEditingId: null,

    async load() {
        try {
            const panels = await API.admin.getP2brasPanels();
            this.render(panels);
        } catch (error) {
            console.error('Erro ao carregar painéis P2BRAS:', error);
        }
    },

    render(panels) {
        const tbody = document.getElementById('p2brasPanelsTableBody');
        tbody.innerHTML = '';

        if (panels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum painel P2BRAS cadastrado</td></tr>';
            return;
        }

        panels.forEach(panel => {
            const statusBadge = Components.createStatusBadge(panel.status);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${panel.name}</td>
                <td><a href="${panel.url}" target="_blank">${panel.url}</a></td>
                <td>${panel.admin_username}</td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminP2brasPanels.edit(${panel.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminP2brasPanels.delete(${panel.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    openModal() {
        this.currentEditingId = null;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Painel P2BRAS</h2>
                <div class="close-modal" onclick="AdminP2brasPanels.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Nome do Painel</label>
                <input type="text" id="p2brasPanelName" placeholder="Ex: Controle VIP Principal">
            </div>
            <div class="form-group">
                <label>URL do Painel</label>
                <input type="url" id="p2brasPanelUrl" placeholder="https://api.braz.vip">
                <small style="color: #888;">URL da API do Controle.VIP</small>
            </div>
            <div class="form-group">
                <label>Username Admin</label>
                <input type="text" id="p2brasPanelUsername" placeholder="seu_usuario">
            </div>
            <div class="form-group">
                <label>Password Admin</label>
                <input type="password" id="p2brasPanelPassword" placeholder="sua_senha">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="p2brasPanelStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminP2brasPanels.save()">Salvar</button>
        `;

        const modal = Components.createModal('p2brasPanelModal', 'Adicionar Painel P2BRAS', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const panels = await API.admin.getP2brasPanels();
            const panel = panels.find(p => p.id === id);

            const modalHtml = `
                <div class="modal-header">
                    <h2>Editar Painel P2BRAS</h2>
                    <div class="close-modal" onclick="AdminP2brasPanels.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Nome do Painel</label>
                    <input type="text" id="p2brasPanelName" value="${panel.name}">
                </div>
                <div class="form-group">
                    <label>URL do Painel</label>
                    <input type="url" id="p2brasPanelUrl" value="${panel.url}">
                    <small style="color: #888;">URL da API do Controle.VIP</small>
                </div>
                <div class="form-group">
                    <label>Username Admin</label>
                    <input type="text" id="p2brasPanelUsername" value="${panel.admin_username}">
                </div>
                <div class="form-group">
                    <label>Password Admin</label>
                    <input type="password" id="p2brasPanelPassword" value="${panel.admin_password}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="p2brasPanelStatus">
                        <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminP2brasPanels.save()">Salvar</button>
            `;

            const modal = Components.createModal('p2brasPanelModal', 'Editar Painel P2BRAS', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar dados do painel');
        }
    },

    async save() {
        const data = {
            name: document.getElementById('p2brasPanelName').value.trim(),
            url: document.getElementById('p2brasPanelUrl').value.trim(),
            admin_username: document.getElementById('p2brasPanelUsername').value.trim(),
            admin_password: document.getElementById('p2brasPanelPassword').value.trim(),
            status: document.getElementById('p2brasPanelStatus').value
        };

        if (!data.name || !data.url || !data.admin_username || !data.admin_password) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateP2brasPanel(this.currentEditingId, data);
                alert('Painel P2BRAS atualizado com sucesso!');
            } else {
                await API.admin.createP2brasPanel(data);
                alert('Painel P2BRAS criado com sucesso!');
            }

            this.closeModal();
            this.load();
        } catch (error) {
            alert('Erro ao salvar painel: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este painel P2BRAS?\n\nTodos os revendedores vinculados também serão excluídos.')) {
            return;
        }

        try {
            await API.admin.deleteP2brasPanel(id);
            alert('Painel P2BRAS excluído com sucesso!');
            this.load();
        } catch (error) {
            alert('Erro ao excluir painel: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('p2brasPanelModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
};

window.AdminP2brasPanels = AdminP2brasPanels;
