// js/client/auth.js - COMPLETO COM TODOS OS PAINÉIS
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
            if (data.success) {
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
            const data = await API.public.verifyReseller(username);
            this.currentReseller = data;
            
            // Salvar sessão no localStorage (com o tipo)
            localStorage.setItem('resellerSession', JSON.stringify(data));
            
            document.getElementById('welcomeUsername').textContent = data.username;
            
            // ✅ MOSTRAR TIPO DO PAINEL COM ÍCONE CORRETO
            let panelTypeLabel;
            if (data.type === 'sigma') {
                panelTypeLabel = '🟢 Sigma';
            } else if (data.type === 'koffice') {
                panelTypeLabel = '🟣 Koffice';
            } else if (data.type === 'gesoffice') {
                panelTypeLabel = '🔵 UNIPLAY';
            } else if (data.type === 'p2bras') {
                panelTypeLabel = '🟠 P2BRAS';
            } else if (data.type === 'rushplay') {
                panelTypeLabel = '🟡 RushPlay';
            } else if (data.type === 'painelfoda') {
                panelTypeLabel = '🟢 PainelFoda';
            }
            
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
                
                // ✅ CORRIGIDO: TODOS OS TIPOS DE PAINÉIS
                let panelTypeLabel;
                if (this.currentReseller.type === 'sigma') {
                    panelTypeLabel = '🟢 Sigma';
                } else if (this.currentReseller.type === 'koffice') {
                    panelTypeLabel = '🟣 Koffice';
                } else if (this.currentReseller.type === 'gesoffice') {
                    panelTypeLabel = '🔵 UNIPLAY';
                } else if (this.currentReseller.type === 'p2bras') {
                    panelTypeLabel = '🟠 P2BRAS';
                } else if (this.currentReseller.type === 'rushplay') {
                    panelTypeLabel = '🟡 RushPlay';
                } else if (this.currentReseller.type === 'painelfoda') {
                    panelTypeLabel = '🟢 PainelFoda';
                }
                
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
