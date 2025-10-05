const ClientAuth = {
    currentReseller: null,

    async verifyAccess() {
        const answer = document.getElementById('accessAnswer').value;
        if (!answer) {
            Utils.showError('Digite a resposta');
            return;
        }

        try {
            const data = await API.public.verifyAccess(answer);
            if (data.valid) {
                Utils.goToStep(2);
            } else {
                Utils.showError('Resposta incorreta');
            }
        } catch (error) {
            Utils.showError('Erro ao verificar acesso');
        }
    },

    async login() {
        const username = document.getElementById('resellerUsername').value;
        if (!username) {
            Utils.showError('Digite o username');
            return;
        }

        try {
            const data = await API.public.login(username);
            this.currentReseller = data;
            
            document.getElementById('welcomeUsername').textContent = data.username;
            document.getElementById('welcomePanel').textContent = data.panel_name;
            
            await ClientPackages.loadPackages(data.id);
            Utils.goToStep(3);
        } catch (error) {
            Utils.showError('Revendedor não encontrado');
        }
    },

    logout() {
        this.currentReseller = null;
        ClientPackages.selectedPackage = null;
        ClientPayment.currentPayment = null;
        ClientPayment.stopMonitoring();
        Utils.goToStep(1);
    }
};

window.ClientAuth = ClientAuth;
