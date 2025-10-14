// public-recharge/js/admin/dashboardbz-packages.js
// Gerenciamento de Pacotes DashboardBz (reutiliza sistema universal de pacotes)

const AdminDashboardBzPackages = {
    currentResellerId: null,
    currentResellerUsername: null,
    currentPackageId: null,

    manage(resellerId, username) {
        this.currentResellerId = resellerId;
        this.currentResellerUsername = username;
        this.load();
    },

    async load() {
        try {
            const packages = await API.admin.getPackages(this.currentResellerId, 'dashboardbz');
            this.renderModal(packages);
        } catch (error) {
            console.error('Erro ao carregar pacotes:', error);
            alert('Erro ao carregar pacotes: ' + error.message);
        }
    },

    renderModal(packages) {
        let packagesHtml = '';
        
        if (packages.length === 0) {
            packagesHtml = '<p style="text-align: center; color: #999; padding: 20px;">Nenhum pacote cadastrado</p>';
        } else {
            packagesHtml = '<div class="packages-list">';
            packages.forEach(pkg => {
                packagesHtml += `
                    <div class="package-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; background: #f9f9f9;">
                        <div>
                            <strong style="font-size: 16px; color: #333;">${pkg.credits} créditos</strong>
                            <div style="color: #28a745; font-size: 18px; font-weight: bold; margin-top: 5px;">R$ ${pkg.price.toFixed(2)}</div>
                        </div>
                        <div>
                            <button class="btn-small btn-primary" onclick="AdminDashboardBzPackages.editPackage(${pkg.id}, ${pkg.credits}, ${pkg.price})" style="margin-right: 5px;">
                                Editar
                            </button>
                            <button class="btn-small btn-danger" onclick="AdminDashboardBzPackages.deletePackage(${pkg.id})">
                                Excluir
                            </button>
                        </div>
                    </div>
                `;
            });
            packagesHtml += '</div>';
        }

        const modalHtml = `
            <div class="modal-header">
                <h2>💰 Pacotes de ${this.currentResellerUsername}</h2>
                <div class="close-modal" onclick="AdminDashboardBzPackages.closeModal()">×</div>
            </div>
            <div class="modal-body">
                ${packagesHtml}
                <button class="btn-success" style="width: 100%; margin-top: 20px;" onclick="AdminDashboardBzPackages.addPackage()">
                    ➕ Adicionar Novo Pacote
                </button>
            </div>
        `;

        const modal = Components.createModal('dashboardbzPackagesModal', 'Gerenciar Pacotes', modalHtml);
        modal.classList.add('show');
    },

    addPackage() {
        this.currentPackageId = null;

        const formHtml = `
            <div class="modal-header">
                <h2>➕ Adicionar Pacote</h2>
                <div class="close-modal" onclick="AdminDashboardBzPackages.closePackageForm()">×</div>
            </div>
            <div class="form-group">
                <label>Quantidade de Créditos *</label>
                <input type="number" id="packageCredits" min="1" placeholder="Ex: 100">
            </div>
            <div class="form-group">
                <label>Preço (R$) *</label>
                <input type="number" id="packagePrice" min="0.01" step="0.01" placeholder="Ex: 10.00">
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-secondary" style="flex: 1;" onclick="AdminDashboardBzPackages.closePackageForm()">
                    Cancelar
                </button>
                <button class="btn-success" style="flex: 1;" onclick="AdminDashboardBzPackages.savePackage()">
                    Salvar
                </button>
            </div>
        `;

        const existingModal = document.getElementById('dashboardbzPackagesModal');
        if (existingModal) {
            existingModal.innerHTML = formHtml;
        }
    },

    editPackage(id, credits, price) {
        this.currentPackageId = id;

        const formHtml = `
            <div class="modal-header">
                <h2>✏️ Editar Pacote</h2>
                <div class="close-modal" onclick="AdminDashboardBzPackages.closePackageForm()">×</div>
            </div>
            <div class="form-group">
                <label>Quantidade de Créditos *</label>
                <input type="number" id="packageCredits" min="1" value="${credits}">
            </div>
            <div class="form-group">
                <label>Preço (R$) *</label>
                <input type="number" id="packagePrice" min="0.01" step="0.01" value="${price}">
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button class="btn-secondary" style="flex: 1;" onclick="AdminDashboardBzPackages.closePackageForm()">
                    Cancelar
                </button>
                <button class="btn-success" style="flex: 1;" onclick="AdminDashboardBzPackages.savePackage()">
                    Salvar
                </button>
            </div>
        `;

        const existingModal = document.getElementById('dashboardbzPackagesModal');
        if (existingModal) {
            existingModal.innerHTML = formHtml;
        }
    },

    async savePackage() {
        const credits = parseInt(document.getElementById('packageCredits').value);
        const price = parseFloat(document.getElementById('packagePrice').value);

        if (!credits || credits < 1) {
            alert('Digite uma quantidade válida de créditos');
            return;
        }

        if (!price || price < 0.01) {
            alert('Digite um preço válido');
            return;
        }

        try {
            if (this.currentPackageId) {
                // Editar
                await API.admin.updatePackage(this.currentPackageId, { credits, price });
            } else {
                // Criar
                await API.admin.createPackage({
                    reseller_id: this.currentResellerId,
                    reseller_type: 'dashboardbz',
                    credits,
                    price
                });
            }

            alert('Pacote salvo com sucesso!');
            this.load(); // Recarregar lista
        } catch (error) {
            alert('Erro ao salvar pacote: ' + error.message);
        }
    },

    async deletePackage(id) {
        if (!confirm('Tem certeza que deseja excluir este pacote?')) return;

        try {
            await API.admin.deletePackage(id);
            alert('Pacote excluído com sucesso!');
            this.load();
        } catch (error) {
            alert('Erro ao excluir pacote: ' + error.message);
        }
    },

    closePackageForm() {
        this.currentPackageId = null;
        this.load(); // Voltar para lista
    },

    closeModal() {
        const modal = document.getElementById('dashboardbzPackagesModal');
        if (modal) modal.classList.remove('show');
        this.currentResellerId = null;
        this.currentResellerUsername = null;
        this.currentPackageId = null;
    }
};

window.AdminDashboardBzPackages = AdminDashboardBzPackages;
