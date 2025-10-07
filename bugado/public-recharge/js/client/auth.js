// js/client/auth.js - VERSÃO CORRIGIDA COMPLETA
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
            
            // CORREÇÃO: Usar data.reseller
            this.currentReseller = data.reseller;
            
            // Salvar sessão no localStorage
            localStorage.setItem('resellerSession', JSON.stringify(data.reseller));
            
            // Atualizar interface
            document.getElementById('welcomeUsername').textContent = data.reseller.username;
            
            // Mostrar tipo do painel
            let panelTypeLabel;
            if (data.reseller.type === 'sigma') {
                panelTypeLabel = '🟢 Sigma';
            } else if (data.reseller.type === 'koffice') {
                panelTypeLabel = '🟣 Koffice';
            } else if (data.reseller.type === 'gesoffice') {
                panelTypeLabel = '🔵 UNIPLAY';
            }
            
            document.getElementById('welcomePanel').textContent = `${data.reseller.panel_name} (${panelTypeLabel})`;
            
            console.log(`✅ Login: ${data.reseller.username} (${data.reseller.type})`);
            
            // Carregar pacotes (SEM parâmetros - a função usa this.currentReseller)
            await ClientPackages.loadPackages();
            
            Utils.goToStep(3);
        } catch (error) {
            Utils.showError(error.message || 'Erro ao fazer login');
        }
    },

    logout() {
        this.currentReseller = null;
        ClientPackages.selectedPackage = null;
        
        if (typeof ClientPayment !== 'undefined') {
            ClientPayment.currentPayment = null;
            ClientPayment.stopMonitoring();
        }
        
        localStorage.removeItem('resellerSession');
        
        Utils.goToStep(1);
    },

    checkSession() {
        const sessionData = localStorage.getItem('resellerSession');
        
        if (!sessionData) {
            return;
        }
        
        try {
            const reseller = JSON.parse(sessionData);
            
            // Validar estrutura dos dados
            if (!reseller.id || !reseller.username || !reseller.type) {
                console.warn('Sessão inválida - dados incompletos');
                localStorage.removeItem('resellerSession');
                return;
            }
            
            this.currentReseller = reseller;
            
            // Restaurar interface
            document.getElementById('welcomeUsername').textContent = reseller.username;
            
            // Mostrar tipo do painel
            let panelTypeLabel;
            if (reseller.type === 'sigma') {
                panelTypeLabel = '🟢 Sigma';
            } else if (reseller.type === 'koffice') {
                panelTypeLabel = '🟣 Koffice';
            } else if (reseller.type === 'gesoffice') {
                panelTypeLabel = '🔵 UNIPLAY';
            }
            
            document.getElementById('welcomePanel').textContent = `${reseller.panel_name} (${panelTypeLabel})`;
            
            console.log(`✅ Sessão restaurada: ${reseller.username} (${reseller.type})`);
            
            // Carregar pacotes (SEM parâmetros)
            ClientPackages.loadPackages();
            
            Utils.goToStep(3);
            
        } catch (error) {
            console.error('Erro ao restaurar sessão:', error);
            localStorage.removeItem('resellerSession');
        }
    }
};

window.ClientAuth = ClientAuth;