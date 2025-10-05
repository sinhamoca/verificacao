#!/usr/bin/env node

/**
 * Script de Diagnóstico - Verificar Pacotes Sigma e Koffice
 * Uso: node diagnose-packages.js
 */

const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'sigma_recharge.db';

console.log('\n' + '='.repeat(70));
console.log('🔍 DIAGNÓSTICO - PACOTES SIGMA E KOFFICE');
console.log('='.repeat(70) + '\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco\n');
});

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function diagnose() {
    try {
        console.log('📊 1. Verificando estrutura da tabela credit_packages...\n');
        
        const tableInfo = await query('PRAGMA table_info(credit_packages)');
        
        console.log('   Colunas encontradas:');
        tableInfo.forEach(col => {
            console.log(`   - ${col.name} (${col.type}) ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });
        
        const hasResellerType = tableInfo.some(col => col.name === 'reseller_type');
        
        if (!hasResellerType) {
            console.log('\n   ⚠️  PROBLEMA: Coluna "reseller_type" NÃO existe!');
            console.log('   Execute a migration para adicionar esta coluna.\n');
        } else {
            console.log('\n   ✅ Coluna "reseller_type" existe\n');
        }

        console.log('📋 2. Contando pacotes por tipo...\n');
        
        const counts = await query(`
            SELECT 
                reseller_type,
                COUNT(*) as total
            FROM credit_packages
            GROUP BY reseller_type
        `);
        
        if (counts.length === 0) {
            console.log('   ⚠️  Nenhum pacote encontrado no banco\n');
        } else {
            counts.forEach(row => {
                console.log(`   ${row.reseller_type}: ${row.total} pacote(s)`);
            });
            console.log('');
        }

        console.log('📦 3. Listando todos os pacotes...\n');
        
        const allPackages = await query(`
            SELECT 
                cp.*,
                CASE 
                    WHEN cp.reseller_type = 'sigma' THEN r.username
                    WHEN cp.reseller_type = 'koffice' THEN kr.username
                END as reseller_username
            FROM credit_packages cp
            LEFT JOIN resellers r ON cp.reseller_id = r.id AND cp.reseller_type = 'sigma'
            LEFT JOIN koffice_resellers kr ON cp.reseller_id = kr.id AND cp.reseller_type = 'koffice'
            ORDER BY cp.reseller_type, cp.reseller_id, cp.credits
        `);
        
        if (allPackages.length === 0) {
            console.log('   ⚠️  Nenhum pacote cadastrado\n');
        } else {
            let currentType = null;
            
            allPackages.forEach(pkg => {
                if (pkg.reseller_type !== currentType) {
                    currentType = pkg.reseller_type;
                    console.log(`\n   === ${currentType.toUpperCase()} ===`);
                }
                
                const unitPrice = (pkg.price / pkg.credits).toFixed(2);
                console.log(`   [${pkg.id}] ${pkg.reseller_username || 'N/A'} (ID ${pkg.reseller_id}): ${pkg.credits} créditos - R$ ${pkg.price.toFixed(2)} (R$ ${unitPrice}/un)`);
            });
            console.log('');
        }

        console.log('👥 4. Verificando revendedores...\n');
        
        const sigmaResellers = await query('SELECT id, username FROM resellers ORDER BY username');
        const kofficeResellers = await query('SELECT id, username FROM koffice_resellers ORDER BY username');
        
        console.log(`   Revendedores Sigma: ${sigmaResellers.length}`);
        sigmaResellers.forEach(r => console.log(`   - [${r.id}] ${r.username}`));
        
        console.log(`\n   Revendedores Koffice: ${kofficeResellers.length}`);
        kofficeResellers.forEach(r => console.log(`   - [${r.id}] ${r.username}`));
        
        console.log('\n🔍 5. Verificando pacotes NULL ou sem tipo...\n');
        
        const nullPackages = await query(`
            SELECT * FROM credit_packages
            WHERE reseller_type IS NULL OR reseller_type = ''
        `);
        
        if (nullPackages.length > 0) {
            console.log(`   ⚠️  Encontrados ${nullPackages.length} pacote(s) sem tipo definido:`);
            nullPackages.forEach(pkg => {
                console.log(`   - Pacote ID ${pkg.id}: ${pkg.credits} créditos (reseller_id: ${pkg.reseller_id})`);
            });
            console.log('\n   💡 Solução: Execute o comando de correção abaixo:\n');
            console.log('   UPDATE credit_packages SET reseller_type = \'sigma\' WHERE reseller_type IS NULL;');
            console.log('');
        } else {
            console.log('   ✅ Todos os pacotes têm tipo definido\n');
        }

        console.log('🧪 6. Testando queries de pacotes...\n');
        
        if (sigmaResellers.length > 0) {
            const testSigmaId = sigmaResellers[0].id;
            const sigmaPkgs = await query(`
                SELECT * FROM credit_packages
                WHERE reseller_id = ? AND reseller_type = 'sigma'
            `, [testSigmaId]);
            
            console.log(`   Query Sigma (reseller ${testSigmaId}): ${sigmaPkgs.length} pacote(s) encontrado(s)`);
        }
        
        if (kofficeResellers.length > 0) {
            const testKofficeId = kofficeResellers[0].id;
            const kofficePkgs = await query(`
                SELECT * FROM credit_packages
                WHERE reseller_id = ? AND reseller_type = 'koffice'
            `, [testKofficeId]);
            
            console.log(`   Query Koffice (reseller ${testKofficeId}): ${kofficePkgs.length} pacote(s) encontrado(s)`);
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ DIAGNÓSTICO CONCLUÍDO');
        console.log('='.repeat(70) + '\n');

        db.close();

    } catch (error) {
        console.error('\n❌ Erro durante diagnóstico:', error.message);
        console.error('Stack:', error.stack);
        db.close();
        process.exit(1);
    }
}

diagnose();
