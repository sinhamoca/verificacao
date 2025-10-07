#!/usr/bin/env node

/**
 * Script para criar novo admin com database isolado
 * Uso: node create-new-admin.js <username> <senha>
 * Exemplo: node create-new-admin.js joao MinhaSenh@123
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// Verificar flags
let customDays = null;
let username = null;
let password = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
        customDays = parseInt(args[i + 1]);
        i++; // Pular o próximo argumento
    } else if (!username) {
        username = args[i];
    } else if (!password) {
        password = args[i];
    }
}

if (!username || !password) {
    console.log('');
    console.log('═'.repeat(60));
    console.log('CRIAR NOVO ADMIN COM DATABASE ISOLADO');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Uso: node create-new-admin.js <username> <senha> [--days <dias>]');
    console.log('');
    console.log('Exemplos:');
    console.log('  node create-new-admin.js joao MinhaSenh@123');
    console.log('  node create-new-admin.js maria Senh@Forte456 --days 60');
    console.log('  node create-new-admin.js admin AdminPass123 --days 365');
    console.log('');
    console.log('Cada admin terá:');
    console.log('  ✓ Database próprio e isolado');
    console.log('  ✓ Configurações próprias (MP, AntiCaptcha, etc)');
    console.log('  ✓ Painéis próprios (Sigma, Koffice, UNIPLAY)');
    console.log('  ✓ Revendedores próprios');
    console.log('  ✓ Transações próprias');
    console.log('  ✓ Validade de 30 dias (ou customizada com --days)');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(1);
}

// Validações
if (username.length < 3) {
    console.error('❌ Username deve ter no mínimo 3 caracteres');
    process.exit(1);
}

if (password.length < 6) {
    console.error('❌ Senha deve ter no mínimo 6 caracteres');
    process.exit(1);
}

// Função para hash SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Nome do database do novo admin (agora dentro da pasta databases/)
const dbDir = path.join(__dirname, 'databases');
const dbFilename = `database_${username}.db`;
const dbPath = path.join(dbDir, dbFilename);

// Criar pasta databases se não existir
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Pasta databases/ criada');
}

// Verificar se database já existe
if (fs.existsSync(dbPath)) {
    console.log('');
    console.log('═'.repeat(60));
    console.log('❌ ERRO: Admin já existe!');
    console.log('═'.repeat(60));
    console.log('');
    console.log(`Database "databases/${dbFilename}" já existe.`);
    console.log('');
    console.log('Opções:');
    console.log('  1. Use outro username');
    console.log('  2. Delete o database existente:');
    console.log(`     rm databases/${dbFilename}`);
    console.log('  3. Troque a senha do admin existente:');
    console.log(`     node change-admin-password.js ${username} NovaSenha123`);
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(1);
}

console.log('');
console.log('═'.repeat(60));
console.log('CRIANDO NOVO ADMIN');
console.log('═'.repeat(60));
console.log('');
console.log(`Username: ${username}`);
console.log(`Password: ${password}`);
console.log(`Database: ${dbFilename}`);
console.log('');
console.log('Aguarde...');
console.log('');

// Criar novo database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao criar database:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    // Criar todas as tabelas
    db.run(`CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        expires_at DATETIME,
        renewed_at DATETIME,
        renewal_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sigma_panels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        admin_username TEXT NOT NULL,
        admin_password TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS resellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        panel_id INTEGER NOT NULL,
        sigma_user_id TEXT,
        reseller_type TEXT DEFAULT 'sigma',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (panel_id) REFERENCES sigma_panels (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS koffice_panels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        admin_username TEXT NOT NULL,
        admin_password TEXT NOT NULL,
        has_captcha BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS koffice_resellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        koffice_id TEXT NOT NULL,
        panel_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (panel_id) REFERENCES koffice_panels (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS gesoffice_panels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        admin_username TEXT NOT NULL,
        admin_password TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS gesoffice_resellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        gesoffice_id TEXT NOT NULL,
        panel_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (panel_id) REFERENCES gesoffice_panels (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS credit_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        credits INTEGER NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
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

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
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

    db.run(`CREATE TABLE IF NOT EXISTS import_logs (
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

    // Inserir configurações padrão
    db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
        ['access_question', 'Com quantos paus se faz uma canoa?']);
    db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
        ['access_answer', hashPassword('eusouandroid2029')]);
    db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
        ['mp_access_token', '']);
    db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
        ['anticaptcha_api_key', '']);

    // Criar usuário admin com validade
    const passwordHash = hashPassword(password);
    
    // Calcular data de expiração (30 dias ou customizado)
    const daysToAdd = customDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);
    expiresAt.setHours(23, 59, 59, 999); // Até o final do dia
    
    const expiresAtISO = expiresAt.toISOString();
    
    db.run(
        'INSERT INTO admin_users (username, password_hash, status, expires_at, renewed_at, renewal_count) VALUES (?, ?, ?, ?, ?, ?)', 
        [username, passwordHash, 'active', expiresAtISO, new Date().toISOString(), 0], 
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar admin:', err.message);
                db.close();
                fs.unlinkSync(dbPath); // Remover database incompleto
                process.exit(1);
            }

            console.log('✓ Tabelas criadas');
            console.log('✓ Configurações padrão inseridas');
            console.log('✓ Usuário admin criado');
            console.log('');
            console.log('═'.repeat(60));
            console.log('✅ ADMIN CRIADO COM SUCESSO!');
            console.log('═'.repeat(60));
            console.log('');
            console.log('Detalhes:');
            console.log(`  Username: ${username}`);
            console.log(`  Password: ${password}`);
            console.log(`  Database: databases/${dbFilename}`);
            console.log(`  Status: active`);
            console.log(`  Validade: ${daysToAdd} dias`);
            console.log(`  Expira em: ${expiresAt.toLocaleDateString('pt-BR')} às ${expiresAt.toLocaleTimeString('pt-BR')}`);
            console.log('');
            console.log('Configurações padrão:');
            console.log('  ✓ Pergunta de acesso: "Com quantos paus se faz uma canoa?"');
            console.log('  ✓ Resposta: eusouandroid2029');
            console.log('  ✓ Mercado Pago: (vazio - configurar no painel)');
            console.log('  ✓ AntiCaptcha: (vazio - configurar no painel)');
            console.log('');
            console.log('Próximos passos:');
            console.log('  1. Faça login no painel admin');
            console.log('  2. Configure suas chaves (MP e AntiCaptcha)');
            console.log('  3. Adicione seus painéis e revendedores');
            console.log('');
            console.log('Para renovar a licença:');
            console.log(`  node renew-admin.js ${username} [--days 30]`);
            console.log('');
            console.log('IMPORTANTE: Anote estas credenciais em local seguro!');
            console.log('');
            console.log('═'.repeat(60));
            console.log('');

            db.close();
        }
    );
});
