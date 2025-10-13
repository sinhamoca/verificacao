// js/admin/rushplay-resellers.js
// Gerenciamento de revendedores RushPlay

const AdminRushPlayResellers = {
    currentEditingId: null,

    async load() {
        try {
            const resellers = await API.admin.getRushPlayResellers();
            await this.render(resellers);
        } catch (error) {
            console.error('Erro ao carregar revendedores RushPlay:', error);
        }
    },

    async render(resellers) {
        const tbody = document.getElementById('rushplayResellersTableBody');
        tbody.innerHTML = '';

        if (resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">Nenhum revendedor RushPlay cadastrado</td></tr>';
            return;
        }

        for (const reseller of resellers) {
            const packages = await API.admin.getPackages(reseller.id, 'rushplay');
            const statusBadge = Components.createStatusBadge(reseller.status);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${reseller.username}</td>
                <td><code>${reseller.rushplay_id}</code></td>
                <td>${reseller.panel_name}</td>
                <td>
                    <button class="btn-success" onclick="AdminRushPlayPackages.openModal(${reseller.id}, '${reseller.username}')">
                        ${packages.length} pacote(s)
                    </button>
                </td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminRushPlayResellers.edit(${reseller.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminRushPlayResellers.delete(${reseller.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        }
    },

    async openModal() {
        this.currentEditingId = null;
        
        const panels = await API.admin.getRushPlayPanels();
        const panelOptions = panels.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Revendedor RushPlay</h2>
                <div class="close-modal" onclick="AdminRushPlayResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username do Revendedor</label>
                <input type="text" id="rushplayResellerUsername" placeholder="Ex: teste123">
                <small style="color: #888;">Username para login do cliente</small>
            </div>
            <div class="form-group">
                <label>ID do Revendedor no RushPlay</label>
                <input type="text" id="rushplayResellerId" placeholder="Ex: 1930824">
                <small style="color: #888;">ID numérico do usuário no painel RushPlay</small>
            </div>
            <div class="form-group">
                <label>Painel</label>
                <select id="rushplayResellerPanel">
                    ${panelOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="rushplayResellerStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminRushPlayResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('rushplayResellerModal', 'Adicionar Revendedor RushPlay', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        const resellers = await API.admin.getRushPlayResellers();
        const reseller = resellers.find(r => r.id === id);
        
        if (!reseller) return;

        this.currentEditingId = id;

        const panels = await API.admin.getRushPlayPanels();
        const panelOptions = panels.map(p => 
            `<option value="${p.id}" ${p.id === reseller.panel_id ? 'selected' : ''}>${p.name}</option>`
        ).join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Editar Revendedor RushPlay</h2>
                <div class="close-modal" onclick="AdminRushPlayResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username do Revendedor</label>
                <input type="text" id="rushplayResellerUsername" value="${reseller.username}">
            </div>
            <div class="form-group">
                <label>ID do Revendedor no RushPlay</label>
                <input type="text" id="rushplayResellerId" value="${reseller.rushplay_id}">
            </div>
            <div class="form-group">
                <label>Painel</label>
                <select id="rushplayResellerPanel">
                    ${panelOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="rushplayResellerStatus">
                    <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                    <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                </select>
            </div>
            <button onclick="AdminRushPlayResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('rushplayResellerModal', 'Editar Revendedor RushPlay', modalHtml);
        modal.classList.add('show');
    },

    async save() {
        const data = {
            username: document.getElementById('rushplayResellerUsername').value,
            rushplay_id: document.getElementById('rushplayResellerId').value,
            panel_id: parseInt(document.getElementById('rushplayResellerPanel').value),
            status: document.getElementById('rushplayResellerStatus').value
        };

        if (!data.username || !data.rushplay_id || !data.panel_id) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateRushPlayReseller(this.currentEditingId, data);
                alert('Revendedor RushPlay atualizado com sucesso!');
            } else {
                await API.admin.createRushPlayReseller(data);
                alert('Revendedor RushPlay criado com sucesso!');
            }

            this.closeModal();
            this.load();
        } catch (error) {
            alert('Erro ao salvar revendedor RushPlay: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este revendedor RushPlay?')) return;

        try {
            await API.admin.deleteRushPlayReseller(id);
            alert('Revendedor RushPlay excluído com sucesso!');
            this.load();
        } catch (error) {
            alert('Erro ao excluir revendedor RushPlay: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('rushplayResellerModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }
};

window.AdminRushPlayResellers = AdminRushPlayResellers;
