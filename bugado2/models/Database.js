// models/Database.js - VERSÃO COM SUPORTE A EXPIRAÇÃO DE TENANTS
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
            
            // ⭐ TABELA TENANTS - COM EXPIRAÇÃO
            this.db.run(`CREATE TABLE IF NOT EXISTS tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'active',
                expires_at DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // ⭐ ÍNDICES PARA TENANTS
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_tenants_expiration 
                ON tenants(expires_at, status)`);

            // Configurações do sistema por tenant
            this.db.run(`CREATE TABLE IF NOT EXISTS tenant_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, key),
                FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_tenant_config 
                ON tenant_config(tenant_id, key)`);

            // Usuários admin
            this.db.run(`CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                tenant_id INTEGER DEFAULT 1,
                role TEXT DEFAULT 'admin',
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_admin_tenant 
                ON admin_users(tenant_id)`);

            // Painéis Sigma
            this.db.run(`CREATE TABLE IF NOT EXISTS sigma_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER DEFAULT 1,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_sigma_panels_tenant 
                ON sigma_panels(tenant_id)`);

            // Revendedores Sigma
            this.db.run(`CREATE TABLE IF NOT EXISTS resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                panel_id INTEGER NOT NULL,
                sigma_user_id TEXT,
                reseller_type TEXT DEFAULT 'sigma',
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES sigma_panels (id) ON DELETE CASCADE
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_resellers_username 
                ON resellers(username)`);

            // Painéis Koffice
            this.db.run(`CREATE TABLE IF NOT EXISTS koffice_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER DEFAULT 1,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                has_captcha BOOLEAN DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_koffice_panels_tenant 
                ON koffice_panels(tenant_id)`);

            // Revendedores Koffice
            this.db.run(`CREATE TABLE IF NOT EXISTS koffice_resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                koffice_id TEXT NOT NULL,
                panel_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES koffice_panels (id) ON DELETE CASCADE
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_koffice_resellers_username 
                ON koffice_resellers(username)`);

            // Painéis GesOffice
            this.db.run(`CREATE TABLE IF NOT EXISTS gesoffice_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER DEFAULT 1,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_gesoffice_panels_tenant 
                ON gesoffice_panels(tenant_id)`);

            // Revendedores GesOffice
            this.db.run(`CREATE TABLE IF NOT EXISTS gesoffice_resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                gesoffice_id TEXT NOT NULL,
                panel_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES gesoffice_panels (id) ON DELETE CASCADE
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_gesoffice_resellers_username 
                ON gesoffice_resellers(username)`);

            // Painéis P2BRAS
            this.db.run(`CREATE TABLE IF NOT EXISTS p2bras_panels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER DEFAULT 1,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                admin_username TEXT NOT NULL,
                admin_password TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
            )`);

            this.db.run(`CREATE INDEX IF NOT EXISTS idx_p2bras_panels_tenant 
                ON p2bras_panels(tenant_id)`);

            // Revendedores P2BRAS
            this.db.run(`CREATE TABLE IF NOT EXISTS p2bras_resellers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                p2bras_id INTEGER NOT NULL,
                panel_id INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (panel_id) REFERENCES p2bras_panels (id) ON DELETE CASCADE
            )`);

            this.db.run(`CREATE INDEX IF NOT EXISTS idx_p2bras_resellers_username 
                ON p2bras_resellers(username)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_p2bras_resellers_panel 
                ON p2bras_resellers(panel_id)`);
                
            // Pacotes de créditos
            this.db.run(`CREATE TABLE IF NOT EXISTS credit_packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reseller_id INTEGER NOT NULL,
                reseller_type TEXT DEFAULT 'sigma' NOT NULL,
                credits INTEGER NOT NULL,
                price REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_packages_reseller 
                ON credit_packages(reseller_id, reseller_type)`);

            // Pagamentos
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
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_payments_status 
                ON payments(status)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_payments_reseller 
                ON payments(reseller_id, reseller_type)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_payments_reseller_type 
                ON payments(reseller_type)`);

            // Transações
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
            
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_payment 
                ON transactions(payment_id)`);

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
        // Verificar se já existe tenant padrão
        this.db.get('SELECT * FROM tenants WHERE id = 1', (err, row) => {
            if (!row) {
                this.db.run(
                    'INSERT INTO tenants (id, name, slug, status) VALUES (?, ?, ?, ?)',
                    [1, 'Sistema Principal', 'default', 'active'],
                    () => {
                        console.log('Tenant padrão criado');
                    }
                );
            }
        });

        // Admin padrão
        this.db.get('SELECT * FROM admin_users WHERE username = ?', ['admin'], (err, row) => {
            if (!row) {
                this.db.run('INSERT INTO admin_users (username, password_hash, tenant_id) VALUES (?, ?, ?)', 
                    ['admin', this.hashPassword('admin123'), 1], () => {
                    console.log('Usuario admin criado: admin/admin123');
                });
            }
        });
    }

    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    // ═════════════════════════════════════════════════════════
    // ⭐ NOVOS MÉTODOS PARA VALIDAÇÃO DE EXPIRAÇÃO
    // ═════════════════════════════════════════════════════════

    /**
     * Verifica se um tenant está válido (ativo e não expirado)
     * @param {number} tenantId 
     * @returns {Promise<boolean>}
     */
    async isTenantValid(tenantId) {
        const tenant = await this.get(`
            SELECT status, expires_at 
            FROM tenants 
            WHERE id = ?
        `, [tenantId]);
        
        if (!tenant) return false;
        if (tenant.status !== 'active') return false;
        
        // Se não tem data de expiração, está válido
        if (!tenant.expires_at) return true;
        
        // Comparar com data atual (timezone do servidor)
        const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return tenant.expires_at >= now;
    }

    /**
     * Verifica se tenant está válido pelo slug
     * @param {string} slug 
     * @returns {Promise<Object|null>}
     */
    async getValidTenant(slug) {
        const tenant = await this.get(`
            SELECT * 
            FROM tenants 
            WHERE slug = ? 
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at >= DATE('now'))
        `, [slug]);
        
        return tenant;
    }

    /**
     * Obter informações sobre expiração de um tenant
     * @param {number} tenantId 
     * @returns {Promise<Object>}
     */
    async getTenantExpirationInfo(tenantId) {
        const tenant = await this.get(`
            SELECT id, name, slug, status, expires_at, created_at
            FROM tenants 
            WHERE id = ?
        `, [tenantId]);
        
        if (!tenant) {
            return { 
                exists: false, 
                valid: false, 
                expired: false 
            };
        }

        const now = new Date().toISOString().split('T')[0];
        const isExpired = tenant.expires_at && tenant.expires_at < now;
        const isValid = tenant.status === 'active' && !isExpired;

        return {
            exists: true,
            valid: isValid,
            expired: isExpired,
            status: tenant.status,
            expires_at: tenant.expires_at,
            name: tenant.name,
            slug: tenant.slug
        };
    }

    // ═════════════════════════════════════════════════════════
    // MÉTODOS AUXILIARES (mantidos do original)
    // ═════════════════════════════════════════════════════════

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
