// routes/public.js
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

    // Login do revendedor
    router.post('/login', async (req, res) => {
        try {
            const { username } = req.body;
            
            const reseller = await db.get(`
                SELECT r.*, sp.name as panel_name, sp.url as panel_url
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE r.username = ? AND r.status = 'active'
            `, [username]);

            if (!reseller) {
                return res.status(404).json({ error: 'Revendedor não encontrado' });
            }

            res.json({
                id: reseller.id,
                username: reseller.username,
                panel_name: reseller.panel_name,
                panel_url: reseller.panel_url
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Listar pacotes do revendedor
    router.get('/packages/:resellerId', async (req, res) => {
        try {
            const packages = await db.query(`
                SELECT * FROM credit_packages
                WHERE reseller_id = ?
                ORDER BY credits ASC
            `, [req.params.resellerId]);

            res.json(packages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Criar pagamento
    router.post('/create-payment', async (req, res) => {
        try {
            const { resellerId, packageId } = req.body;
            
            const packageData = await db.get('SELECT * FROM credit_packages WHERE id = ?', [packageId]);

            if (!packageData) {
                return res.status(404).json({ error: 'Pacote não encontrado' });
            }

            const resellerInfo = await db.get('SELECT username FROM resellers WHERE id = ?', [resellerId]);

            const mpToken = await db.get('SELECT value FROM system_config WHERE key = ?', ['mp_access_token']);

            if (!mpToken || !mpToken.value) {
                return res.status(500).json({ error: 'Mercado Pago não configurado' });
            }

            const paymentService = new PaymentService(mpToken.value);
            const payment = await paymentService.createPixPayment(
                packageData.price,
                `${packageData.credits} creditos Sigma - ${resellerInfo.username}`,
                resellerId
            );

            const result = await db.run(`
                INSERT INTO payments 
                (reseller_id, package_id, credits, amount, mp_payment_id, qr_code, qr_code_base64, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 minutes'))
            `, [
                resellerId,
                packageId,
                packageData.credits,
                packageData.price,
                payment.paymentId,
                payment.qrCode,
                payment.qrCodeBase64
            ]);

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

    // Verificar status do pagamento
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

    // Verificação manual de pagamento
    router.post('/check-payment/:paymentId', async (req, res) => {
        try {
            const payment = await db.get(`
                SELECT p.*, r.username, r.panel_id, sp.url, sp.admin_username, sp.admin_password, r.sigma_user_id
                FROM payments p
                JOIN resellers r ON p.reseller_id = r.id
                JOIN sigma_panels sp ON r.panel_id = sp.id
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
                // Processar pagamento usando MonitorService
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
                        // Falhou ao adicionar créditos - status fica como 'error'
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

    router.post('/retry-recharge/:paymentId', async (req, res) => {
        try {
            const payment = await db.get(`
                SELECT p.*, r.username
                FROM payments p
                JOIN resellers r ON p.reseller_id = r.id
                WHERE p.id = ?
            `, [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            // Verificar se já está pago
            if (payment.status === 'paid') {
                return res.json({ 
                    success: false, 
                    message: 'Este pagamento já foi processado com sucesso' 
                });
            }

            // Verificar se pode fazer retry (apenas status 'error')
            if (payment.status !== 'error') {
                return res.json({ 
                    success: false, 
                    message: 'Este pagamento não está disponível para reprocessamento' 
                });
            }

            // Chamar MonitorService para fazer retry
            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            const result = await monitor.retryRecharge(req.params.paymentId);

            res.json(result);

        } catch (error) {
            console.error('Erro ao tentar retry:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    });

    // Dashboard do revendedor
    router.get('/dashboard/:resellerId', async (req, res) => {
        try {
            const payments = await db.query(`
                SELECT p.*, cp.credits as package_credits
                FROM payments p
                LEFT JOIN credit_packages cp ON p.package_id = cp.id
                WHERE p.reseller_id = ?
                ORDER BY p.created_at DESC
                LIMIT 10
            `, [req.params.resellerId]);

            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_payments,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'paid' THEN credits ELSE 0 END) as total_credits,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_spent
                FROM payments
                WHERE reseller_id = ?
            `, [req.params.resellerId]);

            res.json({
                payments,
                stats
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/retry-all-errors/:resellerId', async (req, res) => {
        try {
            // Buscar todos os pagamentos com status 'error' do revendedor
            const errorPayments = await db.query(`
                SELECT id, reseller_id, credits, amount
                FROM payments
                WHERE status = 'error'
                AND reseller_id = ?
                ORDER BY created_at ASC
            `, [req.params.resellerId]);

            if (errorPayments.length === 0) {
                return res.json({
                    success: true,
                    message: 'Nenhum pagamento com erro encontrado',
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

            // Processar cada pagamento
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

                    // Pequeno delay entre processamentos
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
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    return router;
};
