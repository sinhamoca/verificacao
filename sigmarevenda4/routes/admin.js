// routes/admin.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = (db) => {
    // Login admin
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            
            const admin = await db.get('SELECT * FROM admin_users WHERE username = ?', [username]);

            if (!admin || hashPassword(password) !== admin.password_hash) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }

            res.json({ success: true, admin_id: admin.id });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Configurações
    router.get('/config', async (req, res) => {
        try {
            const configs = await db.query('SELECT * FROM system_config');
            res.json(configs);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/config/:key', async (req, res) => {
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

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // CRUD Painéis
    router.get('/panels', async (req, res) => {
        try {
            const panels = await db.query('SELECT * FROM sigma_panels ORDER BY created_at DESC');
            res.json(panels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/panels', async (req, res) => {
        try {
            const { name, url, admin_username, admin_password } = req.body;
            
            const result = await db.run(`
                INSERT INTO sigma_panels (name, url, admin_username, admin_password)
                VALUES (?, ?, ?, ?)
            `, [name, url, admin_username, admin_password]);

            res.json({ id: result.id, message: 'Painel criado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/panels/:id', async (req, res) => {
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

    router.delete('/panels/:id', async (req, res) => {
        try {
            await db.run('DELETE FROM sigma_panels WHERE id = ?', [req.params.id]);
            res.json({ message: 'Painel excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // CRUD Revendedores
    router.get('/resellers', async (req, res) => {
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

    router.post('/resellers', async (req, res) => {
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

    router.put('/resellers/:id', async (req, res) => {
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

    router.delete('/resellers/:id', async (req, res) => {
        try {
            await db.run('DELETE FROM resellers WHERE id = ?', [req.params.id]);
            res.json({ message: 'Revendedor excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // CRUD Pacotes
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

    router.post('/packages', async (req, res) => {
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

    router.put('/packages/:id', async (req, res) => {
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

    router.delete('/packages/:id', async (req, res) => {
        try {
            await db.run('DELETE FROM credit_packages WHERE id = ?', [req.params.id]);
            res.json({ message: 'Pacote excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Pagamentos
    router.get('/payments', async (req, res) => {
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

    router.delete('/payments/pending', async (req, res) => {
        try {
            const result = await db.run('DELETE FROM payments WHERE status = ?', ['pending']);
            res.json({ message: `${result.changes} pagamento(s) excluído(s)` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/payments/:id', async (req, res) => {
        try {
            await db.run('DELETE FROM payments WHERE id = ? AND status = ?', [req.params.id, 'pending']);
            res.json({ message: 'Pagamento excluído' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Transações
    router.get('/transactions', async (req, res) => {
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

    // Estatísticas
    router.get('/stats', async (req, res) => {
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

    router.post('/retry-recharge/:paymentId', async (req, res) => {
        try {
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

    router.post('/retry-all-errors', async (req, res) => {
        try {
            // Buscar todos os pagamentos com status 'error'
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

                    // Pequeno delay entre processamentos para não sobrecarregar
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
