#!/usr/bin/env node

/**
 * Script para trocar senha administrativa
 * Uso: node change-admin-password.js <username> <nova_senha>
 * Exemplo: node change-admin-password.js admin MinhaNovaSenh@123
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('');
    console.log('Uso: node change-admin-password.js <username> <nova_senha>');
    console.log('');
    console.log('Exemplo:');
    console.log('  node change-admin-password.js admin MinhaNovaSenh@123');
    console.log('');
    process.exit(1);
}

const [username, newPassword] = args;

// Função para hash SHA-256 (mesma do servidor)
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Conectar ao banco
const db = new sqlite3.Database('sigma_recharge.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
});

console.log('');
console.log('='.repeat(60));
console.log('TROCAR SENHA ADMINISTRATIVA');
console.log('='.repeat(60));
console.log('');

// Verificar se usuário existe
db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, user) => {
    if (err) {
        console.error('Erro:', err.message);
        db.close();
        process.exit(1);
    }

    if (!user) {
        console.log(`Erro: Usuario "${username}" nao encontrado!`);
        console.log('');
        console.log('Para criar novo admin, use:');
        console.log(`  node create-admin.js ${username} ${newPassword}`);
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
                console.error('Erro ao atualizar senha:', err.message);
                db.close();
                process.exit(1);
            }

            console.log(`Usuario: ${username}`);
            console.log(`Nova senha: ${newPassword}`);
            console.log(`Hash SHA-256: ${hashedPassword.substring(0, 20)}...`);
            console.log('');
            console.log('Senha alterada com sucesso!');
            console.log('');
            console.log('IMPORTANTE: Anote a nova senha em local seguro!');
            console.log('');
            console.log('='.repeat(60));
            console.log('');

            db.close();
        }
    );
});
