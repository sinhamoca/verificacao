// routes/admin.js - VERSÃO MULTI-TENANT COMPLETA
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
    
    // Renovar sessão
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    session.lastActivity = Date.now();
    
    // IMPORTANTE: Adicionar dados do usuário ao request
    req.userId = session.userId;
    req.username = session.username;
    req.userRole = session.role;
    
    // Manter compatibilidade com código antigo
    req.adminId = session.userId;
    req.adminUsername = session.username;
    
    next();
}

// Middleware para permitir apenas superadmin
function requireSuperAdmin(req, res, next) {
    if (req.userRole !== 'superadmin') {
        return res.status(403).json({ 
            error: 'Acesso negado. Apenas superadmin.',
            code: 'FORBIDDEN'
        });
    }
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
            
            // Buscar usuário na nova tabela multi-tenant
            let user = await db.get(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );

            // Fallback: se não encontrou, tentar na tabela antiga admin_users
            if (!user) {
                const oldAdmin = await db.get(
                    'SELECT * FROM admin_users WHERE username = ?',
                    [username]
                );
                
                if (oldAdmin) {
                    user = {
                        id: oldAdmin.id,
                        username: oldAdmin.username,
                        password_hash: oldAdmin.password_hash,
                        role: 'superadmin' // Admin antigo vira superadmin
                    };
                }
            }

            if (!user || hashPassword(password) !== user.password_hash) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            const token = generateToken();
            
            activeSessions.set(token, {
                userId: user.id,
                username: user.username,
                role: user.role || 'superadmin',
                createdAt: Date.now(),
                lastActivity: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000)
            });

            console.log(`[Auth] Login: ${username} (${user.role})`);

            res.json({
                success: true,
                token,
                admin: {
                    id: user.id,
                    username: user.username,
                    role: user.role || 'superadmin'
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
            console.log(`[Auth] Logout: ${req.username}`);
            res.json({ success: true, message: 'Logout realizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/verify-session', requireAuth, (req, res) => {
        res.json({ 
            valid: true,
            admin: {
                id: req.userId,
                username: req.username,
                role: req.userRole
            }
        });
    });

    // ========================================
    // GERENCIAMENTO DE USUÁRIOS (SUPERADMIN ONLY)
    // ========================================

    router.get('/users', requireAuth, requireSuperAdmin, async (req, res) => {
        try {
            const users = await db.query(`
                SELECT 
                    u.id, u.username, u.email, u.full_name, u.role, u.status, 
                    u.created_at,
                    creator.username as created_by_username
                FROM users u
                LEFT JOIN users creator ON u.created_by = creator.id
                WHERE u.role != 'superadmin'
                ORDER BY u.created_at DESC
            `);
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/users', requireAuth, requireSuperAdmin, async (req, res) => {
        try {
            const { username, password, email, full_name } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Username e senha são obrigatórios' });
            }

            const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
            if (existing) {
                return res.status(400).json({ error: 'Username já existe' });
            }

            const hashedPassword = hashPassword(password);
            const result = await db.run(
                'INSERT INTO users (username, password_hash, email, full_name, role, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                [username, hashedPassword, email, full_name, 'user', req.userId]
            );

            const userId = result.id;

            // Criar configurações padrão do usuário
            const defaultConfigs = [
                ['mp_access_token', ''],
                ['anticaptcha_api_key', ''],
                ['access_question', 'Qual é sua cor favorita?'],
                ['access_answer', hashPassword('azul')]
            ];

            for (const [key, value] of defaultConfigs) {
                await db.run(
                    'INSERT INTO user_config (user_id, key, value) VALUES (?, ?, ?)',
                    [userId, key, value]
                );
            }

            console.log(`[Users] Novo usuário criado: ${username} (ID: ${userId})`);

            res.json({ 
                success: true, 
                message: 'Usuário criado com sucesso',
                user: { id: userId, username, email, full_name }
            });

        } catch (error) {
            console.error('[Users] Erro ao criar usuário:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/users/:userId', requireAuth, requireSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;
            const { email, full_name, status, password } = req.body;

            const updates = [];
            const params = [];

            if (email !== undefined) {
                updates.push('email = ?');
                params.push(email);
            }
            if (full_name !== undefined) {
                updates.push('full_name = ?');
                params.push(full_name);
            }
            if (status !== undefined) {
                updates.push('status = ?');
                params.push(status);
            }
            if (password) {
                updates.push('password_hash = ?');
                params.push(hashPassword(password));
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar' });
            }

            params.push(userId);

            await db.run(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            console.log(`[Users] Usuário ${userId} atualizado`);

            res.json({ success: true, message: 'Usuário atualizado' });

        } catch (error) {
            console.error('[Users] Erro ao atualizar:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/users/:userId', requireAuth, requireSuperAdmin, async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await db.get('SELECT role FROM users WHERE id = ?', [userId]);
            if (user && user.role === 'superadmin') {
                return res.status(403).json({ error: 'Não é possível deletar superadmin' });
            }

            await db.run('DELETE FROM users WHERE id = ?', [userId]);

            console.log(`[Users] Usuário ${userId} deletado`);

            res.json({ success: true, message: 'Usuário deletado' });

        } catch (error) {
            console.error('[Users] Erro ao deletar:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CONFIGURAÇÕES (POR USUÁRIO)
    // ========================================

    router.get('/config', requireAuth, async (req, res) => {
        try {
            const configs = await db.query(
                'SELECT key, value FROM user_config WHERE user_id = ?',
                [req.userId]
            );

            if (configs.length === 0) {
                // Criar configs padrão
                const defaults = [
                    ['mp_access_token', ''],
                    ['anticaptcha_api_key', ''],
                    ['access_question', 'Qual é sua cor favorita?'],
                    ['access_answer', hashPassword('azul')]
                ];

                for (const [key, value] of defaults) {
                    await db.run(
                        'INSERT INTO user_config (user_id, key, value) VALUES (?, ?, ?)',
                        [req.userId, key, value]
                    );
                }

                const newConfigs = await db.query(
                    'SELECT key, value FROM user_config WHERE user_id = ?',
                    [req.userId]
                );
                return res.json(newConfigs);
            }

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
            
            await db.setUserConfig(req.userId, key, finalValue);

            console.log(`[Config] ${req.username} atualizou: ${key}`);
            
            res.json({ success: true, message: 'Configuração atualizada' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PAINÉIS SIGMA (FILTRADO POR USER)
    // ========================================

    router.get('/panels', requireAuth, async (req, res) => {
        try {
            let query = 'SELECT * FROM sigma_panels';
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' WHERE user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY created_at DESC';

            const panels = await db.query(query, params);
            res.json(panels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/panels', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password } = req.body;

            const result = await db.run(
                'INSERT INTO sigma_panels (user_id, name, url, admin_username, admin_password) VALUES (?, ?, ?, ?, ?)',
                [req.userId, name, url, admin_username, admin_password]
            );

            console.log(`[Panels] ${req.username} criou painel Sigma: ${name}`);

            res.json({ id: result.id, message: 'Painel criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/panels/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, url, admin_username, admin_password, status } = req.body;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM sigma_panels WHERE id = ?', [id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run(
                'UPDATE sigma_panels SET name = ?, url = ?, admin_username = ?, admin_password = ?, status = ? WHERE id = ?',
                [name, url, admin_username, admin_password, status, id]
            );

            res.json({ message: 'Painel atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/panels/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM sigma_panels WHERE id = ?', [id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run('DELETE FROM sigma_panels WHERE id = ?', [id]);

            res.json({ message: 'Painel excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // REVENDEDORES SIGMA (FILTRADO POR USER)
    // ========================================

    router.get('/resellers', requireAuth, async (req, res) => {
        try {
            let query = `
                SELECT r.*, sp.name as panel_name, sp.url as panel_url
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
            `;
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' WHERE r.user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY r.created_at DESC';

            const resellers = await db.query(query, params);
            res.json(resellers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/resellers', requireAuth, async (req, res) => {
        try {
            const { username, panel_id } = req.body;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM sigma_panels WHERE id = ?', [panel_id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Painel não pertence a você' });
                }
            }

            const result = await db.run(
                'INSERT INTO resellers (user_id, username, panel_id, reseller_type) VALUES (?, ?, ?, ?)',
                [req.userId, username, panel_id, 'sigma']
            );

            res.json({ id: result.id, message: 'Revendedor Sigma criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/resellers/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { username, panel_id, status } = req.body;

            if (req.userRole !== 'superadmin') {
                const reseller = await db.get('SELECT user_id FROM resellers WHERE id = ?', [id]);
                if (!reseller || reseller.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run(
                'UPDATE resellers SET username = ?, panel_id = ?, status = ? WHERE id = ?',
                [username, panel_id, status, id]
            );

            res.json({ message: 'Revendedor atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/resellers/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;

            if (req.userRole !== 'superadmin') {
                const reseller = await db.get('SELECT user_id FROM resellers WHERE id = ?', [id]);
                if (!reseller || reseller.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run('DELETE FROM resellers WHERE id = ?', [id]);

            res.json({ message: 'Revendedor excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PAINÉIS KOFFICE (FILTRADO POR USER)
    // ========================================

    router.get('/koffice-panels', requireAuth, async (req, res) => {
        try {
            let query = 'SELECT * FROM koffice_panels';
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' WHERE user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY created_at DESC';

            const panels = await db.query(query, params);
            res.json(panels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/koffice-panels', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password, has_captcha } = req.body;

            const result = await db.run(
                'INSERT INTO koffice_panels (user_id, name, url, admin_username, admin_password, has_captcha) VALUES (?, ?, ?, ?, ?, ?)',
                [req.userId, name, url, admin_username, admin_password, has_captcha ? 1 : 0]
            );

            console.log(`[Koffice] ${req.username} criou painel Koffice: ${name}`);

            res.json({ id: result.id, message: 'Painel Koffice criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/koffice-panels/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, url, admin_username, admin_password, has_captcha, status } = req.body;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM koffice_panels WHERE id = ?', [id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run(
                'UPDATE koffice_panels SET name = ?, url = ?, admin_username = ?, admin_password = ?, has_captcha = ?, status = ? WHERE id = ?',
                [name, url, admin_username, admin_password, has_captcha ? 1 : 0, status, id]
            );

            res.json({ message: 'Painel Koffice atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/koffice-panels/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM koffice_panels WHERE id = ?', [id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run('DELETE FROM koffice_panels WHERE id = ?', [id]);

            res.json({ message: 'Painel Koffice excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // REVENDEDORES KOFFICE (FILTRADO POR USER)
    // ========================================

    router.get('/koffice-resellers', requireAuth, async (req, res) => {
        try {
            let query = `
                SELECT kr.*, kp.name as panel_name, kp.url as panel_url
                FROM koffice_resellers kr
                JOIN koffice_panels kp ON kr.panel_id = kp.id
            `;
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' WHERE kr.user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY kr.created_at DESC';

            const resellers = await db.query(query, params);
            res.json(resellers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/koffice-resellers', requireAuth, async (req, res) => {
        try {
            const { username, koffice_id, panel_id } = req.body;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM koffice_panels WHERE id = ?', [panel_id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Painel não pertence a você' });
                }
            }

            const result = await db.run(
                'INSERT INTO koffice_resellers (user_id, username, koffice_id, panel_id) VALUES (?, ?, ?, ?)',
                [req.userId, username, koffice_id, panel_id]
            );

            console.log(`[Koffice] ${req.username} criou revendedor: ${username} (ID: ${koffice_id})`);

            res.json({ id: result.id, message: 'Revendedor Koffice criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/koffice-resellers/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { username, koffice_id, panel_id, status } = req.body;

            if (req.userRole !== 'superadmin') {
                const reseller = await db.get('SELECT user_id FROM koffice_resellers WHERE id = ?', [id]);
                if (!reseller || reseller.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run(
                'UPDATE koffice_resellers SET username = ?, koffice_id = ?, panel_id = ?, status = ? WHERE id = ?',
                [username, koffice_id, panel_id, status, id]
            );

            res.json({ message: 'Revendedor Koffice atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/koffice-resellers/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;

            if (req.userRole !== 'superadmin') {
                const reseller = await db.get('SELECT user_id FROM koffice_resellers WHERE id = ?', [id]);
                if (!reseller || reseller.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run('DELETE FROM koffice_resellers WHERE id = ?', [id]);

            res.json({ message: 'Revendedor Koffice excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PAINÉIS GESOFFICE (FILTRADO POR USER)
    // ========================================

    router.get('/gesoffice-panels', requireAuth, async (req, res) => {
        try {
            let query = 'SELECT * FROM gesoffice_panels';
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' WHERE user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY created_at DESC';

            const panels = await db.query(query, params);
            res.json(panels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/gesoffice-panels', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password } = req.body;

            const result = await db.run(
                'INSERT INTO gesoffice_panels (user_id, name, url, admin_username, admin_password) VALUES (?, ?, ?, ?, ?)',
                [req.userId, name, url, admin_username, admin_password]
            );

            console.log(`[GesOffice] ${req.username} criou painel GesOffice: ${name}`);

            res.json({ id: result.id, message: 'Painel GesOffice criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/gesoffice-panels/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, url, admin_username, admin_password, status } = req.body;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM gesoffice_panels WHERE id = ?', [id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run(
                'UPDATE gesoffice_panels SET name = ?, url = ?, admin_username = ?, admin_password = ?, status = ? WHERE id = ?',
                [name, url, admin_username, admin_password, status, id]
            );

            res.json({ message: 'Painel GesOffice atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/gesoffice-panels/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM gesoffice_panels WHERE id = ?', [id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run('DELETE FROM gesoffice_panels WHERE id = ?', [id]);

            res.json({ message: 'Painel GesOffice excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // REVENDEDORES GESOFFICE (FILTRADO POR USER)
    // ========================================

    router.get('/gesoffice-resellers', requireAuth, async (req, res) => {
        try {
            let query = `
                SELECT gr.*, gp.name as panel_name, gp.url as panel_url
                FROM gesoffice_resellers gr
                JOIN gesoffice_panels gp ON gr.panel_id = gp.id
            `;
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' WHERE gr.user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY gr.created_at DESC';

            const resellers = await db.query(query, params);
            res.json(resellers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/gesoffice-resellers', requireAuth, async (req, res) => {
        try {
            const { username, gesoffice_id, panel_id } = req.body;

            if (req.userRole !== 'superadmin') {
                const panel = await db.get('SELECT user_id FROM gesoffice_panels WHERE id = ?', [panel_id]);
                if (!panel || panel.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Painel não pertence a você' });
                }
            }

            const result = await db.run(
                'INSERT INTO gesoffice_resellers (user_id, username, gesoffice_id, panel_id) VALUES (?, ?, ?, ?)',
                [req.userId, username, gesoffice_id, panel_id]
            );

            console.log(`[GesOffice] ${req.username} criou revendedor: ${username} (ID: ${gesoffice_id})`);

            res.json({ id: result.id, message: 'Revendedor GesOffice criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/gesoffice-resellers/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { username, gesoffice_id, panel_id, status } = req.body;

            if (req.userRole !== 'superadmin') {
                const reseller = await db.get('SELECT user_id FROM gesoffice_resellers WHERE id = ?', [id]);
                if (!reseller || reseller.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run(
                'UPDATE gesoffice_resellers SET username = ?, gesoffice_id = ?, panel_id = ?, status = ? WHERE id = ?',
                [username, gesoffice_id, panel_id, status, id]
            );

            res.json({ message: 'Revendedor GesOffice atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/gesoffice-resellers/:id', requireAuth, async (req, res) => {
        try {
            const { id } = req.params;

            if (req.userRole !== 'superadmin') {
                const reseller = await db.get('SELECT user_id FROM gesoffice_resellers WHERE id = ?', [id]);
                if (!reseller || reseller.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run('DELETE FROM gesoffice_resellers WHERE id = ?', [id]);

            res.json({ message: 'Revendedor GesOffice excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PACOTES (POR USUÁRIO - NOVO FORMATO)
    // ========================================

    router.get('/packages', requireAuth, async (req, res) => {
        try {
            let query = 'SELECT * FROM credit_packages WHERE status = ?';
            let params = ['active'];

            if (req.userRole !== 'superadmin') {
                query += ' AND user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY credits ASC';

            const packages = await db.query(query, params);
            res.json(packages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Buscar pacotes de um revendedor específico
    router.get('/packages/:resellerId', requireAuth, async (req, res) => {
        try {
            const { type } = req.query;
            
            const packages = await db.query(`
                SELECT * FROM credit_packages
                WHERE reseller_id = ? AND reseller_type = ?
                ORDER BY credits ASC
            `, [req.params.resellerId, type]);

            res.json(packages);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Criar pacote para revendedor
    router.post('/packages', requireAuth, async (req, res) => {
        try {
            const { reseller_id, reseller_type, credits, price } = req.body;
            
            const result = await db.run(`
                INSERT INTO credit_packages (reseller_id, reseller_type, credits, price)
                VALUES (?, ?, ?, ?)
            `, [reseller_id, reseller_type, credits, price]);

            res.json({ id: result.id, message: 'Pacote criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/packages/:id', requireAuth, async (req, res) => {
        try {
            const { credits, price, status } = req.body;

            // Verificar permissão
            if (req.userRole !== 'superadmin') {
                const pkg = await db.get('SELECT user_id FROM credit_packages WHERE id = ?', [req.params.id]);
                if (!pkg || pkg.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }
            
            await db.run(`
                UPDATE credit_packages 
                SET credits = ?, price = ?, status = ?
                WHERE id = ?
            `, [credits, price, status || 'active', req.params.id]);

            res.json({ message: 'Pacote atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/packages/:id', requireAuth, async (req, res) => {
        try {
            // Verificar permissão
            if (req.userRole !== 'superadmin') {
                const pkg = await db.get('SELECT user_id FROM credit_packages WHERE id = ?', [req.params.id]);
                if (!pkg || pkg.user_id !== req.userId) {
                    return res.status(403).json({ error: 'Acesso negado' });
                }
            }

            await db.run('DELETE FROM credit_packages WHERE id = ?', [req.params.id]);
            res.json({ message: 'Pacote excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // PAGAMENTOS (FILTRADO POR USER)
    // ========================================

    router.get('/payments', requireAuth, async (req, res) => {
        try {
            let query = `
                SELECT 
                    p.*,
                    CASE 
                        WHEN p.reseller_type = 'sigma' THEN r.username
                        WHEN p.reseller_type = 'koffice' THEN kr.username
                        WHEN p.reseller_type = 'gesoffice' THEN gr.username
                    END as reseller_username
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id AND p.reseller_type = 'sigma'
                LEFT JOIN koffice_resellers kr ON p.reseller_id = kr.id AND p.reseller_type = 'koffice'
                LEFT JOIN gesoffice_resellers gr ON p.reseller_id = gr.id AND p.reseller_type = 'gesoffice'
            `;
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' WHERE p.user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY p.created_at DESC LIMIT 200';

            const payments = await db.query(query, params);
            res.json(payments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/payments/pending', requireAuth, async (req, res) => {
        try {
            let query = "DELETE FROM payments WHERE status = 'pending'";
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' AND user_id = ?';
                params.push(req.userId);
            }

            const result = await db.run(query, params);

            res.json({ message: `${result.changes} pagamento(s) excluído(s)` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/payments/:id', requireAuth, async (req, res) => {
        try {
            let query = 'DELETE FROM payments WHERE id = ? AND status = ?';
            let params = [req.params.id, 'pending'];

            if (req.userRole !== 'superadmin') {
                query += ' AND user_id = ?';
                params.push(req.userId);
            }

            await db.run(query, params);

            res.json({ message: 'Pagamento excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // ESTATÍSTICAS (FILTRADO POR USER)
    // ========================================

    router.get('/stats', requireAuth, async (req, res) => {
        try {
            let whereClause = '';
            let params = [];

            if (req.userRole !== 'superadmin') {
                whereClause = 'WHERE user_id = ?';
                params.push(req.userId);
            }

            const stats = await db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM sigma_panels ${whereClause} AND status = 'active') as active_sigma_panels,
                    (SELECT COUNT(*) FROM koffice_panels ${whereClause} AND status = 'active') as active_koffice_panels,
                    (SELECT COUNT(*) FROM gesoffice_panels ${whereClause} AND status = 'active') as active_gesoffice_panels,
                    (SELECT COUNT(*) FROM resellers ${whereClause} AND status = 'active') as active_sigma_resellers,
                    (SELECT COUNT(*) FROM koffice_resellers ${whereClause} AND status = 'active') as active_koffice_resellers,
                    (SELECT COUNT(*) FROM gesoffice_resellers ${whereClause} AND status = 'active') as active_gesoffice_resellers,
                    (SELECT COUNT(*) FROM payments ${whereClause} AND status = 'paid') as total_payments,
                    (SELECT SUM(amount) FROM payments ${whereClause} AND status = 'paid') as total_revenue,
                    (SELECT SUM(credits) FROM payments ${whereClause} AND status = 'paid') as total_credits_sold,
                    (SELECT COUNT(*) FROM payments ${whereClause} AND status = 'pending') as pending_payments
            `, params.length > 0 ? [params[0], params[0], params[0], params[0], params[0], params[0], params[0], params[0], params[0], params[0]] : []);

            stats.active_panels = (stats.active_sigma_panels || 0) + (stats.active_koffice_panels || 0) + (stats.active_gesoffice_panels || 0);
            stats.active_resellers = (stats.active_sigma_resellers || 0) + (stats.active_koffice_resellers || 0) + (stats.active_gesoffice_resellers || 0);

            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // TRANSAÇÕES (FILTRADO POR USER)
    // ========================================

    router.get('/transactions', requireAuth, async (req, res) => {
        try {
            let query = `
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
                LEFT JOIN koffice_resellers kr ON t.reseller_id = kr.id AND t.reseller_type = 'koffice'
                LEFT JOIN gesoffice_resellers gr ON t.reseller_id = gr.id AND t.reseller_type = 'gesoffice'
                JOIN payments p ON t.payment_id = p.id
            `;
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' WHERE t.user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY t.created_at DESC LIMIT 50';

            const transactions = await db.query(query, params);
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
            const result = await monitor.retryRecharge(req.params.paymentId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/retry-all-errors', requireAuth, async (req, res) => {
        try {
            let query = `
                SELECT id, reseller_id, reseller_type, credits, amount
                FROM payments
                WHERE status = 'error'
            `;
            let params = [];

            if (req.userRole !== 'superadmin') {
                query += ' AND user_id = ?';
                params.push(req.userId);
            }

            query += ' ORDER BY created_at ASC';

            const errorPayments = await db.query(query, params);

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
