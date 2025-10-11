// js/admin/packages.js
// Gerenciamento de pacotes de créditos

const AdminPackages = {
    currentResellerId: null,
    currentResellerName: null,

    // Abrir modal de pacotes
    async openModal(resellerId, resellerName) {
        this.currentResellerId = resellerId;
        this.currentResellerName = resellerName;
        
        const modalHtml = `
            <div class="modal-header">
                <h2>Gerenciar Pacotes - ${resellerName}</h2>
                <div class="close-modal" onclick="AdminPackages.closeModal()">×</div>
            </div>
            
            <div class="card" style="margin-bottom: 20px;">
                <h3>Adicionar Pacote</h3>
                <div class="form-group">
                    <label>Quantidade de Créditos</label>
                    <input type="number" id="packageCredits" placeholder="Ex: 10">
                </div>
                <div class="form-group">
                    <label>Preço (R$)</label>
                    <input type="number" step="0.01" id="packagePrice" placeholder="Ex: 100.00">
                </div>
                <button onclick="AdminPackages.addPackage()" class="btn-success">Adicionar Pacote</button>
            </div>

            <h3>Pacotes Cadastrados</h3>
            <div id="packagesList"></div>
        `;

        const modal = Components.createModal('packagesModal', `Pacotes - ${resellerName}`, modalHtml);
        modal.classList.add('show');
        
        await this.loadPackages();
    },

    // Carregar lista de pacotes
    async loadPackages() {
        try {
            const packages = await API.admin.getPackages(this.currentResellerId);
            const container = document.getElementById('packagesList');
            
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
                    <button class="btn-danger" onclick="AdminPackages.deletePackage(${pkg.id})">Excluir</button>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Erro ao carregar pacotes:', error);
        }
    },

    // Adicionar pacote
    async addPackage() {
        const credits = document.getElementById('packageCredits').value;
        const price = document.getElementById('packagePrice').value;

        if (!credits || !price) {
            alert('Preencha todos os campos');
            return;
        }

        try {
            await API.admin.createPackage({
                reseller_id: this.currentResellerId,
                credits: parseInt(credits),
                price: parseFloat(price)
            });

            document.getElementById('packageCredits').value = '';
            document.getElementById('packagePrice').value = '';
            await this.loadPackages();
            alert('Pacote adicionado com sucesso!');
        } catch (error) {
            alert('Erro ao adicionar pacote');
        }
    },

    // Excluir pacote
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

    // Fechar modal
    closeModal() {
        const modal = document.getElementById('packagesModal');
        if (modal) modal.classList.remove('show');
    }
};

window.AdminPackages = AdminPackages;
