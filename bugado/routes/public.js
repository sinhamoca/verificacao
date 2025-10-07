// routes/public.js - VERSÃO MULTI-TENANT COMPLETA
const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = (db) => {
    // ========================================
    // VERIFICAÇÃO DE ACESSO (POR USUÁRIO)
    // ========================================

    router.post('/verify-access', async (req, res) => {
        try {
            const { answer } = req.body;
            
            // IMPORTANTE: Sempre buscar da config GLOBAL pois ainda não sabemos qual usuário
            // A pergunta/resposta é verificada ANTES do login do revendedor
            const config = await db.get('SELECT value FROM system_config WHERE key = ?', ['access_answer']);
            
            if (!config) {
                return res.status(500).json({ error: 'Configuração não encontrada' });
            }

            const hashedAnswer = hashPassword(answer);
            const isValid = hashedAnswer === config.value;
            
            res.json({ valid: isValid });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Buscar pergunta de acesso (GLOBAL)
    router.get('/access-question', async (req, res) => {
        try {
            // IMPORTANTE: Pergunta é global por enquanto
            // TODO: Implementar subdomínio ou slug de usuário
            const config = await db.get('SELECT value FROM system_config WHERE key = ?', ['access_question']);
            
            res.json({ 
                question: config?.value || 'Qual a senha de acesso?' 
            });
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
            
            // 1. Tentar encontrar em Sigma
            let reseller = await db.get(`
                SELECT r.*, sp.name as panel_name, sp.url as panel_url, 
                       sp.user_id, 'sigma' as type
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE r.username = ? AND r.status = 'active'
            `, [username]);

            // 2. Se não encontrou, tentar em Koffice
            if (!reseller) {
                reseller = await db.get(`
                    SELECT kr.*, kp.name as panel_name, kp.url as panel_url,
                           kp.user_id, 'koffice' as type
                    FROM koffice_resellers kr
                    JOIN koffice_panels kp ON kr.panel_id = kp.id
                    WHERE kr.username = ? AND kr.status = 'active'
                `, [username]);
            }

            // 3. Se não encontrou, tentar em GesOffice
            if (!reseller) {
                reseller = await db.get(`
                    SELECT gr.*, gp.name as panel_name, gp.url as panel_url,
                           gp.user_id, 'gesoffice' as type
                    FROM gesoffice_resellers gr
                    JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                    WHERE gr.username = ? AND gr.status = 'active'
                `, [username]);
            }

            if (!reseller) {
                return res.status(404).json({ 
                    error: 'Revendedor não encontrado',
                    code: 'RESELLER_NOT_FOUND'
                });
            }

            console.log(`[Public] Login revendedor: ${username} (${reseller.type}) - User ID: ${reseller.user_id}`);

            res.json({
                success: true,
                reseller: {
                    id: reseller.id,
                    username: reseller.username,
                    panel_name: reseller.panel_name,
                    panel_url: reseller.panel_url,
                    type: reseller.type,
                    user_id: reseller.user_id  // IMPORTANTE: ID do dono do revendedor
                }
            });

        } catch (error) {
            console.error('[Public] Erro no login:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PACOTES DE CRÉDITOS (FILTRADO POR USER_ID DO REVENDEDOR)
    // ========================================
    router.get('/packages/:resellerId', async (req, res) => {
        try {
            const { resellerId } = req.params;
            const { type } = req.query;

            // Buscar user_id do revendedor
            let resellerUserId;
            
            if (type === 'sigma') {
                const reseller = await db.get('SELECT user_id FROM resellers WHERE id = ?', [resellerId]);
                resellerUserId = reseller?.user_id;
            } else if (type === 'koffice') {
                const reseller = await db.get('SELECT user_id FROM koffice_resellers WHERE id = ?', [resellerId]);
                resellerUserId = reseller?.user_id;
            } else if (type === 'gesoffice') {
                const reseller = await db.get('SELECT user_id FROM gesoffice_resellers WHERE id = ?', [resellerId]);
                resellerUserId = reseller?.user_id;
            }

            if (!resellerUserId) {
                return res.status(404).json({ error: 'Revendedor não encontrado' });
            }

            // Buscar pacotes DO USUÁRIO que criou esse revendedor
            const packages = await db.query(`
                SELECT * FROM credit_packages 
                WHERE user_id = ? AND status = 'active'
                ORDER BY credits ASC
            `, [resellerUserId]);

            res.json(packages);

        } catch (error) {
            console.error('[Public] Erro ao buscar pacotes:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CRIAR PAGAMENTO (USA MP DO DONO DO REVENDEDOR)
    // ========================================
    router.post('/create-payment', async (req, res) => {
        try {
            const { resellerId, packageId, resellerType } = req.body;

            // Buscar pacote
            const packageData = await db.get(
                'SELECT * FROM credit_packages WHERE id = ? AND status = ?',
                [packageId, 'active']
            );

            if (!packageData) {
                return res.status(404).json({ error: 'Pacote não encontrado' });
            }

            // Buscar informações do revendedor E seu user_id
            let resellerInfo;
            let resellerUserId;
            
            if (resellerType === 'sigma') {
                resellerInfo = await db.get('SELECT username, user_id FROM resellers WHERE id = ?', [resellerId]);
            } else if (resellerType === 'koffice') {
                resellerInfo = await db.get('SELECT username, user_id FROM koffice_resellers WHERE id = ?', [resellerId]);
            } else if (resellerType === 'gesoffice') {
                resellerInfo = await db.get('SELECT username, user_id FROM gesoffice_resellers WHERE id = ?', [resellerId]);
            }

            if (!resellerInfo || !resellerInfo.username) {
                console.error(`[Payment] Revendedor não encontrado: ID ${resellerId}, Tipo ${resellerType}`);
                return res.status(404).json({ error: 'Revendedor não encontrado' });
            }

            resellerUserId = resellerInfo.user_id;

            // 🔑 CRÍTICO: Buscar configuração do Mercado Pago DO USUÁRIO que criou o revendedor
            const mpToken = await db.getUserConfig(resellerUserId, 'mp_access_token');

            if (!mpToken) {
                console.error(`[Payment] Mercado Pago não configurado para user_id: ${resellerUserId}`);
                return res.status(500).json({ 
                    error: 'Mercado Pago não configurado para este usuário',
                    code: 'MP_NOT_CONFIGURED'
                });
            }

            console.log(`[Payment] Usando MP do user_id: ${resellerUserId}`);

            const paymentService = new PaymentService(mpToken);
            
            // Descrição do pagamento
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

            // Salvar pagamento COM user_id
            const result = await db.run(`
                INSERT INTO payments 
                (user_id, reseller_id, reseller_type, package_id, credits, amount, mp_payment_id, qr_code, qr_code_base64, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 minutes'))
            `, [
                resellerUserId,  // IMPORTANTE: ID do dono
                resellerId,
                resellerType,
                packageId,
                packageData.credits,
                packageData.price,
                payment.paymentId,
                payment.qrCode,
                payment.qrCodeBase64
            ]);

            console.log(`[Payment] Criado para ${resellerInfo.username} (${resellerType}): ${packageData.credits} créditos - User: ${resellerUserId}`);

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

            if (payment.status === 'paid') {
                return res.json({ status: 'paid', message: 'Pagamento já foi processado' });
            }

            // Buscar MP token DO USUÁRIO que criou o pagamento
            const mpToken = await db.getUserConfig(payment.user_id, 'mp_access_token');

            if (!mpToken) {
                return res.status(500).json({ error: 'Mercado Pago não configurado' });
            }

            const cleanPaymentId = String(payment.mp_payment_id).replace('.0', '');

            const axios = require('axios');
            const mpResponse = await axios.get(
                `https://api.mercadopago.com/v1/payments/${cleanPaymentId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${mpToken}`
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
            console.error('[Public] Erro ao verificar status:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // FORÇAR VERIFICAÇÃO DE PAGAMENTO
    // ========================================
    router.post('/check-payment/:paymentId', async (req, res) => {
        try {
            const payment = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            if (payment.status === 'paid') {
                return res.json({ status: 'paid', message: 'Pagamento já foi processado' });
            }

            // Buscar MP token DO USUÁRIO
            const mpToken = await db.getUserConfig(payment.user_id, 'mp_access_token');

            if (!mpToken) {
                return res.status(500).json({ error: 'Mercado Pago não configurado' });
            }

            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            
            const result = await monitor.processRecharge(payment, true);
            
            if (result.success) {
                return res.json({ 
                    status: 'paid', 
                    message: 'Créditos adicionados com sucesso!' 
                });
            } else {
                return res.json({ 
                    status: 'error', 
                    message: result.message || 'Erro ao processar recarga' 
                });
            }

        } catch (error) {
            console.error('[Public] Erro ao verificar pagamento:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // DASHBOARD DO REVENDEDOR
    // ========================================
    router.get('/dashboard/:resellerId', async (req, res) => {
        try {
            const { resellerId } = req.params;
            const { type } = req.query;

            const payments = await db.query(`
                SELECT * FROM payments 
                WHERE reseller_id = ? AND reseller_type = ?
                ORDER BY created_at DESC
                LIMIT 20
            `, [resellerId, type]);

            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_payments,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'paid' THEN credits ELSE 0 END) as total_credits,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_spent
                FROM payments
                WHERE reseller_id = ? AND reseller_type = ?
            `, [resellerId, type]);

            res.json({
                payments,
                stats: stats || {
                    total_payments: 0,
                    paid_count: 0,
                    total_credits: 0,
                    total_spent: 0
                }
            });

        } catch (error) {
            console.error('[Public] Erro ao buscar dashboard:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // REPROCESSAR RECARGA COM ERRO
    // ========================================
    router.post('/retry-recharge/:paymentId', async (req, res) => {
        try {
            const payment = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            if (payment.status !== 'error' && payment.status !== 'paid') {
                return res.status(400).json({ error: 'Pagamento não está com erro' });
            }

            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            
            const result = await monitor.processRecharge(payment, true);
            
            if (result.success) {
                return res.json({ 
                    success: true,
                    message: 'Créditos adicionados com sucesso!' 
                });
            } else {
                return res.json({ 
                    success: false,
                    message: result.message || 'Erro ao processar recarga' 
                });
            }

        } catch (error) {
            console.error('[Public] Erro ao reprocessar:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
