// public-recharge/js/admin/painelfoda-packages.js
// Gerenciamento de Pacotes de Créditos - PainelFoda

const AdminPainelFodaPackages = {
    currentResellerId: null,
    currentPackage: null,

    async manage(resellerId) {
        this.currentResellerId = resellerId;
        await this.load();
        this.openManageModal();
    },

    async load() {
        try {
            const packages = await API.admin.getPackages(this.currentResellerId, 'painelfoda');
            this.renderPackagesList(packages);
        } catch (error) {
            console.error('Erro ao carregar pacotes:', error);
        }
    },

    renderPackagesList(packages) {
        const container = document.getElementById('painelfodaPackagesList');
        if (!container) return;

        container.innerHTML = '';

        if (packages.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #999;">
                    <p>Nenhum pacote cadastrado</p>
                    <p style="font-size: 12px; margin-top: 10px;">
                        Clique em "Adicionar Pacote" para criar o primeiro pacote
                    </p>
                </div>
            `;
            return;
        }

        packages.forEach(pkg => {
            const div = document.createElement('div');
            div.className = 'package-item';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${pkg.credits} créditos</strong>
                        <span style="margin-left: 15px; color: #4caf50; font-weight: bold;">
                            R$ ${parseFloat(pkg.price).toFixed(2)}
                        </span>
                    </div>
                    <div>
                        <button class="btn-small btn-primary" onclick="AdminPainelFodaPackages.editPackage(${JSON.stringify(pkg).replace(/"/g, '&quot;')})">
                            Editar
                        </button>
                        <button class="btn-small btn-danger" onclick="AdminPainelFodaPackages.deletePackage(${pkg.id})">
                            Excluir
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    },

    openManageModal() {
        const modalHtml = `
            <div class="modal-overlay" id="painelfodaPackagesModal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>💰 Gerenciar Pacotes - PainelFoda</h3>
                        <button class="modal-close" onclick="AdminPainelFodaPackages.closeManageModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <button class="btn-success" onclick="AdminPainelFodaPackages.openAddModal()" style="margin-bottom: 20px; width: 100%;">
                            ➕ Adicionar Pacote
                        </button>
                        <div id="painelfodaPackagesList"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="AdminPainelFodaPackages.closeManageModal()">Fechar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.load();
    },

    closeManageModal() {
        const modal = document.getElementById('painelfodaPackagesModal');
        if (modal) modal.remove();
        this.currentResellerId = null;
    },

    openAddModal() {
        this.currentPackage = null;
        this.openPackageModal();
    },

    editPackage(pkg) {
        this.currentPackage = pkg;
        this.openPackageModal();
    },

    openPackageModal() {
        const pkg = this.currentPackage;
        
        const modalHtml = `
            <div class="modal-overlay" id="painelfodaPackageModal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>${pkg ? 'Editar' : 'Adicionar'} Pacote</h3>
                        <button class="modal-close" onclick="AdminPainelFodaPackages.closePackageModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Quantidade de Créditos *</label>
                            <input type="number" id="painelfodaPackageCredits" value="${pkg?.credits || ''}" placeholder="Ex: 100" min="1" step="1">
                            <small>Quantidade de créditos que o cliente receberá</small>
                        </div>
                        <div class="form-group">
                            <label>Preço (R$) *</label>
                            <input type="number" id="painelfodaPackagePrice" value="${pkg?.price || ''}" placeholder="Ex: 50.00" min="0.01" step="0.01">
                            <small>Valor que o cliente pagará em reais</small>
                        </div>
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                            <strong>💡 Dica:</strong> Crie pacotes variados para dar opções aos clientes!
                            <br><small>Ex: 50 créditos (R$ 25), 100 créditos (R$ 45), 200 créditos (R$ 80)</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="AdminPainelFodaPackages.closePackageModal()">Cancelar</button>
                        <button class="btn-success" onclick="AdminPainelFodaPackages.savePackage()">Salvar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    closePackageModal() {
        const modal = document.getElementById('painelfodaPackageModal');
        if (modal) modal.remove();
        this.currentPackage = null;
    },

    async savePackage() {
        const credits = parseInt(document.getElementById('painelfodaPackageCredits').value);
        const price = parseFloat(document.getElementById('painelfodaPackagePrice').value);

        if (!credits || credits <= 0) {
            alert('Informe uma quantidade válida de créditos!');
            return;
        }

        if (!price || price <= 0) {
            alert('Informe um preço válido!');
            return;
        }

        try {
            const data = {
                reseller_id: this.currentResellerId,
                reseller_type: 'painelfoda',
                credits: credits,
                price: price
            };

            if (this.currentPackage) {
                await API.admin.updatePackage(this.currentPackage.id, data);
                alert('Pacote atualizado com sucesso!');
            } else {
                await API.admin.createPackage(data);
                alert('Pacote criado com sucesso!');
            }

            this.closePackageModal();
            this.load();
        } catch (error) {
            console.error('Erro ao salvar pacote:', error);
            alert('Erro ao salvar: ' + error.message);
        }
    },

    async deletePackage(id) {
        if (!confirm('Tem certeza que deseja excluir este pacote?\n\nOs clientes não poderão mais comprá-lo.')) {
            return;
        }

        try {
            await API.admin.deletePackage(id);
            alert('Pacote excluído com sucesso!');
            this.load();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir: ' + error.message);
        }
    }
};

window.AdminPainelFodaPackages = AdminPainelFodaPackages;
