// js/client/payment.js - COM FEEDBACK VISUAL MELHORADO
const ClientPayment = {
    currentPayment: null,
    monitorInterval: null,
    checkCount: 0,
    // ✅ NOVA FUNÇÃO: Reset completo da interface de pagamento
    resetPaymentUI() {
        console.log('[Payment] 🧹 Limpando interface de pagamento...');
        
        // Limpar imagens e textos
        const qrImage = document.getElementById('qrCodeImage');
        const pixCode = document.getElementById('pixCode');
        const paymentCredits = document.getElementById('paymentCredits');
        const paymentAmount = document.getElementById('paymentAmount');
        const paymentTimer = document.getElementById('paymentTimer');
        
        if (qrImage) {
            qrImage.src = '';
            qrImage.style.display = 'block';
        }
        
        if (pixCode) {
            pixCode.textContent = '';
            pixCode.parentElement.style.display = 'block';
        }
        
        if (paymentCredits) paymentCredits.textContent = '';
        if (paymentAmount) paymentAmount.textContent = '';
        
        if (paymentTimer) {
            paymentTimer.className = 'timer';
            paymentTimer.innerHTML = '<div class="timer">Aguardando pagamento...</div>';
        }
        
        // Mostrar botões novamente
        const copyBtn = document.getElementById('copyPixBtn');
        const cancelBtn = document.getElementById('cancelPaymentBtn');
        
        if (copyBtn) copyBtn.style.display = 'inline-block';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
    },

    startMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        this.checkCount = 0;
        this.updateStatus('Aguardando pagamento PIX...', 'pending');

        this.monitorInterval = setInterval(async () => {
            try {
                this.checkCount++;
                const data = await API.public.getPaymentStatus(this.currentPayment.payment_id);
                
                if (data.status === 'paid') {
                    this.stopMonitoring();
                    this.updateStatus('💳 Pagamento confirmado! Processando recarga...', 'processing');
                    
                    // Aguardar um pouco para dar tempo do monitor processar
                    await this.waitForRecharge();
                    
                } else if (data.status === 'expired') {
                    this.stopMonitoring();
                    this.updateStatus('⏰ Pagamento expirado', 'error');
                    Utils.showError('Pagamento expirado');
                    setTimeout(() => Utils.goToStep(3), 3000);
                } else if (data.status === 'error') {
                    this.stopMonitoring();
                    this.updateStatus('❌ Erro ao processar recarga', 'error');
                    this.showRetryButton();
                }
            } catch (error) {
                console.error('Erro ao verificar pagamento:', error);
            }
        }, 5000); // Verificar a cada 5 segundos
    },

    async waitForRecharge() {
        // Aguardar até 30 segundos para a recarga ser processada
        let attempts = 0;
        const maxAttempts = 30; // 30 verificações x 1 segundo = 30 segundos
        
        const checkInterval = setInterval(async () => {
            attempts++;
            
            try {
                const data = await API.public.getPaymentStatus(this.currentPayment.payment_id);
                
                if (data.status === 'paid') {
                    clearInterval(checkInterval);
                    this.updateStatus('✅ Recarga concluída com sucesso!', 'success');
                    setTimeout(() => Utils.goToStep(5), 2000);
                } else if (data.status === 'error') {
                    clearInterval(checkInterval);
                    this.updateStatus('❌ Erro ao adicionar créditos', 'error');
                    this.showRetryButton();
                } else if (attempts >= maxAttempts) {
                    // Timeout - pode estar processando ainda
                    clearInterval(checkInterval);
                    this.updateStatus('⏳ Recarga em andamento... Verifique o dashboard', 'processing');
                    setTimeout(() => Utils.goToStep(3), 3000);
                }
            } catch (error) {
                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    this.updateStatus('⚠️ Não foi possível confirmar. Verifique o dashboard', 'warning');
                    setTimeout(() => Utils.goToStep(3), 3000);
                }
            }
        }, 1000);
    },

    updateStatus(message, type) {
        const timerDiv = document.getElementById('paymentTimer');
        const qrContainer = document.querySelector('.qr-code-container');
        
        if (!timerDiv) return;

        // Limpar conteúdo anterior
        timerDiv.className = 'timer';
        
        // Definir cores e estilos baseado no tipo
        const styles = {
            pending: {
                color: '#667eea',
                icon: '⏳',
                background: 'transparent'
            },
            processing: {
                color: '#ff9800',
                icon: '🔄',
                background: '#fff3cd',
                pulse: true
            },
            success: {
                color: '#4caf50',
                icon: '✅',
                background: '#d4edda'
            },
            error: {
                color: '#f44336',
                icon: '❌',
                background: '#f8d7da'
            },
            warning: {
                color: '#ff9800',
                icon: '⚠️',
                background: '#fff3cd'
            }
        };

        const style = styles[type] || styles.pending;

        // Esconder QR Code quando não for pending
        if (type !== 'pending') {
            const qrImage = document.getElementById('qrCodeImage');
            const pixCodeDiv = document.querySelector('.pix-code');
            const copyBtn = document.getElementById('copyPixBtn');
            
            if (qrImage) qrImage.style.display = 'none';
            if (pixCodeDiv) pixCodeDiv.style.display = 'none';
            if (copyBtn) copyBtn.style.display = 'none';
        }

        // Atualizar mensagem
        timerDiv.innerHTML = `
            <div style="
                padding: 20px;
                border-radius: 10px;
                background: ${style.background};
                text-align: center;
                margin: 20px 0;
                ${style.pulse ? 'animation: pulse 2s infinite;' : ''}
            ">
                <div style="font-size: 48px; margin-bottom: 10px;">
                    ${style.icon}
                </div>
                <div style="
                    font-size: 18px;
                    font-weight: 600;
                    color: ${style.color};
                ">
                    ${message}
                </div>
            </div>
        `;

        // Adicionar animação de pulse se necessário
        if (style.pulse && !document.getElementById('pulseAnimation')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'pulseAnimation';
            styleSheet.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                }
            `;
            document.head.appendChild(styleSheet);
        }
    },

    showRetryButton() {
        const timerDiv = document.getElementById('paymentTimer');
        const cancelBtn = document.getElementById('cancelPaymentBtn');
        
        if (!timerDiv) return;

        // Adicionar botão de retry
        const retryHTML = `
            <div style="text-align: center; margin-top: 20px;">
                <p style="color: #666; margin-bottom: 15px;">
                    O pagamento foi aprovado, mas houve um erro ao adicionar os créditos.
                </p>
                <button 
                    onclick="ClientPayment.retryCurrentPayment()" 
                    id="retryPaymentBtn"
                    style="
                        padding: 12px 30px;
                        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: transform 0.2s;
                        margin-right: 10px;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.transform='translateY(0)'"
                >
                    🔄 Tentar Novamente
                </button>
                <button 
                    onclick="Utils.goToStep(3)" 
                    style="
                        padding: 12px 30px;
                        background: linear-gradient(135deg, #888 0%, #666 100%);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: transform 0.2s;
                    "
                    onmouseover="this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.transform='translateY(0)'"
                >
                    Voltar
                </button>
            </div>
        `;

        timerDiv.insertAdjacentHTML('beforeend', retryHTML);
        
        // Esconder botão de cancelar
        if (cancelBtn) cancelBtn.style.display = 'none';
    },

    async retryCurrentPayment() {
        const retryBtn = document.getElementById('retryPaymentBtn');
        if (retryBtn) {
            retryBtn.disabled = true;
            retryBtn.textContent = '⏳ Processando...';
        }

        try {
            this.updateStatus('🔄 Tentando reprocessar recarga...', 'processing');
            
            const result = await API.public.retryRecharge(this.currentPayment.payment_id);
            
            if (result.success) {
                this.updateStatus('✅ Recarga concluída com sucesso!', 'success');
                Utils.showSuccess(result.message);
                setTimeout(() => Utils.goToStep(5), 2000);
            } else {
                this.updateStatus('❌ Falha ao reprocessar', 'error');
                Utils.showError(result.message);
                
                if (retryBtn) {
                    retryBtn.disabled = false;
                    retryBtn.textContent = '🔄 Tentar Novamente';
                }
            }
        } catch (error) {
            this.updateStatus('❌ Erro ao reprocessar', 'error');
            Utils.showError('Erro: ' + error.message);
            
            if (retryBtn) {
                retryBtn.disabled = false;
                retryBtn.textContent = '🔄 Tentar Novamente';
            }
        }
    },

    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    },

    async copyPixCode() {
        const code = document.getElementById('pixCode').textContent;
        const success = await Utils.copyToClipboard(code);
        
        if (success) {
            Utils.showSuccess('Código PIX copiado!');
            
            // Feedback visual no botão
            const btn = document.getElementById('copyPixBtn');
            const originalText = btn.textContent;
            btn.textContent = '✅ Copiado!';
            btn.style.background = '#4caf50';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
        } else {
            Utils.showError('Erro ao copiar. Copie manualmente.');
        }
    },

    cancelPayment() {
        if (confirm('Deseja realmente cancelar este pagamento?')) {
            this.stopMonitoring();
            this.currentPayment = null;
            Utils.goToStep(3);
        }
    },

    async checkManually(paymentId) {
        try {
            this.updateStatus('🔍 Verificando pagamento...', 'processing');
            
            const data = await API.public.checkPayment(paymentId);
            
            if (data.status === 'paid') {
                Utils.showSuccess(data.message);
                setTimeout(() => ClientDashboard.load(), 2000);
            } else if (data.status === 'error') {
                Utils.showError(data.message);
                this.updateStatus('❌ Erro ao processar recarga', 'error');
            } else {
                Utils.showError(data.message);
            }
        } catch (error) {
            Utils.showError('Erro ao verificar pagamento');
        }
    }
};

window.ClientPayment = ClientPayment;
