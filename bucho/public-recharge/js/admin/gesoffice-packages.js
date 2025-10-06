// js/admin/gesoffice-packages.js
// Gerenciamento de pacotes de créditos GesOffice (UNIPLAY)

const AdminGesOfficePackages = {
    currentResellerId: null,
    currentResellerName: null,

    async openModal(resellerId, resellerName) {
        this.currentResellerId = resellerId;
        this.currentResellerName = resellerName;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Gerenciar Pacotes - ${resellerName} (UNIPLAY)</h2>
                <div class="close-modal" onclick="AdminGesOfficePackages.closeModal()">×</div>
            </div>
            
            <div class="card" style="margin-bottom: 20px;">
                <h3>Adicionar Pacote</h3>
                <div class="form-group">
                    <label>Quantidade de Créditos</label>
                    <input type="number" id="gesofficePackageCredits" placeholder="Ex: 10">
                </div>
                <div class="form-group">
                    <label>Preço (R$)</label>
                    <input type="number" step="0.01" id="gesofficePackagePrice" placeholder="Ex: 100.00">
                </div>
                <button onclick="AdminGesOfficePackages.addPackage()" class="btn-success">Adicionar Pacote</button>
            </div>

            <h3>Pacotes Cadastrados</h3>
            <div id="gesofficePackagesList"></div>
        `;

        const modal = Components.createModal('gesofficePackagesModal', `Pacotes - ${resellerName} (UNIPLAY)`, modalHtml);
        modal.classList.add('show');
        
        await this.loadPackages();
    },

    async loadPackages() {
        try {
            const packages = await API.admin.getPackages(this.currentResellerId, 'gesoffice');
            const container = document.getElementById('gesofficePackagesList');
            
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
                        <br><small style="color: #888;">R$ ${unitPrice} por crédito</small>
                    </div>
                    <button class="btn-danger" onclick="AdminGesOfficePackages.deletePackage(${pkg.id})">Excluir</button>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Erro ao carregar pacotes GesOffice:', error);
        }
    },

    async addPackage() {
        const credits = document.getElementById('gesofficePackageCredits').value;
        const price = document.getElementById('gesofficePackagePrice').value;

        if (!credits || !price) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            await API.admin.createPackage({
                reseller_id: this.currentResellerId,
                reseller_type: 'gesoffice',
                credits: parseInt(credits),
                price: parseFloat(price)
            });

            document.getElementById('gesofficePackageCredits').value = '';
            document.getElementById('gesofficePackagePrice').value = '';
            await this.loadPackages();
            alert('Pacote UNIPLAY adicionado com sucesso!');
        } catch (error) {
            alert('Erro ao adicionar pacote');
        }
    },

    async deletePackage(id) {
        if (!confirm('Tem certeza que deseja excluir este pacote?')) return;

        try {
            await API.admin.deletePackage(id);
            await this.loadPackages();
            alert('Pacote excluído com sucesso!');
        } catch (error) {
            alert('Erro ao excluir pacote');
        }
    },

    closeModal() {
        const modal = document.getElementById('gesofficePackagesModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminGesOfficePackages = AdminGesOfficePackages;
