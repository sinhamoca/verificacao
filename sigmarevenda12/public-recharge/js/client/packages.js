// js/client/packages.js - COM SUPORTE KOFFICE
const ClientPackages = {
    selectedPackage: null,

    async loadPackages(resellerId, type) {
        try {
            const packages = await API.public.getPackages(resellerId, type);
            const container = document.getElementById('packagesList');
            container.innerHTML = '';

            if (packages.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #888;">Nenhum pacote disponível</p>';
                return;
            }

            packages.forEach(pkg => {
                const card = Components.createPackageCard(pkg, this.selectPackage.bind(this));
                container.appendChild(card);
            });
        } catch (error) {
            Utils.showError('Erro ao carregar pacotes');
        }
    },

    selectPackage(pkg, cardElement) {
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        this.selectedPackage = pkg;
        document.getElementById('selectPackageBtn').disabled = false;
    },

    async proceedToPayment() {
        if (!this.selectedPackage) {
            Utils.showError('Selecione um pacote');
            return;
        }

        try {
            // Passar o tipo do revendedor (sigma ou koffice)
            const payment = await API.public.createPayment(
                ClientAuth.currentReseller.id,
                this.selectedPackage.id,
                ClientAuth.currentReseller.type // NOVO: passa sigma ou koffice
            );

            ClientPayment.currentPayment = payment;
            document.getElementById('paymentCredits').textContent = payment.credits;
            document.getElementById('paymentAmount').textContent = payment.amount.toFixed(2);
            document.getElementById('qrCodeImage').src = `data:image/png;base64,${payment.qr_code_base64}`;
            document.getElementById('pixCode').textContent = payment.qr_code;

            Utils.goToStep(4);
            ClientPayment.startMonitoring();
        } catch (error) {
            Utils.showError(error.message || 'Erro ao criar pagamento');
        }
    }
};

window.ClientPackages = ClientPackages;
