// js/admin/p2bras-resellers.js
// Gerenciamento de revendedores P2BRAS (Controle.VIP) - CORRIGIDO

const AdminP2brasResellers = {
    currentEditingId: null,

    async load() {
        try {
            const resellers = await API.admin.getP2brasResellers();
            this.render(resellers); // REMOVIDO await
        } catch (error) {
            console.error('Erro ao carregar revendedores P2BRAS:', error);
        }
    },

    render(resellers) { // REMOVIDO async
        const tbody = document.getElementById('p2brasResellersTableBody');
        tbody.innerHTML = '';

        if (resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">Nenhum revendedor P2BRAS cadastrado</td></tr>';
            return;
        }

        // MUDANÇA: forEach ao invés de for...of
        resellers.forEach(reseller => {
            const statusBadge = Components.createStatusBadge(reseller.status);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${reseller.username}</td>
                <td><code>${reseller.p2bras_id}</code></td>
                <td>${reseller.panel_name}</td>
                <td>
                    <button class="btn-success" onclick="AdminP2brasPackages.openModal(${reseller.id}, '${reseller.username}')">
                        Ver Pacotes
                    </button>
                </td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminP2brasResellers.edit(${reseller.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminP2brasResellers.delete(${reseller.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    async openModal() {
        this.currentEditingId = null;
        
        const panels = await API.admin.getP2brasPanels();
        const panelOptions = panels.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Revendedor P2BRAS</h2>
                <div class="close-modal" onclick="AdminP2brasResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username do Revendedor</label>
                <input type="text" id="p2brasResellerUsername" placeholder="Ex: teste123">
                <small style="color: #888;">Username para login do cliente</small>
            </div>
            <div class="form-group">
                <label>ID do Revendedor no P2BRAS</label>
                <input type="number" id="p2brasResellerId" placeholder="Ex: 39247">
                <small style="color: #888;">ID numérico do revendedor no Controle.VIP</small>
            </div>
            <div class="form-group">
                <label>Painel P2BRAS</label>
                <select id="p2brasResellerPanelId">
                    <option value="">Selecione um painel</option>
                    ${panelOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="p2brasResellerStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminP2brasResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('p2brasResellerModal', 'Adicionar Revendedor P2BRAS', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const resellers = await API.admin.getP2brasResellers();
            const reseller = resellers.find(r => r.id === id);
            
            const panels = await API.admin.getP2brasPanels();
            const panelOptions = panels.map(p => 
                `<option value="${p.id}" ${p.id === reseller.panel_id ? 'selected' : ''}>${p.name}</option>`
            ).join('');

            const modalHtml = `
                <div class="modal-header">
                    <h2>Editar Revendedor P2BRAS</h2>
                    <div class="close-modal" onclick="AdminP2brasResellers.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Username do Revendedor</label>
                    <input type="text" id="p2brasResellerUsername" value="${reseller.username}">
                    <small style="color: #888;">Username para login do cliente</small>
                </div>
                <div class="form-group">
                    <label>ID do Revendedor no P2BRAS</label>
                    <input type="number" id="p2brasResellerId" value="${reseller.p2bras_id}">
                    <small style="color: #888;">ID numérico do revendedor no Controle.VIP</small>
                </div>
                <div class="form-group">
                    <label>Painel P2BRAS</label>
                    <select id="p2brasResellerPanelId">
                        <option value="">Selecione um painel</option>
                        ${panelOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="p2brasResellerStatus">
                        <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminP2brasResellers.save()">Salvar</button>
            `;

            const modal = Components.createModal('p2brasResellerModal', 'Editar Revendedor P2BRAS', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar dados do revendedor');
        }
    },

    async save() {
        const data = {
            username: document.getElementById('p2brasResellerUsername').value.trim(),
            p2bras_id: parseInt(document.getElementById('p2brasResellerId').value),
            panel_id: parseInt(document.getElementById('p2brasResellerPanelId').value),
            status: document.getElementById('p2brasResellerStatus').value
        };

        if (!data.username || !data.p2bras_id || !data.panel_id) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        if (isNaN(data.p2bras_id) || data.p2bras_id <= 0) {
            alert('ID do P2BRAS deve ser um número válido');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateP2brasReseller(this.currentEditingId, data);
                alert('Revendedor P2BRAS atualizado com sucesso!');
            } else {
                await API.admin.createP2brasReseller(data);
                alert('Revendedor P2BRAS criado com sucesso!');
            }

            this.closeModal();
            this.load();
        } catch (error) {
            alert('Erro ao salvar revendedor: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este revendedor P2BRAS?')) {
            return;
        }

        try {
            await API.admin.deleteP2brasReseller(id);
            alert('Revendedor P2BRAS excluído com sucesso!');
            this.load();
        } catch (error) {
            alert('Erro ao excluir revendedor: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('p2brasResellerModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
};

window.AdminP2brasResellers = AdminP2brasResellers;
