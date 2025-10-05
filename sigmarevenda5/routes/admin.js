// routes/admin.js - VERSÃO SEGURA COM TOKENS
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// ========================================
// SISTEMA DE SESSÕES SEGURO
// ========================================

// Armazenar sessões ativas em memória
// Em produção, use Redis para permitir múltiplos servidores
const activeSessions = new Map();

// Gerar token criptograficamente seguro
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Hash de senha (mantém compatibilidade com SHA-256 atual)
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
    
    // Verificar expiração (24 horas)
    if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return res.status(401).json({ 
            error: 'Sessão expirada',
            code: 'EXPIRED_SESSION'
        });
    }
    
    // Renovar expiração automaticamente (sliding window)
    session.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    session.lastActivity = Date.now();
    
    // Passar dados do admin para as rotas
    req.adminId = session.adminId;
    req.adminUsername = session.username;
    
    next();
}

// ========================================
// ROTAS DE AUTENTICAÇÃO
// ========================================

module.exports = (db) => {
    // LOGIN
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: 'Preencha todos os campos' });
            }
            
            const admin = await db.get(
                'SELECT * FROM admin_users WHERE username = ?', 
                [username]
            );

            if (!admin || hashPassword(password) !== admin.password_hash) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            // Gerar token único
            const token = generateToken();
            
            // Criar sessão
            activeSessions.set(token, {
                adminId: admin.id,
                username: admin.username,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
            });

            console.log(`[Auth] Login: ${username} | Token: ${token.substring(0, 8)}...`);

            res.json({
                success: true,
                token,
                admin: {
                    id: admin.id,
                    username: admin.username
                }
            });

        } catch (error) {
            console.error('[Auth] Erro no login:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // LOGOUT
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

    // VERIFICAR SESSÃO
    router.get('/verify-session', requireAuth, (req, res) => {
        res.json({ 
            valid: true,
            admin: {
                id: req.adminId,
                username: req.adminUsername
            }
        });
    });

    // LISTAR SESSÕES ATIVAS (debug)
    router.get('/active-sessions', requireAuth, (req, res) => {
        const sessions = Array.from(activeSessions.entries()).map(([token, session]) => ({
            token: token.substring(0, 8) + '...',
            username: session.username,
            createdAt: new Date(session.createdAt).toLocaleString('pt-BR'),
            expiresAt: new Date(session.expiresAt).toLocaleString('pt-BR'),
            lastActivity: new Date(session.lastActivity).toLocaleString('pt-BR')
        }));
        
        res.json({ sessions, total: sessions.length });
    });

    // ========================================
    // CONFIGURAÇÕES (PROTEGIDAS)
    // ========================================

    router.get('/config', requireAuth, async (req, res) => {
        try {
            const configs = await db.query('SELECT * FROM system_config');
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

            await db.run(`
                INSERT OR REPLACE INTO system_config (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
            `, [key, finalValue]);

            console.log(`[Config] ${req.adminUsername} atualizou: ${key}`);

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CRUD PAINÉIS (PROTEGIDO)
    // ========================================

    router.get('/panels', requireAuth, async (req, res) => {
        try {
            const panels = await db.query('SELECT * FROM sigma_panels ORDER BY created_at DESC');
            res.json(panels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/panels', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password } = req.body;
            
            const result = await db.run(`
                INSERT INTO sigma_panels (name, url, admin_username, admin_password)
                VALUES (?, ?, ?, ?)
            `, [name, url, admin_username, admin_password]);

            console.log(`[Panels] ${req.adminUsername} criou painel: ${name}`);

            res.json({ id: result.id, message: 'Painel criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/panels/:id', requireAuth, async (req, res) => {
        try {
            const { name, url, admin_username, admin_password, status } = req.body;
            
            await db.run(`
                UPDATE sigma_panels 
                SET name = ?, url = ?, admin_username = ?, admin_password = ?, status = ?
                WHERE id = ?
            `, [name, url, admin_username, admin_password, status, req.params.id]);

            res.json({ message: 'Painel atualizado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/panels/:id', requireAuth, async (req, res) => {
        try {
            await db.run('DELETE FROM sigma_panels WHERE id = ?', [req.params.id]);
            res.json({ message: 'Painel excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CRUD REVENDEDORES (PROTEGIDO)
    // ========================================

    router.get('/resellers', requireAuth, async (req, res) => {
        try {
            const resellers = await db.query(`
                SELECT r.*, sp.name as panel_name, sp.url as panel_url
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                ORDER BY r.created_at DESC
            `);
            res.json(resellers);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/resellers', requireAuth, async (req, res) => {
        try {
            const { username, panel_id } = req.body;
            
            const result = await db.run(`
                INSERT INTO resellers (username, panel_id)
                VALUES (?, ?)
            `, [username, panel_id]);

            res.json({ id: result.id, message: 'Revendedor criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/resellers/:id', requireAuth, async (req, res) => {
        try {
            const { username, panel_id, status } = req.body;
            
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
            await db.run('DELETE FROM resellers WHERE id = ?', [req.params.id]);
            res.json({ message: 'Revendedor excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // CRUD PACOTES (PROTEGIDO)
    // ========================================

    router.get('/packages/:resellerId', requireAuth, async (req, res) => {
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

    router.post('/packages', requireAuth, async (req, res) => {
        try {
            const { reseller_id, credits, price } = req.body;
            
            const result = await db.run(`
                INSERT INTO credit_packages (reseller_id, credits, price)
                VALUES (?, ?, ?)
            `, [reseller_id, credits, price]);

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
    // PAGAMENTOS (PROTEGIDO)
    // ========================================

    router.get('/payments', requireAuth, async (req, res) => {
        try {
            const payments = await db.query(`
                SELECT p.*, r.username as reseller_username
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id
                ORDER BY p.created_at DESC
                LIMIT 200
            `);
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
    // TRANSAÇÕES E ESTATÍSTICAS (PROTEGIDO)
    // ========================================

    router.get('/transactions', requireAuth, async (req, res) => {
        try {
            const transactions = await db.query(`
                SELECT t.*, r.username, p.amount
                FROM transactions t
                JOIN resellers r ON t.reseller_id = r.id
                JOIN payments p ON t.payment_id = p.id
                ORDER BY t.created_at DESC
                LIMIT 50
            `);
            res.json(transactions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/stats', requireAuth, async (req, res) => {
        try {
            const stats = await db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM sigma_panels WHERE status = 'active') as active_panels,
                    (SELECT COUNT(*) FROM resellers WHERE status = 'active') as active_resellers,
                    (SELECT COUNT(*) FROM payments WHERE status = 'paid') as total_payments,
                    (SELECT SUM(amount) FROM payments WHERE status = 'paid') as total_revenue,
                    (SELECT SUM(credits) FROM payments WHERE status = 'paid') as total_credits_sold,
                    (SELECT COUNT(*) FROM payments WHERE status = 'pending') as pending_payments
            `);

            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ========================================
    // RETRY DE RECARGAS (PROTEGIDO)
    // ========================================

    router.post('/retry-recharge/:paymentId', requireAuth, async (req, res) => {
        try {
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

    router.post('/retry-all-errors', requireAuth, async (req, res) => {
        try {
            const errorPayments = await db.query(`
                SELECT id, reseller_id, credits, amount
                FROM payments
                WHERE status = 'error'
                ORDER BY created_at ASC
            `);

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
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    return router;
};
