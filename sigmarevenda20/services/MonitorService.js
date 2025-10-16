// services/MonitorService.js - COMPLETO COM DASHBOARDBZ CORRIGIDO
const PaymentService = require('./PaymentService');
const SigmaService = require('./SigmaService');
const KofficeService = require('./KofficeService');
const GesOfficeService = require('./GesOfficeService');
const P2brasService = require('./P2brasService');
const RushPlayService = require('./RushPlayService');
const PainelFodaService = require('./PainelFodaService');
const DashboardBzService = require('./DashboardBzService'); // ⭐ NOVO

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
            // ⭐ Query com TODOS OS PAINÉIS incluindo DashboardBz
            const payments = await this.db.query(`
                SELECT 
                    p.*,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                        WHEN p.reseller_type = 'p2bras' THEN pr.username
                        WHEN p.reseller_type = 'rushplay' THEN rpr.username
                        WHEN p.reseller_type = 'painelfoda' THEN pfr.username
                        WHEN p.reseller_type = 'dashboardbz' THEN dbr.username
                    END as username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.url
                        WHEN p.reseller_type = 'koffice' THEN kp.url
                        WHEN p.reseller_type = 'gesoffice' THEN gp.url
                        WHEN p.reseller_type = 'p2bras' THEN pp.url
                        WHEN p.reseller_type = 'rushplay' THEN rpp.url
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.url
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.url
                    END as url,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.admin_username
                        WHEN p.reseller_type = 'koffice' THEN kp.admin_username
                        WHEN p.reseller_type = 'gesoffice' THEN gp.admin_username
                        WHEN p.reseller_type = 'p2bras' THEN pp.admin_username
                        WHEN p.reseller_type = 'rushplay' THEN rpp.admin_username
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.admin_username
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.admin_username
                    END as admin_username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.admin_password
                        WHEN p.reseller_type = 'koffice' THEN kp.admin_password
                        WHEN p.reseller_type = 'gesoffice' THEN gp.admin_password
                        WHEN p.reseller_type = 'p2bras' THEN pp.admin_password
                        WHEN p.reseller_type = 'rushplay' THEN rpp.admin_password
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.admin_password
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.admin_password
                    END as admin_password,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.sigma_user_id
                        WHEN p.reseller_type = 'koffice' THEN kr.koffice_id
                        WHEN p.reseller_type = 'gesoffice' THEN gr.gesoffice_id
                        WHEN p.reseller_type = 'p2bras' THEN CAST(pr.p2bras_id AS TEXT)
                        WHEN p.reseller_type = 'rushplay' THEN rpr.rushplay_id
                        WHEN p.reseller_type = 'painelfoda' THEN CAST(pfr.painelfoda_user_id AS TEXT)
                        WHEN p.reseller_type = 'dashboardbz' THEN dbr.dashboardbz_search_term
                    END as user_identifier,
                    CASE 
                        WHEN p.reseller_type = 'koffice' THEN kp.has_captcha
                        ELSE 0
                    END as has_captcha,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.tenant_id
                        WHEN p.reseller_type = 'koffice' THEN kp.tenant_id
                        WHEN p.reseller_type = 'gesoffice' THEN gp.tenant_id
                        WHEN p.reseller_type = 'p2bras' THEN pp.tenant_id
                        WHEN p.reseller_type = 'rushplay' THEN rpp.tenant_id
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.tenant_id
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.tenant_id
                    END as tenant_id,
                    CASE 
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.site_key
                        ELSE NULL
                    END as site_key
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN sigma_panels sp ON r.panel_id = sp.id
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN koffice_panels kp ON kr.panel_id = kp.id
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
                LEFT JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                LEFT JOIN p2bras_resellers pr ON p.reseller_id = pr.id AND p.reseller_type = 'p2bras'
                LEFT JOIN p2bras_panels pp ON pr.panel_id = pp.id
                LEFT JOIN rushplay_resellers rpr ON p.reseller_id = rpr.id AND p.reseller_type = 'rushplay'
                LEFT JOIN rushplay_panels rpp ON rpr.panel_id = rpp.id
                LEFT JOIN painelfoda_resellers pfr ON p.reseller_id = pfr.id AND p.reseller_type = 'painelfoda'
                LEFT JOIN painelfoda_panels pfp ON pfr.panel_id = pfp.id
                LEFT JOIN dashboardbz_resellers dbr ON p.reseller_id = dbr.id AND p.reseller_type = 'dashboardbz'
                LEFT JOIN dashboardbz_panels dbp ON dbr.panel_id = dbp.id
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

            // Buscar token MP do tenant
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
                    payment.user_identifier,
                    payment.credits
                );
            } 
            // ===== KOFFICE =====
            else if (payment.reseller_type === 'koffice') {
                const anticaptchaConfig = await this.db.get(
                    'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                    [payment.tenant_id, 'anticaptcha_api_key']
                );

                const anticaptchaKey = anticaptchaConfig?.value || '';

                const kofficeService = new KofficeService(
                    payment.url,
                    payment.admin_username,
                    payment.admin_password,
                    payment.has_captcha,          // ✅ CORRIGIDO
                    anticaptchaKey                // ✅ CORRIGIDO
                );

                result = await kofficeService.addCreditsWithRetry(
                    payment.user_identifier,      // ✅ CORRIGIDO - ID correto
                    payment.credits               // ✅ CORRIGIDO - créditos corretos
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
                    payment.user_identifier,      // ✅ CORRIGIDO - ID correto
                    payment.credits               // ✅ CORRIGIDO - créditos corretos
                );
            }
            // ===== P2BRAS =====
            else if (payment.reseller_type === 'p2bras') {
                const captcha2Config = await this.db.get(
                    'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                    [payment.tenant_id, '2captcha_api_key']
                );

                const captcha2Key = captcha2Config?.value || '';

                const p2brasService = new P2brasService(
                    payment.url,
                    payment.admin_username,
                    payment.admin_password,
                    captcha2Key
                );

                result = await p2brasService.addCreditsWithRetry(
                    payment.username,
                    payment.user_identifier,
                    payment.credits
                );
            }
            // ===== RUSHPLAY =====
            else if (payment.reseller_type === 'rushplay') {
                const rushplayService = new RushPlayService(
                    payment.url,
                    payment.admin_username,
                    payment.admin_password
                );

                result = await rushplayService.addCreditsWithRetry(
                    payment.username,
                    payment.user_identifier,
                    payment.credits
                );
            }
            // ===== PAINELFODA =====
            else if (payment.reseller_type === 'painelfoda') {
                const painelfodaService = new PainelFodaService(
                    payment.url,
                    payment.admin_username,
                    payment.admin_password
                );

                result = await painelfodaService.addCreditsWithRetry(
                    payment.username,
                    payment.user_identifier,
                    payment.credits
                );
            }
            // ⭐ NOVO: DASHBOARDBZ =====
            else if (payment.reseller_type === 'dashboardbz') {
                // Criar objeto panel com todas as informações necessárias
                const panelData = {
                    name: 'DashboardBz',
                    url: payment.url,
                    admin_username: payment.admin_username,
                    admin_password: payment.admin_password,
                    site_key: payment.site_key
                };

                const dashboardBzService = new DashboardBzService(
                    panelData,
                    payment.tenant_id,
                    this.db
                );

                result = await dashboardBzService.addCreditsWithRetry(
                    payment.user_identifier, // dashboardbz_search_term
                    payment.credits
                );
            }
            else {
                throw new Error(`Tipo de painel desconhecido: ${payment.reseller_type}`);
            }

            // ===== PROCESSAR RESULTADO =====
            if (result.success) {
                await this.db.run(
                    'UPDATE payments SET status = ?, paid_at = datetime("now") WHERE id = ?',
                    ['paid', payment.id]
                );

                await this.db.run(`
                    INSERT INTO transactions 
                    (payment_id, reseller_id, reseller_type, credits, amount, sigma_response, success)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    payment.id,
                    payment.reseller_id,
                    payment.reseller_type,
                    payment.credits,
                    payment.amount,
                    JSON.stringify(result.response || {}),
                    1
                ]);

                console.log(`[Monitor] ✅ Recarga processada: ${payment.username} (${payment.reseller_type}) - ${payment.credits} créditos`);

                if (isRetry) {
                    return { success: true, message: 'Créditos adicionados com sucesso!' };
                }
            } else {
                throw new Error(result.message || 'Falha ao adicionar créditos');
            }

        } catch (error) {
            console.error(`[Monitor] ❌ Erro ao processar recarga:`, error.message);
            
            await this.db.run(
                'UPDATE payments SET status = ? WHERE id = ?',
                ['error', payment.id]
            );

            await this.db.run(`
                INSERT INTO transactions 
                (payment_id, reseller_id, reseller_type, credits, amount, sigma_response, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                payment.id,
                payment.reseller_id,
                payment.reseller_type,
                payment.credits,
                payment.amount,
                JSON.stringify({ error: error.message }),
                0
            ]);

            if (isRetry) {
                return { success: false, message: error.message };
            }
        }
    }

    async expirePayment(paymentId) {
        try {
            await this.db.run(
                'UPDATE payments SET status = ? WHERE id = ?',
                ['expired', paymentId]
            );
            console.log(`[Monitor] Pagamento ${paymentId} marcado como expirado`);
        } catch (error) {
            console.error('[Monitor] Erro ao expirar pagamento:', error.message);
        }
    }

    async retryPayment(paymentId) {
        try {
            // 🔒 VERIFICAR SE JÁ ESTÁ SENDO PROCESSADO
            const lockCheck = await this.db.get(
                'SELECT processing_lock, processing_started_at FROM payments WHERE id = ?',
                [paymentId]
            );

            if (lockCheck && lockCheck.processing_lock === 1) {
                const lockTime = new Date(lockCheck.processing_started_at + 'Z'); // ✅ Adicionar Z para UTC
                const now = new Date();
                const diffMinutes = (now - lockTime) / 1000 / 60;

                console.log(`[Retry] Lock ativo - Tempo decorrido: ${diffMinutes.toFixed(2)} minutos`);

                // Se o lock tem menos de 3 minutos, bloquear
                if (diffMinutes < 3) {
                    return { 
                        success: false, 
                        message: '⏳ Este pagamento já está sendo processado. Aguarde...' 
                    };
                }
                
                // Se passou de 3 minutos, liberar o lock automaticamente
                console.log(`[Retry] Lock expirado para pagamento ${paymentId}, liberando...`);
                await this.db.run(
                    'UPDATE payments SET processing_lock = 0, processing_started_at = NULL WHERE id = ?',
                    [paymentId]
                );
            }

            // 🔒 ADQUIRIR LOCK
            await this.db.run(
                'UPDATE payments SET processing_lock = 1, processing_started_at = datetime("now") WHERE id = ?',
                [paymentId]
            );

            console.log(`[Retry] 🔒 Lock adquirido para pagamento ${paymentId}`);

            // ⭐ Query com nomes CORRETOS das colunas do banco (mantida do código original)
            const payment = await this.db.get(`
                SELECT 
                    p.*,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                        WHEN p.reseller_type = 'p2bras' THEN pr.username
                        WHEN p.reseller_type = 'rushplay' THEN rpr.username
                        WHEN p.reseller_type = 'painelfoda' THEN pfr.username
                        WHEN p.reseller_type = 'dashboardbz' THEN dbr.username
                    END as username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.url
                        WHEN p.reseller_type = 'koffice' THEN kp.url
                        WHEN p.reseller_type = 'gesoffice' THEN gp.url
                        WHEN p.reseller_type = 'p2bras' THEN pp.url
                        WHEN p.reseller_type = 'rushplay' THEN rpp.url
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.url
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.url
                    END as url,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.admin_username
                        WHEN p.reseller_type = 'koffice' THEN kp.admin_username
                        WHEN p.reseller_type = 'gesoffice' THEN gp.admin_username
                        WHEN p.reseller_type = 'p2bras' THEN pp.admin_username
                        WHEN p.reseller_type = 'rushplay' THEN rpp.admin_username
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.admin_username
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.admin_username
                    END as admin_username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.admin_password
                        WHEN p.reseller_type = 'koffice' THEN kp.admin_password
                        WHEN p.reseller_type = 'gesoffice' THEN gp.admin_password
                        WHEN p.reseller_type = 'p2bras' THEN pp.admin_password
                        WHEN p.reseller_type = 'rushplay' THEN rpp.admin_password
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.admin_password
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.admin_password
                    END as admin_password,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.sigma_user_id
                        WHEN p.reseller_type = 'koffice' THEN kr.koffice_id
                        WHEN p.reseller_type = 'gesoffice' THEN gr.gesoffice_id
                        WHEN p.reseller_type = 'p2bras' THEN CAST(pr.p2bras_id AS TEXT)
                        WHEN p.reseller_type = 'rushplay' THEN rpr.rushplay_id
                        WHEN p.reseller_type = 'painelfoda' THEN CAST(pfr.painelfoda_user_id AS TEXT)
                        WHEN p.reseller_type = 'dashboardbz' THEN dbr.dashboardbz_search_term
                    END as user_identifier,
                    CASE 
                        WHEN p.reseller_type = 'koffice' THEN kp.has_captcha
                        ELSE 0
                    END as has_captcha,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.tenant_id
                        WHEN p.reseller_type = 'koffice' THEN kp.tenant_id
                        WHEN p.reseller_type = 'gesoffice' THEN gp.tenant_id
                        WHEN p.reseller_type = 'p2bras' THEN pp.tenant_id
                        WHEN p.reseller_type = 'rushplay' THEN rpp.tenant_id
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.tenant_id
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.tenant_id
                    END as tenant_id,
                    CASE 
                        WHEN p.reseller_type = 'dashboardbz' THEN dbp.site_key
                        ELSE NULL
                    END as site_key
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN sigma_panels sp ON r.panel_id = sp.id
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN koffice_panels kp ON kr.panel_id = kp.id
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
                LEFT JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                LEFT JOIN p2bras_resellers pr ON p.reseller_id = pr.id AND p.reseller_type = 'p2bras'
                LEFT JOIN p2bras_panels pp ON pr.panel_id = pp.id
                LEFT JOIN rushplay_resellers rpr ON p.reseller_id = rpr.id AND p.reseller_type = 'rushplay'
                LEFT JOIN rushplay_panels rpp ON rpr.panel_id = rpp.id
                LEFT JOIN painelfoda_resellers pfr ON p.reseller_id = pfr.id AND p.reseller_type = 'painelfoda'
                LEFT JOIN painelfoda_panels pfp ON pfr.panel_id = pfp.id
                LEFT JOIN dashboardbz_resellers dbr ON p.reseller_id = dbr.id AND p.reseller_type = 'dashboardbz'
                LEFT JOIN dashboardbz_panels dbp ON dbr.panel_id = dbp.id
                WHERE p.id = ?
            `, [paymentId]);

            if (!payment) {
                // 🔓 LIBERAR LOCK
                await this.db.run(
                    'UPDATE payments SET processing_lock = 0, processing_started_at = NULL WHERE id = ?',
                    [paymentId]
                );
                return { 
                    success: false, 
                    message: 'Pagamento não encontrado' 
                };
            }

            // Verificar se pagamento já foi processado
            if (payment.status === 'paid') {
                // 🔓 LIBERAR LOCK
                await this.db.run(
                    'UPDATE payments SET processing_lock = 0, processing_started_at = NULL WHERE id = ?',
                    [paymentId]
                );
                return { 
                    success: false, 
                    message: 'Este pagamento já foi processado com sucesso' 
                };
            }

            // Verificar aprovação no Mercado Pago (somente se for retry manual)
            if (payment.mp_payment_id) {
                const mpToken = await this.db.get(
                    'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                    [payment.tenant_id, 'mp_access_token']
                );

                if (mpToken && mpToken.value) {
                    const paymentService = new PaymentService(mpToken.value);
                    const mpStatus = await paymentService.getPaymentStatus(payment.mp_payment_id);

                    if (mpStatus.status !== 'approved') {
                        // 🔓 LIBERAR LOCK
                        await this.db.run(
                            'UPDATE payments SET processing_lock = 0, processing_started_at = NULL WHERE id = ?',
                            [paymentId]
                        );
                        return { 
                            success: false, 
                            message: `Pagamento ainda não foi aprovado. Status: ${mpStatus.status}` 
                        };
                    }
                }
            }

            console.log(`[Retry] Tentando reprocessar pagamento ${paymentId} (${payment.reseller_type}, tenant ${payment.tenant_id})`);
            const result = await this.processRecharge(payment, true);
            
            // 🔓 LIBERAR LOCK APÓS PROCESSAMENTO
            await this.db.run(
                'UPDATE payments SET processing_lock = 0, processing_started_at = NULL WHERE id = ?',
                [paymentId]
            );
            
            console.log(`[Retry] 🔓 Lock liberado para pagamento ${paymentId}`);
            
            return result;

        } catch (error) {
            console.error('[Retry] Erro:', error.message);
            
            // 🔓 LIBERAR LOCK EM CASO DE ERRO
            try {
                await this.db.run(
                    'UPDATE payments SET processing_lock = 0, processing_started_at = NULL WHERE id = ?',
                    [paymentId]
                );
                console.log(`[Retry] 🔓 Lock liberado (erro) para pagamento ${paymentId}`);
            } catch (unlockError) {
                console.error('[Retry] Erro ao liberar lock:', unlockError.message);
            }
            
            return { 
                success: false, 
                message: error.message 
            };
        }
    }
}

module.exports = MonitorService;
