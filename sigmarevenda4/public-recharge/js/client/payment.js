const ClientPayment = {
    currentPayment: null,
    monitorInterval: null,

    startMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        this.monitorInterval = setInterval(async () => {
            try {
                const data = await API.public.getPaymentStatus(this.currentPayment.payment_id);
                
                if (data.status === 'paid') {
                    this.stopMonitoring();
                    Utils.goToStep(5);
                } else if (data.status === 'expired') {
                    this.stopMonitoring();
                    Utils.showError('Pagamento expirado');
                    Utils.goToStep(3);
                }
            } catch (error) {
                console.error('Erro ao verificar pagamento:', error);
            }
        }, 10000); // 10 segundos
    },

    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    },

    async copyPixCode() {
        const code = document.getElementById('pixCode').textContent;
        const success = await Utils.copyToClipboard(code);
        
        if (success) {
            Utils.showSuccess('Código copiado!');
        } else {
            Utils.showError('Erro ao copiar. Copie manualmente.');
        }
    },

    cancelPayment() {
        this.stopMonitoring();
        Utils.goToStep(3);
    },

    async checkManually(paymentId) {
        try {
            const data = await API.public.checkPayment(paymentId);
            
            if (data.status === 'paid') {
                Utils.showSuccess(data.message);
                setTimeout(() => ClientDashboard.load(), 2000);
            } else {
                Utils.showError(data.message);
            }
        } catch (error) {
            Utils.showError('Erro ao verificar pagamento');
        }
    }
};

window.ClientPayment = ClientPayment;
