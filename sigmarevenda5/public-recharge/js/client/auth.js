// js/client/auth.js - COM PERSISTÊNCIA DE SESSÃO
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
            
            // ✅ NOVO: Salvar sessão no localStorage
            localStorage.setItem('resellerSession', JSON.stringify(data));
            
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
        
        // ✅ NOVO: Limpar sessão do localStorage
        localStorage.removeItem('resellerSession');
        
        Utils.goToStep(1);
    },

    // ✅ NOVO: Verificar sessão ao carregar página
    checkSession() {
        const sessionData = localStorage.getItem('resellerSession');
        
        if (sessionData) {
            try {
                this.currentReseller = JSON.parse(sessionData);
                
                // Restaurar interface
                document.getElementById('welcomeUsername').textContent = this.currentReseller.username;
                document.getElementById('welcomePanel').textContent = this.currentReseller.panel_name;
                
                // Carregar pacotes e ir para step 3
                ClientPackages.loadPackages(this.currentReseller.id);
                Utils.goToStep(3);
                
                console.log('✅ Sessão restaurada:', this.currentReseller.username);
            } catch (error) {
                console.error('❌ Erro ao restaurar sessão:', error);
                localStorage.removeItem('resellerSession');
            }
        }
    }
};

window.ClientAuth = ClientAuth;
