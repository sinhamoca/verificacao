// public-recharge/js/client/dashboard.js
// VERSÃO CORRIGIDA - recent_payments ao invés de payments

const ClientDashboard = {
    async load() {
        console.log('🔍 [Dashboard] Iniciando carregamento...');
        
        try {
            // Verificar se temos revendedor logado
            if (!ClientAuth.currentReseller) {
                console.error('❌ [Dashboard] Nenhum revendedor logado!');
                Utils.showError('Erro: Sessão inválida');
                Utils.goToStep(1);
                return;
            }

            console.log('✓ [Dashboard] Revendedor:', ClientAuth.currentReseller);
            console.log('✓ [Dashboard] ID:', ClientAuth.currentReseller.id);
            console.log('✓ [Dashboard] Tipo:', ClientAuth.currentReseller.type);

            // Fazer chamada à API
            console.log('📡 [Dashboard] Chamando API...');
            const data = await API.public.getDashboard(
                ClientAuth.currentReseller.id, 
                ClientAuth.currentReseller.type
            );
            
            console.log('✓ [Dashboard] Dados recebidos:', data);

            // ✅ CORREÇÃO: Backend retorna "recent_payments", não "payments"
            if (!data || !data.stats || !data.recent_payments) {
                console.error('❌ [Dashboard] Estrutura de dados inválida:', data);
                throw new Error('Dados do dashboard incompletos');
            }

            console.log('✓ [Dashboard] Stats:', data.stats);
            console.log('✓ [Dashboard] Payments:', data.recent_payments.length, 'pagamentos');
            
            // ✅ CORREÇÃO: Usar recent_payments
            const errorCount = data.recent_payments.filter(p => p.status === 'error' || p.status === 'expired').length;
            
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
            
            const dashboardStatsEl = document.getElementById('dashboardStats');
            if (!dashboardStatsEl) {
                console.error('❌ [Dashboard] Elemento dashboardStats não encontrado!');
                throw new Error('Elemento dashboardStats não encontrado no HTML');
            }
            
            dashboardStatsEl.innerHTML = statsHtml;
            console.log('✓ [Dashboard] Stats renderizadas');

            const paymentsContainer = document.getElementById('dashboardPayments');
            if (!paymentsContainer) {
                console.error('❌ [Dashboard] Elemento dashboardPayments não encontrado!');
                throw new Error('Elemento dashboardPayments não encontrado no HTML');
            }
            
            paymentsContainer.innerHTML = '';

            // ✅ CORREÇÃO: Usar recent_payments
            if (data.recent_payments.length === 0) {
                paymentsContainer.innerHTML = '<p style="text-align: center; color: #888;">Nenhuma compra realizada</p>';
                console.log('ℹ️ [Dashboard] Nenhum pagamento encontrado');
            } else {
                console.log('✓ [Dashboard] Renderizando', data.recent_payments.length, 'pagamentos...');
                
                data.recent_payments.forEach((payment, index) => {
                    console.log(`  [${index + 1}/${data.recent_payments.length}]`, payment);
                    
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
                                ${payment.status === 'pending' ? 
                                    `<button onclick="ClientPayment.checkPaymentStatus(${payment.id})" class="btn-small">Verificar</button>` : 
                                    payment.status === 'error' ? 
                                    `<button onclick="ClientDashboard.retryPayment(${payment.id})" class="btn-warning">Reprocessar</button>` : 
                                    ''
                                }
                            </div>
                        </div>
                    `;
                    paymentsContainer.appendChild(paymentCard);
                });
                
                console.log('✓ [Dashboard] Todos os pagamentos renderizados');
            }

            Utils.goToStep(6);
            console.log('✅ [Dashboard] Carregamento concluído com sucesso!');
            
        } catch (error) {
            console.error('❌ [Dashboard] Erro:', error);
            console.error('❌ [Dashboard] Stack:', error.stack);
            
            // Mostrar erro mais detalhado ao usuário
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                Utils.showError('Erro de conexão. Verifique sua internet.');
            } else if (error.message.includes('404')) {
                Utils.showError('Rota do dashboard não encontrada no servidor');
            } else {
                Utils.showError('Erro ao carregar dashboard: ' + error.message);
            }
        }
    },

    async retryPayment(paymentId) {
        console.log('🔄 [Dashboard] Reprocessando pagamento:', paymentId);
        
        // Encontrar o botão específico
        const btn = event.target;
        const originalText = btn.textContent;
        
        // Desabilitar botão e mostrar feedback
        btn.disabled = true;
        btn.textContent = '⏳ Processando...';
        btn.style.opacity = '0.6';
        
        // Mostrar notificação
        Utils.showSuccess('🔄 Reprocessando recarga, aguarde...');
        
        try {
            const result = await API.public.retryRecharge(paymentId);
            console.log('✓ [Dashboard] Resultado:', result);
            
            if (result.success) {
                Utils.showSuccess('✅ ' + result.message);
                // Aguardar 1 segundo antes de recarregar
                setTimeout(() => this.load(), 1000);
            } else {
                Utils.showError('❌ ' + result.message);
                // Reabilitar botão em caso de erro
                btn.disabled = false;
                btn.textContent = originalText;
                btn.style.opacity = '1';
            }
        } catch (error) {
            console.error('❌ [Dashboard] Erro ao reprocessar:', error);
            Utils.showError('❌ Erro: ' + error.message);
            // Reabilitar botão em caso de erro
            btn.disabled = false;
            btn.textContent = originalText;
            btn.style.opacity = '1';
        }
    },

    async retryAllErrors() {
        const btn = document.getElementById('retryAllBtn');
        if (!btn) {
            console.error('❌ [Dashboard] Botão retryAllBtn não encontrado');
            return;
        }

        if (!confirm('Reprocessar todos os pagamentos com erro?')) {
            return;
        }

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Processando...';

        console.log('🔄 [Dashboard] Reprocessando todos os erros...');

        try {
            const result = await API.public.retryAllErrors(
                ClientAuth.currentReseller.id,
                ClientAuth.currentReseller.type
            );
            
            console.log('✓ [Dashboard] Resultado:', result);

            if (result.success) {
                alert(`✅ Concluído!\n\nTotal: ${result.total}\nSucesso: ${result.succeeded}\nFalha: ${result.failed}`);
                setTimeout(() => this.load(), 1000);
            } else {
                alert('❌ ' + result.message);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            console.error('❌ [Dashboard] Erro ao reprocessar todos:', error);
            alert('❌ Erro: ' + error.message);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

window.ClientDashboard = ClientDashboard;
