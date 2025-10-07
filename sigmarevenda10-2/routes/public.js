// routes/public.js - COM SUPORTE MULTI-TENANT + SIGMA + KOFFICE + GESOFFICE
const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');
const crypto = require('crypto');

module.exports = (db) => {
    
    // ========================================
    // PERGUNTA DE ACESSO (POR TENANT)
    // ========================================
    router.get('/access-question', async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Pegar tenant da query ou usar padrão
            const tenantSlug = req.query.tenant || req.query.t;
            let tenantId = 1; // Default
            
            if (tenantSlug) {
                const tenant = await db.get(
                    'SELECT id FROM tenants WHERE slug = ? AND status = ?',
                    [tenantSlug, 'active']
                );
                if (tenant) tenantId = tenant.id;
            }
            
            // ⭐ MULTI-TENANT: Buscar de tenant_config
            const config = await db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [tenantId, 'access_question']
            );
            
            res.json({ 
                question: config?.value || 'Qual a senha de acesso?',
                tenant_id: tenantId
            });
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // VERIFICAR SENHA DE ACESSO (POR TENANT)
    // ========================================
    router.post('/verify-access', async (req, res) => {
        try {
            const { answer } = req.body;
            
            // ⭐ MULTI-TENANT: Pegar tenant da query ou usar padrão
            const tenantSlug = req.query.tenant || req.query.t;
            let tenantId = 1;
            
            if (tenantSlug) {
                const tenant = await db.get(
                    'SELECT id FROM tenants WHERE slug = ?',
                    [tenantSlug]
                );
                if (tenant) tenantId = tenant.id;
            }
            
            // ⭐ MULTI-TENANT: Buscar de tenant_config
            const config = await db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [tenantId, 'access_answer']
            );
            
            if (!config) {
                return res.status(500).json({ error: 'Configuração não encontrada' });
            }

            const hashedAnswer = crypto.createHash('sha256').update(answer).digest('hex');
            const isValid = hashedAnswer === config.value;
            
            res.json({ valid: isValid, tenant_id: tenantId });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // LOGIN UNIFICADO (COM TENANT)
    // ========================================
    router.post('/login', async (req, res) => {
        try {
            const { username } = req.body;
            
            // ⭐ MULTI-TENANT: Pegar tenant da query
            const tenantSlug = req.query.tenant || req.query.t;
            let tenantId = 1;
            
            if (tenantSlug) {
                const tenant = await db.get(
                    'SELECT id FROM tenants WHERE slug = ?',
                    [tenantSlug]
                );
                if (tenant) tenantId = tenant.id;
            }
            
            // ⭐ MULTI-TENANT: Buscar revendedor no tenant específico
            
            // 1. Tentar encontrar em Sigma
            let reseller = await db.get(`
                SELECT r.*, sp.name as panel_name, sp.url as panel_url, sp.tenant_id, 'sigma' as type
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE r.username = ? AND sp.tenant_id = ? AND r.status = 'active'
            `, [username, tenantId]);

            // 2. Se não encontrou, tentar em Koffice
            if (!reseller) {
                reseller = await db.get(`
                    SELECT kr.*, kp.name as panel_name, kp.url as panel_url, kp.tenant_id, 'koffice' as type
                    FROM koffice_resellers kr
                    JOIN koffice_panels kp ON kr.panel_id = kp.id
                    WHERE kr.username = ? AND kp.tenant_id = ? AND kr.status = 'active'
                `, [username, tenantId]);
            }

            // 3. Se não encontrou, tentar em GesOffice
            if (!reseller) {
                reseller = await db.get(`
                    SELECT gr.*, gp.name as panel_name, gp.url as panel_url, gp.tenant_id, 'gesoffice' as type
                    FROM gesoffice_resellers gr
                    JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                    WHERE gr.username = ? AND gp.tenant_id = ? AND gr.status = 'active'
                `, [username, tenantId]);
            }

            if (!reseller) {
                return res.status(404).json({ error: 'Revendedor não encontrado' });
            }

            console.log(`[Login] ${username} (${reseller.type}) - Tenant: ${tenantId}`);

            res.json({
                id: reseller.id,
                username: reseller.username,
                panel_name: reseller.panel_name,
                panel_url: reseller.panel_url,
                type: reseller.type,
                tenant_id: reseller.tenant_id
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // LISTAR PACOTES
    // ========================================
    router.get('/packages/:resellerId', async (req, res) => {
        try {
            const { type } = req.query; // sigma, koffice ou gesoffice
            
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
    // CRIAR PAGAMENTO (COM TENANT)
    // ========================================
    router.post('/create-payment', async (req, res) => {
        try {
            const { resellerId, packageId, resellerType } = req.body;
            
            const packageData = await db.get('SELECT * FROM credit_packages WHERE id = ?', [packageId]);

            if (!packageData) {
                return res.status(404).json({ error: 'Pacote não encontrado' });
            }

            // ⭐ MULTI-TENANT: Buscar revendedor e seu tenant_id
            let resellerInfo;
            let panelTenantId;
            
            if (resellerType === 'sigma') {
                resellerInfo = await db.get(`
                    SELECT r.username, sp.tenant_id 
                    FROM resellers r
                    JOIN sigma_panels sp ON r.panel_id = sp.id
                    WHERE r.id = ?
                `, [resellerId]);
            } else if (resellerType === 'koffice') {
                resellerInfo = await db.get(`
                    SELECT kr.username, kp.tenant_id 
                    FROM koffice_resellers kr
                    JOIN koffice_panels kp ON kr.panel_id = kp.id
                    WHERE kr.id = ?
                `, [resellerId]);
            } else if (resellerType === 'gesoffice') {
                resellerInfo = await db.get(`
                    SELECT gr.username, gp.tenant_id 
                    FROM gesoffice_resellers gr
                    JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                    WHERE gr.id = ?
                `, [resellerId]);
            }

            if (!resellerInfo || !resellerInfo.username) {
                console.error(`[Payment] Revendedor não encontrado: ID ${resellerId}, Tipo ${resellerType}`);
                return res.status(404).json({ error: 'Revendedor não encontrado' });
            }

            panelTenantId = resellerInfo.tenant_id;

            // ⭐ MULTI-TENANT: Buscar token MP do tenant
            const mpToken = await db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [panelTenantId, 'mp_access_token']
            );

            if (!mpToken || !mpToken.value) {
                return res.status(500).json({ error: 'Mercado Pago não configurado para este tenant' });
            }

            const paymentService = new PaymentService(mpToken.value);
            
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

            console.log(`[Payment] Criado para ${resellerInfo.username} (${resellerType}, tenant ${panelTenantId}): ${packageData.credits} créditos`);

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
    // VERIFICAÇÃO MANUAL DE PAGAMENTO (COM TENANT)
    // ========================================
    router.post('/check-payment/:paymentId', async (req, res) => {
        try {
            const payment = await db.get(`
                SELECT p.*, 
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                    END as username,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.tenant_id
                        WHEN p.reseller_type = 'koffice' THEN kp.tenant_id
                        WHEN p.reseller_type = 'gesoffice' THEN gp.tenant_id
                    END as tenant_id
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN sigma_panels sp ON r.panel_id = sp.id
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN koffice_panels kp ON kr.panel_id = kp.id
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
                LEFT JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                WHERE p.id = ?
            `, [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            if (payment.status === 'paid') {
                return res.json({ status: 'paid', message: 'Pagamento já foi processado' });
            }

            // ⭐ MULTI-TENANT: Buscar token MP do tenant
            const mpToken = await db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [payment.tenant_id, 'mp_access_token']
            );

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
    // DASHBOARD DO REVENDEDOR
    // ========================================
    router.get('/dashboard/:resellerId', async (req, res) => {
        try {
            const { type } = req.query; // sigma, koffice ou gesoffice
            
            const stats = await db.get(`
                SELECT 
                    COUNT(CASE WHEN status = 'paid' THEN 1 END) as total_purchases,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_spent,
                    SUM(CASE WHEN status = 'paid' THEN credits ELSE 0 END) as total_credits
                FROM payments
                WHERE reseller_id = ? AND reseller_type = ?
            `, [req.params.resellerId, type || 'sigma']);
            
            const recentPayments = await db.query(`
                SELECT *
                FROM payments
                WHERE reseller_id = ? AND reseller_type = ?
                ORDER BY created_at DESC
                LIMIT 10
            `, [req.params.resellerId, type || 'sigma']);
            
            res.json({
                stats,
                payments: recentPayments
            });
            
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // RETRY DE RECARGA (CLIENTE)
    // ========================================
    router.post('/retry-recharge/:paymentId', async (req, res) => {
        try {
            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            
            const result = await monitor.retryPayment(req.params.paymentId);
            
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========================================
    // RETRY ALL ERRORS (CLIENTE)
    // ========================================
    router.post('/retry-all-errors/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;
            
            const errorPayments = await db.query(`
                SELECT * FROM payments 
                WHERE reseller_id = ? 
                AND reseller_type = ?
                AND status = 'error'
                ORDER BY created_at DESC
                LIMIT 5
            `, [req.params.resellerId, type || 'sigma']);

            if (errorPayments.length === 0) {
                return res.json({
                    success: true,
                    message: 'Nenhum pagamento com erro encontrado',
                    processed: 0
                });
            }

            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            
            let succeeded = 0;
            let failed = 0;

            for (const payment of errorPayments) {
                try {
                    const result = await monitor.retryPayment(payment.id);
                    if (result.success) {
                        succeeded++;
                    } else {
                        failed++;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    failed++;
                }
            }

            res.json({
                success: true,
                message: `Processados ${errorPayments.length}: ${succeeded} sucesso, ${failed} falha(s)`,
                processed: errorPayments.length,
                succeeded,
                failed
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
