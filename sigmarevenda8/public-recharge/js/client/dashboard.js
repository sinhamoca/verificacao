// js/client/dashboard.js - COM SUPORTE KOFFICE
const ClientDashboard = {
    async load() {
        try {
            // Passar o tipo (sigma ou koffice)
            const data = await API.public.getDashboard(
                ClientAuth.currentReseller.id, 
                ClientAuth.currentReseller.type
            );
            
            const errorCount = data.payments.filter(p => p.status === 'error' || p.status === 'expired').length;
            
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
                        <strong style="color: #856404;">⚠️ Você tem ${errorCount} pagamento(s) para reprocessar</strong>
                        <p style="color: #856404; margin: 10px 0 0 0; font-size: 14px;">
                            Pagamentos aprovados mas com erro ao adicionar créditos. Reprocesse individualmente ou todos de uma vez.
                        </p>
                        <button onclick="ClientDashboard.retryAllErrors()" 
                                id="retryAllBtn"
                                style="margin-top: 10px; padding: 10px 20px; background: #ff9800; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            🔄 Reprocessar Todos (${errorCount})
                        </button>
                    </div>
                ` : ''}
            `;
            document.getElementById('dashboardStats').innerHTML = statsHtml;

            const paymentsContainer = document.getElementById('dashboardPayments');
            paymentsContainer.innerHTML = '';

            if (data.payments.length === 0) {
                paymentsContainer.innerHTML = '<p style="text-align: center; color: #888;">Nenhuma compra realizada</p>';
            } else {
                data.payments.forEach(payment => {
                    const date = new Date(payment.created_at).toLocaleString('pt-BR');
                    const statusColors = {
                        'paid': '#4caf50',
                        'pending': '#ff9800',
                        'expired': '#f44336',
                        'error': '#ff5722'
                    };
                    const statusTexts = {
                        'paid': 'Pago',
                        'pending': 'Pendente',
                        'expired': 'Expirado',
                        'error': 'Erro na Recarga'
                    };
                    const statusColor = statusColors[payment.status] || '#888';
                    const statusText = statusTexts[payment.status] || payment.status;
                    
                    const paymentCard = document.createElement('div');
                    paymentCard.style.cssText = 'background: #f8f9ff; padding: 15px; border-radius: 8px; margin-bottom: 10px;';
                    paymentCard.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${payment.credits} créditos</strong><br>
                                <small style="color: #888;">${date}</small>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: ${statusColor}; font-weight: bold; margin-bottom: 5px;">${statusText}</div>
                                <div style="margin-bottom: 8px;">R$ ${payment.amount.toFixed(2)}</div>
                                ${payment.status === 'pending' ? `
                                    <button onclick="ClientPayment.checkManually(${payment.id})" style="padding: 6px 12px; font-size: 12px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                        Verificar Pagamento
                                    </button>
                                ` : ''}
                                ${payment.status === 'error' || payment.status === 'expired' ? `
                                    <button onclick="ClientDashboard.retryRecharge(${payment.id})" 
                                            id="retryBtn${payment.id}"
                                            style="padding: 6px 12px; font-size: 12px; background: #ff9800; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                                        🔄 Reprocessar
                                    </button>
                                ` : ''}
                            </div>
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

    async retryRecharge(paymentId) {
        const btn = document.getElementById(`retryBtn${paymentId}`);
        if (!btn) return;

        if (!confirm('Reprocessar esta recarga?\n\nO sistema tentará adicionar os créditos novamente.')) {
            return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processando...';

        try {
            const result = await API.public.retryRecharge(paymentId);

            if (result.success) {
                alert('✅ ' + result.message);
                setTimeout(() => this.load(), 2000);
            } else {
                alert('❌ ' + result.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            alert('Erro: ' + error.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    },

    async retryAllErrors() {
        const btn = document.getElementById('retryAllBtn');
        if (!btn) return;

        if (!confirm('ATENÇÃO!\n\nReprocessar TODAS as recargas com erro/expiradas?\n\nIsso pode levar alguns minutos.\n\nContinuar?')) {
            return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processando...';

        try {
            // Passar o tipo correto
            const result = await API.public.retryAllErrors(
                ClientAuth.currentReseller.id,
                ClientAuth.currentReseller.type
            );

            if (result.success) {
                alert(`✅ Concluído!\n\nTotal: ${result.total}\nSucesso: ${result.succeeded}\nFalha: ${result.failed}`);
                setTimeout(() => this.load(), 1000);
            } else {
                alert('❌ ' + result.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            alert('❌ Erro: ' + error.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

window.ClientDashboard = ClientDashboard;
