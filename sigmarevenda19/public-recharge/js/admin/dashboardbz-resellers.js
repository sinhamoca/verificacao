// public-recharge/js/admin/dashboardbz-resellers.js
// Gerenciamento de Revendedores DashboardBz - CORRIGIDO

const AdminDashboardBzResellers = {
    currentEditingId: null,
    panels: [],

    async load() {
        try {
            this.panels = await API.admin.getDashboardBzPanels();
            const resellers = await API.admin.getDashboardBzResellers();
            this.renderTable(resellers);
        } catch (error) {
            console.error('Erro ao carregar revendedores DashboardBz:', error);
            alert('Erro ao carregar revendedores: ' + error.message);
        }
    },

    renderTable(resellers) {
        const tbody = document.getElementById('dashboardbzResellersTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Nenhum revendedor cadastrado</td></tr>';
            return;
        }

        resellers.forEach(reseller => {
            const statusBadge = reseller.status === 'active' 
                ? '<span class="badge badge-success">Ativo</span>' 
                : '<span class="badge badge-danger">Inativo</span>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${reseller.username}</strong></td>
                <td><code>${reseller.dashboardbz_search_term || 'N/A'}</code></td>
                <td>${reseller.panel_name || 'N/A'}</td>
                <td>
                    <button class="btn-success" onclick="AdminDashboardBzPackages.openModal(${reseller.id}, '${reseller.username}')">
                        Ver Pacotes
                    </button>
                </td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminDashboardBzResellers.edit(${reseller.id})">
                        Editar
                    </button>
                    <button class="btn-danger" onclick="AdminDashboardBzResellers.delete(${reseller.id})">
                        Excluir
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    openModal() {
        this.currentEditingId = null;

        const panelOptions = this.panels
            .filter(p => p.status === 'active')
            .map(p => `<option value="${p.id}">${p.name}</option>`)
            .join('');

        if (!panelOptions) {
            alert('❌ Nenhum painel DashboardBz ativo encontrado!\n\n📝 Crie um painel primeiro na aba "Painéis DashboardBz".');
            return;
        }

        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Revendedor DashboardBz</h2>
                <div class="close-modal" onclick="AdminDashboardBzResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="dashboardbzResellerUsername" placeholder="usuario123">
                <small>Nome de usuário único para login do cliente</small>
            </div>
            <div class="form-group">
                <label>Termo de Busca no DashboardBz</label>
                <input type="text" id="dashboardbzResellerSearchTerm" placeholder="Nome do usuário no painel">
                <small>Nome/termo para localizar o usuário no painel DashboardBz</small>
            </div>
            <div class="form-group">
                <label>Painel Vinculado</label>
                <select id="dashboardbzResellerPanel">
                    <option value="">Selecione um painel...</option>
                    ${panelOptions}
                </select>
                <small>Painel onde os créditos serão adicionados</small>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="dashboardbzResellerStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminDashboardBzResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('dashboardbzResellerModal', 'Adicionar Revendedor DashboardBz', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        const resellers = await API.admin.getDashboardBzResellers();
        const reseller = resellers.find(r => r.id === id);
        
        if (!reseller) return;

        this.currentEditingId = id;

        const panelOptions = this.panels
            .filter(p => p.status === 'active')
            .map(p => `<option value="${p.id}" ${reseller.panel_id === p.id ? 'selected' : ''}>${p.name}</option>`)
            .join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Editar Revendedor DashboardBz</h2>
                <div class="close-modal" onclick="AdminDashboardBzResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="dashboardbzResellerUsername" value="${reseller.username}">
                <small>Nome de usuário único para login do cliente</small>
            </div>
            <div class="form-group">
                <label>Termo de Busca no DashboardBz</label>
                <input type="text" id="dashboardbzResellerSearchTerm" value="${reseller.dashboardbz_search_term}">
                <small>Nome/termo para localizar o usuário no painel DashboardBz</small>
            </div>
            <div class="form-group">
                <label>Painel Vinculado</label>
                <select id="dashboardbzResellerPanel">
                    <option value="">Selecione um painel...</option>
                    ${panelOptions}
                </select>
                <small>Painel onde os créditos serão adicionados</small>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="dashboardbzResellerStatus">
                    <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                    <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                </select>
            </div>
            <button onclick="AdminDashboardBzResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('dashboardbzResellerModal', 'Editar Revendedor DashboardBz', modalHtml);
        modal.classList.add('show');
    },

    closeModal() {
        const modal = document.getElementById('dashboardbzResellerModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentEditingId = null;
    },

    async save() {
        const username = document.getElementById('dashboardbzResellerUsername').value.trim();
        const dashboardbz_search_term = document.getElementById('dashboardbzResellerSearchTerm').value.trim();
        const panel_id = parseInt(document.getElementById('dashboardbzResellerPanel').value);
        const status = document.getElementById('dashboardbzResellerStatus').value;

        if (!username || !dashboardbz_search_term || !panel_id) {
            alert('Preencha todos os campos obrigatórios!');
            return;
        }

        try {
            const data = { username, dashboardbz_search_term, panel_id, status };

            if (this.currentEditingId) {
                await API.admin.updateDashboardBzReseller(this.currentEditingId, data);
                alert('Revendedor atualizado com sucesso!');
            } else {
                await API.admin.createDashboardBzReseller(data);
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
            await API.admin.deleteDashboardBzReseller(id);
            alert('Revendedor excluído com sucesso!');
            this.load();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir: ' + error.message);
        }
    }
};

window.AdminDashboardBzResellers = AdminDashboardBzResellers;
