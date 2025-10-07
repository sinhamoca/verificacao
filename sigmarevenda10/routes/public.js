// routes/public.js - COM SUPORTE COMPLETO GESOFFICE + LICENCIAMENTO
const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');
const SigmaService = require('../services/SigmaService');
const KofficeService = require('../services/KofficeService');
const GesOfficeService = require('../services/GesOfficeService');
const crypto = require('crypto');

module.exports = (db) => {
    const dbManager = require('../models/DatabaseManager');

    /**
     * Função auxiliar para verificar licença do admin
     */
    async function checkAdminLicense() {
        try {
            // Buscar admin do database atual
            const admin = await db.get('SELECT * FROM admin_users LIMIT 1');
            
            if (!admin) {
                return { valid: false, reason: 'Admin não encontrado' };
            }

            // Verificar licença
            return await dbManager.checkAdminLicense(db, admin.username);
        } catch (error) {
            console.error('[License] Erro ao verificar:', error);
            return { valid: false, reason: 'Erro ao verificar licença' };
        }
    }

    // ========================================
    // VERIFICAÇÃO DE ACESSO
    // ========================================
    
    router.post('/verify-access', async (req, res) => {
        try {
            const { answer } = req.body;
            
            const config = await db.get('SELECT value FROM system_config WHERE key = ?', ['access_answer']);
            
            if (!config) {
                return res.status(500).json({ error: 'Configuração não encontrada' });
            }

            const hashedAnswer = crypto.createHash('sha256').update(answer).digest('hex');
            const isValid = hashedAnswer === config.value;
            
            res.json({ valid: isValid });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/access-question', async (req, res) => {
        try {
            const config = await db.get('SELECT value FROM system_config WHERE key = ?', ['access_question']);
            res.json({ question: config ? config.value : 'Qual a senha de acesso?' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // LOGIN UNIFICADO (DETECTA SIGMA, KOFFICE OU GESOFFICE)
    // ========================================
    
    router.post('/login', async (req, res) => {
        try {
            const { username } = req.body;
            
            // Verificar licença antes de permitir login
            const licenseCheck = await checkAdminLicense();
            
            if (!licenseCheck.valid) {
                console.log(`[Public] Login bloqueado: Admin expirado - ${licenseCheck.reason}`);
                
                return res.status(403).json({ 
                    error: '🔒 Sistema temporariamente indisponível. Entre em contato com o administrador.',
                    code: 'ADMIN_LICENSE_EXPIRED'
                });
            }
            
            // 1. Tentar encontrar em Sigma
            let reseller = await db.get(`
                SELECT r.*, sp.name as panel_name, sp.url as panel_url, 'sigma' as type
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE r.username = ? AND r.status = 'active'
            `, [username]);

            // 2. Se não encontrou, tentar em Koffice
            if (!reseller) {
                reseller = await db.get(`
                    SELECT kr.*, kp.name as panel_name, kp.url as panel_url, 'koffice' as type
                    FROM koffice_resellers kr
                    JOIN koffice_panels kp ON kr.panel_id = kp.id
                    WHERE kr.username = ? AND kr.status = 'active'
                `, [username]);
            }

            // 3. Se não encontrou, tentar em GesOffice
            if (!reseller) {
                reseller = await db.get(`
                    SELECT gr.*, gp.name as panel_name, gp.url as panel_url, 'gesoffice' as type
                    FROM gesoffice_resellers gr
                    JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                    WHERE gr.username = ? AND gr.status = 'active'
                `, [username]);
            }

            if (!reseller) {
                return res.status(404).json({ error: 'Revendedor não encontrado' });
            }

            console.log(`[Login] ${username} (${reseller.type})`);

            res.json({
                id: reseller.id,
                username: reseller.username,
                panel_name: reseller.panel_name,
                panel_url: reseller.panel_url,
                type: reseller.type // sigma, koffice ou gesoffice
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // LISTAR PACOTES
    // ========================================
    
    router.get('/packages', async (req, res) => {
        try {
            const packages = await db.query(`
                SELECT * FROM credit_packages 
                WHERE active = 1 
                ORDER BY price ASC
            `);
            res.json(packages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CRIAR PAGAMENTO (UNIFICADO)
    // ========================================
    
    router.post('/create-payment', async (req, res) => {
        try {
            const { resellerId, packageId, resellerType } = req.body;
            
            // ✅ VERIFICAR LICENÇA DO ADMIN ANTES DE CRIAR PAGAMENTO
            const licenseCheck = await checkAdminLicense();
            
            if (!licenseCheck.valid) {
                console.log(`[Payment] Bloqueado: Admin expirado - ${licenseCheck.reason}`);
                
                return res.status(403).json({ 
                    error: '🔒 Sistema temporariamente indisponível. Entre em contato com o administrador.',
                    code: 'ADMIN_LICENSE_EXPIRED',
                    reason: licenseCheck.reason
                });
            }
            
            const packageData = await db.get('SELECT * FROM credit_packages WHERE id = ?', [packageId]);

            if (!packageData) {
                return res.status(404).json({ error: 'Pacote não encontrado' });
            }

            // Buscar username do revendedor
            let resellerInfo;
            if (resellerType === 'sigma') {
                resellerInfo = await db.get('SELECT username FROM resellers WHERE id = ?', [resellerId]);
            } else if (resellerType === 'koffice') {
                resellerInfo = await db.get('SELECT username FROM koffice_resellers WHERE id = ?', [resellerId]);
            } else if (resellerType === 'gesoffice') {
                resellerInfo = await db.get('SELECT username FROM gesoffice_resellers WHERE id = ?', [resellerId]);
            }

            if (!resellerInfo || !resellerInfo.username) {
                console.error(`[Payment] Revendedor não encontrado: ID ${resellerId}, Tipo ${resellerType}`);
                return res.status(404).json({ error: 'Revendedor não encontrado' });
            }

            const mpToken = await db.get('SELECT value FROM system_config WHERE key = ?', ['mp_access_token']);

            if (!mpToken || !mpToken.value) {
                return res.status(500).json({ error: 'Mercado Pago não configurado' });
            }

            const paymentService = new PaymentService(mpToken.value);
            
            // Descrição adaptada para cada tipo
            let description;
            if (resellerType === 'sigma') {
                description = `${packageData.credits} créditos Sigma - ${resellerInfo.username}`;
            } else if (resellerType === 'koffice') {
                description = `${packageData.credits} créditos Koffice - ${resellerInfo.username}`;
            } else if (resellerType === 'gesoffice') {
                description = `${packageData.credits} créditos UNIPLAY - ${resellerInfo.username}`;
            }
            
            const payment = await paymentService.createPixPayment(
                packageData.price,
                description,
                resellerId
            );

            const result = await db.run(`
                INSERT INTO payments 
                (reseller_id, reseller_type, package_id, credits, amount, mp_payment_id, qr_code, qr_code_base64, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 minutes'))
            `, [
                resellerId,
                resellerType,
                packageId,
                packageData.credits,
                packageData.price,
                payment.paymentId,
                payment.qrCode,
                payment.qrCodeBase64
            ]);

            console.log(`[Payment] Criado para ${resellerInfo.username} (${resellerType}): ${packageData.credits} créditos`);

            res.json({
                payment_id: result.id,
                qr_code: payment.qrCode,
                qr_code_base64: payment.qrCodeBase64,
                amount: packageData.price,
                credits: packageData.credits,
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            });

        } catch (error) {
            console.error('Erro ao criar pagamento:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // VERIFICAR STATUS DO PAGAMENTO
    // ========================================
    
    router.get('/payment-status/:paymentId', async (req, res) => {
        try {
            const payment = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            res.json({
                status: payment.status,
                paid_at: payment.paid_at,
                expires_at: payment.expires_at
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // VERIFICAÇÃO MANUAL DE PAGAMENTO
    // ========================================
    
    router.post('/check-payment/:paymentId', async (req, res) => {
        try {
            const payment = await db.get(`
                SELECT p.*, 
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                    END as username
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
                WHERE p.id = ?
            `, [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            if (payment.status === 'approved') {
                return res.json({ status: 'approved', message: 'Pagamento já foi processado' });
            }

            const mpToken = await db.get('SELECT value FROM system_config WHERE key = ?', ['mp_access_token']);

            if (!mpToken || !mpToken.value) {
                return res.status(500).json({ error: 'Mercado Pago não configurado' });
            }

            const paymentService = new PaymentService(mpToken.value);
            const mpPayment = await paymentService.checkPaymentStatus(payment.mp_payment_id);

            if (mpPayment.status === 'approved') {
                // Processar recarga
                try {
                    let rechargeResult;
                    
                    if (payment.reseller_type === 'sigma') {
                        const panel = await db.get('SELECT * FROM sigma_panels WHERE id = (SELECT panel_id FROM resellers WHERE id = ?)', [payment.reseller_id]);
                        const sigmaService = new SigmaService(panel.url, panel.admin_username, panel.admin_password);
                        const reseller = await db.get('SELECT * FROM resellers WHERE id = ?', [payment.reseller_id]);
                        rechargeResult = await sigmaService.addCredits(reseller.sigma_user_id, payment.credits);
                    } 
                    else if (payment.reseller_type === 'koffice') {
                        const panel = await db.get('SELECT * FROM koffice_panels WHERE id = (SELECT panel_id FROM koffice_resellers WHERE id = ?)', [payment.reseller_id]);
                        const anticaptchaKey = await db.get('SELECT value FROM system_config WHERE key = ?', ['anticaptcha_api_key']);
                        const kofficeService = new KofficeService(panel.url, panel.admin_username, panel.admin_password, panel.has_captcha, anticaptchaKey?.value);
                        const reseller = await db.get('SELECT * FROM koffice_resellers WHERE id = ?', [payment.reseller_id]);
                        rechargeResult = await kofficeService.addCredits(reseller.koffice_id, payment.credits);
                    }
                    else if (payment.reseller_type === 'gesoffice') {
                        const panel = await db.get('SELECT * FROM gesoffice_panels WHERE id = (SELECT panel_id FROM gesoffice_resellers WHERE id = ?)', [payment.reseller_id]);
                        const gesService = new GesOfficeService(panel.url, panel.admin_username, panel.admin_password);
                        const reseller = await db.get('SELECT * FROM gesoffice_resellers WHERE id = ?', [payment.reseller_id]);
                        rechargeResult = await gesService.addCredits(reseller.gesoffice_id, payment.credits);
                    }

                    if (rechargeResult && rechargeResult.success) {
                        await db.run('UPDATE payments SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?', ['approved', payment.id]);
                        await db.run('INSERT INTO transactions (payment_id, reseller_id, reseller_type, credits, amount, sigma_response) VALUES (?, ?, ?, ?, ?, ?)', 
                            [payment.id, payment.reseller_id, payment.reseller_type, payment.credits, payment.amount, JSON.stringify(rechargeResult)]);
                        
                        return res.json({ 
                            status: 'approved', 
                            message: 'Pagamento aprovado e créditos adicionados!' 
                        });
                    } else {
                        return res.json({ 
                            status: 'error', 
                            message: 'Pagamento aprovado mas houve erro ao adicionar créditos. Tente reprocessar.' 
                        });
                    }
                } catch (error) {
                    return res.json({ 
                        status: 'error', 
                        message: 'Pagamento aprovado mas houve erro ao adicionar créditos. Tente reprocessar.' 
                    });
                }
            } else {
                return res.json({ 
                    status: mpPayment.status, 
                    message: `Pagamento ainda não foi aprovado. Status: ${mpPayment.status}` 
                });
            }

        } catch (error) {
            console.error('Erro ao verificar pagamento:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // RETRY DE RECARGA
    // ========================================
    
    router.post('/retry-recharge/:paymentId', async (req, res) => {
        try {
            const payment = await db.get(`
                SELECT p.*,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                    END as username
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
                WHERE p.id = ?
            `, [req.params.paymentId]);

            if (!payment || payment.status !== 'approved') {
                return res.status(400).json({ error: 'Pagamento não está aprovado' });
            }

            let rechargeResult;
            
            if (payment.reseller_type === 'sigma') {
                const panel = await db.get('SELECT * FROM sigma_panels WHERE id = (SELECT panel_id FROM resellers WHERE id = ?)', [payment.reseller_id]);
                const sigmaService = new SigmaService(panel.url, panel.admin_username, panel.admin_password);
                const reseller = await db.get('SELECT * FROM resellers WHERE id = ?', [payment.reseller_id]);
                rechargeResult = await sigmaService.addCredits(reseller.sigma_user_id, payment.credits);
            } 
            else if (payment.reseller_type === 'koffice') {
                const panel = await db.get('SELECT * FROM koffice_panels WHERE id = (SELECT panel_id FROM koffice_resellers WHERE id = ?)', [payment.reseller_id]);
                const anticaptchaKey = await db.get('SELECT value FROM system_config WHERE key = ?', ['anticaptcha_api_key']);
                const kofficeService = new KofficeService(panel.url, panel.admin_username, panel.admin_password, panel.has_captcha, anticaptchaKey?.value);
                const reseller = await db.get('SELECT * FROM koffice_resellers WHERE id = ?', [payment.reseller_id]);
                rechargeResult = await kofficeService.addCredits(reseller.koffice_id, payment.credits);
            }
            else if (payment.reseller_type === 'gesoffice') {
                const panel = await db.get('SELECT * FROM gesoffice_panels WHERE id = (SELECT panel_id FROM gesoffice_resellers WHERE id = ?)', [payment.reseller_id]);
                const gesService = new GesOfficeService(panel.url, panel.admin_username, panel.admin_password);
                const reseller = await db.get('SELECT * FROM gesoffice_resellers WHERE id = ?', [payment.reseller_id]);
                rechargeResult = await gesService.addCredits(reseller.gesoffice_id, payment.credits);
            }

            if (rechargeResult && rechargeResult.success) {
                await db.run('INSERT INTO transactions (payment_id, reseller_id, reseller_type, credits, amount, sigma_response, success) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                    [payment.id, payment.reseller_id, payment.reseller_type, payment.credits, payment.amount, JSON.stringify(rechargeResult), 1]);
                
                res.json({ success: true, message: 'Recarga processada com sucesso!' });
            } else {
                res.json({ success: false, message: 'Erro ao processar recarga' });
            }

        } catch (error) {
            console.error('Erro no retry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // HISTÓRICO DE PAGAMENTOS DO REVENDEDOR
    // ========================================
    
    router.get('/reseller-payments/:resellerId/:type', async (req, res) => {
        try {
            const { resellerId, type } = req.params;
            
            const payments = await db.query(`
                SELECT * FROM payments 
                WHERE reseller_id = ? AND reseller_type = ? 
                ORDER BY created_at DESC 
                LIMIT 50
            `, [resellerId, type]);

            res.json(payments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CANCELAR PAGAMENTOS PENDENTES DE ADMIN EXPIRADO (INTERNO)
    // ========================================
    
    router.post('/internal/cancel-expired-payments', async (req, res) => {
        try {
            // Cancelar todos os pagamentos pendentes das últimas 24h
            const result = await db.run(`
                UPDATE payments 
                SET status = 'cancelled' 
                WHERE status = 'pending' 
                AND created_at > datetime('now', '-1 day')
            `);

            console.log(`[Cleanup] ${result.changes} pagamentos pendentes cancelados`);

            res.json({ 
                success: true, 
                cancelled: result.changes,
                message: `${result.changes} pagamentos pendentes cancelados`
            });

        } catch (error) {
            console.error('[Cleanup] Erro ao cancelar pagamentos:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
