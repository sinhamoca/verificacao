// routes/public.js - COM LOGIN UNIFICADO (SIGMA + KOFFICE)
const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');
const crypto = require('crypto');

module.exports = (db) => {
    // Verificar senha de acesso
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

    // Buscar pergunta de acesso
    router.get('/access-question', async (req, res) => {
        try {
            const config = await db.get('SELECT value FROM system_config WHERE key = ?', ['access_question']);
            res.json({ question: config ? config.value : 'Qual a senha de acesso?' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // LOGIN UNIFICADO (DETECTA SIGMA OU KOFFICE)
    // ========================================
    router.post('/login', async (req, res) => {
        try {
            const { username } = req.body;
            
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

            if (!reseller) {
                return res.status(404).json({ error: 'Revendedor não encontrado' });
            }

            console.log(`[Login] ${username} (${reseller.type})`);

            res.json({
                id: reseller.id,
                username: reseller.username,
                panel_name: reseller.panel_name,
                panel_url: reseller.panel_url,
                type: reseller.type // sigma ou koffice
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // LISTAR PACOTES (UNIFICADO)
    // ========================================
    router.get('/packages/:resellerId', async (req, res) => {
        try {
            const { type } = req.query; // sigma ou koffice
            
            const packages = await db.query(`
                SELECT * FROM credit_packages
                WHERE reseller_id = ? AND reseller_type = ?
                ORDER BY credits ASC
            `, [req.params.resellerId, type || 'sigma']);

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
            
            const packageData = await db.get('SELECT * FROM credit_packages WHERE id = ?', [packageId]);

            if (!packageData) {
                return res.status(404).json({ error: 'Pacote não encontrado' });
            }

            // Buscar username do revendedor (Sigma ou Koffice)
            let resellerInfo;
            if (resellerType === 'sigma') {
                resellerInfo = await db.get('SELECT username FROM resellers WHERE id = ?', [resellerId]);
            } else {
                resellerInfo = await db.get('SELECT username FROM koffice_resellers WHERE id = ?', [resellerId]);
            }

            const mpToken = await db.get('SELECT value FROM system_config WHERE key = ?', ['mp_access_token']);

            if (!mpToken || !mpToken.value) {
                return res.status(500).json({ error: 'Mercado Pago não configurado' });
            }

            const paymentService = new PaymentService(mpToken.value);
            const payment = await paymentService.createPixPayment(
                packageData.price,
                `${packageData.credits} creditos ${resellerType === 'sigma' ? 'Sigma' : 'Koffice'} - ${resellerInfo.username}`,
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
                    END as username
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                WHERE p.id = ?
            `, [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            if (payment.status === 'paid') {
                return res.json({ status: 'paid', message: 'Pagamento já foi processado' });
            }

            const mpToken = await db.get('SELECT value FROM system_config WHERE key = ?', ['mp_access_token']);

            if (!mpToken || !mpToken.value) {
                return res.status(500).json({ error: 'Mercado Pago não configurado' });
            }

            const cleanPaymentId = String(payment.mp_payment_id).replace('.0', '');

            const axios = require('axios');
            const mpResponse = await axios.get(
                `https://api.mercadopago.com/v1/payments/${cleanPaymentId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${mpToken.value}`
                    },
                    validateStatus: () => true
                }
            );

            if (mpResponse.status !== 200) {
                return res.status(500).json({ error: 'Erro ao verificar pagamento no Mercado Pago' });
            }

            const mpPayment = mpResponse.data;

            if (mpPayment.status === 'approved') {
                const MonitorService = require('../services/MonitorService');
                const monitor = new MonitorService(db);
                
                try {
                    const result = await monitor.processRecharge(payment, true);
                    
                    if (result.success) {
                        return res.json({ 
                            status: 'paid', 
                            message: 'Pagamento confirmado e créditos adicionados!' 
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
                    END as username
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                WHERE p.id = ?
            `, [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            if (payment.status === 'paid') {
                return res.json({ 
                    success: false, 
                    message: 'Este pagamento já foi processado com sucesso' 
                });
            }

            if (payment.status !== 'error' && payment.status !== 'expired') {
                return res.json({ 
                    success: false, 
                    message: 'Este pagamento não está disponível para reprocessamento' 
                });
            }

            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            const result = await monitor.retryRecharge(req.params.paymentId);

            res.json(result);

        } catch (error) {
            console.error('Erro ao tentar retry:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========================================
    // DASHBOARD (UNIFICADO)
    // ========================================
    router.get('/dashboard/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;

            const payments = await db.query(`
                SELECT p.*, cp.credits as package_credits
                FROM payments p
                LEFT JOIN credit_packages cp ON p.package_id = cp.id
                WHERE p.reseller_id = ? AND p.reseller_type = ?
                ORDER BY p.created_at DESC
                LIMIT 10
            `, [req.params.resellerId, type || 'sigma']);

            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_payments,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'paid' THEN credits ELSE 0 END) as total_credits,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_spent
                FROM payments
                WHERE reseller_id = ? AND reseller_type = ?
            `, [req.params.resellerId, type || 'sigma']);

            res.json({
                payments,
                stats
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // RETRY EM LOTE
    // ========================================
    router.post('/retry-all-errors/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;

            const errorPayments = await db.query(`
                SELECT id, reseller_id, reseller_type, credits, amount
                FROM payments
                WHERE (status = 'error' OR status = 'expired')
                AND reseller_id = ?
                AND reseller_type = ?
                ORDER BY created_at ASC
            `, [req.params.resellerId, type || 'sigma']);

            if (errorPayments.length === 0) {
                return res.json({
                    success: true,
                    message: 'Nenhum pagamento disponível para reprocessamento',
                    total: 0,
                    processed: 0,
                    succeeded: 0,
                    failed: 0
                });
            }

            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);

            let succeeded = 0;
            let failed = 0;
            const results = [];

            for (const payment of errorPayments) {
                try {
                    const result = await monitor.retryRecharge(payment.id);
                    
                    if (result.success) {
                        succeeded++;
                    } else {
                        failed++;
                    }

                    results.push({
                        paymentId: payment.id,
                        success: result.success,
                        message: result.message
                    });

                    await new Promise(resolve => setTimeout(resolve, 1000));

                } catch (error) {
                    failed++;
                    results.push({
                        paymentId: payment.id,
                        success: false,
                        message: error.message
                    });
                }
            }

            res.json({
                success: true,
                message: `Processados ${errorPayments.length} pagamento(s): ${succeeded} sucesso, ${failed} falha(s)`,
                total: errorPayments.length,
                processed: errorPayments.length,
                succeeded,
                failed,
                details: results
            });

        } catch (error) {
            console.error('Erro ao processar retry em lote:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
