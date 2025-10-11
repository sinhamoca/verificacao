// routes/public.js - COMPLETO COM TODOS OS PAINÉIS + PAINELFODA
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

            // ⭐ Tentar PAINELFODA (NOVO)
            if (!reseller) {
                reseller = await db.get(`
                    SELECT 
                        pfr.*, 
                        pfp.name as panel_name, 
                        pfp.domain as panel_url,
                        pfp.tenant_id,
                        'painelfoda' as type,
                        t.expires_at
                    FROM painelfoda_resellers pfr
                    JOIN painelfoda_panels pfp ON pfr.panel_id = pfp.id
                    JOIN tenants t ON pfp.tenant_id = t.id
                    WHERE pfr.username = ? 
                    AND pfp.tenant_id = ? 
                    AND pfr.status = 'active'
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
            console.error('[Login] Erro:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // LISTAR PACOTES
    // ========================================
    router.get('/packages/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;
            
            const packages = await db.query(`
                SELECT * FROM credit_packages
                WHERE reseller_id = ? AND reseller_type = ?
                ORDER BY credits ASC
            `, [req.params.resellerId, type || 'sigma']);

            res.json(packages);
        } catch (error) {
            console.error('[Packages] Erro:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CRIAR PAGAMENTO (COM PAINELFODA)
    // ========================================
    router.post('/create-payment', async (req, res) => {
        try {
            const { resellerId, packageId, resellerType } = req.body;
            
            const packageData = await db.get('SELECT * FROM credit_packages WHERE id = ?', [packageId]);
            if (!packageData) {
                return res.status(404).json({ error: 'Pacote não encontrado' });
            }

            let resellerInfo;
            let panelTenantId;

            // ===== SIGMA =====
            if (resellerType === 'sigma') {
                resellerInfo = await db.get(`
                    SELECT r.*, sp.url, sp.admin_username, sp.admin_password, sp.tenant_id
                    FROM resellers r
                    JOIN sigma_panels sp ON r.panel_id = sp.id
                    WHERE r.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor Sigma não encontrado' });
                }
                
                const tenantValid = await db.isTenantValid(resellerInfo.tenant_id);
                if (!tenantValid) {
                    return res.status(403).json({ 
                        error: 'Sistema expirado ou indisponível.' 
                    });
                }

                panelTenantId = resellerInfo.tenant_id;
            } 
            // ===== KOFFICE =====
            else if (resellerType === 'koffice') {
                resellerInfo = await db.get(`
                    SELECT kr.*, kp.url, kp.admin_username, kp.admin_password, kp.tenant_id
                    FROM koffice_resellers kr
                    JOIN koffice_panels kp ON kr.panel_id = kp.id
                    WHERE kr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor Koffice não encontrado' });
                }
                
                const tenantValid = await db.isTenantValid(resellerInfo.tenant_id);
                if (!tenantValid) {
                    return res.status(403).json({ 
                        error: 'Sistema expirado ou indisponível.' 
                    });
                }

                panelTenantId = resellerInfo.tenant_id;
            } 
            // ===== GESOFFICE =====
            else if (resellerType === 'gesoffice') {
                resellerInfo = await db.get(`
                    SELECT gr.*, gp.url, gp.admin_username, gp.admin_password, gp.tenant_id
                    FROM gesoffice_resellers gr
                    JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                    WHERE gr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor GesOffice não encontrado' });
                }
                
                const tenantValid = await db.isTenantValid(resellerInfo.tenant_id);
                if (!tenantValid) {
                    return res.status(403).json({ 
                        error: 'Sistema expirado ou indisponível.' 
                    });
                }

                panelTenantId = resellerInfo.tenant_id;
            }
            // ===== P2BRAS =====
            else if (resellerType === 'p2bras') {
                resellerInfo = await db.get(`
                    SELECT pr.*, pp.url, pp.admin_username, pp.admin_password, pp.tenant_id
                    FROM p2bras_resellers pr
                    JOIN p2bras_panels pp ON pr.panel_id = pp.id
                    WHERE pr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor P2BRAS não encontrado' });
                }
                
                const tenantValid = await db.isTenantValid(resellerInfo.tenant_id);
                if (!tenantValid) {
                    return res.status(403).json({ 
                        error: 'Sistema expirado ou indisponível.' 
                    });
                }

                panelTenantId = resellerInfo.tenant_id;
            }
            // ===== RUSHPLAY =====
            else if (resellerType === 'rushplay') {
                resellerInfo = await db.get(`
                    SELECT rpr.*, rpp.url, rpp.admin_username, rpp.admin_password, rpp.tenant_id
                    FROM rushplay_resellers rpr
                    JOIN rushplay_panels rpp ON rpr.panel_id = rpp.id
                    WHERE rpr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor RushPlay não encontrado' });
                }
                
                const tenantValid = await db.isTenantValid(resellerInfo.tenant_id);
                if (!tenantValid) {
                    return res.status(403).json({ 
                        error: 'Sistema expirado ou indisponível.' 
                    });
                }

                panelTenantId = resellerInfo.tenant_id;
            }
            // ===== PAINELFODA ===== ⭐ NOVO
            else if (resellerType === 'painelfoda') {
                resellerInfo = await db.get(`
                    SELECT pfr.*, pfp.domain as url, pfp.admin_username, pfp.admin_password, pfp.tenant_id
                    FROM painelfoda_resellers pfr
                    JOIN painelfoda_panels pfp ON pfr.panel_id = pfp.id
                    WHERE pfr.id = ?
                `, [resellerId]);
                
                if (!resellerInfo) {
                    return res.status(404).json({ error: 'Revendedor PainelFoda não encontrado' });
                }
                
                const tenantValid = await db.isTenantValid(resellerInfo.tenant_id);
                if (!tenantValid) {
                    return res.status(403).json({ 
                        error: 'Sistema expirado ou indisponível.' 
                    });
                }

                panelTenantId = resellerInfo.tenant_id;
            }
            else {
                return res.status(400).json({ error: 'Tipo de revendedor inválido' });
            }

            // Buscar token MP do tenant
            const mpToken = await db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [panelTenantId, 'mp_access_token']
            );

            if (!mpToken || !mpToken.value) {
                return res.status(500).json({ error: 'Token Mercado Pago não configurado' });
            }

            // Criar pagamento no Mercado Pago
            const paymentService = new PaymentService(mpToken.value);
            const payment = await paymentService.createPixPayment(packageData.price);

            // Salvar no banco
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            
            // Determinar user_identifier baseado no tipo
            let userIdentifier;
            if (resellerType === 'sigma') {
                userIdentifier = resellerInfo.sigma_user_id;
            } else if (resellerType === 'koffice') {
                userIdentifier = resellerInfo.koffice_id;
            } else if (resellerType === 'gesoffice') {
                userIdentifier = resellerInfo.gesoffice_id;
            } else if (resellerType === 'p2bras') {
                userIdentifier = resellerInfo.p2bras_id;
            } else if (resellerType === 'rushplay') {
                userIdentifier = resellerInfo.rushplay_id;
            } else if (resellerType === 'painelfoda') {
                userIdentifier = resellerInfo.painelfoda_id; // ⭐ NOVO
            }

            const result = await db.run(`
                INSERT INTO payments (
                    reseller_id, 
                    reseller_type, 
                    package_id, 
                    credits, 
                    amount, 
                    mp_payment_id, 
                    qr_code, 
                    qr_code_base64, 
                    expires_at,
                    user_identifier
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                resellerId,
                resellerType,
                packageId,
                packageData.credits,
                packageData.price,
                payment.id,
                payment.qr_code,
                payment.qr_code_base64,
                expiresAt,
                userIdentifier
            ]);

            res.json({
                payment_id: result.lastID,
                id: result.lastID,
                credits: packageData.credits,
                amount: packageData.price,
                qr_code: payment.qr_code,
                qr_code_base64: payment.qr_code_base64,
                expires_at: expiresAt
            });

        } catch (error) {
            console.error('[Create Payment]', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // STATUS DO PAGAMENTO
    // ========================================
    router.get('/payment-status/:paymentId', async (req, res) => {
        try {
            const payment = await db.get('SELECT * FROM payments WHERE id = ?', [req.params.paymentId]);
            
            if (!payment) {
                return res.status(404).json({ error: 'Pagamento não encontrado' });
            }

            res.json({
                status: payment.status,
                credits: payment.credits,
                amount: payment.amount
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // DASHBOARD DO CLIENTE
    // ========================================
    router.get('/dashboard/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;
            
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_purchases,
                    SUM(amount) as total_spent,
                    SUM(credits) as total_credits
                FROM payments
                WHERE reseller_id = ? 
                AND reseller_type = ?
                AND status = 'paid'
            `, [req.params.resellerId, type || 'sigma']);
            
            const recentPayments = await db.query(`
                SELECT *
                FROM payments
                WHERE reseller_id = ? AND reseller_type = ?
                ORDER BY created_at DESC
                LIMIT 10
            `, [req.params.resellerId, type || 'sigma']);
            
            res.json({
                stats: stats || { total_purchases: 0, total_spent: 0, total_credits: 0 },
                recent_payments: recentPayments || []
            });

        } catch (error) {
            console.error('[Dashboard] Erro:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // RETRY RECHARGE (REPROCESSAR RECARGA)
    // ========================================
    router.post('/retry-recharge/:paymentId', async (req, res) => {
        try {
            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            
            const result = await monitor.retryPayment(req.params.paymentId);
            res.json(result);
            
        } catch (error) {
            console.error('[Retry Recharge] Erro:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // ========================================
    // RETRY ALL ERRORS (REPROCESSAR TODOS OS ERROS)
    // ========================================
    router.post('/retry-all-errors/:resellerId', async (req, res) => {
        try {
            const { type } = req.query;
            
            const errorPayments = await db.query(`
                SELECT * FROM payments 
                WHERE reseller_id = ? 
                AND reseller_type = ? 
                AND status IN ('error', 'expired')
            `, [req.params.resellerId, type || 'sigma']);

            if (errorPayments.length === 0) {
                return res.json({ 
                    success: true, 
                    message: 'Nenhuma recarga com erro encontrada',
                    total: 0,
                    succeeded: 0,
                    failed: 0
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
                message: `Processados ${errorPayments.length} pagamento(s): ${succeeded} sucesso, ${failed} falha(s)`,
                total: errorPayments.length,
                succeeded,
                failed
            });

        } catch (error) {
            console.error('[Retry All] Erro:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
