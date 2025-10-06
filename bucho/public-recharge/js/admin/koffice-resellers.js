// js/admin/koffice-resellers.js
// Gerenciamento de revendedores Koffice

const AdminKofficeResellers = {
    currentEditingId: null,

    async load() {
        try {
            const resellers = await API.admin.getKofficeResellers();
            await this.render(resellers);
        } catch (error) {
            console.error('Erro ao carregar revendedores Koffice:', error);
        }
    },

    async render(resellers) {
        const tbody = document.getElementById('kofficeResellersTableBody');
        tbody.innerHTML = '';

        if (resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">Nenhum revendedor Koffice cadastrado</td></tr>';
            return;
        }

        for (const reseller of resellers) {
            const packages = await API.admin.getPackages(reseller.id, 'koffice');
            const statusBadge = Components.createStatusBadge(reseller.status);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${reseller.username}</td>
                <td><code>${reseller.koffice_id}</code></td>
                <td>${reseller.panel_name}</td>
                <td>
                    <button class="btn-success" onclick="AdminKofficePackages.openModal(${reseller.id}, '${reseller.username}')">
                        ${packages.length} pacote(s)
                    </button>
                </td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminKofficeResellers.edit(${reseller.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminKofficeResellers.delete(${reseller.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        }
    },

    async openModal() {
        this.currentEditingId = null;
        
        const panels = await API.admin.getKofficePanels();
        const panelOptions = panels.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Revendedor Koffice</h2>
                <div class="close-modal" onclick="AdminKofficeResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username do Revendedor</label>
                <input type="text" id="kofficeResellerUsername" placeholder="Ex: teste123">
                <small style="color: #888;">Username para login do cliente</small>
            </div>
            <div class="form-group">
                <label>ID do Revendedor no Koffice</label>
                <input type="text" id="kofficeResellerId" placeholder="Ex: 1673">
                <small style="color: #888;">ID interno do revendedor no painel Koffice (número visível na interface)</small>
            </div>
            <div class="form-group">
                <label>Painel Koffice</label>
                <select id="kofficeResellerPanelId">
                    <option value="">Selecione um painel</option>
                    ${panelOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="kofficeResellerStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminKofficeResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('kofficeResellerModal', 'Adicionar Revendedor Koffice', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const resellers = await API.admin.getKofficeResellers();
            const reseller = resellers.find(r => r.id === id);
            
            const panels = await API.admin.getKofficePanels();
            const panelOptions = panels.map(p => 
                `<option value="${p.id}" ${p.id === reseller.panel_id ? 'selected' : ''}>${p.name}</option>`
            ).join('');

            const modalHtml = `
                <div class="modal-header">
                    <h2>Editar Revendedor Koffice</h2>
                    <div class="close-modal" onclick="AdminKofficeResellers.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Username do Revendedor</label>
                    <input type="text" id="kofficeResellerUsername" value="${reseller.username}">
                    <small style="color: #888;">Username para login do cliente</small>
                </div>
                <div class="form-group">
                    <label>ID do Revendedor no Koffice</label>
                    <input type="text" id="kofficeResellerId" value="${reseller.koffice_id}">
                    <small style="color: #888;">ID interno do revendedor no painel Koffice</small>
                </div>
                <div class="form-group">
                    <label>Painel Koffice</label>
                    <select id="kofficeResellerPanelId">
                        <option value="">Selecione um painel</option>
                        ${panelOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="kofficeResellerStatus">
                        <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminKofficeResellers.save()">Salvar</button>
            `;

            const modal = Components.createModal('kofficeResellerModal', 'Editar Revendedor Koffice', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar revendedor');
        }
    },

    async save() {
        const data = {
            username: document.getElementById('kofficeResellerUsername').value,
            koffice_id: document.getElementById('kofficeResellerId').value,
            panel_id: document.getElementById('kofficeResellerPanelId').value,
            status: document.getElementById('kofficeResellerStatus').value
        };

        if (!data.username || !data.koffice_id || !data.panel_id) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateKofficeReseller(this.currentEditingId, data);
            } else {
                await API.admin.createKofficeReseller(data);
            }

            this.closeModal();
            this.load();
            alert('Revendedor Koffice salvo com sucesso!');
        } catch (error) {
            alert('Erro ao salvar revendedor');
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este revendedor Koffice?')) return;

        try {
            await API.admin.deleteKofficeReseller(id);
            this.load();
            alert('Revendedor Koffice excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir revendedor');
        }
    },

    closeModal() {
        const modal = document.getElementById('kofficeResellerModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminKofficeResellers = AdminKofficeResellers;
