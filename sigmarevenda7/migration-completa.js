#!/usr/bin/env node

/**
 * Migration Completa e Segura
 * Adiciona suporte Koffice sem quebrar dados existentes
 * 
 * Uso: node migration-completa.js
 */

const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'sigma_recharge.db';

console.log('\n' + '='.repeat(70));
console.log('🔄 MIGRATION COMPLETA - SIGMA + KOFFICE');
console.log('='.repeat(70) + '\n');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco\n');
});

function checkColumn(table, column) {
    return new Promise((resolve) => {
        db.all(`PRAGMA table_info(${table})`, (err, rows) => {
            if (err) {
                resolve(false);
                return;
            }
            const exists = rows.some(r => r.name === column);
            resolve(exists);
        });
    });
}

function addColumnSafe(table, column, type, defaultValue) {
    return new Promise((resolve, reject) => {
        const sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultValue}`;
        db.run(sql, (err) => {
            if (err) {
                // Ignorar erro se coluna já existe
                if (err.message.includes('duplicate column')) {
                    console.log(`   ⚠️  Coluna ${column} já existe em ${table}`);
                    resolve();
                } else {
                    reject(err);
                }
            } else {
                console.log(`   ✅ Coluna ${column} adicionada em ${table}`);
                resolve();
            }
        });
    });
}

function updateNullValues(table, column, value) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE ${table} SET ${column} = ? WHERE ${column} IS NULL`, [value], function(err) {
            if (err) reject(err);
            else {
                if (this.changes > 0) {
                    console.log(`   ✅ ${this.changes} registro(s) atualizado(s) em ${table}`);
                }
                resolve();
            }
        });
    });
}

function createTable(sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function insertConfig(key, value) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)`, [key, value], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function migrate() {
    try {
        console.log('📋 Etapa 1: Verificando estrutura atual...\n');

        // Verificar quais colunas já existem
        const hasResellerType = await checkColumn('credit_packages', 'reseller_type');
        const hasPaymentType = await checkColumn('payments', 'reseller_type');
        const hasTransactionType = await checkColumn('transactions', 'reseller_type');

        console.log(`   credit_packages.reseller_type: ${hasResellerType ? '✅ Existe' : '❌ Não existe'}`);
        console.log(`   payments.reseller_type: ${hasPaymentType ? '✅ Existe' : '❌ Não existe'}`);
        console.log(`   transactions.reseller_type: ${hasTransactionType ? '✅ Existe' : '❌ Não existe'}`);

        console.log('\n📋 Etapa 2: Adicionando colunas...\n');

        // Adicionar colunas se não existirem
        if (!hasResellerType) {
            await addColumnSafe('credit_packages', 'reseller_type', 'TEXT', "'sigma'");
            await updateNullValues('credit_packages', 'reseller_type', 'sigma');
        }

        if (!hasPaymentType) {
            await addColumnSafe('payments', 'reseller_type', 'TEXT', "'sigma'");
            await updateNullValues('payments', 'reseller_type', 'sigma');
        }

        if (!hasTransactionType) {
            await addColumnSafe('transactions', 'reseller_type', 'TEXT', "'sigma'");
            await updateNullValues('transactions', 'reseller_type', 'sigma');
        }

        // Adicionar em resellers (pode já ter sido adicionado pelo Database.js)
        const hasResellerTypeInResellers = await checkColumn('resellers', 'reseller_type');
        if (!hasResellerTypeInResellers) {
            await addColumnSafe('resellers', 'reseller_type', 'TEXT', "'sigma'");
            await updateNullValues('resellers', 'reseller_type', 'sigma');
        }

        console.log('\n📋 Etapa 3: Criando tabelas Koffice...\n');

        // Criar tabelas Koffice
        await createTable(`CREATE TABLE IF NOT EXISTS koffice_panels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            admin_username TEXT NOT NULL,
            admin_password TEXT NOT NULL,
            has_captcha BOOLEAN DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('   ✅ Tabela koffice_panels criada');

        await createTable(`CREATE TABLE IF NOT EXISTS koffice_resellers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            koffice_id TEXT NOT NULL,
            panel_id INTEGER NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (panel_id) REFERENCES koffice_panels (id)
        )`);
        console.log('   ✅ Tabela koffice_resellers criada');

        console.log('\n📋 Etapa 4: Adicionando configuração Anti-Captcha...\n');

        await insertConfig('anticaptcha_api_key', '');
        console.log('   ✅ Configuração anticaptcha_api_key adicionada');

        console.log('\n📋 Etapa 5: Criando índices...\n');

        await new Promise((resolve, reject) => {
            db.run(`CREATE INDEX IF NOT EXISTS idx_koffice_resellers_username ON koffice_resellers(username)`, (err) => {
                if (err) reject(err);
                else {
                    console.log('   ✅ Índice idx_koffice_resellers_username criado');
                    resolve();
                }
            });
        });

        await new Promise((resolve, reject) => {
            db.run(`CREATE INDEX IF NOT EXISTS idx_koffice_resellers_panel ON koffice_resellers(panel_id)`, (err) => {
                if (err) reject(err);
                else {
                    console.log('   ✅ Índice idx_koffice_resellers_panel criado');
                    resolve();
                }
            });
        });

        await new Promise((resolve, reject) => {
            db.run(`CREATE INDEX IF NOT EXISTS idx_payments_reseller_type ON payments(reseller_type)`, (err) => {
                if (err) reject(err);
                else {
                    console.log('   ✅ Índice idx_payments_reseller_type criado');
                    resolve();
                }
            });
        });

        console.log('\n📋 Etapa 6: Verificando resultados...\n');

        const stats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM credit_packages WHERE reseller_type = 'sigma') as packages_sigma,
                    (SELECT COUNT(*) FROM payments WHERE reseller_type = 'sigma') as payments_sigma,
                    (SELECT COUNT(*) FROM resellers WHERE reseller_type = 'sigma') as resellers_sigma,
                    (SELECT COUNT(*) FROM koffice_panels) as koffice_panels,
                    (SELECT COUNT(*) FROM koffice_resellers) as koffice_resellers,
                    (SELECT value FROM system_config WHERE key = 'anticaptcha_api_key') as anticaptcha_key
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        console.log('   📊 Resumo:');
        console.log(`   - Pacotes Sigma: ${stats.packages_sigma}`);
        console.log(`   - Pagamentos Sigma: ${stats.payments_sigma}`);
        console.log(`   - Revendedores Sigma: ${stats.resellers_sigma}`);
        console.log(`   - Painéis Koffice: ${stats.koffice_panels}`);
        console.log(`   - Revendedores Koffice: ${stats.koffice_resellers}`);
        console.log(`   - Anti-Captcha configurado: ${stats.anticaptcha_key ? 'Sim' : 'Não (vazio)'}`);

        console.log('\n' + '='.repeat(70));
        console.log('✅ MIGRATION CONCLUÍDA COM SUCESSO!');
        console.log('='.repeat(70));
        console.log('\nPróximos passos:');
        console.log('1. Reiniciar servidor: pm2 restart sigma-recharge');
        console.log('2. Verificar admin: http://localhost:3010/admin.html');
        console.log('3. Verificar se os pacotes aparecem');
        console.log('4. Cadastrar painéis Koffice\n');

        db.close();

    } catch (error) {
        console.error('\n❌ Erro durante migration:', error.message);
        console.error('Stack:', error.stack);
        db.close();
        process.exit(1);
    }
}

// Executar
migrate();
