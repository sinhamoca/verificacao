// js/admin/p2bras-packages.js
// Gerenciamento de pacotes de créditos P2BRAS (Controle.VIP)

const AdminP2brasPackages = {
    currentResellerId: null,
    currentResellerName: null,

    async openModal(resellerId, resellerName) {
        this.currentResellerId = resellerId;
        this.currentResellerName = resellerName;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Gerenciar Pacotes - ${resellerName} (P2BRAS)</h2>
                <div class="close-modal" onclick="AdminP2brasPackages.closeModal()">×</div>
            </div>
            
            <div class="card" style="margin-bottom: 20px;">
                <h3>Adicionar Pacote</h3>
                <div class="form-group">
                    <label>Quantidade de Créditos</label>
                    <input type="number" id="p2brasPackageCredits" placeholder="Ex: 10">
                </div>
                <div class="form-group">
                    <label>Preço (R$)</label>
                    <input type="number" step="0.01" id="p2brasPackagePrice" placeholder="Ex: 100.00">
                </div>
                <button onclick="AdminP2brasPackages.addPackage()" class="btn-success">Adicionar Pacote</button>
            </div>

            <h3>Pacotes Cadastrados</h3>
            <div id="p2brasPackagesList"></div>
        `;

        const modal = Components.createModal('p2brasPackagesModal', `Pacotes - ${resellerName} (P2BRAS)`, modalHtml);
        modal.classList.add('show');
        
        await this.loadPackages();
    },

    async loadPackages() {
        try {
            const packages = await API.admin.getPackages(this.currentResellerId, 'p2bras');
            const container = document.getElementById('p2brasPackagesList');
            
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
                    <button class="btn-danger" onclick="AdminP2brasPackages.deletePackage(${pkg.id})">Excluir</button>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Erro ao carregar pacotes P2BRAS:', error);
        }
    },

    async addPackage() {
        const credits = document.getElementById('p2brasPackageCredits').value;
        const price = document.getElementById('p2brasPackagePrice').value;

        if (!credits || !price) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            await API.admin.createPackage({
                reseller_id: this.currentResellerId,
                reseller_type: 'p2bras',
                credits: parseInt(credits),
                price: parseFloat(price)
            });

            document.getElementById('p2brasPackageCredits').value = '';
            document.getElementById('p2brasPackagePrice').value = '';
            await this.loadPackages();
            alert('Pacote P2BRAS adicionado com sucesso!');
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
        const modal = document.getElementById('p2brasPackagesModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminP2brasPackages = AdminP2brasPackages;
