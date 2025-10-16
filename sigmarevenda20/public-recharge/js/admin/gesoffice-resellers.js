// js/admin/gesoffice-resellers.js
// Gerenciamento de revendedores GesOffice (UNIPLAY) - CORRIGIDO

const AdminGesOfficeResellers = {
    currentEditingId: null,

    async load() {
        try {
            const resellers = await API.admin.getGesOfficeResellers();
            this.render(resellers); // REMOVIDO await
        } catch (error) {
            console.error('Erro ao carregar revendedores GesOffice:', error);
        }
    },

    render(resellers) { // REMOVIDO async
        const tbody = document.getElementById('gesofficeResellersTableBody');
        tbody.innerHTML = '';

        if (resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum revendedor UNIPLAY cadastrado</td></tr>';
            return;
        }

        // MUDANÇA: forEach ao invés de for...of
        resellers.forEach(reseller => {
            const statusBadge = Components.createStatusBadge(reseller.status);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${reseller.username}</td>
                <td>${reseller.panel_name}</td>
                <td>
                    <button class="btn-success" onclick="AdminGesOfficePackages.openModal(${reseller.id}, '${reseller.username}')">
                        Ver Pacotes
                    </button>
                </td>
                <td>${statusBadge}</td>
                <td class="actions">
                    <button onclick="AdminGesOfficeResellers.edit(${reseller.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminGesOfficeResellers.delete(${reseller.id})">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    async openModal() {
        this.currentEditingId = null;
        
        const panels = await API.admin.getGesOfficePanels();
        const panelOptions = panels.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Revendedor UNIPLAY</h2>
                <div class="close-modal" onclick="AdminGesOfficeResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username do Revendedor</label>
                <input type="text" id="gesofficeResellerUsername" placeholder="Ex: teste123">
                <small style="color: #888;">Username para login do cliente</small>
            </div>
            <div class="form-group">
                <label>ID do Revendedor no GesOffice</label>
                <input type="text" id="gesofficeResellerId" placeholder="Ex: 90284">
                <small style="color: #888;">ID numérico do revendedor no painel GesOffice</small>
            </div>
            <div class="form-group">
                <label>Painel UNIPLAY</label>
                <select id="gesofficeResellerPanelId">
                    <option value="">Selecione um painel</option>
                    ${panelOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="gesofficeResellerStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminGesOfficeResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('gesofficeResellerModal', 'Adicionar Revendedor UNIPLAY', modalHtml);
        modal.classList.add('show');
    },

    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const resellers = await API.admin.getGesOfficeResellers();
            const reseller = resellers.find(r => r.id === id);
            
            const panels = await API.admin.getGesOfficePanels();
            const panelOptions = panels.map(p => 
                `<option value="${p.id}" ${p.id === reseller.panel_id ? 'selected' : ''}>${p.name}</option>`
            ).join('');

            const modalHtml = `
                <div class="modal-header">
                    <h2>Editar Revendedor UNIPLAY</h2>
                    <div class="close-modal" onclick="AdminGesOfficeResellers.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Username do Revendedor</label>
                    <input type="text" id="gesofficeResellerUsername" value="${reseller.username}">
                    <small style="color: #888;">Username para login do cliente</small>
                </div>
                <div class="form-group">
                    <label>ID do Revendedor no GesOffice</label>
                    <input type="text" id="gesofficeResellerId" value="${reseller.gesoffice_id}">
                    <small style="color: #888;">ID numérico do revendedor no painel GesOffice</small>
                </div>
                <div class="form-group">
                    <label>Painel UNIPLAY</label>
                    <select id="gesofficeResellerPanelId">
                        <option value="">Selecione um painel</option>
                        ${panelOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="gesofficeResellerStatus">
                        <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminGesOfficeResellers.save()">Salvar</button>
            `;

            const modal = Components.createModal('gesofficeResellerModal', 'Editar Revendedor UNIPLAY', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar revendedor');
        }
    },

    async save() {
        const data = {
            username: document.getElementById('gesofficeResellerUsername').value,
            gesoffice_id: document.getElementById('gesofficeResellerId').value,
            panel_id: document.getElementById('gesofficeResellerPanelId').value,
            status: document.getElementById('gesofficeResellerStatus').value
        };

        if (!data.username || !data.gesoffice_id || !data.panel_id) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateGesOfficeReseller(this.currentEditingId, data);
            } else {
                await API.admin.createGesOfficeReseller(data);
            }

            this.closeModal();
            this.load();
            alert('Revendedor UNIPLAY salvo com sucesso!');
        } catch (error) {
            alert('Erro ao salvar revendedor');
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este revendedor UNIPLAY?')) return;

        try {
            await API.admin.deleteGesOfficeReseller(id);
            this.load();
            alert('Revendedor UNIPLAY excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir revendedor');
        }
    },

    closeModal() {
        const modal = document.getElementById('gesofficeResellerModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminGesOfficeResellers = AdminGesOfficeResellers;
