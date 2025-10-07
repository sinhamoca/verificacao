#!/usr/bin/env node

/**
 * Script de Debug do Login Admin
 * Uso: node debug-login.js
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const db = new sqlite3.Database('sigma_recharge.db', (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
});

console.log('');
console.log('='.repeat(70));
console.log('🔍 DEBUG DO LOGIN ADMIN');
console.log('='.repeat(70));
console.log('');

// Verificar usuários no banco
db.all('SELECT * FROM admin_users', (err, users) => {
    if (err) {
        console.error('❌ Erro ao buscar usuários:', err.message);
        db.close();
        return;
    }

    console.log(`📊 Total de admins no banco: ${users.length}`);
    console.log('');

    if (users.length === 0) {
        console.log('⚠️  NENHUM ADMIN ENCONTRADO!');
        console.log('');
        console.log('Execute este comando para criar:');
        console.log('  node change-admin-password.js admin admin123');
        console.log('');
    } else {
        users.forEach((user, index) => {
            console.log(`[${index + 1}] Username: ${user.username}`);
            console.log(`    ID: ${user.id}`);
            console.log(`    Hash no banco: ${user.password_hash}`);
            console.log('');
        });
    }

    // Testar login com admin/admin123
    console.log('='.repeat(70));
    console.log('🧪 TESTE DE LOGIN');
    console.log('='.repeat(70));
    console.log('');

    const testUsername = 'admin';
    const testPassword = 'admin123';
    const testHash = hashPassword(testPassword);

    console.log(`Username testado: ${testUsername}`);
    console.log(`Password testada: ${testPassword}`);
    console.log(`Hash gerado: ${testHash}`);
    console.log('');

    db.get('SELECT * FROM admin_users WHERE username = ?', [testUsername], (err, admin) => {
        if (err) {
            console.error('❌ Erro ao buscar admin:', err.message);
            db.close();
            return;
        }

        if (!admin) {
            console.log(`❌ ERRO: Usuário "${testUsername}" NÃO EXISTE no banco!`);
            console.log('');
            console.log('Crie o usuário com:');
            console.log(`  node change-admin-password.js ${testUsername} ${testPassword}`);
            console.log('');
        } else {
            console.log('✅ Usuário encontrado no banco');
            console.log('');
            console.log('📋 Comparação:');
            console.log(`   Hash esperado: ${testHash}`);
            console.log(`   Hash no banco: ${admin.password_hash}`);
            console.log('');

            if (testHash === admin.password_hash) {
                console.log('✅ ✅ ✅ SENHAS COINCIDEM! Login deveria funcionar!');
                console.log('');
                console.log('⚠️  Se ainda não funciona, o problema está em:');
                console.log('   1. Função hashPassword() no routes/admin.js');
                console.log('   2. Lógica de comparação no endpoint /login');
                console.log('');
            } else {
                console.log('❌ ❌ ❌ SENHAS NÃO COINCIDEM!');
                console.log('');
                console.log('🔧 SOLUÇÃO: Recriar o hash da senha:');
                console.log(`   node change-admin-password.js ${testUsername} ${testPassword}`);
                console.log('');
            }
        }

        console.log('='.repeat(70));
        console.log('');
        db.close();
    });
});
