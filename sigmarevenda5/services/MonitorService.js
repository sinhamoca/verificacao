// services/MonitorService.js
const PaymentService = require('./PaymentService');
const SigmaService = require('./SigmaService');

class MonitorService {
    constructor(database) {
        this.db = database;
        this.running = false;
        this.interval = null;
        this.processing = new Set();
        this.checkIntervalMs = 10000; // 10 segundos
    }

    start() {
        if (this.running) return;
        
        this.running = true;
        console.log(`[Monitor] Iniciado - verificando a cada ${this.checkIntervalMs/1000}s`);
        
        this.interval = setInterval(async () => {
            await this.checkPendingPayments();
        }, this.checkIntervalMs);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.running = false;
        console.log('[Monitor] Parado');
    }

    async checkPendingPayments() {
        try {
            const payments = await this.db.query(`
                SELECT p.*, r.username, r.panel_id, r.sigma_user_id,
                       sp.url, sp.admin_username, sp.admin_password
                FROM payments p
                JOIN resellers r ON p.reseller_id = r.id
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE p.status = 'pending'
                AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
            `);

            if (payments.length === 0) return;

            console.log(`[Monitor] Verificando ${payments.length} pagamento(s) pendente(s)`);

            for (const payment of payments) {
                if (this.processing.has(payment.id)) {
                    continue;
                }

                this.processing.add(payment.id);
                
                try {
                    await this.checkPaymentStatus(payment);
                } finally {
                    setTimeout(() => {
                        this.processing.delete(payment.id);
                    }, 5000);
                }
            }

        } catch (error) {
            console.error('[Monitor] Erro:', error.message);
        }
    }

    async checkPaymentStatus(payment) {
        try {
            if (!payment.mp_payment_id) {
                console.log(`[Monitor] Pagamento ${payment.id} sem mp_payment_id`);
                return;
            }

            const mpToken = await this.db.get(
                'SELECT value FROM system_config WHERE key = ?', 
                ['mp_access_token']
            );

            if (!mpToken || !mpToken.value) {
                console.log('[Monitor] Token MP não configurado');
                return;
            }

            const paymentService = new PaymentService(mpToken.value);
            const mpStatus = await paymentService.getPaymentStatus(payment.mp_payment_id);

            if (mpStatus.status === 'approved') {
                console.log(`[Monitor] Pagamento ${payment.id} aprovado!`);
                await this.processRecharge(payment);
            } else if (mpStatus.status === 'cancelled' || mpStatus.status === 'expired') {
                console.log(`[Monitor] Pagamento ${payment.id} ${mpStatus.status}`);
                await this.expirePayment(payment.id);
            }

        } catch (error) {
            console.error(`[Monitor] Erro ao verificar pagamento ${payment.id}:`, error.message);
        }
    }

    async processRecharge(payment, isRetry = false) {
        try {
            const sigmaService = new SigmaService(
                payment.url,
                payment.admin_username,
                payment.admin_password
            );

            const result = await sigmaService.addCreditsWithRetry(
                payment.username,
                payment.sigma_user_id,
                payment.credits
            );

            // Atualizar pagamento como pago
            await this.db.run(
                'UPDATE payments SET status = ?, paid_at = datetime(\'now\') WHERE id = ?',
                ['paid', payment.id]
            );

            // Atualizar sigma_user_id se foi descoberto agora
            if (result.userId && !payment.sigma_user_id) {
                await this.db.run(
                    'UPDATE resellers SET sigma_user_id = ? WHERE id = ?',
                    [result.userId, payment.reseller_id]
                );
            }

            // Registrar transação
            await this.db.run(
                `INSERT INTO transactions 
                (payment_id, reseller_id, credits, amount, sigma_response, success)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [payment.id, payment.reseller_id, payment.credits, payment.amount, 
                 JSON.stringify(result.response), 1]
            );

            const logMsg = isRetry ? '[Retry] Recarga OK' : '[Monitor] Recarga OK';
            console.log(`${logMsg}: ${payment.credits} créditos para ${payment.username}`);

            return { success: true, message: 'Créditos adicionados com sucesso!' };

        } catch (error) {
            console.error('[Monitor] Erro ao processar recarga:', error.message);
            
            // Marcar como erro (não como expirado)
            await this.db.run(
                'UPDATE payments SET status = ? WHERE id = ?',
                ['error', payment.id]
            );

            // Registrar transação com falha
            await this.db.run(
                `INSERT INTO transactions 
                (payment_id, reseller_id, credits, amount, sigma_response, success)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [payment.id, payment.reseller_id, payment.credits, payment.amount, 
                 JSON.stringify({ error: error.message }), 0]
            );

            return { success: false, message: error.message };
        }
    }

    async expirePayment(paymentId) {
        await this.db.run(
            'UPDATE payments SET status = ? WHERE id = ?',
            ['expired', paymentId]
        );
    }

    // NOVA FUNÇÃO: Retry manual de recarga
    async retryRecharge(paymentId) {
        try {
            // Buscar dados do pagamento
            const payment = await this.db.get(`
                SELECT p.*, r.username, r.panel_id, r.sigma_user_id,
                       sp.url, sp.admin_username, sp.admin_password
                FROM payments p
                JOIN resellers r ON p.reseller_id = r.id
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE p.id = ?
            `, [paymentId]);

            if (!payment) {
                throw new Error('Pagamento não encontrado');
            }

            // Verificar se já foi pago
            if (payment.status === 'paid') {
                return { 
                    success: false, 
                    message: 'Este pagamento já foi processado com sucesso' 
                };
            }

            // Verificar se o pagamento foi aprovado no MP
            if (payment.status !== 'error' && payment.status !== 'paid') {
                const mpToken = await this.db.get(
                    'SELECT value FROM system_config WHERE key = ?', 
                    ['mp_access_token']
                );

                if (mpToken && mpToken.value) {
                    const paymentService = new PaymentService(mpToken.value);
                    const mpStatus = await paymentService.getPaymentStatus(payment.mp_payment_id);

                    if (mpStatus.status !== 'approved') {
                        return { 
                            success: false, 
                            message: `Pagamento ainda não foi aprovado. Status: ${mpStatus.status}` 
                        };
                    }
                }
            }

            // Processar recarga
            console.log(`[Retry] Tentando reprocessar pagamento ${paymentId}`);
            const result = await this.processRecharge(payment, true);
            
            return result;

        } catch (error) {
            console.error('[Retry] Erro:', error.message);
            return { 
                success: false, 
                message: error.message 
            };
        }
    }
}

module.exports = MonitorService;
