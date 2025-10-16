// public-recharge/js/admin/dashboardbz-packages.js
// Gerenciamento de Pacotes DashboardBz - CORRIGIDO PARA PADRÃO

const AdminDashboardBzPackages = {
    currentResellerId: null,
    currentResellerUsername: null,
    currentEditingId: null,

    async openModal(resellerId, resellerUsername) {
        this.currentResellerId = resellerId;
        this.currentResellerUsername = resellerUsername;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Gerenciar Pacotes - ${resellerUsername} (DashboardBz)</h2>
                <div class="close-modal" onclick="AdminDashboardBzPackages.closeModal()">×</div>
            </div>
            
            <div class="card" style="margin-bottom: 20px;">
                <h3>Adicionar Pacote</h3>
                <div class="form-group">
                    <label>Quantidade de Créditos</label>
                    <input type="number" id="dashboardbzPackageCredits" placeholder="Ex: 10">
                </div>
                <div class="form-group">
                    <label>Preço (R$)</label>
                    <input type="number" step="0.01" id="dashboardbzPackagePrice" placeholder="Ex: 100.00">
                </div>
                <button onclick="AdminDashboardBzPackages.addPackage()" class="btn-success">Adicionar Pacote</button>
            </div>

            <h3>Pacotes Cadastrados</h3>
            <div id="dashboardbzPackagesList"></div>
        `;

        const modal = Components.createModal('dashboardbzPackagesModal', `Pacotes - ${resellerUsername} (DashboardBz)`, modalHtml);
        modal.classList.add('show');
        
        await this.loadPackages();
    },

    async loadPackages() {
        try {
            const packages = await API.admin.getPackages(this.currentResellerId, 'dashboardbz');
            const container = document.getElementById('dashboardbzPackagesList');
            
            if (packages.length === 0) {
                container.innerHTML = '<div class="empty-state">Nenhum pacote cadastrado</div>';
                return;
            }

            container.innerHTML = '';
            packages.forEach(pkg => {
                const unitPrice = (pkg.price / pkg.credits).toFixed(2);
                const item = document.createElement('div');
                item.className = 'package-item';
                item.innerHTML = `
                    <div>
                        <strong>${pkg.credits} créditos</strong> - R$ ${pkg.price.toFixed(2)}
                        <small style="display: block; color: #888; margin-top: 5px;">
                            R$ ${unitPrice} por crédito
                        </small>
                    </div>
                    <div>
                        <button onclick="AdminDashboardBzPackages.edit(${pkg.id})" style="margin-right: 5px;">
                            Editar
                        </button>
                        <button class="btn-danger" onclick="AdminDashboardBzPackages.delete(${pkg.id})">
                            Excluir
                        </button>
                    </div>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Erro ao carregar pacotes:', error);
        }
    },

    async addPackage() {
        const credits = parseInt(document.getElementById('dashboardbzPackageCredits').value);
        const price = parseFloat(document.getElementById('dashboardbzPackagePrice').value);

        if (!credits || credits <= 0) {
            alert('Informe uma quantidade válida de créditos');
            return;
        }

        if (!price || price <= 0) {
            alert('Informe um preço válido');
            return;
        }

        try {
            await API.admin.createPackage({
                reseller_id: this.currentResellerId,
                reseller_type: 'dashboardbz',
                credits: credits,
                price: price
            });

            alert('Pacote adicionado com sucesso!');
            document.getElementById('dashboardbzPackageCredits').value = '';
            document.getElementById('dashboardbzPackagePrice').value = '';
            
            await this.loadPackages();
        } catch (error) {
            alert('Erro ao adicionar pacote: ' + error.message);
        }
    },

    async edit(id) {
        const packages = await API.admin.getPackages(this.currentResellerId, 'dashboardbz');
        const pkg = packages.find(p => p.id === id);
        
        if (!pkg) return;

        this.currentEditingId = id;

        // Preencher campos com valores atuais
        document.getElementById('dashboardbzPackageCredits').value = pkg.credits;
        document.getElementById('dashboardbzPackagePrice').value = pkg.price;

        // Mudar texto do botão
        const addButton = document.querySelector('#dashboardbzPackagesModal .btn-success');
        if (addButton) {
            addButton.textContent = 'Atualizar Pacote';
            addButton.onclick = () => AdminDashboardBzPackages.update();
        }
    },

    async update() {
        const credits = parseInt(document.getElementById('dashboardbzPackageCredits').value);
        const price = parseFloat(document.getElementById('dashboardbzPackagePrice').value);

        if (!credits || credits <= 0) {
            alert('Informe uma quantidade válida de créditos');
            return;
        }

        if (!price || price <= 0) {
            alert('Informe um preço válido');
            return;
        }

        try {
            await API.admin.updatePackage(this.currentEditingId, {
                credits: credits,
                price: price
            });

            alert('Pacote atualizado com sucesso!');
            
            // Resetar
            this.currentEditingId = null;
            document.getElementById('dashboardbzPackageCredits').value = '';
            document.getElementById('dashboardbzPackagePrice').value = '';
            
            // Restaurar botão
            const addButton = document.querySelector('#dashboardbzPackagesModal .btn-success');
            if (addButton) {
                addButton.textContent = 'Adicionar Pacote';
                addButton.onclick = () => AdminDashboardBzPackages.addPackage();
            }
            
            await this.loadPackages();
        } catch (error) {
            alert('Erro ao atualizar pacote: ' + error.message);
        }
    },

    async delete(id) {
        if (!confirm('Tem certeza que deseja excluir este pacote?')) return;

        try {
            await API.admin.deletePackage(id);
            alert('Pacote excluído com sucesso!');
            await this.loadPackages();
        } catch (error) {
            alert('Erro ao excluir pacote: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('dashboardbzPackagesModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentResellerId = null;
        this.currentResellerUsername = null;
        this.currentEditingId = null;
    }
};

window.AdminDashboardBzPackages = AdminDashboardBzPackages;
