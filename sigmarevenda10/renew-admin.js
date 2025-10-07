#!/usr/bin/env node

/**
 * Script para renovar licença de admin
 * Uso: node renew-admin.js <username> [--days <dias>]
 * Exemplo: node renew-admin.js joao --days 60
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

// Parse argumentos
let username = null;
let customDays = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
        customDays = parseInt(args[i + 1]);
        i++;
    } else if (!username) {
        username = args[i];
    }
}

if (!username) {
    console.log('');
    console.log('═'.repeat(60));
    console.log('RENOVAR LICENÇA DE ADMIN');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Uso: node renew-admin.js <username> [--days <dias>]');
    console.log('');
    console.log('Exemplos:');
    console.log('  node renew-admin.js joao              (renova por 30 dias)');
    console.log('  node renew-admin.js maria --days 60   (renova por 60 dias)');
    console.log('  node renew-admin.js admin --days 365  (renova por 1 ano)');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(1);
}

// Caminho do database
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
    console.log('Verifique o username ou crie o admin:');
    console.log(`  node create-new-admin.js ${username} senha123`);
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(1);
}

console.log('');
console.log('═'.repeat(60));
console.log('RENOVAR LICENÇA DE ADMIN');
console.log('═'.repeat(60));
console.log('');

// Conectar ao banco
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
});

// Buscar admin atual
db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, admin) => {
    if (err) {
        console.error('❌ Erro:', err.message);
        db.close();
        process.exit(1);
    }

    if (!admin) {
        console.log(`❌ Admin "${username}" não encontrado no database!`);
        console.log('');
        db.close();
        process.exit(1);
    }

    // Calcular nova data de expiração
    const daysToAdd = customDays || 30;
    let baseDate;

    // Se já tem data de expiração e não está vencido, adicionar a partir dela
    if (admin.expires_at) {
        const currentExpires = new Date(admin.expires_at);
        const now = new Date();
        
        if (currentExpires > now) {
            // Adicionar a partir da data de expiração atual
            baseDate = currentExpires;
            console.log(`📅 Licença atual expira em: ${currentExpires.toLocaleDateString('pt-BR')}`);
        } else {
            // Já venceu, adicionar a partir de agora
            baseDate = now;
            console.log(`⚠️  Licença estava vencida desde: ${currentExpires.toLocaleDateString('pt-BR')}`);
        }
    } else {
        // Primeira vez definindo expiração
        baseDate = new Date();
        console.log('📅 Definindo validade pela primeira vez');
    }

    // Calcular nova data
    const newExpiresAt = new Date(baseDate);
    newExpiresAt.setDate(newExpiresAt.getDate() + daysToAdd);
    newExpiresAt.setHours(23, 59, 59, 999); // Até o final do dia
    
    const newExpiresAtISO = newExpiresAt.toISOString();
    const renewedAt = new Date().toISOString();
    const newRenewalCount = (admin.renewal_count || 0) + 1;

    // Atualizar database
    db.run(
        'UPDATE admin_users SET expires_at = ?, renewed_at = ?, renewal_count = ?, status = ? WHERE username = ?',
        [newExpiresAtISO, renewedAt, newRenewalCount, 'active', username],
        function(err) {
            if (err) {
                console.error('❌ Erro ao renovar:', err.message);
                db.close();
                process.exit(1);
            }

            console.log('');
            console.log('✅ LICENÇA RENOVADA COM SUCESSO!');
            console.log('');
            console.log('Detalhes:');
            console.log(`  Admin: ${username}`);
            console.log(`  Status: active`);
            console.log(`  Dias adicionados: ${daysToAdd}`);
            console.log(`  Nova data de expiração: ${newExpiresAt.toLocaleDateString('pt-BR')} às ${newExpiresAt.toLocaleTimeString('pt-BR')}`);
            console.log(`  Total de renovações: ${newRenewalCount}`);
            console.log('');
            
            // Calcular dias restantes
            const now = new Date();
            const daysRemaining = Math.ceil((newExpiresAt - now) / (1000 * 60 * 60 * 24));
            console.log(`⏰ Tempo restante: ${daysRemaining} dias`);
            console.log('');
            console.log('═'.repeat(60));
            console.log('');

            db.close();
        }
    );
});
