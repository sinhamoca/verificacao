// js/admin/dashboard.js
// Dashboard administrativo

const AdminDashboard = {
    // Carregar dashboard
    async load() {
        try {
            const stats = await API.admin.getStats();
            this.renderStats(stats);
            this.loadRecentTransactions();
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
        }
    },

    // Renderizar estatísticas
    renderStats(stats) {
        const statsGrid = document.getElementById('statsGrid');
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="number">${stats.active_panels || 0}</div>
                <div class="label">Painéis Ativos</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.active_resellers || 0}</div>
                <div class="label">Revendedores Ativos</div>
            </div>
            <div class="stat-card">
                <div class="number">${stats.total_payments || 0}</div>
                <div class="label">Pagamentos Realizados</div>
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

    // Carregar transações recentes
    async loadRecentTransactions() {
        try {
            const transactions = await API.admin.getTransactions();
            const container = document.getElementById('recentTransactions');
            
            if (transactions.length === 0) {
                container.innerHTML = '<div class="empty-state">Nenhuma transação registrada</div>';
                return;
            }

            container.innerHTML = '';
            transactions.slice(0, 5).forEach(tx => {
                const date = Utils.formatDate(tx.created_at);
                const item = document.createElement('div');
                item.className = 'package-item';
                item.innerHTML = `
                    <div>
                        <strong>${tx.username}</strong> - ${tx.credits} créditos
                        <br><small style="color: #888;">${date}</small>
                    </div>
                    <div style="text-align: right;">
                        <strong style="color: #4caf50;">R$ ${tx.amount.toFixed(2)}</strong>
                    </div>
                `;
                container.appendChild(item);
            });
        } catch (error) {
            console.error('Erro ao carregar transações:', error);
        }
    },

    // Carregar configurações
    async loadConfig() {
        try {
            const configs = await API.admin.getConfig();
            
            configs.forEach(config => {
                if (config.key === 'access_question') {
                    document.getElementById('accessQuestion').value = config.value;
                } else if (config.key === 'mp_access_token') {
                    document.getElementById('mpAccessToken').value = config.value;
                }
            });
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    },

    // Salvar configurações
    async saveConfig() {
        try {
            const question = document.getElementById('accessQuestion').value;
            const answer = document.getElementById('accessAnswer').value;
            const mpToken = document.getElementById('mpAccessToken').value;

            await API.admin.updateConfig('access_question', question);
            
            if (answer) {
                await API.admin.updateConfig('access_answer', answer);
            }
            
            await API.admin.updateConfig('mp_access_token', mpToken);

            alert('Configurações salvas com sucesso!');
            document.getElementById('accessAnswer').value = '';
        } catch (error) {
            alert('Erro ao salvar configurações');
        }
    }
};

window.AdminDashboard = AdminDashboard;
