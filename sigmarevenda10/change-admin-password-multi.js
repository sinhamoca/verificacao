#!/usr/bin/env node

/**
 * Script para trocar senha de admin (versão multi-admin)
 * Uso: node change-admin-password-multi.js <username> <nova_senha>
 * Exemplo: node change-admin-password-multi.js admin NovaSenha123
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('');
    console.log('═'.repeat(60));
    console.log('TROCAR SENHA ADMINISTRATIVA (MULTI-ADMIN)');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Uso: node change-admin-password-multi.js <username> <nova_senha>');
    console.log('');
    console.log('Exemplo:');
    console.log('  node change-admin-password-multi.js admin MinhaNovaSenh@123');
    console.log('  node change-admin-password-multi.js joao Senh@Forte456');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(1);
}

const [username, newPassword] = args;

// Função para hash SHA-256 (mesma do servidor)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Caminho do database (agora na pasta databases/)
const dbPath = path.join(__dirname, 'databases', `database_${username}.db`);

// Verificar se database existe
if (!fs.existsSync(dbPath)) {
    console.log('');
    console.log('═'.repeat(60));
    console.log('❌ ERRO: Admin não encontrado!');
    console.log('═'.repeat(60));
    console.log('');
    console.log(`Database "databases/database_${username}.db" não existe.`);
    console.log('');
    console.log('Opções:');
    console.log('  1. Verifique se o username está correto');
    console.log('  2. Liste os admins existentes:');
    console.log('     ls -la databases/database_*.db');
    console.log('  3. Crie um novo admin:');
    console.log(`     node create-new-admin.js ${username} ${newPassword}`);
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(1);
}

console.log('');
console.log('═'.repeat(60));
console.log('TROCAR SENHA ADMINISTRATIVA');
console.log('═'.repeat(60));
console.log('');

// Conectar ao banco
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
});

// Verificar se usuário existe
db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, user) => {
    if (err) {
        console.error('❌ Erro:', err.message);
        db.close();
        process.exit(1);
    }

    if (!user) {
        console.log(`❌ Erro: Usuário "${username}" não encontrado no database!`);
        console.log('');
        console.log('Isso é estranho - o database existe mas não tem o usuário.');
        console.log('O database pode estar corrompido.');
        console.log('');
        db.close();
        process.exit(1);
    }

    // Hash da nova senha
    const hashedPassword = hashPassword(newPassword);

    // Atualizar senha
    db.run('UPDATE admin_users SET password_hash = ? WHERE username = ?', 
        [hashedPassword, username], 
        function(err) {
            if (err) {
                console.error('❌ Erro ao atualizar senha:', err.message);
                db.close();
                process.exit(1);
            }

            console.log(`Usuario: ${username}`);
            console.log(`Nova senha: ${newPassword}`);
            console.log(`Database: databases/database_${username}.db`);
            console.log(`Hash SHA-256: ${hashedPassword.substring(0, 20)}...`);
            console.log('');
            console.log('✅ Senha alterada com sucesso!');
            console.log('');
            console.log('IMPORTANTE: Anote a nova senha em local seguro!');
            console.log('');
            console.log('Próximos passos:');
            console.log('  1. Faça login no painel admin');
            console.log(`  2. Use: ${username} / ${newPassword}`);
            console.log('');
            console.log('═'.repeat(60));
            console.log('');

            db.close();
        }
    );
});
