// js/admin/painelfoda.js
// Gerenciamento de Painéis e Revendedores PainelFoda

const PainelFodaAdmin = {
    // =========================================
    // PAINÉIS PAINELFODA
    // =========================================
    
    async loadPanels() {
        try {
            const panels = await API.admin.getPainelFodaPanels();
            this.renderPanelsList(panels);
        } catch (error) {
            Utils.showError('Erro ao carregar painéis: ' + error.message);
        }
    },

    renderPanelsList(panels) {
        const container = document.getElementById('painelfodaPanelsList');
        
        if (panels.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum painel cadastrado</p>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>URL</th>
                        <th>Usuário Admin</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${panels.map(panel => `
                        <tr>
                            <td><strong>${panel.name}</strong></td>
                            <td><a href="${panel.url}" target="_blank">${panel.url}</a></td>
                            <td>${panel.admin_username}</td>
                            <td>
                                <span class="status-badge ${panel.status === 'active' ? 'status-active' : 'status-inactive'}">
                                    ${panel.status === 'active' ? '✅ Ativo' : '❌ Inativo'}
                                </span>
                            </td>
                            <td>
                                <button onclick="PainelFodaAdmin.editPanel(${panel.id})" class="btn-edit">✏️ Editar</button>
                                <button onclick="PainelFodaAdmin.deletePanel(${panel.id})" class="btn-delete">🗑️ Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
    },

    showPanelForm(panel = null) {
        const isEdit = panel !== null;
        const title = isEdit ? 'Editar Painel PainelFoda' : 'Novo Painel PainelFoda';
        
        const html = `
            <div class="modal-overlay" id="painelModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button onclick="PainelFodaAdmin.closeModal()" class="btn-close">✕</button>
                    </div>
                    <form id="painelForm" class="form">
                        <div class="form-group">
                            <label>Nome do Painel *</label>
                            <input type="text" id="panelName" value="${panel?.name || ''}" 
                                   placeholder="Ex: MGTV, P2Like" required>
                        </div>
                        
                        <div class="form-group">
                            <label>URL do Painel *</label>
                            <input type="url" id="panelUrl" value="${panel?.url || ''}" 
                                   placeholder="https://mgtv.officeacess.live" required>
                            <small>URL completa do painel (com https://)</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Usuário Admin *</label>
                            <input type="text" id="panelUsername" value="${panel?.admin_username || ''}" 
                                   placeholder="admin" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Senha Admin *</label>
                            <input type="password" id="panelPassword" value="${panel?.admin_password || ''}" 
                                   placeholder="••••••••" ${isEdit ? '' : 'required'}>
                            ${isEdit ? '<small>Deixe em branco para manter a senha atual</small>' : ''}
                        </div>
                        
                        ${isEdit ? `
                        <div class="form-group">
                            <label>Status</label>
                            <select id="panelStatus">
                                <option value="active" ${panel.status === 'active' ? 'selected' : ''}>✅ Ativo</option>
                                <option value="inactive" ${panel.status === 'inactive' ? 'selected' : ''}>❌ Inativo</option>
                            </select>
                        </div>
                        ` : ''}
                        
                        <div class="form-actions">
                            <button type="button" onclick="PainelFodaAdmin.closeModal()" class="btn-secondary">
                                Cancelar
                            </button>
                            <button type="submit" class="btn-primary">
                                ${isEdit ? '💾 Salvar' : '➕ Criar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        document.getElementById('painelForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isEdit) {
                await this.updatePanel(panel.id);
            } else {
                await this.createPanel();
            }
        });
    },

    async createPanel() {
        try {
            const data = {
                name: document.getElementById('panelName').value,
                url: document.getElementById('panelUrl').value,
                admin_username: document.getElementById('panelUsername').value,
                admin_password: document.getElementById('panelPassword').value
            };

            await API.admin.createPainelFodaPanel(data);
            Utils.showSuccess('Painel criado com sucesso!');
            this.closeModal();
            this.loadPanels();
        } catch (error) {
            Utils.showError('Erro ao criar painel: ' + error.message);
        }
    },

    async editPanel(id) {
        try {
            const panels = await API.admin.getPainelFodaPanels();
            const panel = panels.find(p => p.id === id);
            if (panel) {
                this.showPanelForm(panel);
            }
        } catch (error) {
            Utils.showError('Erro ao carregar painel: ' + error.message);
        }
    },

    async updatePanel(id) {
        try {
            const data = {
                name: document.getElementById('panelName').value,
                url: document.getElementById('panelUrl').value,
                admin_username: document.getElementById('panelUsername').value,
                admin_password: document.getElementById('panelPassword').value || undefined,
                status: document.getElementById('panelStatus').value
            };

            await API.admin.updatePainelFodaPanel(id, data);
            Utils.showSuccess('Painel atualizado com sucesso!');
            this.closeModal();
            this.loadPanels();
        } catch (error) {
            Utils.showError('Erro ao atualizar painel: ' + error.message);
        }
    },

    async deletePanel(id) {
        if (!confirm('Tem certeza que deseja excluir este painel?')) return;

        try {
            await API.admin.deletePainelFodaPanel(id);
            Utils.showSuccess('Painel excluído com sucesso!');
            this.loadPanels();
        } catch (error) {
            Utils.showError('Erro ao excluir painel: ' + error.message);
        }
    },

    // =========================================
    // REVENDEDORES PAINELFODA
    // =========================================

    async loadResellers() {
        try {
            const resellers = await API.admin.getPainelFodaResellers();
            this.renderResellersList(resellers);
        } catch (error) {
            Utils.showError('Erro ao carregar revendedores: ' + error.message);
        }
    },

    renderResellersList(resellers) {
        const container = document.getElementById('painelfodaResellersList');
        
        if (resellers.length === 0) {
            container.innerHTML = '<p class="empty-state">Nenhum revendedor cadastrado</p>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>ID do Usuário</th>
                        <th>Painel</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${resellers.map(reseller => `
                        <tr>
                            <td><strong>${reseller.username}</strong></td>
                            <td><code>${reseller.painelfoda_user_id}</code></td>
                            <td>
                                ${reseller.panel_name}<br>
                                <small style="color: #666;">${reseller.panel_url}</small>
                            </td>
                            <td>
                                <span class="status-badge ${reseller.status === 'active' ? 'status-active' : 'status-inactive'}">
                                    ${reseller.status === 'active' ? '✅ Ativo' : '❌ Inativo'}
                                </span>
                            </td>
                            <td>
                                <button onclick="PainelFodaAdmin.viewPackages(${reseller.id}, '${reseller.username}')" class="btn-info">
                                    📦 Pacotes
                                </button>
                                <button onclick="PainelFodaAdmin.editReseller(${reseller.id})" class="btn-edit">
                                    ✏️ Editar
                                </button>
                                <button onclick="PainelFodaAdmin.deleteReseller(${reseller.id})" class="btn-delete">
                                    🗑️ Excluir
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = html;
    },

    async showResellerForm(reseller = null) {
        const isEdit = reseller !== null;
        const title = isEdit ? 'Editar Revendedor PainelFoda' : 'Novo Revendedor PainelFoda';
        
        // Carregar painéis disponíveis
        const panels = await API.admin.getPainelFodaPanels();
        
        const html = `
            <div class="modal-overlay" id="resellerModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button onclick="PainelFodaAdmin.closeModal()" class="btn-close">✕</button>
                    </div>
                    <form id="resellerForm" class="form">
                        <div class="form-group">
                            <label>Painel *</label>
                            <select id="resellerPanelId" required>
                                <option value="">Selecione um painel</option>
                                ${panels.filter(p => p.status === 'active').map(panel => `
                                    <option value="${panel.id}" ${reseller?.panel_id === panel.id ? 'selected' : ''}>
                                        ${panel.name} - ${panel.url}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Username do Revendedor *</label>
                            <input type="text" id="resellerUsername" value="${reseller?.username || ''}" 
                                   placeholder="Ex: isaac123" required>
                            <small>Username usado para login no sistema de recarga</small>
                        </div>
                        
                        <div class="form-group">
                            <label>ID do Usuário no Painel *</label>
                            <input type="text" id="resellerUserId" value="${reseller?.painelfoda_user_id || ''}" 
                                   placeholder="Ex: 167517" required>
                            <small>ID numérico usado na API do painel para adicionar créditos</small>
                        </div>
                        
                        ${isEdit ? `
                        <div class="form-group">
                            <label>Status</label>
                            <select id="resellerStatus">
                                <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>✅ Ativo</option>
                                <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>❌ Inativo</option>
                            </select>
                        </div>
                        ` : ''}
                        
                        <div class="form-actions">
                            <button type="button" onclick="PainelFodaAdmin.closeModal()" class="btn-secondary">
                                Cancelar
                            </button>
                            <button type="submit" class="btn-primary">
                                ${isEdit ? '💾 Salvar' : '➕ Criar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        document.getElementById('resellerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isEdit) {
                await this.updateReseller(reseller.id);
            } else {
                await this.createReseller();
            }
        });
    },

    async createReseller() {
        try {
            const data = {
                panel_id: parseInt(document.getElementById('resellerPanelId').value),
                username: document.getElementById('resellerUsername').value,
                painelfoda_user_id: document.getElementById('resellerUserId').value
            };

            await API.admin.createPainelFodaReseller(data);
            Utils.showSuccess('Revendedor criado com sucesso!');
            this.closeModal();
            this.loadResellers();
        } catch (error) {
            Utils.showError('Erro ao criar revendedor: ' + error.message);
        }
    },

    async editReseller(id) {
        try {
            const resellers = await API.admin.getPainelFodaResellers();
            const reseller = resellers.find(r => r.id === id);
            if (reseller) {
                await this.showResellerForm(reseller);
            }
        } catch (error) {
            Utils.showError('Erro ao carregar revendedor: ' + error.message);
        }
    },

    async updateReseller(id) {
        try {
            const data = {
                panel_id: parseInt(document.getElementById('resellerPanelId').value),
                username: document.getElementById('resellerUsername').value,
                painelfoda_user_id: document.getElementById('resellerUserId').value,
                status: document.getElementById('resellerStatus').value
            };

            await API.admin.updatePainelFodaReseller(id, data);
            Utils.showSuccess('Revendedor atualizado com sucesso!');
            this.closeModal();
            this.loadResellers();
        } catch (error) {
            Utils.showError('Erro ao atualizar revendedor: ' + error.message);
        }
    },

    async deleteReseller(id) {
        if (!confirm('Tem certeza que deseja excluir este revendedor?')) return;

        try {
            await API.admin.deletePainelFodaReseller(id);
            Utils.showSuccess('Revendedor excluído com sucesso!');
            this.loadResellers();
        } catch (error) {
            Utils.showError('Erro ao excluir revendedor: ' + error.message);
        }
    },

    // Gerenciar pacotes (reutiliza função existente)
    viewPackages(resellerId, username) {
        if (window.AdminPackages) {
            window.AdminPackages.showPackageManager(resellerId, 'painelfoda', username);
        } else {
            Utils.showError('Módulo de pacotes não carregado');
        }
    },

    closeModal() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    }
};

// Disponibilizar globalmente
window.PainelFodaAdmin = PainelFodaAdmin;
