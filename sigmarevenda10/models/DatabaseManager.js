// models/DatabaseManager.js
// Gerenciador de databases dinâmicos por admin

const Database = require('./Database');
const crypto = require('crypto');
const path = require('path');

class DatabaseManager {
    constructor() {
        // Cache de databases ativos
        this.databases = new Map();
        
        // Sessões ativas: token -> {adminId, username, db}
        this.sessions = new Map();
    }

    /**
     * Gera nome do arquivo database baseado no username
     * Todos os databases ficam na pasta databases/
     */
    getDatabasePath(username) {
        const dbDir = path.join(__dirname, '..', 'databases');
        
        // Criar pasta databases se não existir
        const fs = require('fs');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log('[DatabaseManager] Pasta databases/ criada');
        }
        
        return path.join(dbDir, `database_${username}.db`);
    }

    /**
     * Obtém ou cria uma conexão de database para um admin
     */
    getDatabase(username) {
        // Verifica se já existe no cache
        if (this.databases.has(username)) {
            return this.databases.get(username);
        }

        // Cria nova conexão
        const dbPath = this.getDatabasePath(username);
        const db = new Database(dbPath);
        
        // Adiciona ao cache
        this.databases.set(username, db);
        
        console.log(`[DatabaseManager] Database carregado: ${username}`);
        
        return db;
    }

    /**
     * Verifica se admin está ativo e dentro da validade
     */
    async checkAdminLicense(db, username) {
        const admin = await db.get(
            'SELECT * FROM admin_users WHERE username = ?',
            [username]
        );

        if (!admin) {
            return { valid: false, reason: 'Admin não encontrado' };
        }

        // Verificar status
        if (admin.status !== 'active') {
            return { 
                valid: false, 
                reason: admin.status === 'suspended' ? 'Conta suspensa' : 'Conta inativa',
                status: admin.status
            };
        }

        // Verificar data de expiração
        if (admin.expires_at) {
            const now = new Date();
            const expiresAt = new Date(admin.expires_at);
            
            if (now > expiresAt) {
                // Atualizar status para expired
                await db.run(
                    'UPDATE admin_users SET status = ? WHERE username = ?',
                    ['expired', username]
                );
                
                console.log(`[DatabaseManager] Licença EXPIRADA: ${username}`);
                
                return {
                    valid: false,
                    reason: 'Licença expirada',
                    status: 'expired',
                    expired_at: admin.expires_at
                };
            }

            // Verificar se está próximo de expirar (7 dias)
            const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
            
            return {
                valid: true,
                status: admin.status,
                expires_at: admin.expires_at,
                days_remaining: daysRemaining,
                expiring_soon: daysRemaining <= 7
            };
        }

        // Sem data de expiração (admin antigo ou ilimitado)
        return { valid: true, status: admin.status };
    }

    /**
     * Cria uma sessão de login
     */
    async createSession(username, adminId, licenseInfo) {
        const token = this.generateToken();
        const db = this.getDatabase(username);
        
        const session = {
            token,
            adminId,
            username,
            db,
            licenseInfo,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
        };
        
        this.sessions.set(token, session);
        
        console.log(`[DatabaseManager] Sessão criada: ${username}`);
        
        return session;
    }

    /**
     * Obtém sessão pelo token
     */
    getSession(token) {
        return this.sessions.get(token);
    }

    /**
     * Valida e renova sessão
     */
    async validateSession(token) {
        const session = this.sessions.get(token);
        
        if (!session) {
            return null;
        }
        
        // Verifica expiração da sessão
        if (Date.now() > session.expiresAt) {
            this.sessions.delete(token);
            console.log(`[DatabaseManager] Sessão expirada: ${session.username}`);
            return null;
        }

        // Verifica licença do admin a cada validação
        const licenseCheck = await this.checkAdminLicense(session.db, session.username);
        
        if (!licenseCheck.valid) {
            this.sessions.delete(token);
            console.log(`[DatabaseManager] Licença inválida durante sessão: ${session.username} - ${licenseCheck.reason}`);
            return null;
        }
        
        // Renova expiração
        session.lastActivity = Date.now();
        session.expiresAt = Date.now() + (24 * 60 * 60 * 1000);
        session.licenseInfo = licenseCheck; // Atualizar info da licença
        
        return session;
    }

    /**
     * Remove sessão (logout)
     */
    removeSession(token) {
        const session = this.sessions.get(token);
        if (session) {
            console.log(`[DatabaseManager] Sessão removida: ${session.username}`);
            this.sessions.delete(token);
        }
    }

    /**
     * Fecha database específico
     */
    closeDatabase(username) {
        const db = this.databases.get(username);
        if (db) {
            db.close();
            this.databases.delete(username);
            console.log(`[DatabaseManager] Database fechado: ${username}`);
        }
    }

    /**
     * Fecha todos os databases
     */
    closeAll() {
        console.log('[DatabaseManager] Fechando todos os databases...');
        
        for (const [username, db] of this.databases.entries()) {
            db.close();
            console.log(`[DatabaseManager] Database fechado: ${username}`);
        }
        
        this.databases.clear();
        this.sessions.clear();
    }

    /**
     * Limpa sessões expiradas (executar periodicamente)
     */
    cleanExpiredSessions() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [token, session] of this.sessions.entries()) {
            if (now > session.expiresAt) {
                this.sessions.delete(token);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[DatabaseManager] ${cleaned} sessões expiradas removidas`);
        }
    }

    /**
     * Estatísticas
     */
    getStats() {
        return {
            activeDatabases: this.databases.size,
            activeSessions: this.sessions.size,
            databases: Array.from(this.databases.keys()),
            sessions: Array.from(this.sessions.values()).map(s => ({
                username: s.username,
                lastActivity: new Date(s.lastActivity).toISOString(),
                expiresAt: new Date(s.expiresAt).toISOString()
            }))
        };
    }

    /**
     * Gera token único
     */
    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Hash de senha (SHA-256)
     */
    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }
}

// Singleton
const dbManager = new DatabaseManager();

// Limpeza periódica de sessões expiradas (a cada 1 hora)
setInterval(() => {
    dbManager.cleanExpiredSessions();
}, 60 * 60 * 1000);

module.exports = dbManager;
