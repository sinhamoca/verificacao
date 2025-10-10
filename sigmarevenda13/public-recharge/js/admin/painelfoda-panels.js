// js/admin/painelfoda-panels.js
const PainelFodaPanels = {
    panels: [],

    async load() {
        try {
            this.panels = await API.admin.getPainelFodaPanels();
            this.render();
        } catch (error) {
            Utils.showError('Erro ao carregar painéis PainelFoda');
        }
    },

    render() {
        const container = document.getElementById('painelFodaPanelsContent');
        
        if (this.panels.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>🟡 Nenhum painel PainelFoda cadastrado</p>
                    <button onclick="PainelFodaPanels.showCreateForm()" class="btn-primary">
                        Adicionar Primeiro Painel
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <button onclick="PainelFodaPanels.showCreateForm()" class="btn-primary" style="margin-bottom: 20px;">
                ➕ Novo Painel PainelFoda
            </button>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nome</th>
                        <th>URL</th>
                        <th>Admin Username</th>
                        <th>Status</th>
                        <th>Criado em</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.panels.map(panel => `
                        <tr>
                            <td>${panel.id}</td>
                            <td><strong>${panel.name}</strong></td>
                            <td><a href="${panel.url}" target="_blank">${panel.url}</a></td>
                            <td>${panel.admin_username}</td>
                            <td>
                                <span class="badge ${panel.status === 'active' ? 'badge-success' : 'badge-danger'}">
                                    ${panel.status === 'active' ? '✅ Ativo' : '❌ Inativo'}
                                </span>
                            </td>
                            <td>${Utils.formatDate(panel.created_at)}</td>
                            <td>
                                <button onclick="PainelFodaPanels.showEditForm(${panel.id})" class="btn-small">
                                    ✏️ Editar
                                </button>
                                <button onclick="PainelFodaPanels.delete(${panel.id})" class="btn-small btn-danger">
                                    🗑️ Deletar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    showCreateForm() {
        const modal = document.getElementById('modalContainer');
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="PainelFodaPanels.closeModal()"></div>
            <div class="modal">
                <h2>➕ Novo Painel PainelFoda</h2>
                <form id="painelFodaPanelForm" onsubmit="PainelFodaPanels.create(event)">
                    <div class="form-group">
                        <label>Nome do Painel *</label>
                        <input type="text" name="name" placeholder="Ex: MGTV, P2Like" required>
                    </div>
                    <div class="form-group">
                        <label>URL do Painel *</label>
                        <input type="url" name="url" placeholder="https://mgtv.officeacess.live" required>
                        <small>URL completa do painel (com https://)</small>
                    </div>
                    <div class="form-group">
                        <label>Admin Username *</label>
                        <input type="text" name="admin_username" placeholder="Usuário admin do painel" required>
                    </div>
                    <div class="form-group">
                        <label>Admin Password *</label>
                        <input type="password" name="admin_password" placeholder="Senha admin do painel" required>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn-primary">💾 Salvar</button>
                        <button type="button" onclick="PainelFodaPanels.closeModal()" class="btn-secondary">
                            ❌ Cancelar
                        </button>
                    </div>
                </form>
            </div>
        `;
        modal.style.display = 'flex';
    },

    showEditForm(id) {
        const panel = this.panels.find(p => p.id === id);
        if (!panel) return;

        const modal = document.getElementById('modalContainer');
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="PainelFodaPanels.closeModal()"></div>
            <div class="modal">
                <h2>✏️ Editar Painel PainelFoda</h2>
                <form id="painelFodaPanelForm" onsubmit="PainelFodaPanels.update(event, ${id})">
                    <div class="form-group">
                        <label>Nome do Painel *</label>
                        <input type="text" name="name" value="${panel.name}" required>
                    </div>
                    <div class="form-group">
                        <label>URL do Painel *</label>
                        <input type="url" name="url" value="${panel.url}" required>
                    </div>
                    <div class="form-group">
                        <label>Admin Username *</label>
                        <input type="text" name="admin_username" value="${panel.admin_username}" required>
                    </div>
                    <div class="form-group">
                        <label>Admin Password *</label>
                        <input type="password" name="admin_password" value="${panel.admin_password}" required>
                        <small>Deixe em branco para manter a senha atual</small>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="active" ${panel.status === 'active' ? 'selected' : ''}>Ativo</option>
                            <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn-primary">💾 Atualizar</button>
                        <button type="button" onclick="PainelFodaPanels.closeModal()" class="btn-secondary">
                            ❌ Cancelar
                        </button>
                    </div>
                </form>
            </div>
        `;
        modal.style.display = 'flex';
    },

    async create(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);

        try {
            await API.admin.createPainelFodaPanel(data);
            Utils.showSuccess('Painel criado com sucesso!');
            this.closeModal();
            await this.load();
        } catch (error) {
            Utils.showError('Erro ao criar painel');
        }
    },

    async update(event, id) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);

        try {
            await API.admin.updatePainelFodaPanel(id, data);
            Utils.showSuccess('Painel atualizado com sucesso!');
            this.closeModal();
            await this.load();
        } catch (error) {
            Utils.showError('Erro ao atualizar painel');
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja deletar este painel?\n\nIsso também deletará todos os revendedores associados!')) {
            return;
        }

        try {
            await API.admin.deletePainelFodaPanel(id);
            Utils.showSuccess('Painel deletado com sucesso!');
            await this.load();
        } catch (error) {
            Utils.showError('Erro ao deletar painel');
        }
    },

    closeModal() {
        const modal = document.getElementById('modalContainer');
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
};

window.PainelFodaPanels = PainelFodaPanels;
