// routes/admin.js - COM SUPORTE A DATABASES DINÂMICOS POR ADMIN + LICENCIAMENTO
const express = require('express');
const router = express.Router();
const dbManager = require('../models/DatabaseManager');
const SigmaService = require('../services/SigmaService');
const KofficeService = require('../services/KofficeService');
const GesOfficeService = require('../services/GesOfficeService');

// ========================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ========================================

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Token não fornecido',
            code: 'NO_TOKEN'
        });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Validar sessão (agora é async)
    dbManager.validateSession(token).then(session => {
        if (!session) {
            return res.status(401).json({ 
                error: 'Sessão inválida ou expirada',
                code: 'INVALID_SESSION'
            });
        }
        
        // Anexa dados da sessão à requisição
        req.session = session;
        req.db = session.db;
        req.adminId = session.adminId;
        req.adminUsername = session.username;
        req.token = token;
        
        next();
    }).catch(error => {
        return res.status(500).json({ error: 'Erro ao validar sessão' });
    });
}

// ========================================
// ROTAS DE AUTENTICAÇÃO
// ========================================

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Preencha todos os campos' });
        }

        // Carrega database do admin
        const db = dbManager.getDatabase(username);
        
        // Verifica licença antes de verificar credenciais
        const licenseCheck = await dbManager.checkAdminLicense(db, username);
        
        if (!licenseCheck.valid) {
            console.log(`[Auth] Login bloqueado: ${username} - ${licenseCheck.reason}`);
            
            let errorMessage = 'Acesso bloqueado';
            
            if (licenseCheck.status === 'expired') {
                errorMessage = '🔒 Sua licença expirou! Entre em contato para renovar.';
            } else if (licenseCheck.status === 'suspended') {
                errorMessage = '🔒 Conta suspensa. Entre em contato com o suporte.';
            } else {
                errorMessage = `🔒 ${licenseCheck.reason}`;
            }
            
            return res.status(403).json({ 
                error: errorMessage,
                code: 'LICENSE_EXPIRED',
                status: licenseCheck.status,
                expired_at: licenseCheck.expired_at
            });
        }
        
        // Verifica credenciais
        const admin = await db.get(
            'SELECT * FROM admin_users WHERE username = ?', 
            [username]
        );

        if (!admin || dbManager.hashPassword(password) !== admin.password_hash) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Cria sessão com informações de licença
        const session = await dbManager.createSession(username, admin.id, licenseCheck);

        console.log(`[Auth] Login: ${username} (Database: databases/database_${username}.db, Expira: ${licenseCheck.expires_at || 'Ilimitado'})`);

        res.json({
            success: true,
            token: session.token,
            admin: {
                id: admin.id,
                username: admin.username || username,
                license: {
                    status: licenseCheck.status || 'active',
                    expires_at: licenseCheck.expires_at || null,
                    days_remaining: licenseCheck.days_remaining || null,
                    expiring_soon: licenseCheck.expiring_soon || false
                }
            }
        });

    } catch (error) {
        console.error('[Auth] Erro no login:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/logout', requireAuth, (req, res) => {
    try {
        dbManager.removeSession(req.token);
        console.log(`[Auth] Logout: ${req.adminUsername}`);
        res.json({ success: true, message: 'Logout realizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/verify-session', requireAuth, (req, res) => {
    res.json({ 
        valid: true,
        admin: {
            id: req.adminId,
            username: req.adminUsername,
            license: req.session.licenseInfo || {}
        }
    });
});

// ========================================
// LICENÇA
// ========================================

router.get('/license-status', requireAuth, async (req, res) => {
    try {
        const licenseInfo = req.session.licenseInfo;
        
        res.json({
            username: req.adminUsername,
            status: licenseInfo.status,
            expires_at: licenseInfo.expires_at,
            days_remaining: licenseInfo.days_remaining,
            expiring_soon: licenseInfo.expiring_soon,
            valid: licenseInfo.valid
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// CONFIGURAÇÕES
// ========================================

router.get('/config', requireAuth, async (req, res) => {
    try {
        const configs = await req.db.query('SELECT * FROM system_config');
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/config/:key', requireAuth, async (req, res) => {
    try {
        const { value } = req.body;
        const { key } = req.params;
        
        let finalValue = value;
        if (key === 'access_answer') {
            finalValue = dbManager.hashPassword(value);
        }
        
        await req.db.run(
            'UPDATE system_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
            [finalValue, key]
        );
        
        console.log(`[Config] ${req.adminUsername}: ${key} atualizado`);
        
        res.json({ success: true, message: 'Configuração atualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PAINÉIS SIGMA
// ========================================

router.get('/panels', requireAuth, async (req, res) => {
    try {
        const panels = await req.db.query('SELECT * FROM sigma_panels ORDER BY created_at DESC');
        res.json(Array.isArray(panels) ? panels : []);
    } catch (error) {
        console.error('[Panels] Erro:', error);
        res.json([]);
    }
});

router.post('/panels', requireAuth, async (req, res) => {
    try {
        const { name, url, admin_username, admin_password } = req.body;
        
        const result = await req.db.run(
            'INSERT INTO sigma_panels (name, url, admin_username, admin_password) VALUES (?, ?, ?, ?)',
            [name, url, admin_username, admin_password]
        );
        
        console.log(`[Panel] ${req.adminUsername}: Painel Sigma criado #${result.id}`);
        
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/panels/:id', requireAuth, async (req, res) => {
    try {
        const { name, url, admin_username, admin_password, status } = req.body;
        
        await req.db.run(
            'UPDATE sigma_panels SET name = ?, url = ?, admin_username = ?, admin_password = ?, status = ? WHERE id = ?',
            [name, url, admin_username, admin_password, status, req.params.id]
        );
        
        console.log(`[Panel] ${req.adminUsername}: Painel Sigma #${req.params.id} atualizado`);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/panels/:id', requireAuth, async (req, res) => {
    try {
        await req.db.run('DELETE FROM sigma_panels WHERE id = ?', [req.params.id]);
        console.log(`[Panel] ${req.adminUsername}: Painel Sigma #${req.params.id} deletado`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// REVENDEDORES SIGMA
// ========================================

router.get('/resellers', requireAuth, async (req, res) => {
    try {
        const resellers = await req.db.query(`
            SELECT r.*, p.name as panel_name, p.url as panel_url
            FROM resellers r
            LEFT JOIN sigma_panels p ON r.panel_id = p.id
            ORDER BY r.created_at DESC
        `);
        res.json(Array.isArray(resellers) ? resellers : []);
    } catch (error) {
        console.error('[Resellers] Erro:', error);
        res.json([]);
    }
});

router.post('/resellers', requireAuth, async (req, res) => {
    try {
        const { username, panel_id, sigma_user_id } = req.body;
        
        const result = await req.db.run(
            'INSERT INTO resellers (username, panel_id, sigma_user_id) VALUES (?, ?, ?)',
            [username, panel_id, sigma_user_id]
        );
        
        console.log(`[Reseller] ${req.adminUsername}: Revendedor Sigma criado #${result.id}`);
        
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/resellers/:id', requireAuth, async (req, res) => {
    try {
        await req.db.run('DELETE FROM resellers WHERE id = ?', [req.params.id]);
        console.log(`[Reseller] ${req.adminUsername}: Revendedor Sigma #${req.params.id} deletado`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PAINÉIS KOFFICE
// ========================================

router.get('/koffice-panels', requireAuth, async (req, res) => {
    try {
        const panels = await req.db.query('SELECT * FROM koffice_panels ORDER BY created_at DESC');
        res.json(Array.isArray(panels) ? panels : []);
    } catch (error) {
        console.error('[Koffice Panels] Erro:', error);
        res.json([]);
    }
});

router.post('/koffice-panels', requireAuth, async (req, res) => {
    try {
        const { name, url, admin_username, admin_password, has_captcha } = req.body;
        
        const result = await req.db.run(
            'INSERT INTO koffice_panels (name, url, admin_username, admin_password, has_captcha) VALUES (?, ?, ?, ?, ?)',
            [name, url, admin_username, admin_password, has_captcha ? 1 : 0]
        );
        
        console.log(`[Panel] ${req.adminUsername}: Painel Koffice criado #${result.id}`);
        
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/koffice-panels/:id', requireAuth, async (req, res) => {
    try {
        const { name, url, admin_username, admin_password, has_captcha, status } = req.body;
        
        await req.db.run(
            'UPDATE koffice_panels SET name = ?, url = ?, admin_username = ?, admin_password = ?, has_captcha = ?, status = ? WHERE id = ?',
            [name, url, admin_username, admin_password, has_captcha ? 1 : 0, status, req.params.id]
        );
        
        console.log(`[Panel] ${req.adminUsername}: Painel Koffice #${req.params.id} atualizado`);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/koffice-panels/:id', requireAuth, async (req, res) => {
    try {
        await req.db.run('DELETE FROM koffice_panels WHERE id = ?', [req.params.id]);
        console.log(`[Panel] ${req.adminUsername}: Painel Koffice #${req.params.id} deletado`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// REVENDEDORES KOFFICE
// ========================================

router.get('/koffice-resellers', requireAuth, async (req, res) => {
    try {
        const resellers = await req.db.query(`
            SELECT r.*, p.name as panel_name, p.url as panel_url
            FROM koffice_resellers r
            LEFT JOIN koffice_panels p ON r.panel_id = p.id
            ORDER BY r.created_at DESC
        `);
        res.json(Array.isArray(resellers) ? resellers : []);
    } catch (error) {
        console.error('[Koffice Resellers] Erro:', error);
        res.json([]);
    }
});

router.post('/koffice-resellers', requireAuth, async (req, res) => {
    try {
        const { username, panel_id, koffice_id } = req.body;
        
        const result = await req.db.run(
            'INSERT INTO koffice_resellers (username, panel_id, koffice_id) VALUES (?, ?, ?)',
            [username, panel_id, koffice_id]
        );
        
        console.log(`[Reseller] ${req.adminUsername}: Revendedor Koffice criado #${result.id}`);
        
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/koffice-resellers/:id', requireAuth, async (req, res) => {
    try {
        await req.db.run('DELETE FROM koffice_resellers WHERE id = ?', [req.params.id]);
        console.log(`[Reseller] ${req.adminUsername}: Revendedor Koffice #${req.params.id} deletado`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PAINÉIS GESOFFICE (UNIPLAY)
// ========================================

router.get('/gesoffice-panels', requireAuth, async (req, res) => {
    try {
        const panels = await req.db.query('SELECT * FROM gesoffice_panels ORDER BY created_at DESC');
        res.json(Array.isArray(panels) ? panels : []);
    } catch (error) {
        console.error('[GesOffice Panels] Erro:', error);
        res.json([]);
    }
});

router.post('/gesoffice-panels', requireAuth, async (req, res) => {
    try {
        const { name, url, admin_username, admin_password } = req.body;
        
        const result = await req.db.run(
            'INSERT INTO gesoffice_panels (name, url, admin_username, admin_password) VALUES (?, ?, ?, ?)',
            [name, url, admin_username, admin_password]
        );
        
        console.log(`[Panel] ${req.adminUsername}: Painel UNIPLAY criado #${result.id}`);
        
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/gesoffice-panels/:id', requireAuth, async (req, res) => {
    try {
        const { name, url, admin_username, admin_password, status } = req.body;
        
        await req.db.run(
            'UPDATE gesoffice_panels SET name = ?, url = ?, admin_username = ?, admin_password = ?, status = ? WHERE id = ?',
            [name, url, admin_username, admin_password, status, req.params.id]
        );
        
        console.log(`[Panel] ${req.adminUsername}: Painel UNIPLAY #${req.params.id} atualizado`);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/gesoffice-panels/:id', requireAuth, async (req, res) => {
    try {
        await req.db.run('DELETE FROM gesoffice_panels WHERE id = ?', [req.params.id]);
        console.log(`[Panel] ${req.adminUsername}: Painel UNIPLAY #${req.params.id} deletado`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// REVENDEDORES GESOFFICE (UNIPLAY)
// ========================================

router.get('/gesoffice-resellers', requireAuth, async (req, res) => {
    try {
        const resellers = await req.db.query(`
            SELECT r.*, p.name as panel_name, p.url as panel_url
            FROM gesoffice_resellers r
            LEFT JOIN gesoffice_panels p ON r.panel_id = p.id
            ORDER BY r.created_at DESC
        `);
        res.json(Array.isArray(resellers) ? resellers : []);
    } catch (error) {
        console.error('[GesOffice Resellers] Erro:', error);
        res.json([]);
    }
});

router.post('/gesoffice-resellers', requireAuth, async (req, res) => {
    try {
        const { username, panel_id, gesoffice_id } = req.body;
        
        const result = await req.db.run(
            'INSERT INTO gesoffice_resellers (username, panel_id, gesoffice_id) VALUES (?, ?, ?)',
            [username, panel_id, gesoffice_id]
        );
        
        console.log(`[Reseller] ${req.adminUsername}: Revendedor UNIPLAY criado #${result.id}`);
        
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/gesoffice-resellers/:id', requireAuth, async (req, res) => {
    try {
        await req.db.run('DELETE FROM gesoffice_resellers WHERE id = ?', [req.params.id]);
        console.log(`[Reseller] ${req.adminUsername}: Revendedor UNIPLAY #${req.params.id} deletado`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PACOTES DE CRÉDITO
// ========================================

router.get('/packages', requireAuth, async (req, res) => {
    try {
        const packages = await req.db.query('SELECT * FROM credit_packages WHERE active = 1 ORDER BY price ASC');
        res.json(Array.isArray(packages) ? packages : []);
    } catch (error) {
        console.error('[Packages] Erro:', error);
        res.json([]);
    }
});

router.post('/packages', requireAuth, async (req, res) => {
    try {
        const { name, credits, price, description } = req.body;
        
        const result = await req.db.run(
            'INSERT INTO credit_packages (name, credits, price, description) VALUES (?, ?, ?, ?)',
            [name, credits, price, description || '']
        );
        
        console.log(`[Package] ${req.adminUsername}: Pacote criado #${result.id}`);
        
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/packages/:id', requireAuth, async (req, res) => {
    try {
        const { name, credits, price, description, active } = req.body;
        
        await req.db.run(
            'UPDATE credit_packages SET name = ?, credits = ?, price = ?, description = ?, active = ? WHERE id = ?',
            [name, credits, price, description, active ? 1 : 0, req.params.id]
        );
        
        console.log(`[Package] ${req.adminUsername}: Pacote #${req.params.id} atualizado`);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/packages/:id', requireAuth, async (req, res) => {
    try {
        await req.db.run('DELETE FROM credit_packages WHERE id = ?', [req.params.id]);
        console.log(`[Package] ${req.adminUsername}: Pacote #${req.params.id} deletado`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PAGAMENTOS
// ========================================

router.get('/payments', requireAuth, async (req, res) => {
    try {
        const payments = await req.db.query(`
            SELECT 
                p.*,
                CASE 
                    WHEN p.reseller_type = 'sigma' THEN sr.username
                    WHEN p.reseller_type = 'koffice' THEN kr.username
                    WHEN p.reseller_type = 'gesoffice' THEN gr.username
                END as reseller_username,
                pkg.name as package_name
            FROM payments p
            LEFT JOIN resellers sr ON p.reseller_id = sr.id AND p.reseller_type = 'sigma'
            LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
            LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
            LEFT JOIN credit_packages pkg ON p.package_id = pkg.id
            ORDER BY p.created_at DESC
            LIMIT 100
        `);
        
        res.json(Array.isArray(payments) ? payments : []);
    } catch (error) {
        console.error('[Payments] Erro:', error);
        res.json([]);
    }
});

// ========================================
// TRANSAÇÕES
// ========================================

router.get('/transactions', requireAuth, async (req, res) => {
    try {
        const transactions = await req.db.query(`
            SELECT 
                t.*,
                CASE 
                    WHEN t.reseller_type = 'sigma' THEN sr.username
                    WHEN t.reseller_type = 'koffice' THEN kr.username
                    WHEN t.reseller_type = 'gesoffice' THEN gr.username
                END as reseller_username,
                p.mp_payment_id
            FROM transactions t
            LEFT JOIN resellers sr ON t.reseller_id = sr.id AND t.reseller_type = 'sigma'
            LEFT JOIN koffice_resellers kr ON t.reseller_id = kr.id AND t.reseller_type = 'koffice'
            LEFT JOIN gesoffice_resellers gr ON t.reseller_id = gr.id AND t.reseller_type = 'gesoffice'
            LEFT JOIN payments p ON t.payment_id = p.id
            ORDER BY t.created_at DESC
            LIMIT 100
        `);
        
        res.json(Array.isArray(transactions) ? transactions : []);
    } catch (error) {
        console.error('[Transactions] Erro:', error);
        res.json([]);
    }
});

// ========================================
// DASHBOARD / ESTATÍSTICAS
// ========================================

router.get('/stats', requireAuth, async (req, res) => {
    try {
        const stats = await req.db.get(`
            SELECT 
                (SELECT COUNT(*) FROM sigma_panels WHERE status = 'active') as active_sigma_panels,
                (SELECT COUNT(*) FROM koffice_panels WHERE status = 'active') as active_koffice_panels,
                (SELECT COUNT(*) FROM gesoffice_panels WHERE status = 'active') as active_gesoffice_panels,
                (SELECT COUNT(*) FROM resellers WHERE status = 'active') as active_sigma_resellers,
                (SELECT COUNT(*) FROM koffice_resellers WHERE status = 'active') as active_koffice_resellers,
                (SELECT COUNT(*) FROM gesoffice_resellers WHERE status = 'active') as active_gesoffice_resellers,
                (SELECT COUNT(*) FROM payments WHERE status = 'approved') as total_payments,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'approved') as total_revenue,
                (SELECT COALESCE(SUM(credits), 0) FROM payments WHERE status = 'approved') as total_credits_sold,
                (SELECT COUNT(*) FROM payments WHERE status = 'pending') as pending_payments
        `);

        if (!stats) {
            return res.json({
                active_sigma_panels: 0,
                active_koffice_panels: 0,
                active_gesoffice_panels: 0,
                active_sigma_resellers: 0,
                active_koffice_resellers: 0,
                active_gesoffice_resellers: 0,
                active_panels: 0,
                active_resellers: 0,
                total_payments: 0,
                total_revenue: 0,
                total_credits_sold: 0,
                pending_payments: 0
            });
        }

        // Calcular totais
        stats.active_panels = (stats.active_sigma_panels || 0) + (stats.active_koffice_panels || 0) + (stats.active_gesoffice_panels || 0);
        stats.active_resellers = (stats.active_sigma_resellers || 0) + (stats.active_koffice_resellers || 0) + (stats.active_gesoffice_resellers || 0);

        res.json(stats);
    } catch (error) {
        console.error('[Stats] Erro:', error);
        res.json({
            active_sigma_panels: 0,
            active_koffice_panels: 0,
            active_gesoffice_panels: 0,
            active_sigma_resellers: 0,
            active_koffice_resellers: 0,
            active_gesoffice_resellers: 0,
            active_panels: 0,
            active_resellers: 0,
            total_payments: 0,
            total_revenue: 0,
            total_credits_sold: 0,
            pending_payments: 0
        });
    }
});

// ========================================
// MANAGER STATS (DEBUG)
// ========================================

router.get('/manager-stats', requireAuth, async (req, res) => {
    try {
        const stats = dbManager.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
