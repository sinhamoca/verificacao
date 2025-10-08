#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════
 * SIGMA RECHARGE - GERENCIADOR DE TENANTS
 * Central de Comandos com Menu Interativo + EXPIRAÇÃO
 * Versão: 3.1.0
 * ═══════════════════════════════════════════════════════════
 */

const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const inquirer = require('inquirer');

// Cores para o terminal
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
};

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('sigma_recharge.db', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

function closeDatabase(db) {
    return new Promise((resolve) => {
        db.close(() => resolve());
    });
}

function query(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function showHeader() {
    console.clear();
    console.log(colors.cyan + colors.bright);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   SIGMA RECHARGE - GERENCIADOR DE TENANTS v3.1.0');
    console.log('   Central de Comandos Multi-Tenant + Expiração');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(colors.reset);
    console.log();
}

// ═════════════════════════════════════════════════════════
// ⭐ HELPER: CALCULAR DATA FUTURA
// ═════════════════════════════════════════════════════════
function calculateFutureDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ═════════════════════════════════════════════════════════
// ⭐ HELPER: VERIFICAR SE TENANT ESTÁ EXPIRADO
// ═════════════════════════════════════════════════════════
function isTenantExpired(expiresAt) {
    if (!expiresAt) return false;
    const today = new Date().toISOString().split('T')[0];
    return expiresAt < today;
}

// ═════════════════════════════════════════════════════════
// ⭐ HELPER: CALCULAR DIAS RESTANTES
// ═════════════════════════════════════════════════════════
function getDaysRemaining(expiresAt) {
    if (!expiresAt) return null;
    const today = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

async function mainMenu() {
    showHeader();
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'O que deseja fazer?',
            choices: [
                { name: '📋 Listar Todos os Tenants', value: 'list' },
                { name: '➕ Criar Novo Tenant', value: 'create' },
                { name: '✏️  Editar Tenant', value: 'edit' },
                { name: '📅 Renovar/Definir Expiração', value: 'renew' },  // ⭐ NOVO
                { name: '🔄 Ativar/Desativar Tenant', value: 'toggle' },
                { name: '🗑️  Excluir Tenant', value: 'delete' },
                { name: '👤 Gerenciar Admins', value: 'admins' },
                { name: '📊 Estatísticas de Tenant', value: 'stats' },
                { name: '🔗 Mostrar Links de Acesso', value: 'links' },
                { name: '🔑 Resetar Senha de Admin', value: 'reset-password' },
                new inquirer.Separator(),
                { name: '❌ Sair', value: 'exit' }
            ]
        }
    ]);
    
    return action;
}

// ═════════════════════════════════════════════════════════
// LISTAR TENANTS (COM INFO DE EXPIRAÇÃO)
// ═════════════════════════════════════════════════════════
async function listTenants(db) {
    showHeader();
    console.log(colors.bright + '📋 LISTA DE TENANTS' + colors.reset);
    console.log();
    
    const tenants = await query(db, 'SELECT * FROM tenants ORDER BY created_at DESC');
    
    if (tenants.length === 0) {
        console.log(colors.yellow + '⚠️  Nenhum tenant encontrado' + colors.reset);
        console.log();
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    for (const tenant of tenants) {
        const statusColor = tenant.status === 'active' ? colors.green : colors.red;
        const statusIcon = tenant.status === 'active' ? '✅' : '❌';
        
        // ⭐ VERIFICAR EXPIRAÇÃO
        let expirationInfo = '';
        let isExpired = false;
        
        if (tenant.expires_at) {
            isExpired = tenant.expires_at < today;
            const daysRemaining = getDaysRemaining(tenant.expires_at);
            
            let expColor = colors.green;
            let expIcon = '✅';
            
            if (isExpired) {
                expColor = colors.red;
                expIcon = '🔒';
            } else if (daysRemaining <= 7) {
                expColor = colors.yellow;
                expIcon = '⚠️';
            } else if (daysRemaining <= 30) {
                expColor = colors.yellow;
                expIcon = '⏰';
            }
            
            const daysText = isExpired ? 
                `EXPIRADO há ${Math.abs(daysRemaining)} dia(s)` : 
                `${daysRemaining} dia(s) restante(s)`;
            
            expirationInfo = `${expColor}   ${expIcon} Expira: ${tenant.expires_at} (${daysText})${colors.reset}`;
        } else {
            expirationInfo = `${colors.green}   ♾️  Sem expiração${colors.reset}`;
        }
        
        console.log(colors.cyan + `${statusIcon} ${tenant.name}` + colors.reset);
        console.log(colors.dim + `   ID: ${tenant.id}`);
        console.log(`   Slug: ${tenant.slug}`);
        console.log(`   Status: ${statusColor}${tenant.status}${colors.reset}`);
        console.log(expirationInfo);
        
        // Contar admins
        const adminCount = await get(db, 'SELECT COUNT(*) as total FROM admin_users WHERE tenant_id = ?', [tenant.id]);
        console.log(`   Admins: ${adminCount.total}`);
        
        // Contar painéis
        const panelsCount = await get(db, `
            SELECT 
                (SELECT COUNT(*) FROM sigma_panels WHERE tenant_id = ?) +
                (SELECT COUNT(*) FROM koffice_panels WHERE tenant_id = ?) +
                (SELECT COUNT(*) FROM gesoffice_panels WHERE tenant_id = ?) as total
        `, [tenant.id, tenant.id, tenant.id]);
        console.log(`   Painéis: ${panelsCount.total}`);
        console.log(`   Criado: ${tenant.created_at}${colors.reset}`);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// CRIAR TENANT (COM OPÇÃO DE EXPIRAÇÃO)
// ═════════════════════════════════════════════════════════
async function createTenant(db) {
    showHeader();
    console.log(colors.bright + '➕ CRIAR NOVO TENANT' + colors.reset);
    console.log();
    
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Nome da empresa:',
            validate: (input) => input.length > 0 || 'Nome é obrigatório'
        },
        {
            type: 'input',
            name: 'slug',
            message: 'Slug (URL amigável, ex: empresa-abc):',
            validate: (input) => {
                if (input.length === 0) return 'Slug é obrigatório';
                if (!/^[a-z0-9-]+$/.test(input)) return 'Use apenas letras minúsculas, números e hífens';
                return true;
            }
        },
        // ⭐ ADICIONAR PERGUNTA DE EXPIRAÇÃO
        {
            type: 'list',
            name: 'expiration',
            message: 'Validade do tenant:',
            choices: [
                { name: '7 dias', value: '7' },
                { name: '15 dias', value: '15' },
                { name: '30 dias', value: '30' },
                { name: '60 dias', value: '60' },
                { name: '90 dias', value: '90' },
                { name: '6 meses (180 dias)', value: '180' },
                { name: '1 ano (365 dias)', value: '365' },
                { name: 'Sem expiração', value: 'unlimited' },
                { name: 'Definir data específica', value: 'custom' }
            ]
        }
    ]);
    
    let expiresAt = null;
    
    if (answers.expiration === 'custom') {
        const { customDate } = await inquirer.prompt([
            {
                type: 'input',
                name: 'customDate',
                message: 'Digite a data (YYYY-MM-DD):',
                validate: (input) => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
                        return 'Formato inválido! Use YYYY-MM-DD (ex: 2025-12-31)';
                    }
                    const date = new Date(input);
                    if (isNaN(date.getTime())) {
                        return 'Data inválida!';
                    }
                    return true;
                }
            }
        ]);
        expiresAt = customDate;
    } else if (answers.expiration !== 'unlimited') {
        const days = parseInt(answers.expiration);
        expiresAt = calculateFutureDate(days);
    }
    
    try {
        // Verificar se slug já existe
        const existing = await get(db, 'SELECT id FROM tenants WHERE slug = ?', [answers.slug]);
        if (existing) {
            console.log();
            console.log(colors.red + '❌ Erro: Slug já existe!' + colors.reset);
            console.log();
            return;
        }
        
        // ⭐ CRIAR TENANT COM EXPIRAÇÃO
        const result = await run(db, 
            'INSERT INTO tenants (name, slug, status, expires_at) VALUES (?, ?, ?, ?)',
            [answers.name, answers.slug, 'active', expiresAt]
        );
        
        const tenantId = result.id;
        
        // Criar configurações padrão
        const defaultConfigs = [
            ['access_question', 'Com quantos paus se faz uma canoa?'],
            ['access_answer', hashPassword('eusouandroid2029')],
            ['mp_access_token', ''],
            ['anticaptcha_api_key', '']
        ];
        
        for (const [key, value] of defaultConfigs) {
            await run(db, 
                'INSERT INTO tenant_config (tenant_id, key, value) VALUES (?, ?, ?)',
                [tenantId, key, value]
            );
        }
        
        console.log();
        console.log(colors.green + '✅ Tenant criado com sucesso!' + colors.reset);
        console.log();
        console.log(colors.cyan + `ID: ${tenantId}`);
        console.log(`Nome: ${answers.name}`);
        console.log(`Slug: ${answers.slug}`);
        
        if (expiresAt) {
            const daysRemaining = getDaysRemaining(expiresAt);
            console.log(`Expira: ${expiresAt} (${daysRemaining} dias)`);
        } else {
            console.log(`Expira: Nunca (sem expiração)`);
        }
        
        console.log(`Link Cliente: http://localhost:3010/?tenant=${answers.slug}`);
        console.log(`Link Admin: http://localhost:3010/admin?tenant=${answers.slug}` + colors.reset);
        console.log();
        
        // Perguntar se quer criar admin
        const { createAdmin } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'createAdmin',
                message: 'Deseja criar um admin para este tenant agora?',
                default: true
            }
        ]);
        
        if (createAdmin) {
            await createAdminForTenant(db, tenantId, answers.slug);
        }
        
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// ⭐ RENOVAR/DEFINIR EXPIRAÇÃO
// ═════════════════════════════════════════════════════════
async function renewTenant(db) {
    showHeader();
    console.log(colors.bright + '📅 RENOVAR/DEFINIR EXPIRAÇÃO' + colors.reset);
    console.log();
    
    const tenants = await query(db, 'SELECT * FROM tenants ORDER BY name');
    
    if (tenants.length === 0) {
        console.log(colors.yellow + '⚠️  Nenhum tenant encontrado' + colors.reset);
        console.log();
        return;
    }
    
    const { tenantId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'tenantId',
            message: 'Selecione o tenant:',
            choices: tenants.map(t => {
                let expInfo;
                if (t.expires_at) {
                    const isExpired = isTenantExpired(t.expires_at);
                    const daysRemaining = getDaysRemaining(t.expires_at);
                    
                    if (isExpired) {
                        expInfo = `🔒 EXPIRADO em ${t.expires_at}`;
                    } else if (daysRemaining <= 7) {
                        expInfo = `⚠️ Expira em ${daysRemaining} dia(s)`;
                    } else {
                        expInfo = `Expira: ${t.expires_at}`;
                    }
                } else {
                    expInfo = '♾️ Sem expiração';
                }
                
                return {
                    name: `${t.name} (${t.slug}) - ${expInfo}`,
                    value: t.id
                };
            })
        }
    ]);
    
    const tenant = tenants.find(t => t.id === tenantId);
    
    const { option } = await inquirer.prompt([
        {
            type: 'list',
            name: 'option',
            message: 'Escolha a ação:',
            choices: [
                { name: '➕ 7 dias a partir de hoje', value: '7' },
                { name: '➕ 15 dias a partir de hoje', value: '15' },
                { name: '➕ 30 dias a partir de hoje', value: '30' },
                { name: '➕ 60 dias a partir de hoje', value: '60' },
                { name: '➕ 90 dias a partir de hoje', value: '90' },
                { name: '➕ 6 meses a partir de hoje', value: '180' },
                { name: '➕ 1 ano a partir de hoje', value: '365' },
                new inquirer.Separator(),
                { name: '📅 Definir data específica', value: 'custom' },
                { name: '♾️  Remover expiração (sem limite)', value: 'unlimited' },
                new inquirer.Separator(),
                { name: '↩️  Cancelar', value: 'cancel' }
            ]
        }
    ]);
    
    if (option === 'cancel') return;
    
    let newExpirationDate;
    
    if (option === 'unlimited') {
        newExpirationDate = null;
    } else if (option === 'custom') {
        const { customDate } = await inquirer.prompt([
            {
                type: 'input',
                name: 'customDate',
                message: 'Digite a data (YYYY-MM-DD):',
                validate: (input) => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
                        return 'Formato inválido! Use YYYY-MM-DD (ex: 2025-12-31)';
                    }
                    const date = new Date(input);
                    if (isNaN(date.getTime())) {
                        return 'Data inválida!';
                    }
                    return true;
                }
            }
        ]);
        newExpirationDate = customDate;
    } else {
        const days = parseInt(option);
        newExpirationDate = calculateFutureDate(days);
    }
    
    try {
        if (newExpirationDate === null) {
            await run(db, 'UPDATE tenants SET expires_at = NULL WHERE id = ?', [tenantId]);
            console.log();
            console.log(colors.green + '✅ Expiração removida! Tenant não expira mais.' + colors.reset);
            console.log(colors.cyan + `Tenant: ${tenant.name}` + colors.reset);
        } else {
            await run(db, 'UPDATE tenants SET expires_at = ? WHERE id = ?', [newExpirationDate, tenantId]);
            
            const daysRemaining = getDaysRemaining(newExpirationDate);
            
            console.log();
            console.log(colors.green + '✅ Nova data de expiração definida!' + colors.reset);
            console.log(colors.cyan + `Tenant: ${tenant.name}`);
            console.log(`Expira em: ${newExpirationDate} (${daysRemaining} dias)` + colors.reset);
        }
        console.log();
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// EDITAR TENANT
// ═════════════════════════════════════════════════════════
async function editTenant(db) {
    showHeader();
    console.log(colors.bright + '✏️  EDITAR TENANT' + colors.reset);
    console.log();
    
    const tenants = await query(db, 'SELECT * FROM tenants ORDER BY name');
    
    if (tenants.length === 0) {
        console.log(colors.yellow + '⚠️  Nenhum tenant encontrado' + colors.reset);
        console.log();
        return;
    }
    
    const { tenantId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'tenantId',
            message: 'Selecione o tenant:',
            choices: tenants.map(t => ({
                name: `${t.name} (${t.slug})`,
                value: t.id
            }))
        }
    ]);
    
    const tenant = tenants.find(t => t.id === tenantId);
    
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Novo nome (deixe vazio para manter):',
            default: tenant.name
        },
        {
            type: 'input',
            name: 'slug',
            message: 'Novo slug (deixe vazio para manter):',
            default: tenant.slug,
            validate: (input) => {
                if (input.length === 0) return true;
                if (!/^[a-z0-9-]+$/.test(input)) return 'Use apenas letras minúsculas, números e hífens';
                return true;
            }
        }
    ]);
    
    try {
        await run(db,
            'UPDATE tenants SET name = ?, slug = ? WHERE id = ?',
            [answers.name, answers.slug, tenantId]
        );
        
        console.log();
        console.log(colors.green + '✅ Tenant atualizado com sucesso!' + colors.reset);
        console.log();
        
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// EXCLUIR TENANT
// ═════════════════════════════════════════════════════════
async function deleteTenant(db) {
    showHeader();
    console.log(colors.bright + colors.red + '🗑️  EXCLUIR TENANT' + colors.reset);
    console.log(colors.yellow + '⚠️  ATENÇÃO: Esta ação é IRREVERSÍVEL!' + colors.reset);
    console.log();
    
    const tenants = await query(db, 'SELECT * FROM tenants WHERE id != 1 ORDER BY name');
    
    if (tenants.length === 0) {
        console.log(colors.yellow + '⚠️  Nenhum tenant disponível para exclusão' + colors.reset);
        console.log();
        return;
    }
    
    const { tenantId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'tenantId',
            message: 'Selecione o tenant para EXCLUIR:',
            choices: tenants.map(t => ({
                name: `${t.name} (${t.slug})`,
                value: t.id
            }))
        }
    ]);
    
    const tenant = tenants.find(t => t.id === tenantId);
    
    // Mostrar o que será excluído
    const adminsCount = await get(db, 'SELECT COUNT(*) as total FROM admin_users WHERE tenant_id = ?', [tenantId]);
    const panelsCount = await get(db, `
        SELECT 
            (SELECT COUNT(*) FROM sigma_panels WHERE tenant_id = ?) +
            (SELECT COUNT(*) FROM koffice_panels WHERE tenant_id = ?) +
            (SELECT COUNT(*) FROM gesoffice_panels WHERE tenant_id = ?) as total
    `, [tenantId, tenantId, tenantId]);
    
    console.log();
    console.log(colors.red + 'Será excluído:');
    console.log(`  - Tenant: ${tenant.name}`);
    console.log(`  - ${adminsCount.total} admin(s)`);
    console.log(`  - ${panelsCount.total} painel(éis)`);
    console.log(`  - Todas as configurações`);
    console.log(`  - Todos os revendedores`);
    console.log(`  - Todos os pacotes`);
    console.log(`  - Todos os pagamentos` + colors.reset);
    console.log();
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'input',
            name: 'confirm',
            message: `Digite "${tenant.slug}" para confirmar a exclusão:`,
        }
    ]);
    
    if (confirm !== tenant.slug) {
        console.log();
        console.log(colors.yellow + '❌ Exclusão cancelada' + colors.reset);
        console.log();
        return;
    }
    
    try {
        // Excluir tudo relacionado ao tenant
        await run(db, 'DELETE FROM tenant_config WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM admin_users WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM sigma_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM koffice_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM gesoffice_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM tenants WHERE id = ?', [tenantId]);
        
        console.log();
        console.log(colors.green + '✅ Tenant excluído com sucesso!' + colors.reset);
        console.log();
        
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// ATIVAR/DESATIVAR TENANT
// ═════════════════════════════════════════════════════════
async function toggleTenant(db) {
    showHeader();
    console.log(colors.bright + '🔄 ATIVAR/DESATIVAR TENANT' + colors.reset);
    console.log();
    
    const tenants = await query(db, 'SELECT * FROM tenants ORDER BY name');
    
    if (tenants.length === 0) {
        console.log(colors.yellow + '⚠️  Nenhum tenant encontrado' + colors.reset);
        console.log();
        return;
    }
    
    const { tenantId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'tenantId',
            message: 'Selecione o tenant:',
            choices: tenants.map(t => ({
                name: `${t.status === 'active' ? '✅' : '❌'} ${t.name} (${t.slug}) - ${t.status}`,
                value: t.id
            }))
        }
    ]);
    
    const tenant = tenants.find(t => t.id === tenantId);
    const newStatus = tenant.status === 'active' ? 'inactive' : 'active';
    
    try {
        await run(db, 'UPDATE tenants SET status = ? WHERE id = ?', [newStatus, tenantId]);
        
        console.log();
        const statusColor = newStatus === 'active' ? colors.green : colors.yellow;
        console.log(statusColor + `✅ Tenant ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso!` + colors.reset);
        console.log();
        
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// GERENCIAR ADMINS
// ═════════════════════════════════════════════════════════
async function manageAdmins(db) {
    showHeader();
    console.log(colors.bright + '👤 GERENCIAR ADMINS' + colors.reset);
    console.log();
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'O que deseja fazer?',
            choices: [
                { name: '➕ Criar Admin', value: 'create' },
                { name: '📋 Listar Admins', value: 'list' },
                { name: '🗑️  Excluir Admin', value: 'delete' },
                { name: '↩️  Voltar', value: 'back' }
            ]
        }
    ]);
    
    if (action === 'back') return;
    
    if (action === 'create') {
        await createAdmin(db);
    } else if (action === 'list') {
        await listAdmins(db);
    } else if (action === 'delete') {
        await deleteAdmin(db);
    }
}

async function createAdmin(db) {
    const tenants = await query(db, 'SELECT * FROM tenants WHERE status = "active" ORDER BY name');
    
    const { tenantId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'tenantId',
            message: 'Selecione o tenant:',
            choices: tenants.map(t => ({
                name: `${t.name} (${t.slug})`,
                value: t.id
            }))
        }
    ]);
    
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'username',
            message: 'Username:',
            validate: (input) => input.length > 0 || 'Username é obrigatório'
        },
        {
            type: 'password',
            name: 'password',
            message: 'Senha:',
            validate: (input) => input.length >= 6 || 'Senha deve ter no mínimo 6 caracteres'
        }
    ]);
    
    await createAdminForTenant(db, tenantId, tenants.find(t => t.id === tenantId).slug, answers.username, answers.password);
}

async function createAdminForTenant(db, tenantId, tenantSlug, username, password) {
    if (!username || !password) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'username',
                message: 'Username do admin:',
                validate: (input) => input.length > 0 || 'Username é obrigatório'
            },
            {
                type: 'password',
                name: 'password',
                message: 'Senha:',
                validate: (input) => input.length >= 6 || 'Senha deve ter no mínimo 6 caracteres'
            }
        ]);
        username = answers.username;
        password = answers.password;
    }
    
    try {
        const hashedPassword = hashPassword(password);
        
        await run(db,
            'INSERT INTO admin_users (username, password_hash, tenant_id, role, status) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, tenantId, 'admin', 'active']
        );
        
        console.log();
        console.log(colors.green + '✅ Admin criado com sucesso!' + colors.reset);
        console.log();
        console.log(colors.cyan + `Username: ${username}`);
        console.log(`Senha: ${password}`);
        console.log(`Tenant: ${tenantSlug}`);
        console.log(`Link: http://localhost:3010/admin?tenant=${tenantSlug}` + colors.reset);
        console.log();
        
    } catch (error) {
        console.log();
        if (error.message.includes('UNIQUE')) {
            console.log(colors.red + '❌ Erro: Username já existe!' + colors.reset);
        } else {
            console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
        }
        console.log();
    }
}

async function listAdmins(db) {
    showHeader();
    console.log(colors.bright + '📋 LISTA DE ADMINS' + colors.reset);
    console.log();
    
    const admins = await query(db, `
        SELECT a.*, t.name as tenant_name, t.slug as tenant_slug
        FROM admin_users a
        LEFT JOIN tenants t ON a.tenant_id = t.id
        ORDER BY t.name, a.username
    `);
    
    if (admins.length === 0) {
        console.log(colors.yellow + '⚠️  Nenhum admin encontrado' + colors.reset);
        console.log();
        return;
    }
    
    let currentTenant = null;
    for (const admin of admins) {
        if (currentTenant !== admin.tenant_name) {
            currentTenant = admin.tenant_name;
            console.log(colors.cyan + colors.bright + `\n${currentTenant} (${admin.tenant_slug})` + colors.reset);
        }
        
        const statusColor = admin.status === 'active' ? colors.green : colors.red;
        console.log(`  ${statusColor}${admin.status === 'active' ? '✅' : '❌'}${colors.reset} ${admin.username} (${admin.role})`);
    }
    console.log();
}

async function deleteAdmin(db) {
    const admins = await query(db, `
        SELECT a.*, t.name as tenant_name, t.slug as tenant_slug
        FROM admin_users a
        LEFT JOIN tenants t ON a.tenant_id = t.id
        WHERE a.id != 1
        ORDER BY t.name, a.username
    `);
    
    if (admins.length === 0) {
        console.log(colors.yellow + '⚠️  Nenhum admin disponível para exclusão' + colors.reset);
        console.log();
        return;
    }
    
    const { adminId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'adminId',
            message: 'Selecione o admin para excluir:',
            choices: admins.map(a => ({
                name: `${a.username} - ${a.tenant_name}`,
                value: a.id
            }))
        }
    ]);
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Tem certeza que deseja excluir este admin?',
            default: false
        }
    ]);
    
    if (!confirm) {
        console.log();
        console.log(colors.yellow + '❌ Exclusão cancelada' + colors.reset);
        console.log();
        return;
    }
    
    try {
        await run(db, 'DELETE FROM admin_users WHERE id = ?', [adminId]);
        console.log();
        console.log(colors.green + '✅ Admin excluído com sucesso!' + colors.reset);
        console.log();
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// ESTATÍSTICAS (COM INFO DE EXPIRAÇÃO)
// ═════════════════════════════════════════════════════════
async function showStats(db) {
    showHeader();
    console.log(colors.bright + '📊 ESTATÍSTICAS POR TENANT' + colors.reset);
    console.log();
    
    const tenants = await query(db, 'SELECT * FROM tenants WHERE status = "active" ORDER BY name');
    
    const { tenantId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'tenantId',
            message: 'Selecione o tenant:',
            choices: tenants.map(t => ({
                name: `${t.name} (${t.slug})`,
                value: t.id
            }))
        }
    ]);
    
    const tenant = tenants.find(t => t.id === tenantId);
    
    // Buscar estatísticas
    const stats = await get(db, `
        SELECT 
            (SELECT COUNT(*) FROM sigma_panels WHERE tenant_id = ?) as sigma_panels,
            (SELECT COUNT(*) FROM koffice_panels WHERE tenant_id = ?) as koffice_panels,
            (SELECT COUNT(*) FROM gesoffice_panels WHERE tenant_id = ?) as gesoffice_panels,
            (SELECT COUNT(*) FROM admin_users WHERE tenant_id = ?) as admins
    `, [tenantId, tenantId, tenantId, tenantId]);
    
    // Contar revendedores
    const resellers = await get(db, `
        SELECT 
            (SELECT COUNT(*) FROM resellers r JOIN sigma_panels sp ON r.panel_id = sp.id WHERE sp.tenant_id = ?) +
            (SELECT COUNT(*) FROM koffice_resellers kr JOIN koffice_panels kp ON kr.panel_id = kp.id WHERE kp.tenant_id = ?) +
            (SELECT COUNT(*) FROM gesoffice_resellers gr JOIN gesoffice_panels gp ON gr.panel_id = gp.id WHERE gp.tenant_id = ?) as total
    `, [tenantId, tenantId, tenantId]);
    
    console.log(colors.cyan + colors.bright + tenant.name + colors.reset);
    console.log(colors.dim + `Slug: ${tenant.slug}` + colors.reset);
    
    // ⭐ MOSTRAR INFO DE EXPIRAÇÃO
    if (tenant.expires_at) {
        const isExpired = isTenantExpired(tenant.expires_at);
        const daysRemaining = getDaysRemaining(tenant.expires_at);
        
        if (isExpired) {
            console.log(colors.red + `🔒 EXPIRADO em ${tenant.expires_at} (há ${Math.abs(daysRemaining)} dias)` + colors.reset);
        } else if (daysRemaining <= 7) {
            console.log(colors.yellow + `⚠️ Expira em ${tenant.expires_at} (${daysRemaining} dias restantes!)` + colors.reset);
        } else {
            console.log(colors.green + `✅ Expira em ${tenant.expires_at} (${daysRemaining} dias)` + colors.reset);
        }
    } else {
        console.log(colors.green + `♾️ Sem expiração` + colors.reset);
    }
    
    console.log();
    console.log(colors.green + '📊 Resumo:');
    console.log(`  Admins: ${stats.admins}`);
    console.log(`  Painéis Sigma: ${stats.sigma_panels}`);
    console.log(`  Painéis Koffice: ${stats.koffice_panels}`);
    console.log(`  Painéis GesOffice: ${stats.gesoffice_panels}`);
    console.log(`  Total de Painéis: ${stats.sigma_panels + stats.koffice_panels + stats.gesoffice_panels}`);
    console.log(`  Total de Revendedores: ${resellers.total}` + colors.reset);
    console.log();
}

// ═════════════════════════════════════════════════════════
// MOSTRAR LINKS
// ═════════════════════════════════════════════════════════
async function showLinks(db) {
    showHeader();
    console.log(colors.bright + '🔗 LINKS DE ACESSO' + colors.reset);
    console.log();
    
    const tenants = await query(db, 'SELECT * FROM tenants WHERE status = "active" ORDER BY name');
    
    if (tenants.length === 0) {
        console.log(colors.yellow + '⚠️  Nenhum tenant ativo encontrado' + colors.reset);
        console.log();
        return;
    }
    
    for (const tenant of tenants) {
        console.log(colors.cyan + colors.bright + `${tenant.name}` + colors.reset);
        console.log(colors.dim + `  Slug: ${tenant.slug}` + colors.reset);
        
        // ⭐ INFO DE EXPIRAÇÃO
        if (tenant.expires_at) {
            const daysRemaining = getDaysRemaining(tenant.expires_at);
            const isExpired = isTenantExpired(tenant.expires_at);
            
            if (isExpired) {
                console.log(colors.red + `  🔒 EXPIRADO` + colors.reset);
            } else if (daysRemaining <= 7) {
                console.log(colors.yellow + `  ⚠️ Expira em ${daysRemaining} dia(s)` + colors.reset);
            }
        }
        
        console.log(colors.green + `  Cliente:  http://localhost:3010/?tenant=${tenant.slug}`);
        console.log(colors.blue + `  Admin:    http://localhost:3010/admin?tenant=${tenant.slug}` + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// RESETAR SENHA
// ═════════════════════════════════════════════════════════
async function resetPassword(db) {
    showHeader();
    console.log(colors.bright + '🔑 RESETAR SENHA DE ADMIN' + colors.reset);
    console.log();
    
    const admins = await query(db, `
        SELECT a.*, t.name as tenant_name
        FROM admin_users a
        LEFT JOIN tenants t ON a.tenant_id = t.id
        ORDER BY t.name, a.username
    `);
    
    const { adminId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'adminId',
            message: 'Selecione o admin:',
            choices: admins.map(a => ({
                name: `${a.username} - ${a.tenant_name}`,
                value: a.id
            }))
        }
    ]);
    
    const { password } = await inquirer.prompt([
        {
            type: 'password',
            name: 'password',
            message: 'Nova senha:',
            validate: (input) => input.length >= 6 || 'Senha deve ter no mínimo 6 caracteres'
        }
    ]);
    
    try {
        const hashedPassword = hashPassword(password);
        await run(db, 'UPDATE admin_users SET password_hash = ? WHERE id = ?', [hashedPassword, adminId]);
        
        const admin = admins.find(a => a.id === adminId);
        
        console.log();
        console.log(colors.green + '✅ Senha resetada com sucesso!' + colors.reset);
        console.log();
        console.log(colors.cyan + `Username: ${admin.username}`);
        console.log(`Nova senha: ${password}` + colors.reset);
        console.log();
        
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════
async function main() {
    let db;
    
    try {
        db = await openDatabase();
        
        while (true) {
            const action = await mainMenu();
            
            if (action === 'exit') {
                console.log();
                console.log(colors.cyan + '👋 Até logo!' + colors.reset);
                console.log();
                break;
            }
            
            switch (action) {
                case 'list':
                    await listTenants(db);
                    break;
                case 'create':
                    await createTenant(db);
                    break;
                case 'edit':
                    await editTenant(db);
                    break;
                case 'renew':  // ⭐ NOVO
                    await renewTenant(db);
                    break;
                case 'delete':
                    await deleteTenant(db);
                    break;
                case 'toggle':
                    await toggleTenant(db);
                    break;
                case 'admins':
                    await manageAdmins(db);
                    break;
                case 'stats':
                    await showStats(db);
                    break;
                case 'links':
                    await showLinks(db);
                    break;
                case 'reset-password':
                    await resetPassword(db);
                    break;
            }
            
            // Pausa antes de voltar ao menu
            await inquirer.prompt([
                {
                    type: 'input',
                    name: 'continue',
                    message: 'Pressione ENTER para continuar...'
                }
            ]);
        }
        
    } catch (error) {
        console.error(colors.red + 'Erro fatal:', error.message + colors.reset);
    } finally {
        if (db) {
            await closeDatabase(db);
        }
    }
}

// Executar
main();
