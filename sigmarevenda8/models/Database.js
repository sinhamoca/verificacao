// models/Database.js - VERSÃO COM SUPORTE SIGMA + KOFFICE + GESOFFICE
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

class Database {
    constructor(dbPath = 'sigma_recharge.db') {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Erro ao conectar com banco de dados:', err);
                process.exit(1);
            }
            console.log('Conectado ao banco de dados SQLite');
        });
        this.initTables();
    }

    initTables() {
        this.db.serialize(() => {
            console.log('Criando/verificando tabelas...');
            
            // Configurações do sistema
            this.db.run(`CREATE TABLE IF NOT EXISTS system_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Usuários admin
            this.db.run(`CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Painéis Sigma
            this.db.run(`CREATE TABLE IF NOT EXISTS sigma_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Revendedores Sigma
            this.db.run(`CREATE TABLE IF NOT EXISTS resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                panel_id INTEGER NOT NULL,
                sigma_user_id TEXT,
                reseller_type TEXT DEFAULT 'sigma',
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES sigma_panels (id)
            )`);

            // ===== KOFFICE TABLES =====

            // Painéis Koffice
            this.db.run(`CREATE TABLE IF NOT EXISTS koffice_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                has_captcha BOOLEAN DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Revendedores Koffice
            this.db.run(`CREATE TABLE IF NOT EXISTS koffice_resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                koffice_id TEXT NOT NULL,
                panel_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES koffice_panels (id)
            )`);

            // ===== GESOFFICE TABLES =====

            // Painéis GesOffice
            this.db.run(`CREATE TABLE IF NOT EXISTS gesoffice_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Revendedores GesOffice
            this.db.run(`CREATE TABLE IF NOT EXISTS gesoffice_resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                gesoffice_id TEXT NOT NULL,
                panel_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES gesoffice_panels (id)
            )`);

            // ===== SHARED TABLES =====

            // Pacotes de créditos (serve para todos)
            this.db.run(`CREATE TABLE IF NOT EXISTS credit_packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reseller_id INTEGER NOT NULL,
                reseller_type TEXT DEFAULT 'sigma' NOT NULL,
                credits INTEGER NOT NULL,
                price REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Garantir que pacotes existentes tenham reseller_type
            this.db.run(`UPDATE credit_packages SET reseller_type = 'sigma' WHERE reseller_type IS NULL`);

            // Pagamentos (unificado)
            this.db.run(`CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                FOREIGN KEY (package_id) REFERENCES credit_packages (id)
            )`);

            // Transações (unificado)
            this.db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payment_id INTEGER NOT NULL,
                reseller_id INTEGER NOT NULL,
                reseller_type TEXT DEFAULT 'sigma',
                credits INTEGER NOT NULL,
                amount REAL NOT NULL,
                sigma_response TEXT,
                success BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (payment_id) REFERENCES payments (id)
            )`);

            // Logs de importação
            this.db.run(`CREATE TABLE IF NOT EXISTS import_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                domain_id INTEGER,
                package_id INTEGER,
                total_clients INTEGER,
                successful_imports INTEGER,
                failed_imports INTEGER,
                success_rate REAL,
                details TEXT
            )`);

            this.seedDefaultData();
        });
    }

    seedDefaultData() {
        // Configurações padrão
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
                console.log('Configurações padrão criadas');
            }
        });

        // Admin padrão
        this.db.get('SELECT * FROM admin_users WHERE username = ?', ['admin'], (err, row) => {
            if (!row) {
                this.db.run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', 
                    ['admin', this.hashPassword('admin123')], () => {
                    console.log('Usuario admin criado: admin/admin123');
                });
            }
        });
    }

    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    // Métodos auxiliares
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
