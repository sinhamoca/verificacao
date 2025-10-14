// js/admin/dashboard.js - COM EXIBIÇÃO DE EXPIRAÇÃO DO TENANT

const AdminDashboard = {
    async load() {
        try {
            const stats = await API.admin.getStats();
            this.renderStats(stats);
            this.loadRecentTransactions();
            this.showTenantExpiration(); // ⭐ NOVO
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
        }
    },

    // ⭐ NOVO: Exibir informações de expiração do tenant
    showTenantExpiration() {
        const adminData = localStorage.getItem('adminData');
        if (!adminData) return;

        try {
            const admin = JSON.parse(adminData);
            const expiresAt = admin.tenant_expires_at;

            if (!expiresAt) {
                // Sem data de expiração
                this.renderExpirationBanner(null, 'unlimited');
                return;
            }

            // Calcular dias restantes
            const now = new Date();
            const expireDate = new Date(expiresAt);
            const diffTime = expireDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            this.renderExpirationBanner(expiresAt, diffDays);
        } catch (error) {
            console.error('Erro ao verificar expiração:', error);
        }
    },

    renderExpirationBanner(expiresAt, daysOrStatus) {
        const topBar = document.querySelector('.top-bar-left');
        if (!topBar) return;

        // Remover banner antigo se existir
        const oldBanner = document.getElementById('expirationBanner');
        if (oldBanner) oldBanner.remove();

        let bannerHTML = '';
        let bannerClass = '';
        let icon = '';
        let message = '';

        if (daysOrStatus === 'unlimited') {
            // Sem expiração
            bannerClass = 'expiration-unlimited';
            icon = '♾️';
            message = 'Acesso Ilimitado';
        } else if (daysOrStatus <= 0) {
            // Expirado
            bannerClass = 'expiration-expired';
            icon = '🔒';
            message = `Sistema Expirado`;
        } else if (daysOrStatus <= 7) {
            // Próximo de expirar (7 dias ou menos) - SEM DATA
            bannerClass = 'expiration-critical';
            icon = '⚠️';
            message = `Expira em ${daysOrStatus} dia${daysOrStatus > 1 ? 's' : ''}`;
        } else if (daysOrStatus <= 30) {
            // Atenção (30 dias ou menos) - SEM DATA
            bannerClass = 'expiration-warning';
            icon = '⏰';
            message = `Expira em ${daysOrStatus} dias`;
        } else {
            // Mais de 30 dias - SEM DATA
            bannerClass = 'expiration-ok';
            icon = '✅';
            message = `Expira em ${daysOrStatus} dias`;
        }

        bannerHTML = `
            <div id="expirationBanner" class="expiration-banner ${bannerClass}">
                <span class="expiration-icon">${icon}</span>
                <span class="expiration-message">${message}</span>
            </div>
        `;

        topBar.insertAdjacentHTML('afterend', bannerHTML);
    },

    renderStats(stats) {
        const statsGrid = document.getElementById('statsGrid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="number">${stats.active_panels || 0}</div>
                <div class="label">Painéis Ativos (Total)</div>
                <small style="color: #888; font-size: 12px;">
                    🟢 ${stats.active_sigma_panels || 0} Sigma | 
                    🟣 ${stats.active_koffice_panels || 0} Koffice | 
                    🔵 ${stats.active_gesoffice_panels || 0} UNIPLAY<br>
                    🟠 ${stats.active_p2bras_panels || 0} P2BRAS | 
                    🔴 ${stats.active_rushplay_resellers || 0} RushPlay | 
                    ⚫ ${stats.active_painelfoda_resellers || 0} PainelFoda | 
                    🟡 ${stats.active_dashboardbz_resellers || 0} DashboardBz
                </small>
            </div>
            <div class="stat-card">
                <div class="number">${stats.active_resellers || 0}</div>
                <div class="label">Revendedores Ativos (Total)</div>
                <small style="color: #888; font-size: 12px;">
                    🟢 ${stats.active_sigma_resellers || 0} Sigma | 
                    🟣 ${stats.active_koffice_resellers || 0} Koffice | 
                    🔵 ${stats.active_gesoffice_resellers || 0} UNIPLAY<br>
                    🟠 ${stats.active_p2bras_resellers || 0} P2BRAS | 
                    🔴 ${stats.active_rushplay_resellers || 0} RushPlay | 
                    ⚫ ${stats.active_painelfoda_resellers || 0} PainelFoda | 
                    🟡 ${stats.active_dashboardbz_resellers || 0} DashboardBz
                </small>
            </div>
            <div class="stat-card">
                <div class="number">${stats.total_payments || 0}</div>
                <div class="label">Total de Pagamentos</div>
            </div>
            <div class="stat-card">
                <div class="number">R$ ${(stats.total_revenue || 0).toFixed(2)}</div>
                <div class="label">Receita Total</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.total_credits_sold || 0}</div>
                <div class="label">Créditos Vendidos</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.pending_payments || 0}</div>
                <div class="label">Pagamentos Pendentes</div>
            </div>
        `;
    },

    async loadRecentTransactions() {
        try {
            const transactions = await API.admin.getTransactions();
            const container = document.getElementById('recentTransactions');
            
            if (transactions.length === 0) {
                container.innerHTML = '<div class="empty-state">Nenhuma transação registrada</div>';
                return;
            }

            container.innerHTML = '';
            transactions.slice(0, 5).forEach(transaction => {
                const date = new Date(transaction.created_at).toLocaleDateString('pt-BR');
                const item = document.createElement('div');
                item.className = 'package-item';
                item.innerHTML = `
                    <div>
                        <strong>${transaction.username}</strong><br>
                        <small>${transaction.credits} créditos - R$ ${transaction.amount.toFixed(2)}</small>
                    </div>
                    <div style="text-align: right;">
                        <small>${date}</small>
                    </div>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Erro ao carregar transações:', error);
        }
    },

    async loadConfig() {
        try {
            const configs = await API.admin.getConfig();
            
            configs.forEach(config => {
                if (config.key === 'access_question') {
                    document.getElementById('accessQuestion').value = config.value;
                } else if (config.key === 'mp_access_token') {
                    document.getElementById('mpAccessToken').value = config.value;
                } else if (config.key === 'anticaptcha_api_key') {
                    document.getElementById('anticaptchaApiKey').value = config.value;
                } else if (config.key === '2captcha_api_key') {
                    document.getElementById('captcha2ApiKey').value = config.value;
                }
            });
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    },

    async saveConfig() {
        try {
            const question = document.getElementById('accessQuestion').value;
            const answer = document.getElementById('accessAnswer').value;
            const mpToken = document.getElementById('mpAccessToken').value;
            const anticaptchaKey = document.getElementById('anticaptchaApiKey').value;
            const captcha2Key = document.getElementById('captcha2ApiKey').value;

            await API.admin.updateConfig('access_question', question);
            
            if (answer) {
                await API.admin.updateConfig('access_answer', answer);
            }
            
            await API.admin.updateConfig('mp_access_token', mpToken);
            await API.admin.updateConfig('anticaptcha_api_key', anticaptchaKey);
            await API.admin.updateConfig('2captcha_api_key', captcha2Key);

            alert('Configurações salvas com sucesso!');
            document.getElementById('accessAnswer').value = '';
        } catch (error) {
            alert('Erro ao salvar configurações');
        }
    }
};

window.AdminDashboard = AdminDashboard;
