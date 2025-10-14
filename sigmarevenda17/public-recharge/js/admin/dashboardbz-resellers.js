// public-recharge/js/admin/dashboardbz-resellers.js
// Gerenciamento de Revendedores DashboardBz

const AdminDashboardBzResellers = {
    currentEditingId: null,
    panels: [],

    async load() {
        try {
            // Carregar painéis e revendedores
            this.panels = await API.admin.getDashboardBzPanels();
            const resellers = await API.admin.getDashboardBzResellers();
            this.renderTable(resellers);
            this.attachEventListeners();
        } catch (error) {
            console.error('Erro ao carregar revendedores DashboardBz:', error);
            alert('Erro ao carregar revendedores: ' + error.message);
        }
    },

    attachEventListeners() {
        const addBtn = document.getElementById('addDashboardBzResellerBtn');
        if (addBtn) {
            addBtn.onclick = () => this.openModal();
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
                    <button class="btn-small" onclick="AdminDashboardBzPackages.manage(${reseller.id}, '${reseller.username}')">
                        Gerenciar Pacotes
                    </button>
                </td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button class="btn-small btn-primary" onclick="AdminDashboardBzResellers.edit(${reseller.id})">
                        Editar
                    </button>
                    <button class="btn-small btn-danger" onclick="AdminDashboardBzResellers.delete(${reseller.id})">
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
                <h2>➕ Adicionar Revendedor DashboardBz</h2>
                <div class="close-modal" onclick="AdminDashboardBzResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username *</label>
                <input type="text" id="dashboardbzResellerUsername" placeholder="usuario123">
                <small style="color: #888; display: block; margin-top: 5px;">
                    Nome de usuário único para login do cliente no sistema de recarga
                </small>
            </div>
            <div class="form-group">
                <label>Termo de Busca no Painel *</label>
                <input type="text" id="dashboardbzResellerSearchTerm" placeholder="124928">
                <small style="color: #888; display: block; margin-top: 5px;">
                    Nome ou ID usado para buscar o usuário na página de revendedores do dashboard.bz (pode ser nome, ID, etc)
                </small>
            </div>
            <div class="form-group">
                <label>Painel Vinculado *</label>
                <select id="dashboardbzResellerPanel">
                    <option value="">Selecione um painel...</option>
                    ${panelOptions}
                </select>
                <small style="color: #888; display: block; margin-top: 5px;">
                    Painel onde os créditos serão adicionados
                </small>
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
        this.currentEditingId = id;
        
        try {
            const resellers = await API.admin.getDashboardBzResellers();
            const reseller = resellers.find(r => r.id === id);

            const panelOptions = this.panels
                .filter(p => p.status === 'active')
                .map(p => `<option value="${p.id}" ${p.id === reseller.panel_id ? 'selected' : ''}>${p.name}</option>`)
                .join('');

            const modalHtml = `
                <div class="modal-header">
                    <h2>✏️ Editar Revendedor DashboardBz</h2>
                    <div class="close-modal" onclick="AdminDashboardBzResellers.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Username *</label>
                    <input type="text" id="dashboardbzResellerUsername" value="${reseller.username}">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Nome de usuário para login do cliente
                    </small>
                </div>
                <div class="form-group">
                    <label>Termo de Busca no Painel *</label>
                    <input type="text" id="dashboardbzResellerSearchTerm" value="${reseller.dashboardbz_search_term}">
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Nome ou ID usado para buscar o usuário na página de revendedores do dashboard.bz
                    </small>
                </div>
                <div class="form-group">
                    <label>Painel Vinculado *</label>
                    <select id="dashboardbzResellerPanel">
                        <option value="">Selecione um painel...</option>
                        ${panelOptions}
                    </select>
                    <small style="color: #888; display: block; margin-top: 5px;">
                        Painel onde os créditos serão adicionados
                    </small>
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
        } catch (error) {
            alert('Erro ao carregar revendedor: ' + error.message);
        }
    },

    async save() {
        const data = {
            username: document.getElementById('dashboardbzResellerUsername').value.trim(),
            dashboardbz_search_term: document.getElementById('dashboardbzResellerSearchTerm').value.trim(),
            panel_id: document.getElementById('dashboardbzResellerPanel').value,
            status: document.getElementById('dashboardbzResellerStatus').value
        };

        if (!data.username || !data.dashboardbz_search_term || !data.panel_id) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        // Validar username (sem espaços, caracteres especiais)
        if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
            alert('Username inválido. Use apenas letras, números, _ e -');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateDashboardBzReseller(this.currentEditingId, data);
            } else {
                await API.admin.createDashboardBzReseller(data);
            }

            this.closeModal();
            this.load();
            alert('Revendedor DashboardBz salvo com sucesso!');
        } catch (error) {
            alert('Erro ao salvar revendedor: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('⚠️ Tem certeza que deseja excluir este revendedor DashboardBz?\n\nTodos os pacotes vinculados também serão excluídos!')) return;

        try {
            await API.admin.deleteDashboardBzReseller(id);
            this.load();
            alert('Revendedor DashboardBz excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir revendedor: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('dashboardbzResellerModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminDashboardBzResellers = AdminDashboardBzResellers;
