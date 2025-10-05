// js/client/auth.js - COM DETECÇÃO AUTOMÁTICA SIGMA/KOFFICE
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
            
            // Salvar sessão no localStorage (com o tipo)
            localStorage.setItem('resellerSession', JSON.stringify(data));
            
            document.getElementById('welcomeUsername').textContent = data.username;
            
            // Mostrar tipo do painel
            const panelTypeLabel = data.type === 'sigma' ? '🟢 Sigma' : '🟣 Koffice';
            document.getElementById('welcomePanel').textContent = `${data.panel_name} (${panelTypeLabel})`;
            
            // Carregar pacotes com o tipo correto
            await ClientPackages.loadPackages(data.id, data.type);
            Utils.goToStep(3);
            
            console.log(`✅ Login: ${username} (${data.type})`);
        } catch (error) {
            Utils.showError('Revendedor não encontrado');
        }
    },

    logout() {
        this.currentReseller = null;
        ClientPackages.selectedPackage = null;
        ClientPayment.currentPayment = null;
        ClientPayment.stopMonitoring();
        
        localStorage.removeItem('resellerSession');
        
        Utils.goToStep(1);
    },

    checkSession() {
        const sessionData = localStorage.getItem('resellerSession');
        
        if (sessionData) {
            try {
                this.currentReseller = JSON.parse(sessionData);
                
                // Restaurar interface
                document.getElementById('welcomeUsername').textContent = this.currentReseller.username;
                
                const panelTypeLabel = this.currentReseller.type === 'sigma' ? '🟢 Sigma' : '🟣 Koffice';
                document.getElementById('welcomePanel').textContent = `${this.currentReseller.panel_name} (${panelTypeLabel})`;
                
                // Carregar pacotes com o tipo correto
                ClientPackages.loadPackages(this.currentReseller.id, this.currentReseller.type);
                Utils.goToStep(3);
                
                console.log(`✅ Sessão restaurada: ${this.currentReseller.username} (${this.currentReseller.type})`);
            } catch (error) {
                console.error('❌ Erro ao restaurar sessão:', error);
                localStorage.removeItem('resellerSession');
            }
        }
    }
};

window.ClientAuth = ClientAuth;
