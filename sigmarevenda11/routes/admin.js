// routes/admin.js - COM SUPORTE MULTI-TENANT + SIGMA + KOFFICE + GESOFFICE
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const activeSessions = new Map();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Token não fornecido',
            code: 'NO_TOKEN'
        });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const session = activeSessions.get(token);
    
    if (!session) {
        return res.status(401).json({ 
            error: 'Sessão inválida ou expirada',
            code: 'INVALID_SESSION'
        });
    }
    
    if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return res.status(401).json({ 
            error: 'Sessão expirada',
            code: 'EXPIRED_SESSION'
        });
    }
    
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    session.lastActivity = Date.now();
    
    req.adminId = session.adminId;
    req.adminUsername = session.username;
    req.tenantId = session.tenantId;  // ⭐ MULTI-TENANT
    
    next();
}

module.exports = (db) => {
    // ========================================
    // AUTENTICAÇÃO
    // ========================================

    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Preencha todos os campos' });
            }
            
            // ⭐ MULTI-TENANT: Buscar admin com tenant info
            const admin = await db.get(
                `SELECT a.*, t.name as tenant_name, t.slug as tenant_slug, t.expires_at, t.status as tenant_status
                FROM admin_users a 
                LEFT JOIN tenants t ON a.tenant_id = t.id 
                WHERE a.username = ? 
                AND a.status = 'active'
                AND t.status = 'active'
                AND (t.expires_at IS NULL OR t.expires_at >= DATE('now'))`,
                [username]
            );

            if (!admin || hashPassword(password) !== admin.password_hash) {
                return res.status(401).json({ 
                    error: 'Credenciais inválidas ou acesso expirado',
                    code: 'INVALID_CREDENTIALS'
                });
            }
            
            // ⭐ VERIFICAÇÃO ADICIONAL DE EXPIRAÇÃO (camada extra de segurança)
            const tenantInfo = await db.getTenantExpirationInfo(admin.tenant_id);
            if (!tenantInfo.valid) {
                console.log(`[Admin Login] ⚠️ Tentativa de login em tenant expirado: ${admin.username} (tenant: ${admin.tenant_name})`);
                return res.status(403).json({ 
                    error: 'Acesso expirado. Entre em contato com o suporte.',
                    code: 'TENANT_EXPIRED',
                    details: tenantInfo.expired ? 'Tenant expirado' : 'Tenant inativo'
                });
            }

            const token = generateToken();
            
            // ⭐ MULTI-TENANT: Salvar tenant_id na sessão
            activeSessions.set(token, {
                adminId: admin.id,
                username: admin.username,
                tenantId: admin.tenant_id,  // ⭐ NOVO
                createdAt: Date.now(),
                lastActivity: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000)
            });

            const expInfo = admin.expires_at ? 
                `Expira: ${admin.expires_at}` : 
                'Sem expiração';
            
            console.log(`[Auth] ✅ Login: ${username} (Tenant: ${admin.tenant_name || 'N/A'} - ${expInfo})`);

            // ⭐ MULTI-TENANT: Retornar info do tenant
            res.json({
                success: true,
                token,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    tenant_id: admin.tenant_id,
                    tenant_name: admin.tenant_name,
                    tenant_slug: admin.tenant_slug,
                    tenant_expires_at: admin.expires_at,  // ⭐ ADICIONAR
                    tenant_status: admin.tenant_status     // ⭐ ADICIONAR
                }
            });

        } catch (error) {
            console.error('[Auth] Erro no login:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/logout', requireAuth, (req, res) => {
        try {
            const token = req.headers.authorization.replace('Bearer ', '');
            activeSessions.delete(token);
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
                tenant_id: req.tenantId  // ⭐ MULTI-TENANT
            }
        });
    });

    // ========================================
    // CONFIGURAÇÕES
    // ========================================

    router.get('/config', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Buscar de tenant_config
            const configs = await db.query(
                'SELECT * FROM tenant_config WHERE tenant_id = ?',
                [req.tenantId]
            );
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
                finalValue = hashPassword(value);
            }

            // ⭐ MULTI-TENANT: Salvar em tenant_config
            await db.run(`
                INSERT OR REPLACE INTO tenant_config (tenant_id, key, value, updated_at)
                VALUES (?, ?, ?, datetime('now'))
            `, [req.tenantId, key, finalValue]);

            console.log(`[Config] ${req.adminUsername} (tenant ${req.tenantId}) atualizou: ${key}`);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PAINÉIS SIGMA
    // ========================================

    router.get('/panels', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Filtrar por tenant
            const panels = await db.query(
                'SELECT * FROM sigma_panels WHERE tenant_id = ? ORDER BY created_at DESC',
                [req.tenantId]
            );
            res.json(panels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/panels', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password } = req.body;
            
            // ⭐ MULTI-TENANT: Incluir tenant_id
            const result = await db.run(`
                INSERT INTO sigma_panels (tenant_id, name, url, admin_username, admin_password)
                VALUES (?, ?, ?, ?, ?)
            `, [req.tenantId, name, url, admin_username, admin_password]);

            console.log(`[Panels] ${req.adminUsername} (tenant ${req.tenantId}) criou painel Sigma: ${name}`);
            res.json({ id: result.id, message: 'Painel criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/panels/:id', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password, status } = req.body;
            
            // ⭐ MULTI-TENANT: Adicionar filtro por tenant
            await db.run(`
                UPDATE sigma_panels 
                SET name = ?, url = ?, admin_username = ?, admin_password = ?, status = ?
                WHERE id = ? AND tenant_id = ?
            `, [name, url, admin_username, admin_password, status, req.params.id, req.tenantId]);

            res.json({ message: 'Painel atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/panels/:id', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Adicionar filtro por tenant
            await db.run(
                'DELETE FROM sigma_panels WHERE id = ? AND tenant_id = ?',
                [req.params.id, req.tenantId]
            );
            res.json({ message: 'Painel excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PAINÉIS KOFFICE
    // ========================================

    router.get('/koffice-panels', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Filtrar por tenant
            const panels = await db.query(
                'SELECT * FROM koffice_panels WHERE tenant_id = ? ORDER BY created_at DESC',
                [req.tenantId]
            );
            res.json(panels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/koffice-panels', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password, has_captcha } = req.body;
            
            // ⭐ MULTI-TENANT: Incluir tenant_id
            const result = await db.run(`
                INSERT INTO koffice_panels (tenant_id, name, url, admin_username, admin_password, has_captcha)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [req.tenantId, name, url, admin_username, admin_password, has_captcha ? 1 : 0]);

            console.log(`[Koffice] ${req.adminUsername} (tenant ${req.tenantId}) criou painel Koffice: ${name}`);
            res.json({ id: result.id, message: 'Painel Koffice criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/koffice-panels/:id', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password, has_captcha, status } = req.body;
            
            // ⭐ MULTI-TENANT: Adicionar filtro por tenant
            await db.run(`
                UPDATE koffice_panels 
                SET name = ?, url = ?, admin_username = ?, admin_password = ?, has_captcha = ?, status = ?
                WHERE id = ? AND tenant_id = ?
            `, [name, url, admin_username, admin_password, has_captcha ? 1 : 0, status, req.params.id, req.tenantId]);

            res.json({ message: 'Painel Koffice atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/koffice-panels/:id', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Adicionar filtro por tenant
            await db.run(
                'DELETE FROM koffice_panels WHERE id = ? AND tenant_id = ?',
                [req.params.id, req.tenantId]
            );
            res.json({ message: 'Painel Koffice excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PAINÉIS GESOFFICE
    // ========================================

    router.get('/gesoffice-panels', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Filtrar por tenant
            const panels = await db.query(
                'SELECT * FROM gesoffice_panels WHERE tenant_id = ? ORDER BY created_at DESC',
                [req.tenantId]
            );
            res.json(panels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/gesoffice-panels', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password } = req.body;
            
            // ⭐ MULTI-TENANT: Incluir tenant_id
            const result = await db.run(`
                INSERT INTO gesoffice_panels (tenant_id, name, url, admin_username, admin_password)
                VALUES (?, ?, ?, ?, ?)
            `, [req.tenantId, name, url, admin_username, admin_password]);

            console.log(`[GesOffice] ${req.adminUsername} (tenant ${req.tenantId}) criou painel GesOffice: ${name}`);
            res.json({ id: result.id, message: 'Painel GesOffice criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/gesoffice-panels/:id', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password, status } = req.body;
            
            // ⭐ MULTI-TENANT: Adicionar filtro por tenant
            await db.run(`
                UPDATE gesoffice_panels 
                SET name = ?, url = ?, admin_username = ?, admin_password = ?, status = ?
                WHERE id = ? AND tenant_id = ?
            `, [name, url, admin_username, admin_password, status, req.params.id, req.tenantId]);

            res.json({ message: 'Painel GesOffice atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/gesoffice-panels/:id', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Adicionar filtro por tenant
            await db.run(
                'DELETE FROM gesoffice_panels WHERE id = ? AND tenant_id = ?',
                [req.params.id, req.tenantId]
            );
            res.json({ message: 'Painel GesOffice excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // REVENDEDORES SIGMA
    // ========================================

    router.get('/resellers', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Join com sigma_panels para filtrar por tenant
            const resellers = await db.query(`
                SELECT r.*, sp.name as panel_name, sp.url as panel_url
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE sp.tenant_id = ?
                ORDER BY r.created_at DESC
            `, [req.tenantId]);
            res.json(resellers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/resellers', requireAuth, async (req, res) => {
        try {
            const { username, panel_id } = req.body;
            
            // ⭐ MULTI-TENANT: Verificar se painel pertence ao tenant
            const panel = await db.get(
                'SELECT id FROM sigma_panels WHERE id = ? AND tenant_id = ?',
                [panel_id, req.tenantId]
            );
            
            if (!panel) {
                return res.status(403).json({ error: 'Painel não encontrado ou sem permissão' });
            }
            
            const result = await db.run(`
                INSERT INTO resellers (username, panel_id, reseller_type)
                VALUES (?, ?, 'sigma')
            `, [username, panel_id]);

            res.json({ id: result.id, message: 'Revendedor Sigma criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/resellers/:id', requireAuth, async (req, res) => {
        try {
            const { username, panel_id, status } = req.body;
            
            // ⭐ MULTI-TENANT: Verificar se revendedor pertence ao tenant
            const existing = await db.get(`
                SELECT r.id FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE r.id = ? AND sp.tenant_id = ?
            `, [req.params.id, req.tenantId]);
            
            if (!existing) {
                return res.status(403).json({ error: 'Revendedor não encontrado ou sem permissão' });
            }
            
            await db.run(`
                UPDATE resellers 
                SET username = ?, panel_id = ?, status = ?
                WHERE id = ?
            `, [username, panel_id, status, req.params.id]);

            res.json({ message: 'Revendedor atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/resellers/:id', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Deletar apenas se pertencer ao tenant
            const result = await db.run(`
                DELETE FROM resellers 
                WHERE id = ? AND EXISTS (
                    SELECT 1 FROM sigma_panels sp 
                    WHERE sp.id = resellers.panel_id AND sp.tenant_id = ?
                )
            `, [req.params.id, req.tenantId]);
            
            if (result.changes === 0) {
                return res.status(403).json({ error: 'Revendedor não encontrado ou sem permissão' });
            }
            
            res.json({ message: 'Revendedor excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // REVENDEDORES KOFFICE
    // ========================================

    router.get('/koffice-resellers', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Join com koffice_panels para filtrar por tenant
            const resellers = await db.query(`
                SELECT kr.*, kp.name as panel_name, kp.url as panel_url
                FROM koffice_resellers kr
                JOIN koffice_panels kp ON kr.panel_id = kp.id
                WHERE kp.tenant_id = ?
                ORDER BY kr.created_at DESC
            `, [req.tenantId]);
            res.json(resellers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/koffice-resellers', requireAuth, async (req, res) => {
        try {
            const { username, koffice_id, panel_id } = req.body;
            
            // ⭐ MULTI-TENANT: Verificar se painel pertence ao tenant
            const panel = await db.get(
                'SELECT id FROM koffice_panels WHERE id = ? AND tenant_id = ?',
                [panel_id, req.tenantId]
            );
            
            if (!panel) {
                return res.status(403).json({ error: 'Painel não encontrado ou sem permissão' });
            }
            
            const result = await db.run(`
                INSERT INTO koffice_resellers (username, koffice_id, panel_id)
                VALUES (?, ?, ?)
            `, [username, koffice_id, panel_id]);

            console.log(`[Koffice] ${req.adminUsername} criou revendedor: ${username} (ID: ${koffice_id})`);
            res.json({ id: result.id, message: 'Revendedor Koffice criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/koffice-resellers/:id', requireAuth, async (req, res) => {
        try {
            const { username, koffice_id, panel_id, status } = req.body;
            
            // ⭐ MULTI-TENANT: Verificar se revendedor pertence ao tenant
            const existing = await db.get(`
                SELECT kr.id FROM koffice_resellers kr
                JOIN koffice_panels kp ON kr.panel_id = kp.id
                WHERE kr.id = ? AND kp.tenant_id = ?
            `, [req.params.id, req.tenantId]);
            
            if (!existing) {
                return res.status(403).json({ error: 'Revendedor não encontrado ou sem permissão' });
            }
            
            await db.run(`
                UPDATE koffice_resellers 
                SET username = ?, koffice_id = ?, panel_id = ?, status = ?
                WHERE id = ?
            `, [username, koffice_id, panel_id, status, req.params.id]);

            res.json({ message: 'Revendedor Koffice atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/koffice-resellers/:id', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Deletar apenas se pertencer ao tenant
            const result = await db.run(`
                DELETE FROM koffice_resellers 
                WHERE id = ? AND EXISTS (
                    SELECT 1 FROM koffice_panels kp 
                    WHERE kp.id = koffice_resellers.panel_id AND kp.tenant_id = ?
                )
            `, [req.params.id, req.tenantId]);
            
            if (result.changes === 0) {
                return res.status(403).json({ error: 'Revendedor não encontrado ou sem permissão' });
            }
            
            res.json({ message: 'Revendedor Koffice excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // REVENDEDORES GESOFFICE
    // ========================================

    router.get('/gesoffice-resellers', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Join com gesoffice_panels para filtrar por tenant
            const resellers = await db.query(`
                SELECT gr.*, gp.name as panel_name, gp.url as panel_url
                FROM gesoffice_resellers gr
                JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                WHERE gp.tenant_id = ?
                ORDER BY gr.created_at DESC
            `, [req.tenantId]);
            res.json(resellers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/gesoffice-resellers', requireAuth, async (req, res) => {
        try {
            const { username, gesoffice_id, panel_id } = req.body;
            
            // ⭐ MULTI-TENANT: Verificar se painel pertence ao tenant
            const panel = await db.get(
                'SELECT id FROM gesoffice_panels WHERE id = ? AND tenant_id = ?',
                [panel_id, req.tenantId]
            );
            
            if (!panel) {
                return res.status(403).json({ error: 'Painel não encontrado ou sem permissão' });
            }
            
            const result = await db.run(`
                INSERT INTO gesoffice_resellers (username, gesoffice_id, panel_id)
                VALUES (?, ?, ?)
            `, [username, gesoffice_id, panel_id]);

            console.log(`[GesOffice] ${req.adminUsername} criou revendedor: ${username} (ID: ${gesoffice_id})`);
            res.json({ id: result.id, message: 'Revendedor GesOffice criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/gesoffice-resellers/:id', requireAuth, async (req, res) => {
        try {
            const { username, gesoffice_id, panel_id, status } = req.body;
            
            // ⭐ MULTI-TENANT: Verificar se revendedor pertence ao tenant
            const existing = await db.get(`
                SELECT gr.id FROM gesoffice_resellers gr
                JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                WHERE gr.id = ? AND gp.tenant_id = ?
            `, [req.params.id, req.tenantId]);
            
            if (!existing) {
                return res.status(403).json({ error: 'Revendedor não encontrado ou sem permissão' });
            }
            
            await db.run(`
                UPDATE gesoffice_resellers 
                SET username = ?, gesoffice_id = ?, panel_id = ?, status = ?
                WHERE id = ?
            `, [username, gesoffice_id, panel_id, status, req.params.id]);

            res.json({ message: 'Revendedor GesOffice atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/gesoffice-resellers/:id', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Deletar apenas se pertencer ao tenant
            const result = await db.run(`
                DELETE FROM gesoffice_resellers 
                WHERE id = ? AND EXISTS (
                    SELECT 1 FROM gesoffice_panels gp 
                    WHERE gp.id = gesoffice_resellers.panel_id AND gp.tenant_id = ?
                )
            `, [req.params.id, req.tenantId]);
            
            if (result.changes === 0) {
                return res.status(403).json({ error: 'Revendedor não encontrado ou sem permissão' });
            }
            
            res.json({ message: 'Revendedor GesOffice excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PACOTES (UNIFICADO)
    // ========================================

    router.get('/packages/:resellerId', requireAuth, async (req, res) => {
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

    router.post('/packages', requireAuth, async (req, res) => {
        try {
            const { reseller_id, reseller_type, credits, price } = req.body;
            
            const result = await db.run(`
                INSERT INTO credit_packages (reseller_id, reseller_type, credits, price)
                VALUES (?, ?, ?, ?)
            `, [reseller_id, reseller_type || 'sigma', credits, price]);

            res.json({ id: result.id, message: 'Pacote criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/packages/:id', requireAuth, async (req, res) => {
        try {
            const { credits, price } = req.body;
            
            await db.run(`
                UPDATE credit_packages 
                SET credits = ?, price = ?
                WHERE id = ?
            `, [credits, price, req.params.id]);

            res.json({ message: 'Pacote atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/packages/:id', requireAuth, async (req, res) => {
        try {
            await db.run('DELETE FROM credit_packages WHERE id = ?', [req.params.id]);
            res.json({ message: 'Pacote excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PAGAMENTOS
    // ========================================

    router.get('/payments', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Filtrar pagamentos por tenant via joins
            const payments = await db.query(`
                SELECT 
                    p.*,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                    END as reseller_username
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN sigma_panels sp ON r.panel_id = sp.id
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN koffice_panels kp ON kr.panel_id = kp.id
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
                LEFT JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                WHERE (sp.tenant_id = ? OR kp.tenant_id = ? OR gp.tenant_id = ?)
                ORDER BY p.created_at DESC
                LIMIT 200
            `, [req.tenantId, req.tenantId, req.tenantId]);
            res.json(payments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/payments/pending', requireAuth, async (req, res) => {
        try {
            const result = await db.run('DELETE FROM payments WHERE status = ?', ['pending']);
            res.json({ message: `${result.changes} pagamento(s) excluído(s)` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/payments/:id', requireAuth, async (req, res) => {
        try {
            await db.run('DELETE FROM payments WHERE id = ? AND status = ?', [req.params.id, 'pending']);
            res.json({ message: 'Pagamento excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // ESTATÍSTICAS (POR TENANT)
    // ========================================

    router.get('/stats', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Estatísticas apenas do tenant
            const stats = await db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM sigma_panels WHERE status = 'active' AND tenant_id = ?) as active_sigma_panels,
                    (SELECT COUNT(*) FROM koffice_panels WHERE status = 'active' AND tenant_id = ?) as active_koffice_panels,
                    (SELECT COUNT(*) FROM gesoffice_panels WHERE status = 'active' AND tenant_id = ?) as active_gesoffice_panels,
                    (SELECT COUNT(*) FROM resellers r JOIN sigma_panels sp ON r.panel_id = sp.id WHERE r.status = 'active' AND sp.tenant_id = ?) as active_sigma_resellers,
                    (SELECT COUNT(*) FROM koffice_resellers kr JOIN koffice_panels kp ON kr.panel_id = kp.id WHERE kr.status = 'active' AND kp.tenant_id = ?) as active_koffice_resellers,
                    (SELECT COUNT(*) FROM gesoffice_resellers gr JOIN gesoffice_panels gp ON gr.panel_id = gp.id WHERE gr.status = 'active' AND gp.tenant_id = ?) as active_gesoffice_resellers,
                    (SELECT COUNT(*) FROM payments p LEFT JOIN resellers r ON p.reseller_id = r.id LEFT JOIN sigma_panels sp ON r.panel_id = sp.id WHERE p.status = 'paid' AND sp.tenant_id = ?) as total_payments,
                    (SELECT SUM(amount) FROM payments p LEFT JOIN resellers r ON p.reseller_id = r.id LEFT JOIN sigma_panels sp ON r.panel_id = sp.id WHERE p.status = 'paid' AND sp.tenant_id = ?) as total_revenue,
                    (SELECT SUM(credits) FROM payments p LEFT JOIN resellers r ON p.reseller_id = r.id LEFT JOIN sigma_panels sp ON r.panel_id = sp.id WHERE p.status = 'paid' AND sp.tenant_id = ?) as total_credits_sold,
                    (SELECT COUNT(*) FROM payments WHERE status = 'pending') as pending_payments
            `, [req.tenantId, req.tenantId, req.tenantId, req.tenantId, req.tenantId, req.tenantId, req.tenantId, req.tenantId, req.tenantId]);

            // Calcular totais
            stats.active_panels = (stats.active_sigma_panels || 0) + (stats.active_koffice_panels || 0) + (stats.active_gesoffice_panels || 0);
            stats.active_resellers = (stats.active_sigma_resellers || 0) + (stats.active_koffice_resellers || 0) + (stats.active_gesoffice_resellers || 0);

            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // TRANSAÇÕES (POR TENANT)
    // ========================================

    router.get('/transactions', requireAuth, async (req, res) => {
        try {
            // ⭐ MULTI-TENANT: Filtrar transações por tenant
            const transactions = await db.query(`
                SELECT 
                    t.*,
                    CASE 
                        WHEN t.reseller_type = 'sigma' THEN r.username
                        WHEN t.reseller_type = 'koffice' THEN kr.username
                        WHEN t.reseller_type = 'gesoffice' THEN gr.username
                    END as username,
                    p.amount
                FROM transactions t
                LEFT JOIN resellers r ON t.reseller_id = r.id AND t.reseller_type = 'sigma'
                LEFT JOIN sigma_panels sp ON r.panel_id = sp.id
                LEFT JOIN koffice_resellers kr ON t.reseller_id = kr.id AND t.reseller_type = 'koffice'
                LEFT JOIN koffice_panels kp ON kr.panel_id = kp.id
                LEFT JOIN gesoffice_resellers gr ON t.reseller_id = gr.id AND t.reseller_type = 'gesoffice'
                LEFT JOIN gesoffice_panels gp ON gr.panel_id = gp.id
                JOIN payments p ON t.payment_id = p.id
                WHERE (sp.tenant_id = ? OR kp.tenant_id = ? OR gp.tenant_id = ?)
                ORDER BY t.created_at DESC
                LIMIT 50
            `, [req.tenantId, req.tenantId, req.tenantId]);
            res.json(transactions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // RETRY DE RECARGAS
    // ========================================

    router.post('/retry-recharge/:paymentId', requireAuth, async (req, res) => {
        try {
            const MonitorService = require('../services/MonitorService');
            const monitor = new MonitorService(db);
            
            const result = await monitor.retryPayment(req.params.paymentId);
            
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/retry-all-errors', requireAuth, async (req, res) => {
        try {
            const errorPayments = await db.query(`
                SELECT * FROM payments 
                WHERE status = 'error' 
                ORDER BY created_at ASC
                LIMIT 10
            `);

            if (errorPayments.length === 0) {
                return res.json({
                    success: true,
                    message: 'Nenhum pagamento com erro encontrado',
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