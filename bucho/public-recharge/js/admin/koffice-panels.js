// js/admin/koffice-panels.js
// Gerenciamento de painéis Koffice

const AdminKofficePanels = {
    currentEditingId: null,

    async load() {
        try {
            const panels = await API.admin.getKofficePanels();
            this.render(panels);
        } catch (error) {
            console.error('Erro ao carregar painéis Koffice:', error);
        }
    },

    render(panels) {
        const tbody = document.getElementById('kofficePanelsTableBody');
        tbody.innerHTML = '';

        if (panels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">Nenhum painel Koffice cadastrado</td></tr>';
            return;
        }

        panels.forEach(panel => {
            const statusBadge = Components.createStatusBadge(panel.status);
            const captchaBadge = panel.has_captcha ? 
                '<span class="badge badge-warning">✓ Com Captcha</span>' : 
                '<span class="badge" style="background: #e0e0e0; color: #666;">Sem Captcha</span>';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${panel.name}</td>
                <td>${panel.url}</td>
                <td>${panel.admin_username}</td>
                <td>${captchaBadge}</td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminKofficePanels.edit(${panel.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminKofficePanels.delete(${panel.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    openModal() {
        this.currentEditingId = null;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Painel Koffice</h2>
                <div class="close-modal" onclick="AdminKofficePanels.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Nome do Painel</label>
                <input type="text" id="kofficePanelName" placeholder="Ex: Acticon">
            </div>
            <div class="form-group">
                <label>URL</label>
                <input type="text" id="kofficePanelUrl" placeholder="https://painel.acticon.top">
            </div>
            <div class="form-group">
                <label>Usuário Admin</label>
                <input type="text" id="kofficePanelUsername" placeholder="usuario_admin">
            </div>
            <div class="form-group">
                <label>Senha Admin</label>
                <input type="password" id="kofficePanelPassword" placeholder="senha_admin">
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="kofficePanelCaptcha">
                    Este painel tem Captcha (hCaptcha)
                </label>
                <small style="color: #888; display: block; margin-top: 5px;">
                    Marque se o painel exige captcha no login. Configure o Anti-Captcha API Key nas configurações.
                </small>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="kofficePanelStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminKofficePanels.save()">Salvar</button>
        `;

        const modal = Components.createModal('kofficePanelModal', 'Adicionar Painel Koffice', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const panels = await API.admin.getKofficePanels();
            const panel = panels.find(p => p.id === id);

            const modalHtml = `
                <div class="modal-header">
                    <h2>Editar Painel Koffice</h2>
                    <div class="close-modal" onclick="AdminKofficePanels.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Nome do Painel</label>
                    <input type="text" id="kofficePanelName" value="${panel.name}">
                </div>
                <div class="form-group">
                    <label>URL</label>
                    <input type="text" id="kofficePanelUrl" value="${panel.url}">
                </div>
                <div class="form-group">
                    <label>Usuário Admin</label>
                    <input type="text" id="kofficePanelUsername" value="${panel.admin_username}">
                </div>
                <div class="form-group">
                    <label>Senha Admin</label>
                    <input type="password" id="kofficePanelPassword" value="${panel.admin_password}">
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="kofficePanelCaptcha" ${panel.has_captcha ? 'checked' : ''}>
                        Este painel tem Captcha (hCaptcha)
                    </label>
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Marque se o painel exige captcha no login. Configure o Anti-Captcha API Key nas configurações.
                    </small>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="kofficePanelStatus">
                        <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminKofficePanels.save()">Salvar</button>
            `;

            const modal = Components.createModal('kofficePanelModal', 'Editar Painel Koffice', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar painel');
        }
    },

    async save() {
        const data = {
            name: document.getElementById('kofficePanelName').value,
            url: document.getElementById('kofficePanelUrl').value,
            admin_username: document.getElementById('kofficePanelUsername').value,
            admin_password: document.getElementById('kofficePanelPassword').value,
            has_captcha: document.getElementById('kofficePanelCaptcha').checked,
            status: document.getElementById('kofficePanelStatus').value
        };

        if (!data.name || !data.url || !data.admin_username || !data.admin_password) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateKofficePanel(this.currentEditingId, data);
            } else {
                await API.admin.createKofficePanel(data);
            }

            this.closeModal();
            this.load();
            alert('Painel Koffice salvo com sucesso!');
        } catch (error) {
            alert('Erro ao salvar painel');
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este painel Koffice?')) return;

        try {
            await API.admin.deleteKofficePanel(id);
            this.load();
            alert('Painel Koffice excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir painel');
        }
    },

    closeModal() {
        const modal = document.getElementById('kofficePanelModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminKofficePanels = AdminKofficePanels;
