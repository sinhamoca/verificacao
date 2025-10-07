// models/SuperAdmin.js
// Gerenciador de todos os admins (Super Admin)

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

class SuperAdmin {
    constructor() {
        this.dbDir = path.join(__dirname, '..', 'databases');
        this.superPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin2025!@#';
    }

    /**
     * Verifica super-senha
     */
    verifyPassword(password) {
        return password === this.superPassword;
    }

    /**
     * Hash de senha
     */
    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }

    /**
     * Lista todos os admins com detalhes
     */
    async listAllAdmins() {
        try {
            if (!fs.existsSync(this.dbDir)) {
                return [];
            }

            const files = fs.readdirSync(this.dbDir);
            const dbFiles = files.filter(file => 
                file.startsWith('database_') && 
                file.endsWith('.db') &&
                file !== 'database_sigma_recharge_default.db'
            );

            const admins = [];

            for (const file of dbFiles) {
                const dbPath = path.join(this.dbDir, file);
                const adminData = await this.getAdminDetails(dbPath, file);
                if (adminData) {
                    admins.push(adminData);
                }
            }

            return admins;
        } catch (error) {
            console.error('[SuperAdmin] Erro ao listar admins:', error);
            return [];
        }
    }

    /**
     * Obtém detalhes de um admin
     */
    async getAdminDetails(dbPath, filename) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error(`Erro ao abrir ${filename}:`, err);
                    resolve(null);
                    return;
                }
            });

            db.get('SELECT * FROM admin_users LIMIT 1', [], (err, admin) => {
                if (err || !admin) {
                    db.close();
                    resolve(null);
                    return;
                }

                // Buscar estatísticas
                db.all(`
                    SELECT 
                        (SELECT COUNT(*) FROM sigma_panels WHERE status = 'active') as sigma_panels,
                        (SELECT COUNT(*) FROM koffice_panels WHERE status = 'active') as koffice_panels,
                        (SELECT COUNT(*) FROM gesoffice_panels WHERE status = 'active') as gesoffice_panels,
                        (SELECT COUNT(*) FROM resellers WHERE status = 'active') as sigma_resellers,
                        (SELECT COUNT(*) FROM koffice_resellers WHERE status = 'active') as koffice_resellers,
                        (SELECT COUNT(*) FROM gesoffice_resellers WHERE status = 'active') as gesoffice_resellers,
                        (SELECT COUNT(*) FROM payments WHERE status = 'approved') as payments,
                        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'approved') as revenue
                `, [], (err, rows) => {
                    const stats = rows[0] || {};
                    
                    const totalPanels = (stats.sigma_panels || 0) + (stats.koffice_panels || 0) + (stats.gesoffice_panels || 0);
                    const totalResellers = (stats.sigma_resellers || 0) + (stats.koffice_resellers || 0) + (stats.gesoffice_resellers || 0);
                    
                    // Calcular status de licença
                    let licenseStatus = 'active';
                    let daysRemaining = null;
                    let expiringWarning = false;
                    
                    if (admin.status === 'suspended') {
                        licenseStatus = 'suspended';
                    } else if (admin.status === 'expired') {
                        licenseStatus = 'expired';
                    } else if (admin.expires_at) {
                        const now = new Date();
                        const expiresAt = new Date(admin.expires_at);
                        daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                        
                        if (daysRemaining < 0) {
                            licenseStatus = 'expired';
                        } else if (daysRemaining <= 7) {
                            expiringWarning = true;
                        }
                    }

                    db.close();
                    
                    resolve({
                        username: admin.username,
                        database: filename,
                        status: admin.status || 'active',
                        licenseStatus,
                        expires_at: admin.expires_at,
                        daysRemaining,
                        expiringWarning,
                        created_at: admin.created_at,
                        renewed_at: admin.renewed_at,
                        renewal_count: admin.renewal_count || 0,
                        stats: {
                            panels: {
                                sigma: stats.sigma_panels || 0,
                                koffice: stats.koffice_panels || 0,
                                gesoffice: stats.gesoffice_panels || 0,
                                total: totalPanels
                            },
                            resellers: {
                                sigma: stats.sigma_resellers || 0,
                                koffice: stats.koffice_resellers || 0,
                                gesoffice: stats.gesoffice_resellers || 0,
                                total: totalResellers
                            },
                            payments: stats.payments || 0,
                            revenue: stats.revenue || 0
                        }
                    });
                });
            });
        });
    }

    /**
     * Cria novo admin
     */
    async createAdmin(username, password, days = 30) {
        const dbFilename = `database_${username}.db`;
        const dbPath = path.join(this.dbDir, dbFilename);

        // Verificar se já existe
        if (fs.existsSync(dbPath)) {
            throw new Error('Admin já existe');
        }

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });

            db.serialize(() => {
                // Criar tabelas (mesma estrutura do create-new-admin.js)
                const tables = [
                    `CREATE TABLE IF NOT EXISTS system_config (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        key TEXT UNIQUE NOT NULL,
                        value TEXT NOT NULL,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS admin_users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        status TEXT DEFAULT 'active',
                        expires_at DATETIME,
                        renewed_at DATETIME,
                        renewal_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS sigma_panels (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        url TEXT NOT NULL,
                        admin_username TEXT NOT NULL,
                        admin_password TEXT NOT NULL,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS resellers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        panel_id INTEGER NOT NULL,
                        sigma_user_id TEXT,
                        reseller_type TEXT DEFAULT 'sigma',
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (panel_id) REFERENCES sigma_panels (id)
                    )`,
                    `CREATE TABLE IF NOT EXISTS koffice_panels (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        url TEXT NOT NULL,
                        admin_username TEXT NOT NULL,
                        admin_password TEXT NOT NULL,
                        has_captcha BOOLEAN DEFAULT 0,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS koffice_resellers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        koffice_id TEXT NOT NULL,
                        panel_id INTEGER NOT NULL,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (panel_id) REFERENCES koffice_panels (id)
                    )`,
                    `CREATE TABLE IF NOT EXISTS gesoffice_panels (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        url TEXT NOT NULL,
                        admin_username TEXT NOT NULL,
                        admin_password TEXT NOT NULL,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS gesoffice_resellers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        gesoffice_id TEXT NOT NULL,
                        panel_id INTEGER NOT NULL,
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (panel_id) REFERENCES gesoffice_panels (id)
                    )`,
                    `CREATE TABLE IF NOT EXISTS credit_packages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        credits INTEGER NOT NULL,
                        price REAL NOT NULL,
                        description TEXT,
                        active BOOLEAN DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS payments (
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
                    )`,
                    `CREATE TABLE IF NOT EXISTS transactions (
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
                    )`,
                    `CREATE TABLE IF NOT EXISTS import_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        domain_id INTEGER,
                        package_id INTEGER,
                        total_clients INTEGER,
                        successful_imports INTEGER,
                        failed_imports INTEGER,
                        success_rate REAL,
                        details TEXT
                    )`
                ];

                tables.forEach(sql => db.run(sql));

                // Inserir configurações padrão
                db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                    ['access_question', 'Com quantos paus se faz uma canoa?']);
                db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                    ['access_answer', this.hashPassword('eusouandroid2029')]);
                db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                    ['mp_access_token', '']);
                db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                    ['anticaptcha_api_key', '']);

                // Criar admin com validade
                const passwordHash = this.hashPassword(password);
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + days);
                expiresAt.setHours(23, 59, 59, 999);
                const expiresAtISO = expiresAt.toISOString();

                db.run(
                    'INSERT INTO admin_users (username, password_hash, status, expires_at, renewed_at, renewal_count) VALUES (?, ?, ?, ?, ?, ?)',
                    [username, passwordHash, 'active', expiresAtISO, new Date().toISOString(), 0],
                    function(err) {
                        db.close();
                        if (err) {
                            fs.unlinkSync(dbPath);
                            reject(err);
                        } else {
                            resolve({
                                username,
                                database: dbFilename,
                                expires_at: expiresAtISO,
                                days
                            });
                        }
                    }
                );
            });
        });
    }

    /**
     * Renova licença de admin
     */
    async renewAdmin(username, days = 30) {
        const dbPath = path.join(this.dbDir, `database_${username}.db`);

        if (!fs.existsSync(dbPath)) {
            throw new Error('Admin não encontrado');
        }

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, admin) => {
                if (err || !admin) {
                    db.close();
                    reject(new Error('Admin não encontrado no database'));
                    return;
                }

                let baseDate;
                if (admin.expires_at) {
                    const currentExpires = new Date(admin.expires_at);
                    const now = new Date();
                    baseDate = currentExpires > now ? currentExpires : now;
                } else {
                    baseDate = new Date();
                }

                const newExpiresAt = new Date(baseDate);
                newExpiresAt.setDate(newExpiresAt.getDate() + days);
                newExpiresAt.setHours(23, 59, 59, 999);
                const newExpiresAtISO = newExpiresAt.toISOString();
                const renewedAt = new Date().toISOString();
                const newRenewalCount = (admin.renewal_count || 0) + 1;

                db.run(
                    'UPDATE admin_users SET expires_at = ?, renewed_at = ?, renewal_count = ?, status = ? WHERE username = ?',
                    [newExpiresAtISO, renewedAt, newRenewalCount, 'active', username],
                    function(err) {
                        db.close();
                        if (err) {
                            reject(err);
                        } else {
                            resolve({
                                username,
                                expires_at: newExpiresAtISO,
                                renewal_count: newRenewalCount,
                                days
                            });
                        }
                    }
                );
            });
        });
    }

    /**
     * Suspende admin
     */
    async suspendAdmin(username) {
        return this.updateAdminStatus(username, 'suspended');
    }

    /**
     * Ativa admin
     */
    async activateAdmin(username) {
        return this.updateAdminStatus(username, 'active');
    }

    /**
     * Atualiza status do admin
     */
    async updateAdminStatus(username, status) {
        const dbPath = path.join(this.dbDir, `database_${username}.db`);

        if (!fs.existsSync(dbPath)) {
            throw new Error('Admin não encontrado');
        }

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.run(
                'UPDATE admin_users SET status = ? WHERE username = ?',
                [status, username],
                function(err) {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ username, status });
                    }
                }
            );
        });
    }

    /**
     * Troca senha do admin
     */
    async changeAdminPassword(username, newPassword) {
        const dbPath = path.join(this.dbDir, `database_${username}.db`);

        if (!fs.existsSync(dbPath)) {
            throw new Error('Admin não encontrado');
        }

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);
            const hashedPassword = this.hashPassword(newPassword);

            db.run(
                'UPDATE admin_users SET password_hash = ? WHERE username = ?',
                [hashedPassword, username],
                function(err) {
                    db.close();
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ username, message: 'Senha alterada' });
                    }
                }
            );
        });
    }

    /**
     * Deleta admin (com confirmação)
     */
    async deleteAdmin(username) {
        const dbPath = path.join(this.dbDir, `database_${username}.db`);

        if (!fs.existsSync(dbPath)) {
            throw new Error('Admin não encontrado');
        }

        // Fazer backup antes
        const backupPath = path.join(this.dbDir, 'backups', `database_${username}_${Date.now()}.db`);
        const backupDir = path.join(this.dbDir, 'backups');
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        fs.copyFileSync(dbPath, backupPath);
        fs.unlinkSync(dbPath);

        return { username, backup: backupPath };
    }

    /**
     * Estatísticas gerais
     */
    async getGlobalStats() {
        const admins = await this.listAllAdmins();

        const stats = {
            total: admins.length,
            active: 0,
            expiring: 0,
            expired: 0,
            suspended: 0,
            totalRevenue: 0,
            totalPayments: 0,
            totalPanels: 0,
            totalResellers: 0
        };

        admins.forEach(admin => {
            if (admin.licenseStatus === 'suspended') {
                stats.suspended++;
            } else if (admin.licenseStatus === 'expired') {
                stats.expired++;
            } else if (admin.expiringWarning) {
                stats.expiring++;
            } else {
                stats.active++;
            }

            stats.totalRevenue += admin.stats.revenue;
            stats.totalPayments += admin.stats.payments;
            stats.totalPanels += admin.stats.panels.total;
            stats.totalResellers += admin.stats.resellers.total;
        });

        return stats;
    }
}

module.exports = new SuperAdmin();
