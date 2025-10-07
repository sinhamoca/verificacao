#!/usr/bin/env node

/**
 * Script de Correção COMPLETA do Banco de Dados
 * Cria todas as tabelas necessárias para Sigma + Koffice
 * Uso: node full-database-fix.js
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const DB_PATH = 'sigma_recharge.db';

console.log('\n' + '='.repeat(70));
console.log('🔧 CORREÇÃO COMPLETA - BANCO DE DADOS SIGMA RECHARGE');
console.log('='.repeat(70) + '\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco\n');
});

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function fix() {
    try {
        console.log('📋 1. Verificando tabelas existentes...\n');
        
        const tables = await query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            ORDER BY name
        `);
        
        console.log('   Tabelas encontradas:');
        tables.forEach(t => console.log(`   - ${t.name}`));
        console.log('');

        // ========================================
        // CRIAR TABELAS ESSENCIAIS
        // ========================================

        console.log('🔨 2. Criando/verificando tabelas essenciais...\n');

        // System Config
        console.log('   📦 system_config...');
        await run(`CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('   ✅ system_config OK');

        // Admin Users
        console.log('   📦 admin_users...');
        await run(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('   ✅ admin_users OK');

        // Sigma Panels
        console.log('   📦 sigma_panels...');
        await run(`CREATE TABLE IF NOT EXISTS sigma_panels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            admin_username TEXT NOT NULL,
            admin_password TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('   ✅ sigma_panels OK');

        // Resellers
        console.log('   📦 resellers...');
        await run(`CREATE TABLE IF NOT EXISTS resellers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            panel_id INTEGER NOT NULL,
            sigma_user_id TEXT,
            reseller_type TEXT DEFAULT 'sigma',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (panel_id) REFERENCES sigma_panels (id)
        )`);
        console.log('   ✅ resellers OK');

        // Koffice Panels
        console.log('   📦 koffice_panels...');
        await run(`CREATE TABLE IF NOT EXISTS koffice_panels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            admin_username TEXT NOT NULL,
            admin_password TEXT NOT NULL,
            has_captcha BOOLEAN DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('   ✅ koffice_panels OK');

        // Koffice Resellers
        console.log('   📦 koffice_resellers...');
        await run(`CREATE TABLE IF NOT EXISTS koffice_resellers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            koffice_id TEXT NOT NULL,
            panel_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (panel_id) REFERENCES koffice_panels (id)
        )`);
        console.log('   ✅ koffice_resellers OK');

        // ========================================
        // CRÍTICO: CREDIT PACKAGES
        // ========================================
        
        console.log('   📦 credit_packages (CRÍTICO)...');
        await run(`CREATE TABLE IF NOT EXISTS credit_packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reseller_id INTEGER NOT NULL,
            reseller_type TEXT DEFAULT 'sigma' NOT NULL,
            credits INTEGER NOT NULL,
            price REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('   ✅ credit_packages OK');

        // Payments
        console.log('   📦 payments...');
        await run(`CREATE TABLE IF NOT EXISTS payments (
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
        console.log('   ✅ payments OK');

        // Transactions
        console.log('   📦 transactions...');
        await run(`CREATE TABLE IF NOT EXISTS transactions (
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
        console.log('   ✅ transactions OK');

        console.log('');

        // ========================================
        // CRIAR ÍNDICES
        // ========================================

        console.log('📊 3. Criando índices para performance...\n');

        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_packages_reseller ON credit_packages(reseller_id, reseller_type)',
            'CREATE INDEX IF NOT EXISTS idx_payments_reseller ON payments(reseller_id, reseller_type)',
            'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_payment ON transactions(payment_id)',
            'CREATE INDEX IF NOT EXISTS idx_koffice_resellers_username ON koffice_resellers(username)',
            'CREATE INDEX IF NOT EXISTS idx_koffice_resellers_panel ON koffice_resellers(panel_id)'
        ];

        for (const sql of indexes) {
            try {
                await run(sql);
                console.log(`   ✅ ${sql.split(' ')[5]} criado`);
            } catch (err) {
                if (err.message.includes('already exists')) {
                    console.log(`   ⚠️  ${sql.split(' ')[5]} já existe`);
                } else {
                    throw err;
                }
            }
        }

        console.log('');

        // ========================================
        // SEED DATA
        // ========================================

        console.log('🌱 4. Verificando dados iniciais...\n');

        // Config
        const configs = [
            ['access_question', 'Com quantos paus se faz uma canoa?'],
            ['access_answer', hashPassword('eusouandroid2029')],
            ['mp_access_token', ''],
            ['anticaptcha_api_key', '']
        ];

        for (const [key, value] of configs) {
            const existing = await get('SELECT * FROM system_config WHERE key = ?', [key]);
            if (!existing) {
                await run('INSERT INTO system_config (key, value) VALUES (?, ?)', [key, value]);
                console.log(`   ✅ Config "${key}" criada`);
            } else {
                console.log(`   ⚠️  Config "${key}" já existe`);
            }
        }

        // Admin default
        const adminExists = await get('SELECT * FROM admin_users WHERE username = ?', ['admin']);
        if (!adminExists) {
            await run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', 
                ['admin', hashPassword('admin123')]);
            console.log('   ✅ Admin padrão criado (admin/admin123)');
        } else {
            console.log('   ⚠️  Admin padrão já existe');
        }

        console.log('');

        // ========================================
        // ESTATÍSTICAS
        // ========================================

        console.log('📈 5. Estatísticas do banco...\n');

        const stats = {
            sigma_panels: await query('SELECT COUNT(*) as total FROM sigma_panels'),
            koffice_panels: await query('SELECT COUNT(*) as total FROM koffice_panels'),
            resellers: await query('SELECT COUNT(*) as total FROM resellers'),
            koffice_resellers: await query('SELECT COUNT(*) as total FROM koffice_resellers'),
            credit_packages: await query('SELECT COUNT(*) as total FROM credit_packages'),
            payments: await query('SELECT COUNT(*) as total FROM payments'),
            transactions: await query('SELECT COUNT(*) as total FROM transactions')
        };

        console.log('   Registros no banco:');
        console.log(`   - Painéis Sigma: ${stats.sigma_panels[0].total}`);
        console.log(`   - Painéis Koffice: ${stats.koffice_panels[0].total}`);
        console.log(`   - Revendedores Sigma: ${stats.resellers[0].total}`);
        console.log(`   - Revendedores Koffice: ${stats.koffice_resellers[0].total}`);
        console.log(`   - Pacotes de Créditos: ${stats.credit_packages[0].total}`);
        console.log(`   - Pagamentos: ${stats.payments[0].total}`);
        console.log(`   - Transações: ${stats.transactions[0].total}`);

        console.log('');

        // ========================================
        // VERIFICAÇÃO FINAL
        // ========================================

        console.log('✅ 6. Verificação final...\n');

        const finalTables = await query(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        console.log('   Tabelas criadas/verificadas:');
        finalTables.forEach(t => console.log(`   ✅ ${t.name}`));

        console.log('');
        console.log('='.repeat(70));
        console.log('✅ BANCO DE DADOS CORRIGIDO COM SUCESSO!');
        console.log('='.repeat(70));
        console.log('\nPróximos passos:');
        console.log('1. Reiniciar servidor: pm2 restart sigma-recharge');
        console.log('2. Acessar admin: http://localhost:3010/admin.html');
        console.log('3. Login: admin / admin123');
        console.log('4. Cadastrar painéis e revendedores');
        console.log('5. Criar pacotes de créditos\n');

        db.close();

    } catch (error) {
        console.error('\n❌ Erro durante correção:', error.message);
        console.error('Stack:', error.stack);
        db.close();
        process.exit(1);
    }
}

fix();
