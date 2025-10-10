// js/admin/painelfoda-resellers.js
const PainelFodaResellers = {
    resellers: [],
    panels: [],

    async load() {
        try {
            [this.resellers, this.panels] = await Promise.all([
                API.admin.getPainelFodaResellers(),
                API.admin.getPainelFodaPanels()
            ]);
            this.render();
        } catch (error) {
            Utils.showError('Erro ao carregar revendedores PainelFoda');
        }
    },

    render() {
        const container = document.getElementById('painelFodaResellersContent');
        
        if (this.panels.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>⚠️ Você precisa cadastrar um painel PainelFoda primeiro!</p>
                    <button onclick="AdminNav.switchTab('painelfoda-panels')" class="btn-primary">
                        Ir para Painéis PainelFoda
                    </button>
                </div>
            `;
            return;
        }

        if (this.resellers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>🟡 Nenhum revendedor PainelFoda cadastrado</p>
                    <button onclick="PainelFodaResellers.showCreateForm()" class="btn-primary">
                        Adicionar Primeiro Revendedor
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <button onclick="PainelFodaResellers.showCreateForm()" class="btn-primary" style="margin-bottom: 20px;">
                ➕ Novo Revendedor PainelFoda
            </button>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>ID do Usuário</th>
                        <th>Painel</th>
                        <th>URL do Painel</th>
                        <th>Status</th>
                        <th>Criado em</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.resellers.map(reseller => `
                        <tr>
                            <td>${reseller.id}</td>
                            <td><strong>${reseller.username}</strong></td>
                            <td><code>${reseller.painelfoda_user_id}</code></td>
                            <td>${reseller.panel_name}</td>
                            <td><a href="${reseller.panel_url}" target="_blank">${reseller.panel_url}</a></td>
                            <td>
                                <span class="badge ${reseller.status === 'active' ? 'badge-success' : 'badge-danger'}">
                                    ${reseller.status === 'active' ? '✅ Ativo' : '❌ Inativo'}
                                </span>
                            </td>
                            <td>${Utils.formatDate(reseller.created_at)}</td>
                            <td>
                                <button onclick="PainelFodaResellers.showEditForm(${reseller.id})" class="btn-small">
                                    ✏️ Editar
                                </button>
                                <button onclick="AdminNav.switchTab('packages'); AdminPackages.loadForReseller(${reseller.id}, 'painelfoda')" class="btn-small btn-success">
                                    💰 Pacotes
                                </button>
                                <button onclick="PainelFodaResellers.delete(${reseller.id})" class="btn-small btn-danger">
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
            <div class="modal-backdrop" onclick="PainelFodaResellers.closeModal()"></div>
            <div class="modal">
                <h2>➕ Novo Revendedor PainelFoda</h2>
                <form id="painelFodaResellerForm" onsubmit="PainelFodaResellers.create(event)">
                    <div class="form-group">
                        <label>Painel *</label>
                        <select name="panel_id" required>
                            <option value="">Selecione o painel</option>
                            ${this.panels.filter(p => p.status === 'active').map(panel => `
                                <option value="${panel.id}">${panel.name} (${panel.url})</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Username do Revendedor *</label>
                        <input type="text" name="username" placeholder="Ex: isaac123" required>
                        <small>Username usado para login no sistema de recarga</small>
                    </div>
                    <div class="form-group">
                        <label>ID do Usuário no Painel *</label>
                        <input type="text" name="painelfoda_user_id" placeholder="Ex: 167517" required>
                        <small>ID numérico usado na API para adicionar créditos</small>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn-primary">💾 Salvar</button>
                        <button type="button" onclick="PainelFodaResellers.closeModal()" class="btn-secondary">
                            ❌ Cancelar
                        </button>
                    </div>
                </form>
            </div>
        `;
        modal.style.display = 'flex';
    },

    showEditForm(id) {
        const reseller = this.resellers.find(r => r.id === id);
        if (!reseller) return;

        const modal = document.getElementById('modalContainer');
        modal.innerHTML = `
            <div class="modal-backdrop" onclick="PainelFodaResellers.closeModal()"></div>
            <div class="modal">
                <h2>✏️ Editar Revendedor PainelFoda</h2>
                <form id="painelFodaResellerForm" onsubmit="PainelFodaResellers.update(event, ${id})">
                    <div class="form-group">
                        <label>Painel *</label>
                        <select name="panel_id" required>
                            ${this.panels.map(panel => `
                                <option value="${panel.id}" ${panel.id === reseller.panel_id ? 'selected' : ''}>
                                    ${panel.name} (${panel.url})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Username do Revendedor *</label>
                        <input type="text" name="username" value="${reseller.username}" required>
                    </div>
                    <div class="form-group">
                        <label>ID do Usuário no Painel *</label>
                        <input type="text" name="painelfoda_user_id" value="${reseller.painelfoda_user_id}" required>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                            <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                        </select>
                    </div>
                    <div class="modal-actions">
                        <button type="submit" class="btn-primary">💾 Atualizar</button>
                        <button type="button" onclick="PainelFodaResellers.closeModal()" class="btn-secondary">
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
            await API.admin.createPainelFodaReseller(data);
            Utils.showSuccess('Revendedor criado com sucesso!');
            this.closeModal();
            await this.load();
        } catch (error) {
            Utils.showError('Erro ao criar revendedor');
        }
    },

    async update(event, id) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData);

        try {
            await API.admin.updatePainelFodaReseller(id, data);
            Utils.showSuccess('Revendedor atualizado com sucesso!');
            this.closeModal();
            await this.load();
        } catch (error) {
            Utils.showError('Erro ao atualizar revendedor');
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja deletar este revendedor?')) {
            return;
        }

        try {
            await API.admin.deletePainelFodaReseller(id);
            Utils.showSuccess('Revendedor deletado com sucesso!');
            await this.load();
        } catch (error) {
            Utils.showError('Erro ao deletar revendedor');
        }
    },

    closeModal() {
        const modal = document.getElementById('modalContainer');
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
};

window.PainelFodaResellers = PainelFodaResellers;
