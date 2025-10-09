// js/admin/gesoffice-panels.js
// Gerenciamento de painéis GesOffice (UNIPLAY)

const AdminGesOfficePanels = {
    currentEditingId: null,

    async load() {
        try {
            const panels = await API.admin.getGesOfficePanels();
            this.render(panels);
        } catch (error) {
            console.error('Erro ao carregar painéis GesOffice:', error);
        }
    },

    render(panels) {
        const tbody = document.getElementById('gesofficePanelsTableBody');
        tbody.innerHTML = '';

        if (panels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum painel UNIPLAY cadastrado</td></tr>';
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
                    <button onclick="AdminGesOfficePanels.edit(${panel.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminGesOfficePanels.delete(${panel.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    openModal() {
        this.currentEditingId = null;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Painel UNIPLAY</h2>
                <div class="close-modal" onclick="AdminGesOfficePanels.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Nome do Painel</label>
                <input type="text" id="gesofficePanelName" placeholder="Ex: UNIPLAY Principal">
            </div>
            <div class="form-group">
                <label>URL da API</label>
                <input type="text" id="gesofficePanelUrl" placeholder="https://gesapioffice.com">
                <small style="color: #888; display: block; margin-top: 5px;">
                    URL base da API GesOffice (geralmente https://gesapioffice.com)
                </small>
            </div>
            <div class="form-group">
                <label>Usuário Admin</label>
                <input type="text" id="gesofficePanelUsername" placeholder="usuario_admin">
            </div>
            <div class="form-group">
                <label>Senha Admin</label>
                <input type="password" id="gesofficePanelPassword" placeholder="senha_admin">
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="gesofficePanelStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminGesOfficePanels.save()">Salvar</button>
        `;

        const modal = Components.createModal('gesofficePanelModal', 'Adicionar Painel UNIPLAY', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const panels = await API.admin.getGesOfficePanels();
            const panel = panels.find(p => p.id === id);

            const modalHtml = `
                <div class="modal-header">
                    <h2>Editar Painel UNIPLAY</h2>
                    <div class="close-modal" onclick="AdminGesOfficePanels.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Nome do Painel</label>
                    <input type="text" id="gesofficePanelName" value="${panel.name}">
                </div>
                <div class="form-group">
                    <label>URL da API</label>
                    <input type="text" id="gesofficePanelUrl" value="${panel.url}">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        URL base da API GesOffice
                    </small>
                </div>
                <div class="form-group">
                    <label>Usuário Admin</label>
                    <input type="text" id="gesofficePanelUsername" value="${panel.admin_username}">
                </div>
                <div class="form-group">
                    <label>Senha Admin</label>
                    <input type="password" id="gesofficePanelPassword" value="${panel.admin_password}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="gesofficePanelStatus">
                        <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminGesOfficePanels.save()">Salvar</button>
            `;

            const modal = Components.createModal('gesofficePanelModal', 'Editar Painel UNIPLAY', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar painel');
        }
    },

    async save() {
        const data = {
            name: document.getElementById('gesofficePanelName').value,
            url: document.getElementById('gesofficePanelUrl').value,
            admin_username: document.getElementById('gesofficePanelUsername').value,
            admin_password: document.getElementById('gesofficePanelPassword').value,
            status: document.getElementById('gesofficePanelStatus').value
        };

        if (!data.name || !data.url || !data.admin_username || !data.admin_password) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateGesOfficePanel(this.currentEditingId, data);
            } else {
                await API.admin.createGesOfficePanel(data);
            }

            this.closeModal();
            this.load();
            alert('Painel UNIPLAY salvo com sucesso!');
        } catch (error) {
            alert('Erro ao salvar painel');
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este painel UNIPLAY?')) return;

        try {
            await API.admin.deleteGesOfficePanel(id);
            this.load();
            alert('Painel UNIPLAY excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir painel');
        }
    },

    closeModal() {
        const modal = document.getElementById('gesofficePanelModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminGesOfficePanels = AdminGesOfficePanels;
