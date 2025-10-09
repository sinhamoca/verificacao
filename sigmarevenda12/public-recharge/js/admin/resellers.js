// js/admin/resellers.js - COM DEBUG E CORREÇÕES
const AdminResellers = {
    currentEditingId: null,

    // Carregar revendedores
    async load() {
        try {
            console.log('[AdminResellers] Carregando revendedores Sigma...');
            const resellers = await API.admin.getResellers();
            console.log('[AdminResellers] Revendedores recebidos:', resellers);
            await this.render(resellers);
        } catch (error) {
            console.error('[AdminResellers] Erro ao carregar revendedores:', error);
            alert('Erro ao carregar revendedores: ' + error.message);
        }
    },

    // Renderizar tabela
    async render(resellers) {
        const tbody = document.getElementById('resellersTableBody');
        
        if (!tbody) {
            console.error('[AdminResellers] Elemento resellersTableBody não encontrado!');
            return;
        }
        
        tbody.innerHTML = '';

        if (resellers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum revendedor cadastrado</td></tr>';
            return;
        }

        console.log('[AdminResellers] Renderizando', resellers.length, 'revendedores');

        for (const reseller of resellers) {
            try {
                console.log(`[AdminResellers] Carregando pacotes para ${reseller.username} (ID: ${reseller.id})`);
                
                // ✅ CRÍTICO: Passar 'sigma' como segundo parâmetro
                const packages = await API.admin.getPackages(reseller.id, 'sigma');
                
                console.log(`[AdminResellers] ${reseller.username} tem ${packages.length} pacote(s)`);
                
                const statusBadge = Components.createStatusBadge(reseller.status);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${reseller.username}</td>
                    <td>${reseller.panel_name || 'N/A'}</td>
                    <td>
                        <button 
                            class="btn-success" 
                            onclick="AdminPackages.openModal(${reseller.id}, '${reseller.username}')"
                            style="min-width: 100px;"
                        >
                            📦 ${packages.length} pacote(s)
                        </button>
                    </td>
                    <td>${statusBadge}</td>
                    <td class="actions">
                        <button onclick="AdminResellers.edit(${reseller.id})">Editar</button>
                        <button class="btn-danger" onclick="AdminResellers.delete(${reseller.id})">Excluir</button>
                    </td>
                `;
                tbody.appendChild(row);
            } catch (error) {
                console.error(`[AdminResellers] Erro ao processar ${reseller.username}:`, error);
                
                // Adicionar linha mesmo com erro
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${reseller.username}</td>
                    <td>${reseller.panel_name || 'N/A'}</td>
                    <td>
                        <button 
                            class="btn-danger" 
                            onclick="AdminPackages.openModal(${reseller.id}, '${reseller.username}')"
                        >
                            ⚠️ Erro ao carregar
                        </button>
                    </td>
                    <td>${Components.createStatusBadge(reseller.status)}</td>
                    <td class="actions">
                        <button onclick="AdminResellers.edit(${reseller.id})">Editar</button>
                        <button class="btn-danger" onclick="AdminResellers.delete(${reseller.id})">Excluir</button>
                    </td>
                `;
                tbody.appendChild(row);
            }
        }
        
        console.log('[AdminResellers] Renderização concluída');
    },

    // Abrir modal (criar)
    async openModal() {
        this.currentEditingId = null;
        
        // Carregar painéis
        const panels = await API.admin.getPanels();
        const panelOptions = panels.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');

        const modalHtml = `
            <div class="modal-header">
                <h2>Adicionar Revendedor Sigma</h2>
                <div class="close-modal" onclick="AdminResellers.closeModal()">×</div>
            </div>
            <div class="form-group">
                <label>Username do Revendedor</label>
                <input type="text" id="resellerUsername" placeholder="Ex: ostenes">
            </div>
            <div class="form-group">
                <label>Painel Sigma</label>
                <select id="resellerPanelId">
                    <option value="">Selecione um painel</option>
                    ${panelOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="resellerStatus">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
            </div>
            <button onclick="AdminResellers.save()">Salvar</button>
        `;

        const modal = Components.createModal('resellerModal', 'Adicionar Revendedor', modalHtml);
        modal.classList.add('show');
    },

    // Editar revendedor
    async edit(id) {
        this.currentEditingId = id;
        
        try {
            const resellers = await API.admin.getResellers();
            const reseller = resellers.find(r => r.id === id);
            
            const panels = await API.admin.getPanels();
            const panelOptions = panels.map(p => 
                `<option value="${p.id}" ${p.id === reseller.panel_id ? 'selected' : ''}>${p.name}</option>`
            ).join('');

            const modalHtml = `
                <div class="modal-header">
                    <h2>Editar Revendedor Sigma</h2>
                    <div class="close-modal" onclick="AdminResellers.closeModal()">×</div>
                </div>
                <div class="form-group">
                    <label>Username do Revendedor</label>
                    <input type="text" id="resellerUsername" value="${reseller.username}">
                </div>
                <div class="form-group">
                    <label>Painel Sigma</label>
                    <select id="resellerPanelId">
                        <option value="">Selecione um painel</option>
                        ${panelOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="resellerStatus">
                        <option value="active" ${reseller.status === 'active' ? 'selected' : ''}>Ativo</option>
                        <option value="inactive" ${reseller.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                    </select>
                </div>
                <button onclick="AdminResellers.save()">Salvar</button>
            `;

            const modal = Components.createModal('resellerModal', 'Editar Revendedor', modalHtml);
            modal.classList.add('show');
        } catch (error) {
            alert('Erro ao carregar revendedor');
        }
    },

    // Salvar revendedor
    async save() {
        const data = {
            username: document.getElementById('resellerUsername').value,
            panel_id: document.getElementById('resellerPanelId').value,
            status: document.getElementById('resellerStatus').value
        };

        if (!data.username || !data.panel_id) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            if (this.currentEditingId) {
                await API.admin.updateReseller(this.currentEditingId, data);
            } else {
                await API.admin.createReseller(data);
            }

            this.closeModal();
            this.load();
            alert('Revendedor salvo com sucesso!');
        } catch (error) {
            console.error('[AdminResellers] Erro ao salvar:', error);
            alert('Erro ao salvar revendedor: ' + error.message);
        }
    },

    // Excluir revendedor
    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este revendedor?')) return;

        try {
            await API.admin.deleteReseller(id);
            this.load();
            alert('Revendedor excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir revendedor');
        }
    },

    // Fechar modal
    closeModal() {
        const modal = document.getElementById('resellerModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminResellers = AdminResellers;
