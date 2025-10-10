// services/MonitorService.js - COM SUPORTE MULTI-TENANT + SIGMA + KOFFICE + GESOFFICE + P2BRAS
const PaymentService = require('./PaymentService');
const SigmaService = require('./SigmaService');
const KofficeService = require('./KofficeService');
const GesOfficeService = require('./GesOfficeService');
const P2brasService = require('./P2brasService'); // ⭐ NOVO

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
            // ⭐ MULTI-TENANT: Query busca tenant_id junto com os pagamentos + P2BRAS
            const payments = await this.db.query(`
                SELECT 
                    p.*,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                        WHEN p.reseller_type = 'p2bras' THEN pr.username
                    END as username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.sigma_user_id
                        WHEN p.reseller_type = 'koffice' THEN kr.koffice_id
                        WHEN p.reseller_type = 'gesoffice' THEN gr.gesoffice_id
                        WHEN p.reseller_type = 'p2bras' THEN pr.p2bras_id
                    END as user_identifier,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.url
                        WHEN p.reseller_type = 'koffice' THEN kp.url
                        WHEN p.reseller_type = 'gesoffice' THEN gp.url
                        WHEN p.reseller_type = 'p2bras' THEN pp.url
                    END as url,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.admin_username
                        WHEN p.reseller_type = 'koffice' THEN kp.admin_username
                        WHEN p.reseller_type = 'gesoffice' THEN gp.admin_username
                        WHEN p.reseller_type = 'p2bras' THEN pp.admin_username
                    END as admin_username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.admin_password
                        WHEN p.reseller_type = 'koffice' THEN kp.admin_password
                        WHEN p.reseller_type = 'gesoffice' THEN gp.admin_password
                        WHEN p.reseller_type = 'p2bras' THEN pp.admin_password
                    END as admin_password,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.tenant_id
                        WHEN p.reseller_type = 'koffice' THEN kp.tenant_id
                        WHEN p.reseller_type = 'gesoffice' THEN gp.tenant_id
                        WHEN p.reseller_type = 'p2bras' THEN pp.tenant_id
                    END as tenant_id,
                    CASE 
                        WHEN p.reseller_type = 'koffice' THEN kp.has_captcha
                        ELSE 0
                    END as has_captcha
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN sigma_panels sp ON r.panel_id = sp.id
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN koffice_panels kp ON kr.panel_id = kp.id
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
                LEFT JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                LEFT JOIN p2bras_resellers pr ON p.reseller_id = pr.id AND p.reseller_type = 'p2bras'
                LEFT JOIN p2bras_panels pp ON pr.panel_id = pp.id
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

            // ⭐ MULTI-TENANT: Buscar token MP do tenant específico
            const mpToken = await this.db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [payment.tenant_id, 'mp_access_token']
            );

            if (!mpToken || !mpToken.value) {
                console.log(`[Monitor] Token MP não configurado para tenant ${payment.tenant_id}`);
                return;
            }

            const paymentService = new PaymentService(mpToken.value);
            const mpStatus = await paymentService.getPaymentStatus(payment.mp_payment_id);

            if (mpStatus.status === 'approved') {
                console.log(`[Monitor] Pagamento ${payment.id} (${payment.reseller_type}, tenant ${payment.tenant_id}) aprovado!`);
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
            let result;

            // ===== SIGMA =====
            if (payment.reseller_type === 'sigma') {
                const sigmaService = new SigmaService(
                    payment.url,
                    payment.admin_username,
                    payment.admin_password
                );

                result = await sigmaService.addCreditsWithRetry(
                    payment.username,
                    payment.user_identifier, // sigma_user_id
                    payment.credits
                );
            } 
            // ===== KOFFICE =====
            else if (payment.reseller_type === 'koffice') {
                // ⭐ MULTI-TENANT: Buscar Anti-Captcha key do tenant
                const anticaptchaConfig = await this.db.get(
                    'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                    [payment.tenant_id, 'anticaptcha_api_key']
                );

                const anticaptchaKey = anticaptchaConfig?.value || '';

                const kofficeService = new KofficeService(
                    payment.url,
                    payment.admin_username,
                    payment.admin_password,
                    payment.has_captcha ? anticaptchaKey : null
                );

                result = await kofficeService.addCreditsWithRetry(
                    payment.username,
                    payment.user_identifier, // koffice_id
                    payment.credits
                );
            }
            // ===== GESOFFICE =====
            else if (payment.reseller_type === 'gesoffice') {
                const gesofficeService = new GesOfficeService(
                    payment.url,
                    payment.admin_username,
                    payment.admin_password
                );

                result = await gesofficeService.addCreditsWithRetry(
                    payment.username,
                    payment.user_identifier, // gesoffice_id
                    payment.credits
                );
            }
            // ⭐ ===== P2BRAS ===== NOVO
            else if (payment.reseller_type === 'p2bras') {
                // ⭐ MULTI-TENANT: Buscar 2Captcha key do tenant
                const captcha2Config = await this.db.get(
                    'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                    [payment.tenant_id, '2captcha_api_key']
                );

                const captcha2Key = captcha2Config?.value || '';

                if (!captcha2Key) {
                    throw new Error('2Captcha API Key não configurada para este tenant');
                }

                const p2brasService = new P2brasService(
                    payment.url,
                    payment.admin_username,
                    payment.admin_password,
                    captcha2Key
                );

                result = await p2brasService.addCreditsWithRetry(
                    payment.username,
                    payment.user_identifier, // p2bras_id
                    payment.credits
                );
            }

            if (!result || !result.success) {
                throw new Error(result?.message || 'Falha ao adicionar créditos');
            }

            // Marcar pagamento como pago
            await this.db.run(
                'UPDATE payments SET status = ?, paid_at = datetime("now") WHERE id = ?',
                ['paid', payment.id]
            );

            // Registrar transação
            await this.db.run(
                `INSERT INTO transactions 
                (payment_id, reseller_id, reseller_type, credits, amount, sigma_response, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [payment.id, payment.reseller_id, payment.reseller_type, 
                 payment.credits, payment.amount, JSON.stringify(result), 1]
            );

            const logMsg = isRetry ? '[Retry] Recarga OK' : '[Monitor] Recarga OK';
            console.log(`${logMsg} (${payment.reseller_type}, tenant ${payment.tenant_id}): ${payment.credits} créditos para ${payment.username}`);

            return { success: true, message: 'Créditos adicionados com sucesso!' };

        } catch (error) {
            console.error(`[Monitor] Erro ao processar recarga (${payment.reseller_type}, tenant ${payment.tenant_id}):`, error.message);
            
            // Marcar como erro
            await this.db.run(
                'UPDATE payments SET status = ? WHERE id = ?',
                ['error', payment.id]
            );

            // Registrar transação com falha
            await this.db.run(
                `INSERT INTO transactions 
                (payment_id, reseller_id, reseller_type, credits, amount, sigma_response, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [payment.id, payment.reseller_id, payment.reseller_type, 
                 payment.credits, payment.amount, JSON.stringify({ error: error.message }), 0]
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

    async retryPayment(paymentId) {
        try {
            // ⭐ MULTI-TENANT: Buscar pagamento com tenant_id + P2BRAS
            const payment = await this.db.get(`
                SELECT 
                    p.*,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                        WHEN p.reseller_type = 'p2bras' THEN pr.username
                    END as username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.sigma_user_id
                        WHEN p.reseller_type = 'koffice' THEN kr.koffice_id
                        WHEN p.reseller_type = 'gesoffice' THEN gr.gesoffice_id
                        WHEN p.reseller_type = 'p2bras' THEN pr.p2bras_id
                    END as user_identifier,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.url
                        WHEN p.reseller_type = 'koffice' THEN kp.url
                        WHEN p.reseller_type = 'gesoffice' THEN gp.url
                        WHEN p.reseller_type = 'p2bras' THEN pp.url
                    END as url,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.admin_username
                        WHEN p.reseller_type = 'koffice' THEN kp.admin_username
                        WHEN p.reseller_type = 'gesoffice' THEN gp.admin_username
                        WHEN p.reseller_type = 'p2bras' THEN pp.admin_username
                    END as admin_username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.admin_password
                        WHEN p.reseller_type = 'koffice' THEN kp.admin_password
                        WHEN p.reseller_type = 'gesoffice' THEN gp.admin_password
                        WHEN p.reseller_type = 'p2bras' THEN pp.admin_password
                    END as admin_password,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.tenant_id
                        WHEN p.reseller_type = 'koffice' THEN kp.tenant_id
                        WHEN p.reseller_type = 'gesoffice' THEN gp.tenant_id
                        WHEN p.reseller_type = 'p2bras' THEN pp.tenant_id
                    END as tenant_id,
                    CASE 
                        WHEN p.reseller_type = 'koffice' THEN kp.has_captcha
                        ELSE 0
                    END as has_captcha
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN sigma_panels sp ON r.panel_id = sp.id
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN koffice_panels kp ON kr.panel_id = kp.id
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
                LEFT JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                LEFT JOIN p2bras_resellers pr ON p.reseller_id = pr.id AND p.reseller_type = 'p2bras'
                LEFT JOIN p2bras_panels pp ON pr.panel_id = pp.id
                WHERE p.id = ?
            `, [paymentId]);

            if (!payment) {
                throw new Error('Pagamento não encontrado');
            }

            if (payment.status === 'paid') {
                return { 
                    success: false, 
                    message: 'Este pagamento já foi processado com sucesso' 
                };
            }

            if (payment.status !== 'error' && payment.status !== 'paid') {
                // ⭐ MULTI-TENANT: Verificar no MP usando token do tenant
                const mpToken = await this.db.get(
                    'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                    [payment.tenant_id, 'mp_access_token']
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

            console.log(`[Retry] Tentando reprocessar pagamento ${paymentId} (${payment.reseller_type}, tenant ${payment.tenant_id})`);
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
