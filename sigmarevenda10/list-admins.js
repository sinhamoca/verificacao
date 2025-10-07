#!/usr/bin/env node

/**
 * Script para listar todos os admins existentes
 * Uso: node list-admins.js
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbDir = path.join(__dirname, 'databases');

console.log('');
console.log('═'.repeat(60));
console.log('LISTAR ADMINS EXISTENTES');
console.log('═'.repeat(60));
console.log('');

// Verificar se pasta databases existe
if (!fs.existsSync(dbDir)) {
    console.log('❌ Pasta databases/ não existe!');
    console.log('');
    console.log('Crie o primeiro admin com:');
    console.log('  node create-new-admin.js admin senha123');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(0);
}

// Procurar arquivos database_*.db
const files = fs.readdirSync(dbDir);
const dbFiles = files.filter(file => 
    file.startsWith('database_') && 
    file.endsWith('.db') &&
    file !== 'database_sigma_recharge_default.db'
);

if (dbFiles.length === 0) {
    console.log('⚠️  Nenhum admin encontrado!');
    console.log('');
    console.log('Crie o primeiro admin com:');
    console.log('  node create-new-admin.js admin senha123');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(0);
}

console.log(`✓ Encontrados ${dbFiles.length} admin(s):\n`);

let processed = 0;

dbFiles.forEach((file, index) => {
    const dbPath = path.join(dbDir, file);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(`❌ ${file}: Erro ao abrir - ${err.message}`);
            processed++;
            return;
        }

        // Buscar informações do admin
        db.get('SELECT * FROM admin_users LIMIT 1', [], (err, admin) => {
            if (err) {
                console.error(`❌ ${file}: Erro ao ler - ${err.message}`);
                db.close();
                processed++;
                return;
            }

            if (!admin) {
                console.log(`⚠️  ${file}: Database sem admin`);
                db.close();
                processed++;
                return;
            }

            // Verificar status de licença
            let licenseStatus = '✅ Ativo';
            let licenseInfo = '';
            
            if (admin.status === 'suspended') {
                licenseStatus = '🔒 Suspenso';
            } else if (admin.status === 'expired') {
                licenseStatus = '❌ Expirado';
            } else if (admin.expires_at) {
                const now = new Date();
                const expiresAt = new Date(admin.expires_at);
                const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                
                if (daysRemaining < 0) {
                    licenseStatus = '❌ Expirado';
                    licenseInfo = `Vencido há ${Math.abs(daysRemaining)} dias`;
                } else if (daysRemaining <= 7) {
                    licenseStatus = '⚠️  Expirando';
                    licenseInfo = `${daysRemaining} dias restantes`;
                } else {
                    licenseInfo = `${daysRemaining} dias restantes`;
                }
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
                    (SELECT SUM(amount) FROM payments WHERE status = 'approved') as revenue
            `, [], (err, rows) => {
                const stats = rows[0] || {};
                
                const totalPanels = (stats.sigma_panels || 0) + (stats.koffice_panels || 0) + (stats.gesoffice_panels || 0);
                const totalResellers = (stats.sigma_resellers || 0) + (stats.koffice_resellers || 0) + (stats.gesoffice_resellers || 0);
                
                console.log(`${index + 1}. ${admin.username}`);
                console.log(`   Status: ${licenseStatus}`);
                if (licenseInfo) {
                    console.log(`   Licença: ${licenseInfo}`);
                }
                if (admin.expires_at) {
                    const expiresAt = new Date(admin.expires_at);
                    console.log(`   Expira em: ${expiresAt.toLocaleDateString('pt-BR')}`);
                }
                console.log(`   Renovações: ${admin.renewal_count || 0}`);
                console.log(`   Database: ${file}`);
                console.log(`   Criado em: ${admin.created_at || 'N/A'}`);
                console.log(`   Painéis: ${totalPanels} (Sigma: ${stats.sigma_panels || 0}, Koffice: ${stats.koffice_panels || 0}, UNIPLAY: ${stats.gesoffice_panels || 0})`);
                console.log(`   Revendedores: ${totalResellers} (Sigma: ${stats.sigma_resellers || 0}, Koffice: ${stats.koffice_resellers || 0}, UNIPLAY: ${stats.gesoffice_resellers || 0})`);
                console.log(`   Pagamentos aprovados: ${stats.payments || 0}`);
                console.log(`   Receita total: R$ ${(stats.revenue || 0).toFixed(2)}`);
                console.log('');
                
                db.close();
                processed++;
                
                // Se processou todos, mostrar rodapé
                if (processed === dbFiles.length) {
                    console.log('═'.repeat(60));
                    console.log('');
                    console.log('Comandos úteis:');
                    console.log('  • Criar novo admin: node create-new-admin.js <username> <senha>');
                    console.log('  • Renovar licença: node renew-admin.js <username> [--days 30]');
                    console.log('  • Trocar senha: node change-admin-password-multi.js <username> <senha>');
                    console.log('  • Suspender admin: node suspend-admin.js <username>');
                    console.log('  • Ativar admin: node activate-admin.js <username>');
                    console.log('  • Verificar expirados: node check-expired-admins.js');
                    console.log('  • Deletar admin: rm databases/database_<username>.db');
                    console.log('');
                    console.log('═'.repeat(60));
                    console.log('');
                }
            });
        });
    });
});
