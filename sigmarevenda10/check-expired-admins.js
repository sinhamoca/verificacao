#!/usr/bin/env node

/**
 * Script para verificar admins expirados ou próximos de expirar
 * Uso: node check-expired-admins.js [--days <dias>]
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const args = process.argv.slice(2);
let daysThreshold = 7; // Padrão: próximos 7 dias

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
        daysThreshold = parseInt(args[i + 1]);
        i++;
    }
}

const dbDir = path.join(__dirname, 'databases');

console.log('');
console.log('═'.repeat(60));
console.log('VERIFICAR LICENÇAS EXPIRADAS');
console.log('═'.repeat(60));
console.log('');

if (!fs.existsSync(dbDir)) {
    console.log('❌ Pasta databases/ não existe!');
    console.log('');
    process.exit(0);
}

const files = fs.readdirSync(dbDir);
const dbFiles = files.filter(file => 
    file.startsWith('database_') && 
    file.endsWith('.db') &&
    file !== 'database_sigma_recharge_default.db'
);

if (dbFiles.length === 0) {
    console.log('⚠️  Nenhum admin encontrado!');
    console.log('');
    process.exit(0);
}

const now = new Date();
let expired = [];
let expiringSoon = [];
let active = [];
let suspended = [];

let processed = 0;

console.log(`Verificando ${dbFiles.length} admin(s)...\n`);

dbFiles.forEach((file) => {
    const dbPath = path.join(dbDir, file);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

    db.get('SELECT * FROM admin_users LIMIT 1', [], (err, admin) => {
        if (err || !admin) {
            processed++;
            db.close();
            return;
        }

        const info = {
            username: admin.username,
            status: admin.status,
            expires_at: admin.expires_at,
            renewal_count: admin.renewal_count || 0
        };

        if (admin.status === 'suspended') {
            suspended.push(info);
        } else if (admin.expires_at) {
            const expiresAt = new Date(admin.expires_at);
            const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

            info.days_remaining = daysRemaining;
            info.expires_date = expiresAt.toLocaleDateString('pt-BR');

            if (daysRemaining < 0) {
                expired.push(info);
            } else if (daysRemaining <= daysThreshold) {
                expiringSoon.push(info);
            } else {
                active.push(info);
            }
        } else {
            active.push(info);
        }

        processed++;
        db.close();

        // Quando processar todos
        if (processed === dbFiles.length) {
            displayResults();
        }
    });
});

function displayResults() {
    // EXPIRADOS
    if (expired.length > 0) {
        console.log('❌ ADMINS EXPIRADOS:');
        console.log('─'.repeat(60));
        expired.forEach(admin => {
            const daysPast = Math.abs(admin.days_remaining);
            console.log(`  ${admin.username}`);
            console.log(`    Vencido há: ${daysPast} dias (${admin.expires_date})`);
            console.log(`    Renovações: ${admin.renewal_count}`);
            console.log(`    Ação: node renew-admin.js ${admin.username} --days 30`);
            console.log('');
        });
    }

    // EXPIRANDO EM BREVE
    if (expiringSoon.length > 0) {
        console.log(`⚠️  ADMINS EXPIRANDO EM ${daysThreshold} DIAS:`);
        console.log('─'.repeat(60));
        expiringSoon.forEach(admin => {
            console.log(`  ${admin.username}`);
            console.log(`    Expira em: ${admin.days_remaining} dias (${admin.expires_date})`);
            console.log(`    Renovações: ${admin.renewal_count}`);
            console.log(`    Ação: node renew-admin.js ${admin.username} --days 30`);
            console.log('');
        });
    }

    // SUSPENSOS
    if (suspended.length > 0) {
        console.log('🔒 ADMINS SUSPENSOS:');
        console.log('─'.repeat(60));
        suspended.forEach(admin => {
            console.log(`  ${admin.username}`);
            console.log(`    Status: suspended`);
            console.log(`    Ação: node activate-admin.js ${admin.username}`);
            console.log('');
        });
    }

    // ATIVOS
    if (active.length > 0) {
        console.log('✅ ADMINS ATIVOS:');
        console.log('─'.repeat(60));
        active.forEach(admin => {
            console.log(`  ${admin.username}`);
            if (admin.days_remaining) {
                console.log(`    Expira em: ${admin.days_remaining} dias (${admin.expires_date})`);
            } else {
                console.log(`    Validade: Ilimitada`);
            }
            console.log(`    Renovações: ${admin.renewal_count}`);
            console.log('');
        });
    }

    // RESUMO
    console.log('═'.repeat(60));
    console.log('RESUMO');
    console.log('═'.repeat(60));
    console.log(`Total de admins: ${dbFiles.length}`);
    console.log(`✅ Ativos: ${active.length}`);
    console.log(`⚠️  Expirando em breve: ${expiringSoon.length}`);
    console.log(`❌ Expirados: ${expired.length}`);
    console.log(`🔒 Suspensos: ${suspended.length}`);
    console.log('');

    if (expired.length > 0 || expiringSoon.length > 0) {
        console.log('Ações recomendadas:');
        if (expired.length > 0) {
            console.log(`  • Renovar ${expired.length} admin(s) expirado(s)`);
        }
        if (expiringSoon.length > 0) {
            console.log(`  • Avisar ${expiringSoon.length} admin(s) que vão expirar`);
        }
        console.log('');
    }

    console.log('═'.repeat(60));
    console.log('');
}
