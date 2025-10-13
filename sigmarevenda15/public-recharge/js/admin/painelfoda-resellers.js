// public-recharge/js/admin/painelfoda-resellers.js
// Gerenciamento de Revendedores PainelFoda

const AdminPainelFodaResellers = {
    currentReseller: null,
    panels: [],

    async load() {
        try {
            // Carregar painéis e revendedores
            this.panels = await API.admin.getPainelFodaPanels();
            const resellers = await API.admin.getPainelFodaResellers();
            this.renderTable(resellers);
        } catch (error) {
            console.error('Erro ao carregar revendedores PainelFoda:', error);
            alert('Erro ao carregar revendedores: ' + error.message);
        }
    },

    renderTable(resellers) {
        const tbody = document.getElementById('painelfodaResellersTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Nenhum revendedor cadastrado</td></tr>';
            return;
        }

        resellers.forEach(reseller => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${reseller.username}</strong></td>
                <td><code>${reseller.painelfoda_user_id || 'N/A'}</code></td>
                <td>${reseller.panel_name || 'N/A'}</td>
                <td>
                    <button class="btn-small" onclick="AdminPainelFodaPackages.manage(${reseller.id}, '${reseller.username}')">
                        Gerenciar Pacotes
                    </button>
                </td>
                <td>
                    <span class="badge badge-${reseller.status === 'active' ? 'success' : 'danger'}">
                        ${reseller.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn-small btn-primary" onclick="AdminPainelFodaResellers.openModal(${JSON.stringify(reseller).replace(/"/g, '&quot;')})">
                        Editar
                    </button>
                    <button class="btn-small btn-danger" onclick="AdminPainelFodaResellers.delete(${reseller.id})">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openModal(reseller = null) {
        this.currentReseller = reseller;

        const panelOptions = this.panels
            .filter(p => p.status === 'active')
            .map(p => `<option value="${p.id}" ${reseller?.panel_id === p.id ? 'selected' : ''}>${p.name}</option>`)
            .join('');

        if (!panelOptions) {
            alert('❌ Nenhum painel PainelFoda ativo encontrado!\n\n📝 Crie um painel primeiro na aba "Painéis PainelFoda".');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="painelfodaResellerModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${reseller ? '✏️ Editar' : '➕ Adicionar'} Revendedor PainelFoda</h3>
                        <button class="modal-close" onclick="AdminPainelFodaResellers.closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Username *</label>
                            <input type="text" id="painelfodaResellerUsername" value="${reseller?.username || ''}" placeholder="usuario123">
                            <small>Nome de usuário único para login do cliente</small>
                        </div>
                        <div class="form-group">
                            <label>ID do Usuário no PainelFoda *</label>
                            <input type="text" id="painelfodaResellerUserId" value="${reseller?.painelfoda_user_id || ''}" placeholder="12345">
                            <small>ID numérico do usuário no painel PainelFoda</small>
                        </div>
                        <div class="form-group">
                            <label>Painel Vinculado *</label>
                            <select id="painelfodaResellerPanel">
                                <option value="">Selecione um painel...</option>
                                ${panelOptions}
                            </select>
                            <small>Painel onde os créditos serão adicionados</small>
                        </div>
                        ${reseller ? `
                        <div class="form-group">
                            <label>Status</label>
                            <select id="painelfodaResellerStatus">
                                <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                                <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                            </select>
                        </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="AdminPainelFodaResellers.closeModal()">Cancelar</button>
                        <button class="btn-success" onclick="AdminPainelFodaResellers.save()">
                            ${reseller ? '💾 Salvar Alterações' : '✅ Criar Revendedor'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    closeModal() {
        const modal = document.getElementById('painelfodaResellerModal');
        if (modal) modal.remove();
        this.currentReseller = null;
    },

    async save() {
        const username = document.getElementById('painelfodaResellerUsername').value.trim();
        const painelfoda_user_id = document.getElementById('painelfodaResellerUserId').value.trim();
        const panel_id = document.getElementById('painelfodaResellerPanel').value;
        const status = document.getElementById('painelfodaResellerStatus')?.value || 'active';

        if (!username || !painelfoda_user_id || !panel_id) {
            alert('Preencha todos os campos obrigatórios!');
            return;
        }

        try {
            const data = {
                username,
                painelfoda_user_id,
                panel_id: parseInt(panel_id),
                status
            };

            if (this.currentReseller) {
                await API.admin.updatePainelFodaReseller(this.currentReseller.id, data);
                alert('Revendedor atualizado com sucesso!');
            } else {
                await API.admin.createPainelFodaReseller(data);
                alert('Revendedor criado com sucesso!\n\nAgora configure os pacotes de créditos na lista.');
            }

            this.closeModal();
            this.load();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este revendedor?\n\nTodos os pacotes e histórico também serão excluídos!')) {
            return;
        }

        try {
            await API.admin.deletePainelFodaReseller(id);
            alert('Revendedor excluído com sucesso!');
            this.load();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir: ' + error.message);
        }
    }
};

// Auto-load quando a aba for ativada
window.AdminPainelFodaResellers = AdminPainelFodaResellers;
