// routes/super-admin.js
// Rotas do Super Admin Panel

const express = require('express');
const router = express.Router();
const superAdmin = require('../models/SuperAdmin');
const crypto = require('crypto');

// Sessões ativas do super admin
const activeSessions = new Map();

/**
 * Gera token de sessão
 */
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware de autenticação
 */
function requireSuperAuth(req, res, next) {
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
    
    // Verificar expiração (4 horas)
    if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return res.status(401).json({ 
            error: 'Sessão expirada',
            code: 'EXPIRED_SESSION'
        });
    }
    
    // Renovar sessão
    session.expiresAt = Date.now() + (4 * 60 * 60 * 1000);
    session.lastActivity = Date.now();
    
    next();
}

// ========================================
// AUTENTICAÇÃO
// ========================================

router.post('/login', (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Senha é obrigatória' });
        }

        if (!superAdmin.verifyPassword(password)) {
            console.log('[SuperAdmin] Tentativa de login falhou');
            return res.status(401).json({ error: 'Senha incorreta' });
        }

        const token = generateToken();
        
        activeSessions.set(token, {
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + (4 * 60 * 60 * 1000) // 4 horas
        });

        console.log('[SuperAdmin] Login bem-sucedido');

        res.json({
            success: true,
            token,
            message: 'Login realizado com sucesso'
        });

    } catch (error) {
        console.error('[SuperAdmin] Erro no login:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/logout', requireSuperAuth, (req, res) => {
    try {
        const token = req.headers.authorization.replace('Bearer ', '');
        activeSessions.delete(token);
        console.log('[SuperAdmin] Logout realizado');
        res.json({ success: true, message: 'Logout realizado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/verify-session', requireSuperAuth, (req, res) => {
    res.json({ valid: true });
});

// ========================================
// ESTATÍSTICAS GERAIS
// ========================================

router.get('/stats', requireSuperAuth, async (req, res) => {
    try {
        const stats = await superAdmin.getGlobalStats();
        res.json(stats);
    } catch (error) {
        console.error('[SuperAdmin] Erro ao buscar stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// LISTAR ADMINS
// ========================================

router.get('/admins', requireSuperAuth, async (req, res) => {
    try {
        const admins = await superAdmin.listAllAdmins();
        res.json(admins);
    } catch (error) {
        console.error('[SuperAdmin] Erro ao listar admins:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// CRIAR ADMIN
// ========================================

router.post('/admins', requireSuperAuth, async (req, res) => {
    try {
        const { username, password, days } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username e senha são obrigatórios' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username deve ter no mínimo 3 caracteres' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
        }

        const result = await superAdmin.createAdmin(username, password, days || 30);
        
        console.log(`[SuperAdmin] Admin criado: ${username}`);
        
        res.json({
            success: true,
            message: 'Admin criado com sucesso',
            data: result
        });

    } catch (error) {
        console.error('[SuperAdmin] Erro ao criar admin:', error);
        
        if (error.message === 'Admin já existe') {
            return res.status(409).json({ error: error.message });
        }
        
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// RENOVAR LICENÇA
// ========================================

router.post('/admins/:username/renew', requireSuperAuth, async (req, res) => {
    try {
        const { username } = req.params;
        const { days } = req.body;
        
        if (!days || days < 1) {
            return res.status(400).json({ error: 'Dias deve ser maior que 0' });
        }

        const result = await superAdmin.renewAdmin(username, days);
        
        console.log(`[SuperAdmin] Licença renovada: ${username} (+${days} dias)`);
        
        res.json({
            success: true,
            message: `Licença renovada por ${days} dias`,
            data: result
        });

    } catch (error) {
        console.error('[SuperAdmin] Erro ao renovar:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// SUSPENDER ADMIN
// ========================================

router.post('/admins/:username/suspend', requireSuperAuth, async (req, res) => {
    try {
        const { username } = req.params;
        
        const result = await superAdmin.suspendAdmin(username);
        
        console.log(`[SuperAdmin] Admin suspenso: ${username}`);
        
        res.json({
            success: true,
            message: 'Admin suspenso com sucesso',
            data: result
        });

    } catch (error) {
        console.error('[SuperAdmin] Erro ao suspender:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// ATIVAR ADMIN
// ========================================

router.post('/admins/:username/activate', requireSuperAuth, async (req, res) => {
    try {
        const { username } = req.params;
        
        const result = await superAdmin.activateAdmin(username);
        
        console.log(`[SuperAdmin] Admin ativado: ${username}`);
        
        res.json({
            success: true,
            message: 'Admin ativado com sucesso',
            data: result
        });

    } catch (error) {
        console.error('[SuperAdmin] Erro ao ativar:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// TROCAR SENHA
// ========================================

router.post('/admins/:username/change-password', requireSuperAuth, async (req, res) => {
    try {
        const { username } = req.params;
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Nova senha deve ter no mínimo 6 caracteres' });
        }

        const result = await superAdmin.changeAdminPassword(username, newPassword);
        
        console.log(`[SuperAdmin] Senha alterada: ${username}`);
        
        res.json({
            success: true,
            message: 'Senha alterada com sucesso',
            data: result
        });

    } catch (error) {
        console.error('[SuperAdmin] Erro ao trocar senha:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// DELETAR ADMIN
// ========================================

router.delete('/admins/:username', requireSuperAuth, async (req, res) => {
    try {
        const { username } = req.params;
        const { confirm } = req.body;
        
        if (confirm !== username) {
            return res.status(400).json({ error: 'Confirmação incorreta' });
        }

        const result = await superAdmin.deleteAdmin(username);
        
        console.log(`[SuperAdmin] Admin deletado: ${username}`);
        
        res.json({
            success: true,
            message: 'Admin deletado com sucesso (backup criado)',
            data: result
        });

    } catch (error) {
        console.error('[SuperAdmin] Erro ao deletar:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// OBTER DETALHES DE UM ADMIN
// ========================================

router.get('/admins/:username', requireSuperAuth, async (req, res) => {
    try {
        const { username } = req.params;
        const admins = await superAdmin.listAllAdmins();
        const admin = admins.find(a => a.username === username);
        
        if (!admin) {
            return res.status(404).json({ error: 'Admin não encontrado' });
        }

        res.json(admin);

    } catch (error) {
        console.error('[SuperAdmin] Erro ao buscar admin:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
