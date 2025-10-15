// public-recharge/js/admin/painelfoda-resellers.js
// Gerenciamento de Revendedores PainelFoda - CORRIGIDO PARA USAR POP-UP

const AdminPainelFodaResellers = {
    currentReseller: null,
    panels: [],

    async load() {
        try {
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
                    <button class="btn-success" onclick="AdminPainelFodaPackages.manage(${reseller.id}, '${reseller.username}')">
                        Ver Pacotes
                    </button>
                </td>
                <td>
                    <span class="badge badge-${reseller.status === 'active' ? 'success' : 'danger'}">
                        ${reseller.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="actions">
                    <button onclick="AdminPainelFodaResellers.edit(${reseller.id})">
                        Editar
                    </button>
                    <button class="btn-danger" onclick="AdminPainelFodaResellers.delete(${reseller.id})">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openModal() {
        this.currentReseller = null;

        const panelOptions = this.panels
            .filter(p => p.status === 'active')
            .map(p => `<option value="${p.id}">${p.name}</option>`)
            .join('');

        if (!panelOptions) {
            alert('❌ Nenhum painel PainelFoda ativo encontrado!\n\n📝 Crie um painel primeiro na aba "Painéis PainelFoda".');
            return;
        }

        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Revendedor PainelFoda</h2>
                <div class="close-modal" onclick="AdminPainelFodaResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="painelfodaResellerUsername" placeholder="usuario123">
                <small>Nome de usuário único para login do cliente</small>
            </div>
            <div class="form-group">
                <label>ID do Usuário no PainelFoda</label>
                <input type="text" id="painelfodaResellerUserId" placeholder="12345">
                <small>ID numérico do usuário no painel PainelFoda</small>
            </div>
            <div class="form-group">
                <label>Painel Vinculado</label>
                <select id="painelfodaResellerPanel">
                    <option value="">Selecione um painel...</option>
                    ${panelOptions}
                </select>
                <small>Painel onde os créditos serão adicionados</small>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="painelfodaResellerStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminPainelFodaResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('painelfodaResellerModal', 'Adicionar Revendedor PainelFoda', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        const resellers = await API.admin.getPainelFodaResellers();
        const reseller = resellers.find(r => r.id === id);
        
        if (!reseller) return;

        this.currentReseller = reseller;

        const panelOptions = this.panels
            .filter(p => p.status === 'active')
            .map(p => `<option value="${p.id}" ${reseller.panel_id === p.id ? 'selected' : ''}>${p.name}</option>`)
            .join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Editar Revendedor PainelFoda</h2>
                <div class="close-modal" onclick="AdminPainelFodaResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="painelfodaResellerUsername" value="${reseller.username}">
                <small>Nome de usuário único para login do cliente</small>
            </div>
            <div class="form-group">
                <label>ID do Usuário no PainelFoda</label>
                <input type="text" id="painelfodaResellerUserId" value="${reseller.painelfoda_user_id}">
                <small>ID numérico do usuário no painel PainelFoda</small>
            </div>
            <div class="form-group">
                <label>Painel Vinculado</label>
                <select id="painelfodaResellerPanel">
                    <option value="">Selecione um painel...</option>
                    ${panelOptions}
                </select>
                <small>Painel onde os créditos serão adicionados</small>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="painelfodaResellerStatus">
                    <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                    <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                </select>
            </div>
            <button onclick="AdminPainelFodaResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('painelfodaResellerModal', 'Editar Revendedor PainelFoda', modalHtml);
        modal.classList.add('show');
    },

    closeModal() {
        const modal = document.getElementById('painelfodaResellerModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentReseller = null;
    },

    async save() {
        const username = document.getElementById('painelfodaResellerUsername').value.trim();
        const painelfoda_user_id = document.getElementById('painelfodaResellerUserId').value.trim();
        const panel_id = parseInt(document.getElementById('painelfodaResellerPanel').value);
        const status = document.getElementById('painelfodaResellerStatus').value;

        if (!username || !painelfoda_user_id || !panel_id) {
            alert('Preencha todos os campos obrigatórios!');
            return;
        }

        try {
            const data = { username, painelfoda_user_id, panel_id, status };

            if (this.currentReseller) {
                await API.admin.updatePainelFodaReseller(this.currentReseller.id, data);
                alert('Revendedor atualizado com sucesso!');
            } else {
                await API.admin.createPainelFodaReseller(data);
                alert('Revendedor criado com sucesso!');
            }

            this.closeModal();
            this.load();
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este revendedor?')) {
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

window.AdminPainelFodaResellers = AdminPainelFodaResellers;
