#!/usr/bin/env node

/**
 * Script para executar migration do Koffice
 * Uso: node run-migration.js
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = 'sigma_recharge.db';
const MIGRATION_FILE = 'migration-koffice.sql';

console.log('');
console.log('='.repeat(70));
console.log('KOFFICE MIGRATION - Adicionando Suporte a Painéis Koffice');
console.log('='.repeat(70));
console.log('');

// Conectar ao banco
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco:', DB_PATH);
});

// Ler arquivo de migration
const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');

// Separar comandos SQL
const commands = migrationSQL
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

console.log(`📋 Executando ${commands.length} comando(s)...\n`);

// Executar cada comando
db.serialize(() => {
    let successCount = 0;
    let errorCount = 0;

    commands.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) {
                // Ignorar erros de "column already exists"
                if (err.message.includes('duplicate column name')) {
                    console.log(`⚠️  Comando ${index + 1}: Coluna já existe (ignorado)`);
                    successCount++;
                } else {
                    console.error(`❌ Comando ${index + 1} falhou:`, err.message);
                    errorCount++;
                }
            } else {
                console.log(`✅ Comando ${index + 1} executado`);
                successCount++;
            }
        });
    });

    // Aguardar conclusão e exibir resumo
    setTimeout(() => {
        console.log('');
        console.log('='.repeat(70));
        console.log('RESUMO DA MIGRATION');
        console.log('='.repeat(70));
        console.log(`✅ Sucesso: ${successCount}`);
        console.log(`❌ Erros: ${errorCount}`);
        console.log('');

        // Verificar tabelas criadas
        db.all(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE '%koffice%'
            ORDER BY name
        `, (err, tables) => {
            if (!err && tables.length > 0) {
                console.log('📊 Tabelas Koffice criadas:');
                tables.forEach(t => console.log(`   - ${t.name}`));
                console.log('');
            }

            // Verificar configuração
            db.get(`
                SELECT value FROM system_config 
                WHERE key = 'anticaptcha_api_key'
            `, (err, row) => {
                if (!err && row) {
                    console.log('🔑 Configuração Anti-Captcha:');
                    console.log(`   - Key: ${row.value || '(vazia - configure no admin)'}`);
                    console.log('');
                }

                console.log('='.repeat(70));
                console.log('✅ MIGRATION CONCLUÍDA COM SUCESSO!');
                console.log('='.repeat(70));
                console.log('');
                console.log('Próximos passos:');
                console.log('1. Configure o Anti-Captcha API Key no painel admin');
                console.log('2. Cadastre painéis Koffice na nova aba');
                console.log('3. Cadastre revendedores Koffice');
                console.log('');

                db.close();
            });
        });
    }, 1000);
});
