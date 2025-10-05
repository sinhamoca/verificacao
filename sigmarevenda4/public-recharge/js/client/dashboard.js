// js/client/dashboard.js
const ClientDashboard = {
    async load() {
        try {
            const data = await API.public.getDashboard(ClientAuth.currentReseller.id);
            
            // Contar quantos pagamentos com erro
            const errorCount = data.payments.filter(p => p.status === 'error').length;
            
            // Estatísticas
            const statsHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div class="stat-card">
                        <div class="number">${data.stats.total_credits || 0}</div>
                        <div class="label">Créditos Comprados</div>
                    </div>
                    <div class="stat-card">
                        <div class="number">R$ ${(data.stats.total_spent || 0).toFixed(2)}</div>
                        <div class="label">Total Gasto</div>
                    </div>
                </div>
                ${errorCount > 0 ? `
                    <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <strong style="color: #856404;">⚠️ ${errorCount} pagamento(s) com erro na recarga</strong>
                        <br>
                        <button onclick="ClientDashboard.retryAllErrors()" 
                                id="retryAllBtn"
                                style="margin-top: 10px; padding: 10px 20px; background: #ff9800; width: auto;">
                            🔄 Reprocessar Todos os Erros
                        </button>
                    </div>
                ` : ''}
            `;
            document.getElementById('dashboardStats').innerHTML = statsHtml;

            // Pagamentos
            const paymentsContainer = document.getElementById('dashboardPayments');
            paymentsContainer.innerHTML = '';

            if (data.payments.length === 0) {
                paymentsContainer.innerHTML = '<p style="text-align: center; color: #888;">Nenhuma compra realizada</p>';
            } else {
                data.payments.forEach(payment => {
                    const date = Utils.formatDate(payment.created_at);
                    const statusBadge = Components.createStatusBadge(payment.status);
                    
                    const paymentCard = document.createElement('div');
                    paymentCard.className = 'package-item';
                    paymentCard.innerHTML = `
                        <div>
                            <strong>${payment.credits} créditos</strong><br>
                            <small style="color: #888;">${date}</small>
                        </div>
                        <div style="text-align: right;">
                            ${statusBadge}
                            <div>R$ ${payment.amount.toFixed(2)}</div>
                            ${payment.status === 'pending' ? `
                                <button onclick="ClientPayment.checkManually(${payment.id})" 
                                        style="margin-top: 5px; padding: 5px 10px; font-size: 12px;">
                                    Verificar Pagamento
                                </button>
                            ` : ''}
                            ${payment.status === 'error' ? `
                                <button onclick="ClientDashboard.retryRecharge(${payment.id})" 
                                        id="retryBtn${payment.id}"
                                        style="margin-top: 5px; padding: 5px 10px; font-size: 12px; background: #ff9800;">
                                    Reprocessar Recarga
                                </button>
                            ` : ''}
                        </div>
                    `;
                    paymentsContainer.appendChild(paymentCard);
                });
            }

            Utils.goToStep(6);
        } catch (error) {
            Utils.showError('Erro ao carregar dashboard');
        }
    },

    // Retry de recarga individual
    async retryRecharge(paymentId) {
        const btn = document.getElementById(`retryBtn${paymentId}`);
        if (!btn) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processando...';

        try {
            const result = await API.public.retryRecharge(paymentId);

            if (result.success) {
                Utils.showSuccess(result.message);
                setTimeout(() => this.load(), 2000);
            } else {
                Utils.showError(result.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            Utils.showError('Erro ao reprocessar recarga');
            btn.disabled = false;
            btn.textContent = originalText;
        }
    },

    // NOVA FUNÇÃO: Retry de todos os pagamentos com erro
    async retryAllErrors() {
        const btn = document.getElementById('retryAllBtn');
        if (!btn) return;

        if (!confirm('Deseja reprocessar TODAS as recargas com erro? Isso pode levar alguns minutos.')) {
            return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Processando...';

        try {
            const result = await API.public.retryAllErrors(ClientAuth.currentReseller.id);

            if (result.success) {
                const message = `✅ ${result.message}\n\n` +
                               `Total: ${result.total}\n` +
                               `Sucesso: ${result.succeeded}\n` +
                               `Falha: ${result.failed}`;
                
                alert(message);
                
                // Recarregar dashboard
                setTimeout(() => this.load(), 1000);
            } else {
                alert('❌ ' + result.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            alert('❌ Erro ao reprocessar: ' + error.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

window.ClientDashboard = ClientDashboard;
