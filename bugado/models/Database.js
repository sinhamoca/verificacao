// models/Database.js - VERSÃO MULTI-TENANT COMPLETA
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

class Database {
    constructor(dbPath = 'sigma_recharge.db') {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Erro ao conectar com banco de dados:', err);
                process.exit(1);
            }
            console.log('✅ Conectado ao banco de dados SQLite (Multi-Tenant)');
        });
        this.initTables();
    }

    initTables() {
        this.db.serialize(() => {
            console.log('🔧 Criando/verificando tabelas Multi-Tenant...');
            
            // ===== TABELA DE USUÁRIOS (NOVA) =====
            this.db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                full_name TEXT,
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`);

            // ===== CONFIGURAÇÕES POR USUÁRIO (NOVA) =====
            this.db.run(`CREATE TABLE IF NOT EXISTS user_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, key)
            )`);

            // ===== MANTÉM TABELAS ANTIGAS PARA COMPATIBILIDADE =====
            this.db.run(`CREATE TABLE IF NOT EXISTS system_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // ===== PAINÉIS SIGMA =====
            this.db.run(`CREATE TABLE IF NOT EXISTS sigma_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== REVENDEDORES SIGMA =====
            this.db.run(`CREATE TABLE IF NOT EXISTS resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT UNIQUE NOT NULL,
                panel_id INTEGER NOT NULL,
                sigma_user_id TEXT,
                reseller_type TEXT DEFAULT 'sigma',
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES sigma_panels(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== PAINÉIS KOFFICE =====
            this.db.run(`CREATE TABLE IF NOT EXISTS koffice_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                has_captcha BOOLEAN DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== REVENDEDORES KOFFICE =====
            this.db.run(`CREATE TABLE IF NOT EXISTS koffice_resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT UNIQUE NOT NULL,
                koffice_id TEXT NOT NULL,
                panel_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES koffice_panels(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== PAINÉIS GESOFFICE =====
            this.db.run(`CREATE TABLE IF NOT EXISTS gesoffice_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== REVENDEDORES GESOFFICE =====
            this.db.run(`CREATE TABLE IF NOT EXISTS gesoffice_resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT UNIQUE NOT NULL,
                gesoffice_id TEXT NOT NULL,
                panel_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES gesoffice_panels(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== PACOTES DE CRÉDITOS =====
            this.db.run(`CREATE TABLE IF NOT EXISTS credit_packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                credits INTEGER NOT NULL,
                price REAL NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== PAGAMENTOS =====
            this.db.run(`CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                reseller_id INTEGER NOT NULL,
                reseller_type TEXT DEFAULT 'sigma',
                package_id INTEGER NOT NULL,
                credits INTEGER NOT NULL,
                amount REAL NOT NULL,
                mp_payment_id TEXT,
                qr_code TEXT,
                qr_code_base64 TEXT,
                status TEXT DEFAULT 'pending',
                expires_at DATETIME,
                paid_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (package_id) REFERENCES credit_packages(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== TRANSAÇÕES =====
            this.db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                payment_id INTEGER NOT NULL,
                reseller_id INTEGER NOT NULL,
                reseller_type TEXT DEFAULT 'sigma',
                credits INTEGER NOT NULL,
                amount REAL NOT NULL,
                sigma_response TEXT,
                success BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (payment_id) REFERENCES payments(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // ===== LOGS DE IMPORTAÇÃO =====
            this.db.run(`CREATE TABLE IF NOT EXISTS import_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                domain_id INTEGER,
                package_id INTEGER,
                total_clients INTEGER,
                successful_imports INTEGER,
                failed_imports INTEGER,
                success_rate REAL,
                details TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            this.seedDefaultData();
        });
    }

    seedDefaultData() {
        // Verificar se já foi migrado para multi-tenant
        this.db.get('SELECT * FROM users WHERE role = ?', ['superadmin'], (err, superadmin) => {
            if (!superadmin) {
                console.log('⚠️  Sistema ainda não foi migrado para Multi-Tenant');
                console.log('📝 Execute: node migration-to-multitenant.js');
                
                // Criar dados padrão antigos para compatibilidade
                this.createLegacyDefaults();
            } else {
                console.log('✅ Sistema Multi-Tenant ativo');
            }
        });
    }

    createLegacyDefaults() {
        // Configurações padrão antigas
        this.db.get('SELECT * FROM system_config WHERE key = ?', ['access_question'], (err, row) => {
            if (!row) {
                this.db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                    ['access_question', 'Com quantos paus se faz uma canoa?']);
                this.db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                    ['access_answer', this.hashPassword('eusouandroid2029')]);
                this.db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                    ['mp_access_token', '']);
                this.db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                    ['anticaptcha_api_key', '']);
            }
        });

        // Admin padrão antigo
        this.db.get('SELECT * FROM admin_users WHERE username = ?', ['admin'], (err, row) => {
            if (!row) {
                this.db.run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', 
                    ['admin', this.hashPassword('admin123')], () => {
                    console.log('👤 Usuario admin criado: admin/admin123');
                });
            }
        });
    }

    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    // ========================================
    // MÉTODOS MULTI-TENANT
    // ========================================

    async getUserRole(userId) {
        const user = await this.get('SELECT role FROM users WHERE id = ?', [userId]);
        return user?.role || 'user';
    }

    async getUserConfig(userId, key) {
        const config = await this.get(
            'SELECT value FROM user_config WHERE user_id = ? AND key = ?',
            [userId, key]
        );
        return config?.value || null;
    }

    async setUserConfig(userId, key, value) {
        const existing = await this.get(
            'SELECT id FROM user_config WHERE user_id = ? AND key = ?',
            [userId, key]
        );

        if (existing) {
            return this.run(
                'UPDATE user_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND key = ?',
                [value, userId, key]
            );
        } else {
            return this.run(
                'INSERT INTO user_config (user_id, key, value) VALUES (?, ?, ?)',
                [userId, key, value]
            );
        }
    }

    // Query com filtro de user_id automático
    async queryByUser(sql, userId, additionalParams = []) {
        const role = await this.getUserRole(userId);
        
        if (role === 'superadmin') {
            // Superadmin vê tudo
            return this.query(sql, additionalParams);
        } else {
            // Adicionar WHERE user_id = ?
            const params = [userId, ...additionalParams];
            return this.query(sql, params);
        }
    }

    // ========================================
    // MÉTODOS AUXILIARES
    // ========================================

    query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    close() {
        this.db.close();
    }
}

module.exports = Database;
