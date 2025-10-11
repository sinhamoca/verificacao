// public-recharge/js/admin/painelfoda-packages.js
// Gerenciamento de pacotes de créditos PainelFoda

const AdminPainelFodaPackages = {
    currentResellerId: null,
    currentResellerName: null,

    async openModal(resellerId, resellerName) {
        this.currentResellerId = resellerId;
        this.currentResellerName = resellerName;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Gerenciar Pacotes - ${resellerName} (PainelFoda)</h2>
                <div class="close-modal" onclick="AdminPainelFodaPackages.closeModal()">×</div>
            </div>
            
            <div class="card" style="margin-bottom: 20px;">
                <h3>Adicionar Pacote</h3>
                <div class="form-group">
                    <label>Quantidade de Créditos</label>
                    <input type="number" id="painelFodaPackageCredits" placeholder="Ex: 10">
                </div>
                <div class="form-group">
                    <label>Preço (R$)</label>
                    <input type="number" step="0.01" id="painelFodaPackagePrice" placeholder="Ex: 100.00">
                </div>
                <button onclick="AdminPainelFodaPackages.addPackage()" class="btn-success">Adicionar Pacote</button>
            </div>

            <h3>Pacotes Cadastrados</h3>
            <div id="painelFodaPackagesList"></div>
        `;

        const modal = Components.createModal('painelFodaPackagesModal', `Pacotes - ${resellerName} (PainelFoda)`, modalHtml);
        modal.classList.add('show');
        
        await this.loadPackages();
    },

    async loadPackages() {
        try {
            const packages = await API.admin.getPackages(this.currentResellerId, 'painelfoda');
            const container = document.getElementById('painelFodaPackagesList');
            
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
                        <br>
                        <small>Preço unitário: R$ ${unitPrice}/crédito</small>
                    </div>
                    <button onclick="AdminPainelFodaPackages.deletePackage(${pkg.id})" class="btn-delete-small">
                        🗑️
                    </button>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Erro ao carregar pacotes:', error);
        }
    },

    async addPackage() {
        const credits = parseInt(document.getElementById('painelFodaPackageCredits').value);
        const price = parseFloat(document.getElementById('painelFodaPackagePrice').value);

        if (!credits || !price || credits <= 0 || price <= 0) {
            alert('Preencha os valores corretamente');
            return;
        }

        try {
            await API.admin.createPackage({
                reseller_id: this.currentResellerId,
                reseller_type: 'painelfoda',
                credits: credits,
                price: price
            });

            document.getElementById('painelFodaPackageCredits').value = '';
            document.getElementById('painelFodaPackagePrice').value = '';
            
            await this.loadPackages();
            alert('✅ Pacote adicionado com sucesso!');
        } catch (error) {
            alert('❌ Erro ao adicionar pacote: ' + error.message);
        }
    },

    async deletePackage(packageId) {
        if (!confirm('Deseja excluir este pacote?')) return;

        try {
            await API.admin.deletePackage(packageId);
            await this.loadPackages();
            alert('✅ Pacote excluído com sucesso!');
        } catch (error) {
            alert('❌ Erro ao excluir pacote: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('painelFodaPackagesModal');
        if (modal) {
            modal.remove();
        }
    }
};

window.AdminPainelFodaPackages = AdminPainelFodaPackages;
