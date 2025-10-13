// routes/public.js - COMPLETO COM PAINELFODA + TODOS OS PAINÉIS
const express = require('express');
const PaymentService = require('../services/PaymentService');

module.exports = (db) => {
    const router = express.Router();

    // ========================================
    // PERGUNTA DE ACESSO
    // ========================================
    router.get('/access-question', async (req, res) => {
        try {
            const tenantId = req.query.tenant_id || 1;
            
            const config = await db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [tenantId, 'access_question']
            );
            
            res.json({ 
                question: config?.value || 'Qual é a resposta?' 
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // VERIFICAR RESPOSTA DE ACESSO
    // ========================================
    router.post('/verify-access', async (req, res) => {
        try {
            const { answer } = req.body;
            const tenantId = req.query.tenant_id || 1;
            
            const config = await db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [tenantId, 'access_answer']
            );
            
            const isValid = config && config.value.toLowerCase() === answer.toLowerCase();
            
            res.json({ success: isValid });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // VERIFICAR REVENDEDOR (COM PAINELFODA)
    // ========================================
    router.post('/verify-reseller', async (req, res) => {
        try {
            const { username } = req.body;
            const tenantId = req.query.tenant_id || 1;

            let reseller = null;

            // Tentar encontrar em Sigma
            reseller = await db.get(`
                SELECT 
                    r.*, 
                    sp.name as panel_name, 
                    sp.url as panel_url,
                    sp.tenant_id,
                    'sigma' as type,
                    t.expires_at
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                JOIN tenants t ON sp.tenant_id = t.id
                WHERE r.username = ? 
                AND sp.tenant_id = ? 
                AND r.status = 'active'
                AND t.status = 'active'
                AND (t.expires_at IS NULL OR t.expires_at >= DATE('now'))
            `, [username, tenantId]);

            // Tentar Koffice
            if (!reseller) {
                reseller = await db.get(`
                    SELECT 
                        kr.*, 
                        kp.name as panel_name, 
                        kp.url as panel_url,
                        kp.tenant_id,
                        'koffice' as type,
                        t.expires_at
                    FROM koffice_resellers kr
                    JOIN koffice_panels kp ON kr.panel_id = kp.id
                    JOIN tenants t ON kp.tenant_id = t.id
                    WHERE kr.username = ? 
                    AND kp.tenant_id = ? 
                    AND kr.status = 'active'
                    AND t.status = 'active'
                    AND (t.expires_at IS NULL OR t.expires_at >= DATE('now'))
                `, [username, tenantId]);
            }

            // Tentar GesOffice
            if (!reseller) {
                reseller = await db.get(`
                    SELECT 
                        gr.*, 
                        gp.name as panel_name, 
                        gp.url as panel_url,
                        gp.tenant_id,
                        'gesoffice' as type,
                        t.expires_at
                    FROM gesoffice_resellers gr
                    JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                    JOIN tenants t ON gp.tenant_id = t.id
                    WHERE gr.username = ? 
                    AND gp.tenant_id = ? 
                    AND gr.status = 'active'
                    AND t.status = 'active'
                    AND (t.expires_at IS NULL OR t.expires_at >= DATE('now'))
                `, [username, tenantId]);
            }

            // Tentar P2BRAS
            if (!reseller) {
                reseller = await db.get(`
                    SELECT 
                        pr.*, 
                        pp.name as panel_name, 
                        pp.url as panel_url,
                        pp.tenant_id,
                        'p2bras' as type,
                        t.expires_at
                    FROM p2bras_resellers pr
                    JOIN p2bras_panels pp ON pr.panel_id = pp.id
                    JOIN tenants t ON pp.tenant_id = t.id
                    WHERE pr.username = ? 
                    AND pp.tenant_id = ? 
                    AND pr.status = 'active'
                    AND t.status = 'active'
                    AND (t.expires_at IS NULL OR t.expires_at >= DATE('now'))
                `, [username, tenantId]);
            }

            // Tentar RushPlay
            if (!reseller) {
                reseller = await db.get(`
                    SELECT 
                        rr.*, 
                        rp.name as panel_name, 
                        rp.url as panel_url,
                        rp.tenant_id,
                        'rushplay' as type,
                        t.expires_at
                    FROM rushplay_resellers rr
                    JOIN rushplay_panels rp ON rr.panel_id = rp.id
                    JOIN tenants t ON rp.tenant_id = t.id
                    WHERE rr.username = ? 
                    AND rp.tenant_id = ? 
                    AND rr.status = 'active'
                    AND t.status = 'active'
                    AND (t.expires_at IS NULL OR t.expires_at >= DATE('now'))
                `, [username, tenantId]);
            }

            // ⭐ Tentar PainelFoda
            if (!reseller) {
                reseller = await db.get(`
                    SELECT 
                        pf.*, 
                        pp.name as panel_name, 
                        pp.url as panel_url,
                        pp.tenant_id,
                        'painelfoda' as type,
                        t.expires_at
                    FROM painelfoda_resellers pf
                    JOIN painelfoda_panels pp ON pf.panel_id = pp.id
                    JOIN tenants t ON pp.tenant_id = t.id
                    WHERE pf.username = ? 
                    AND pp.tenant_id = ? 
                    AND pf.status = 'active'
                    AND t.status = 'active'
                    AND (t.expires_at IS NULL OR t.expires_at >= DATE('now'))
                `, [username, tenantId]);
            }

            if (!reseller) {
                console.log(`[Login] ❌ Revendedor não encontrado ou tenant expirado: ${username}`);
                return res.status(404).json({ 
                    error: 'Revendedor não encontrado ou acesso expirado' 
                });
            }

            const expInfo = reseller.expires_at ? `Expira: ${reseller.expires_at}` : 'Sem expiração';
            console.log(`[Login] ✅ ${username} (${reseller.type}) - Tenant: ${tenantId} - ${expInfo}`);

            res.json({
                id: reseller.id,
                username: reseller.username,
                panel_name: reseller.panel_name,
                panel_url: reseller.panel_url,
                type: reseller.type,
                tenant_id: reseller.tenant_id,
                tenant_expires_at: reseller.expires_at
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // LISTAR PACOTES DO REVENDEDOR
    // ========================================
    router.get('/packages/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;
            
            const packages = await db.query(
                'SELECT * FROM credit_packages WHERE reseller_id = ? AND reseller_type = ? ORDER BY price ASC',
                [req.params.resellerId, type || 'sigma']
            );
            
            res.json(packages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CRIAR PAGAMENTO PIX (COM PAINELFODA)
    // ========================================
    router.post('/create-payment', async (req, res) => {
        try {
            const { resellerId, packageId, resellerType } = req.body;
            
            const packageData = await db.get(
                'SELECT * FROM credit_packages WHERE id = ?',
                [packageId]
            );
            
            if (!packageData) {
                return res.status(404).json({ error: 'Pacote não encontrado' });
            }
            
            let resellerInfo;
            let panelTenantId;
            
            if (resellerType === 'sigma') {
                resellerInfo = await db.get(`
                    SELECT r.*, sp.tenant_id 
                    FROM resellers r 
                    JOIN sigma_panels sp ON r.panel_id = sp.id 
                    WHERE r.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor Sigma não encontrado' });
                }
                
                panelTenantId = resellerInfo.tenant_id;
            } 
            else if (resellerType === 'koffice') {
                resellerInfo = await db.get(`
                    SELECT kr.*, kp.tenant_id 
                    FROM koffice_resellers kr 
                    JOIN koffice_panels kp ON kr.panel_id = kp.id 
                    WHERE kr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor Koffice não encontrado' });
                }
                
                panelTenantId = resellerInfo.tenant_id;
            } 
            else if (resellerType === 'gesoffice') {
                resellerInfo = await db.get(`
                    SELECT gr.*, gp.tenant_id 
                    FROM gesoffice_resellers gr 
                    JOIN gesoffice_panels gp ON gr.panel_id = gp.id 
                    WHERE gr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor GesOffice não encontrado' });
                }
                
                panelTenantId = resellerInfo.tenant_id;
            } 
            else if (resellerType === 'p2bras') {
                resellerInfo = await db.get(`
                    SELECT pr.*, pp.tenant_id 
                    FROM p2bras_resellers pr 
                    JOIN p2bras_panels pp ON pr.panel_id = pp.id 
                    WHERE pr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor P2BRAS não encontrado' });
                }
                
                panelTenantId = resellerInfo.tenant_id;
            }
            else if (resellerType === 'rushplay') {
                resellerInfo = await db.get(`
                    SELECT rr.*, rp.tenant_id 
                    FROM rushplay_resellers rr 
                    JOIN rushplay_panels rp ON rr.panel_id = rp.id 
                    WHERE rr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor RushPlay não encontrado' });
                }
                
                panelTenantId = resellerInfo.tenant_id;
            }
            // ⭐ NOVO: PainelFoda
            else if (resellerType === 'painelfoda') {
                resellerInfo = await db.get(`
                    SELECT pf.*, pp.tenant_id 
                    FROM painelfoda_resellers pf 
                    JOIN painelfoda_panels pp ON pf.panel_id = pp.id 
                    WHERE pf.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor PainelFoda não encontrado' });
                }
                
                panelTenantId = resellerInfo.tenant_id;
            }

            // Buscar token MP do tenant
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
            } else if (resellerType === 'p2bras') {
                description = `${packageData.credits} créditos P2BRAS - ${resellerInfo.username}`;
            } else if (resellerType === 'rushplay') {
                description = `${packageData.credits} créditos RushPlay - ${resellerInfo.username}`;
            } else if (resellerType === 'painelfoda') {
                description = `${packageData.credits} créditos PainelFoda - ${resellerInfo.username}`;
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

            console.log(`[Payment] ✅ Criado para ${resellerInfo.username} (${resellerType}, tenant ${panelTenantId}): ${packageData.credits} créditos`);

            res.json({
                payment_id: result.id,
                qr_code: payment.qrCode,
                qr_code_base64: payment.qrCodeBase64,
                amount: packageData.price,
                credits: packageData.credits,
                expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            });

        } catch (error) {
            console.error('[Payment] Erro ao criar pagamento:', error);
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
                paid_at: payment.paid_at
            });

        } catch (error) {
            console.error('[Payment Status] Erro:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // VERIFICAR E PROCESSAR PAGAMENTO MANUALMENTE (COM PAINELFODA)
    // ========================================
    router.post('/check-payment/:paymentId', async (req, res) => {
        try {
            const payment = await db.get(`
                SELECT p.*, 
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN sp.tenant_id
                        WHEN p.reseller_type = 'koffice' THEN kp.tenant_id
                        WHEN p.reseller_type = 'gesoffice' THEN gp.tenant_id
                        WHEN p.reseller_type = 'p2bras' THEN pp.tenant_id
                        WHEN p.reseller_type = 'rushplay' THEN rpp.tenant_id
                        WHEN p.reseller_type = 'painelfoda' THEN pfp.tenant_id
                    END as tenant_id
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
                WHERE p.id = ?
            `, [req.params.paymentId]);

            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            if (payment.status === 'paid') {
                return res.json({ status: 'paid', message: 'Pagamento já foi processado' });
            }

            // Buscar token MP do tenant
            const mpToken = await db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [payment.tenant_id, 'mp_access_token']
            );

            if (!mpToken || !mpToken.value) {
                return res.json({ 
                    status: 'error', 
                    message: 'Mercado Pago não configurado' 
                });
            }

            const paymentService = new PaymentService(mpToken.value);
            const mpPayment = await paymentService.getPaymentStatus(payment.mp_payment_id);

            if (mpPayment.status === 'approved') {
                const MonitorService = require('../services/MonitorService');
                const monitor = new MonitorService(db);
                
                try {
                    const result = await monitor.retryPayment(payment.id);
                    
                    if (result.success) {
                        return res.json({ 
                            status: 'paid', 
                            message: 'Créditos adicionados com sucesso!' 
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
            console.error('[Check Payment] Erro:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // DASHBOARD DO REVENDEDOR
    // ========================================
    router.get('/dashboard/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;
            
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
                LIMIT 20
            `, [req.params.resellerId, type || 'sigma']);
            
            res.json({
                stats: {
                    total_purchases: stats.total_purchases || 0,
                    total_spent: stats.total_spent || 0,
                    total_credits: stats.total_credits || 0
                },
                recent_payments: recentPayments
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // REPROCESSAR RECARGA
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
    // REPROCESSAR TODOS OS ERROS
    // ========================================
    router.post('/retry-all-errors/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;
            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            
            const errorPayments = await db.query(`
                SELECT * FROM payments 
                WHERE reseller_id = ? 
                AND reseller_type = ? 
                AND status = 'error'
                ORDER BY created_at DESC
            `, [req.params.resellerId, type || 'sigma']);
            
            let succeeded = 0;
            let failed = 0;
            const results = [];
            
            for (const payment of errorPayments) {
                try {
                    const result = await monitor.retryPayment(payment.id);
                    if (result.success) {
                        succeeded++;
                    } else {
                        failed++;
                    }
                    results.push({
                        paymentId: payment.id,
                        type: payment.reseller_type,
                        success: result.success,
                        message: result.message
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    failed++;
                    results.push({
                        paymentId: payment.id,
                        type: payment.reseller_type,
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
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};