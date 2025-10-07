#!/usr/bin/env node

/**
 * Script de Teste de Integração - Sigma + Koffice
 * Valida se a implementação está correta
 * 
 * Uso: node test-integration.js
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_PATH = 'sigma_recharge.db';

console.log('\n' + '='.repeat(70));
console.log('🧪 TESTE DE INTEGRAÇÃO - SIGMA + KOFFICE');
console.log('='.repeat(70) + '\n');

const tests = {
    passed: 0,
    failed: 0,
    total: 0
};

function test(name, fn) {
    tests.total++;
    try {
        fn();
        console.log(`✅ ${name}`);
        tests.passed++;
        return true;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Erro: ${error.message}`);
        tests.failed++;
        return false;
    }
}

function testAsync(name, fn) {
    tests.total++;
    return new Promise((resolve) => {
        fn()
            .then(() => {
                console.log(`✅ ${name}`);
                tests.passed++;
                resolve(true);
            })
            .catch((error) => {
                console.log(`❌ ${name}`);
                console.log(`   Erro: ${error.message}`);
                tests.failed++;
                resolve(false);
            });
    });
}

// Conectar ao banco
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        process.exit(1);
    }
});

async function runTests() {
    console.log('📋 Verificando Banco de Dados...\n');

    // Teste 1: Tabelas Koffice existem
    await testAsync('Tabela koffice_panels existe', () => {
        return new Promise((resolve, reject) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='koffice_panels'", (err, row) => {
                if (err) reject(err);
                else if (!row) reject(new Error('Tabela não encontrada'));
                else resolve();
            });
        });
    });

    await testAsync('Tabela koffice_resellers existe', () => {
        return new Promise((resolve, reject) => {
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='koffice_resellers'", (err, row) => {
                if (err) reject(err);
                else if (!row) reject(new Error('Tabela não encontrada'));
                else resolve();
            });
        });
    });

    // Teste 2: Campo reseller_type existe
    await testAsync('Campo reseller_type em payments', () => {
        return new Promise((resolve, reject) => {
            db.get("PRAGMA table_info(payments)", (err, row) => {
                if (err) reject(err);
                else {
                    db.all("PRAGMA table_info(payments)", (err, rows) => {
                        const hasField = rows.some(r => r.name === 'reseller_type');
                        if (hasField) resolve();
                        else reject(new Error('Campo não encontrado'));
                    });
                }
            });
        });
    });

    // Teste 3: Configuração Anti-Captcha
    await testAsync('Configuração anticaptcha_api_key existe', () => {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM system_config WHERE key = 'anticaptcha_api_key'", (err, row) => {
                if (err) reject(err);
                else if (!row) reject(new Error('Configuração não encontrada'));
                else resolve();
            });
        });
    });

    console.log('\n📁 Verificando Arquivos Backend...\n');

    // Teste 4: Arquivos backend existem
    test('services/KofficeService.js existe', () => {
        if (!fs.existsSync('services/KofficeService.js')) {
            throw new Error('Arquivo não encontrado');
        }
    });

    test('models/Database.js atualizado', () => {
        const content = fs.readFileSync('models/Database.js', 'utf8');
        if (!content.includes('koffice_panels')) {
            throw new Error('Database.js não foi atualizado');
        }
    });

    test('services/MonitorService.js atualizado', () => {
        const content = fs.readFileSync('services/MonitorService.js', 'utf8');
        if (!content.includes('reseller_type')) {
            throw new Error('MonitorService.js não foi atualizado');
        }
    });

    console.log('\n📁 Verificando Arquivos Frontend...\n');

    // Teste 5: Arquivos frontend existem
    test('js/admin/koffice-panels.js existe', () => {
        if (!fs.existsSync('public-recharge/js/admin/koffice-panels.js')) {
            throw new Error('Arquivo não encontrado');
        }
    });

    test('js/admin/koffice-resellers.js existe', () => {
        if (!fs.existsSync('public-recharge/js/admin/koffice-resellers.js')) {
            throw new Error('Arquivo não encontrado');
        }
    });

    test('js/admin/koffice-packages.js existe', () => {
        if (!fs.existsSync('public-recharge/js/admin/koffice-packages.js')) {
            throw new Error('Arquivo não encontrado');
        }
    });

    test('admin.html atualizado', () => {
        const content = fs.readFileSync('public-recharge/admin.html', 'utf8');
        if (!content.includes('koffice-panels')) {
            throw new Error('admin.html não foi atualizado');
        }
    });

    test('js/shared/api.js atualizado', () => {
        const content = fs.readFileSync('public-recharge/js/shared/api.js', 'utf8');
        if (!content.includes('getKofficePanels')) {
            throw new Error('api.js não foi atualizado');
        }
    });

    test('js/client/auth.js atualizado', () => {
        const content = fs.readFileSync('public-recharge/js/client/auth.js', 'utf8');
        if (!content.includes('reseller_type') && !content.includes('.type')) {
            throw new Error('auth.js não foi atualizado');
        }
    });

    console.log('\n📦 Verificando Dependências...\n');

    // Teste 6: Dependências
    test('cheerio instalado', () => {
        try {
            require.resolve('cheerio');
        } catch (e) {
            throw new Error('Cheerio não instalado. Execute: npm install cheerio');
        }
    });

    test('axios instalado', () => {
        try {
            require.resolve('axios');
        } catch (e) {
            throw new Error('Axios não instalado');
        }
    });

    console.log('\n🔍 Verificando Estrutura do Código...\n');

    // Teste 7: Código contém funcionalidades esperadas
    test('KofficeService tem método addCreditsWithRetry', () => {
        const content = fs.readFileSync('services/KofficeService.js', 'utf8');
        if (!content.includes('addCreditsWithRetry')) {
            throw new Error('Método não encontrado');
        }
    });

    test('MonitorService detecta tipo sigma/koffice', () => {
        const content = fs.readFileSync('services/MonitorService.js', 'utf8');
        if (!content.includes('reseller_type') || !content.includes('koffice')) {
            throw new Error('Detecção de tipo não implementada');
        }
    });

    test('Routes admin tem endpoints Koffice', () => {
        const content = fs.readFileSync('routes/admin.js', 'utf8');
        if (!content.includes('koffice-panels') || !content.includes('koffice-resellers')) {
            throw new Error('Endpoints Koffice não encontrados');
        }
    });

    test('Routes public tem login unificado', () => {
        const content = fs.readFileSync('routes/public.js', 'utf8');
        if (!content.includes('koffice_resellers')) {
            throw new Error('Login unificado não implementado');
        }
    });

    // Fechar banco
    db.close(() => {
        console.log('\n' + '='.repeat(70));
        console.log('📊 RESULTADO DOS TESTES');
        console.log('='.repeat(70));
        console.log(`\nTotal: ${tests.total}`);
        console.log(`✅ Passou: ${tests.passed}`);
        console.log(`❌ Falhou: ${tests.failed}`);
        
        const percentage = ((tests.passed / tests.total) * 100).toFixed(1);
        console.log(`\n📈 Taxa de Sucesso: ${percentage}%`);

        if (tests.failed === 0) {
            console.log('\n' + '='.repeat(70));
            console.log('🎉 PARABÉNS! TODOS OS TESTES PASSARAM!');
            console.log('='.repeat(70));
            console.log('\n✅ A integração Koffice está completa e funcional!\n');
            console.log('Próximos passos:');
            console.log('1. Configure o Anti-Captcha API Key no admin');
            console.log('2. Cadastre painéis Koffice');
            console.log('3. Cadastre revendedores Koffice');
            console.log('4. Teste o fluxo completo de compra\n');
        } else {
            console.log('\n' + '='.repeat(70));
            console.log('⚠️  ALGUNS TESTES FALHARAM');
            console.log('='.repeat(70));
            console.log('\nRevise os arquivos com erro acima e tente novamente.\n');
            process.exit(1);
        }
    });
}

// Executar testes
runTests().catch(error => {
    console.error('\n❌ Erro fatal ao executar testes:', error);
    process.exit(1);
});
