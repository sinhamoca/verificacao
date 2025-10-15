// js/admin/rushplay-packages.js
// Gerenciamento de pacotes de créditos RushPlay

const AdminRushPlayPackages = {
    currentResellerId: null,
    currentResellerUsername: null,
    currentEditingId: null,

    async openModal(resellerId, resellerUsername) {
        this.currentResellerId = resellerId;
        this.currentResellerUsername = resellerUsername;
        this.currentEditingId = null;

        const packages = await API.admin.getPackages(resellerId, 'rushplay');
        
        const packagesHtml = packages.length > 0 ? packages.map(pkg => `
            <tr>
                <td>${pkg.credits}</td>
                <td>R$ ${pkg.price.toFixed(2)}</td>
                <td class="actions">
                    <button onclick="AdminRushPlayPackages.editPackage(${pkg.id})">Editar</button>
                    <button class="btn-danger" onclick="AdminRushPlayPackages.deletePackage(${pkg.id})">Excluir</button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="3" style="text-align: center; color: #888;">Nenhum pacote cadastrado</td></tr>';

        const modalHtml = `
            <div class="modal-header">
                <h2>Pacotes de Créditos - ${resellerUsername}</h2>
                <div class="close-modal" onclick="AdminRushPlayPackages.closeModal()">×</div>
            </div>

            <div style="margin-bottom: 20px;">
                <table style="width: 100%;">
                    <thead>
                        <tr>
                            <th>Créditos</th>
                            <th>Preço</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${packagesHtml}
                    </tbody>
                </table>
            </div>

            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">

            <h3>Adicionar/Editar Pacote</h3>
            <div class="form-group">
                <label>Quantidade de Créditos</label>
                <input type="number" id="rushplayPackageCredits" placeholder="Ex: 10">
            </div>
            <div class="form-group">
                <label>Preço (R$)</label>
                <input type="number" step="0.01" id="rushplayPackagePrice" placeholder="Ex: 5.00">
            </div>
            <button onclick="AdminRushPlayPackages.savePackage()">
                ${this.currentEditingId ? 'Atualizar Pacote' : 'Adicionar Pacote'}
            </button>
            ${this.currentEditingId ? '<button class="btn-secondary" onclick="AdminRushPlayPackages.cancelEdit()">Cancelar Edição</button>' : ''}
        `;

        const modal = Components.createModal('rushplayPackagesModal', 'Pacotes RushPlay', modalHtml);
        modal.classList.add('show');
    },

    async editPackage(packageId) {
        const packages = await API.admin.getPackages(this.currentResellerId, 'rushplay');
        const pkg = packages.find(p => p.id === packageId);
        
        if (!pkg) return;

        this.currentEditingId = packageId;

        document.getElementById('rushplayPackageCredits').value = pkg.credits;
        document.getElementById('rushplayPackagePrice').value = pkg.price;

        // Refresh modal to show cancel button
        this.openModal(this.currentResellerId, this.currentResellerUsername);
        
        // Re-set values (modal refresh clears them)
        setTimeout(() => {
            document.getElementById('rushplayPackageCredits').value = pkg.credits;
            document.getElementById('rushplayPackagePrice').value = pkg.price;
        }, 100);
    },

    cancelEdit() {
        this.currentEditingId = null;
        document.getElementById('rushplayPackageCredits').value = '';
        document.getElementById('rushplayPackagePrice').value = '';
        this.openModal(this.currentResellerId, this.currentResellerUsername);
    },

    async savePackage() {
        const credits = parseInt(document.getElementById('rushplayPackageCredits').value);
        const price = parseFloat(document.getElementById('rushplayPackagePrice').value);

        if (!credits || credits <= 0) {
            alert('Informe uma quantidade válida de créditos');
            return;
        }

        if (!price || price <= 0) {
            alert('Informe um preço válido');
            return;
        }

        const data = {
            reseller_id: this.currentResellerId,
            reseller_type: 'rushplay',
            credits: credits,
            price: price
        };

        try {
            if (this.currentEditingId) {
                await API.admin.updatePackage(this.currentEditingId, { credits, price });
                alert('Pacote atualizado com sucesso!');
            } else {
                await API.admin.createPackage(data);
                alert('Pacote criado com sucesso!');
            }

            this.currentEditingId = null;
            document.getElementById('rushplayPackageCredits').value = '';
            document.getElementById('rushplayPackagePrice').value = '';
            
            // Refresh modal
            this.openModal(this.currentResellerId, this.currentResellerUsername);
        } catch (error) {
            alert('Erro ao salvar pacote: ' + error.message);
        }
    },

    async deletePackage(packageId) {
        if (!confirm('Tem certeza que deseja excluir este pacote?')) return;

        try {
            await API.admin.deletePackage(packageId);
            alert('Pacote excluído com sucesso!');
            this.openModal(this.currentResellerId, this.currentResellerUsername);
        } catch (error) {
            alert('Erro ao excluir pacote: ' + error.message);
        }
    },

    closeModal() {
        const modal = document.getElementById('rushplayPackagesModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
        this.currentResellerId = null;
        this.currentResellerUsername = null;
        this.currentEditingId = null;
    }
};

window.AdminRushPlayPackages = AdminRushPlayPackages;
