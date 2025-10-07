#!/usr/bin/env node

/**
 * Script para suspender admin manualmente
 * Uso: node suspend-admin.js <username>
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length < 1) {
    console.log('');
    console.log('═'.repeat(60));
    console.log('SUSPENDER ADMIN');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Uso: node suspend-admin.js <username>');
    console.log('');
    console.log('Exemplo:');
    console.log('  node suspend-admin.js joao');
    console.log('');
    console.log('Isso irá:');
    console.log('  • Bloquear login do admin');
    console.log('  • Impedir revendedores de comprar');
    console.log('  • Manter dados preservados');
    console.log('');
    console.log('Para reativar:');
    console.log('  node activate-admin.js joao');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(1);
}

const username = args[0];
const dbPath = path.join(__dirname, 'databases', `database_${username}.db`);

if (!fs.existsSync(dbPath)) {
    console.log('');
    console.log(`❌ Admin "${username}" não encontrado!`);
    console.log('');
    process.exit(1);
}

console.log('');
console.log('═'.repeat(60));
console.log('SUSPENDER ADMIN');
console.log('═'.repeat(60));
console.log('');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    }
});

db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, admin) => {
    if (err || !admin) {
        console.log('❌ Erro ao buscar admin');
        db.close();
        process.exit(1);
    }

    if (admin.status === 'suspended') {
        console.log(`⚠️  Admin "${username}" já está suspenso!`);
        console.log('');
        console.log('Para reativar:');
        console.log(`  node activate-admin.js ${username}`);
        console.log('');
        db.close();
        process.exit(0);
    }

    db.run(
        'UPDATE admin_users SET status = ? WHERE username = ?',
        ['suspended', username],
        function(err) {
            if (err) {
                console.error('❌ Erro ao suspender:', err.message);
                db.close();
                process.exit(1);
            }

            console.log(`✅ Admin "${username}" SUSPENSO com sucesso!`);
            console.log('');
            console.log('Efeitos:');
            console.log('  ❌ Login bloqueado');
            console.log('  ❌ Revendedores não podem comprar');
            console.log('  ✅ Dados preservados');
            console.log('');
            console.log('Para reativar:');
            console.log(`  node activate-admin.js ${username}`);
            console.log('');
            console.log('═'.repeat(60));
            console.log('');

            db.close();
        }
    );
});
