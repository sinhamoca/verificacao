// clean-data.js - Sistema de Limpeza Profundo do Sistema
const Database = require('./models/Database');
const inquirer = require('inquirer');

// ═════════════════════════════════════════════════════════
// CORES PARA TERMINAL
// ═════════════════════════════════════════════════════════
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// ═════════════════════════════════════════════════════════
// HELPERS DE BANCO DE DADOS
// ═════════════════════════════════════════════════════════
const query = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const get = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const run = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

// ═════════════════════════════════════════════════════════
// HEADER
// ═════════════════════════════════════════════════════════
function showHeader() {
    console.clear();
    console.log(colors.cyan + colors.bright + '╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║              🧹 SISTEMA DE LIMPEZA PROFUNDO 🧹             ║');
    console.log('║                    Sigma Recharge System                   ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝' + colors.reset);
    console.log();
}

// ═════════════════════════════════════════════════════════
// ANÁLISE COMPLETA DE UM TENANT
// ═════════════════════════════════════════════════════════
async function analyzeTenant(db, tenantId) {
    console.log(colors.cyan + '\n📊 Analisando conteúdo do tenant...\n' + colors.reset);
    
    const data = {
        admins: await get(db, 'SELECT COUNT(*) as total FROM admin_users WHERE tenant_id = ?', [tenantId]),
        
        // Painéis
        sigmaPanels: await get(db, 'SELECT COUNT(*) as total FROM sigma_panels WHERE tenant_id = ?', [tenantId]),
        kofficePanels: await get(db, 'SELECT COUNT(*) as total FROM koffice_panels WHERE tenant_id = ?', [tenantId]),
        gesofficePanels: await get(db, 'SELECT COUNT(*) as total FROM gesoffice_panels WHERE tenant_id = ?', [tenantId]),
        p2brasPanels: await get(db, 'SELECT COUNT(*) as total FROM p2bras_panels WHERE tenant_id = ?', [tenantId]),
        rushplayPanels: await get(db, 'SELECT COUNT(*) as total FROM rushplay_panels WHERE tenant_id = ?', [tenantId]),
        painelfodaPanels: await get(db, 'SELECT COUNT(*) as total FROM painelfoda_panels WHERE tenant_id = ?', [tenantId]),
        dashboardbzPanels: await get(db, 'SELECT COUNT(*) as total FROM dashboardbz_panels WHERE tenant_id = ?', [tenantId]),
        
        // Revendedores (por painel)
        sigmaResellers: await get(db, `
            SELECT COUNT(*) as total FROM resellers 
            WHERE panel_id IN (SELECT id FROM sigma_panels WHERE tenant_id = ?)
        `, [tenantId]),
        
        kofficeResellers: await get(db, `
            SELECT COUNT(*) as total FROM koffice_resellers 
            WHERE panel_id IN (SELECT id FROM koffice_panels WHERE tenant_id = ?)
        `, [tenantId]),
        
        gesofficeResellers: await get(db, `
            SELECT COUNT(*) as total FROM gesoffice_resellers 
            WHERE panel_id IN (SELECT id FROM gesoffice_panels WHERE tenant_id = ?)
        `, [tenantId]),
        
        p2brasResellers: await get(db, `
            SELECT COUNT(*) as total FROM p2bras_resellers 
            WHERE panel_id IN (SELECT id FROM p2bras_panels WHERE tenant_id = ?)
        `, [tenantId]),
        
        rushplayResellers: await get(db, `
            SELECT COUNT(*) as total FROM rushplay_resellers 
            WHERE panel_id IN (SELECT id FROM rushplay_panels WHERE tenant_id = ?)
        `, [tenantId]),
        
        painelfodaResellers: await get(db, `
            SELECT COUNT(*) as total FROM painelfoda_resellers 
            WHERE panel_id IN (SELECT id FROM painelfoda_panels WHERE tenant_id = ?)
        `, [tenantId]),
        
        dashboardbzResellers: await get(db, `
            SELECT COUNT(*) as total FROM dashboardbz_resellers 
            WHERE panel_id IN (SELECT id FROM dashboardbz_panels WHERE tenant_id = ?)
        `, [tenantId]),
        
        // Pacotes
        packages: await get(db, `
            SELECT COUNT(*) as total FROM credit_packages 
            WHERE reseller_id IN (
                SELECT id FROM resellers WHERE panel_id IN (SELECT id FROM sigma_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM koffice_resellers WHERE panel_id IN (SELECT id FROM koffice_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM gesoffice_resellers WHERE panel_id IN (SELECT id FROM gesoffice_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM p2bras_resellers WHERE panel_id IN (SELECT id FROM p2bras_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM rushplay_resellers WHERE panel_id IN (SELECT id FROM rushplay_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM painelfoda_resellers WHERE panel_id IN (SELECT id FROM painelfoda_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM dashboardbz_resellers WHERE panel_id IN (SELECT id FROM dashboardbz_panels WHERE tenant_id = ?)
            )
        `, [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId]),
        
        // Pagamentos
        payments: await get(db, `
            SELECT COUNT(*) as total FROM payments 
            WHERE reseller_id IN (
                SELECT id FROM resellers WHERE panel_id IN (SELECT id FROM sigma_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM koffice_resellers WHERE panel_id IN (SELECT id FROM koffice_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM gesoffice_resellers WHERE panel_id IN (SELECT id FROM gesoffice_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM p2bras_resellers WHERE panel_id IN (SELECT id FROM p2bras_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM rushplay_resellers WHERE panel_id IN (SELECT id FROM rushplay_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM painelfoda_resellers WHERE panel_id IN (SELECT id FROM painelfoda_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM dashboardbz_resellers WHERE panel_id IN (SELECT id FROM dashboardbz_panels WHERE tenant_id = ?)
            )
        `, [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId]),
        
        // Transações
        transactions: await get(db, `
            SELECT COUNT(*) as total FROM transactions 
            WHERE payment_id IN (
                SELECT id FROM payments WHERE reseller_id IN (
                    SELECT id FROM resellers WHERE panel_id IN (SELECT id FROM sigma_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM koffice_resellers WHERE panel_id IN (SELECT id FROM koffice_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM gesoffice_resellers WHERE panel_id IN (SELECT id FROM gesoffice_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM p2bras_resellers WHERE panel_id IN (SELECT id FROM p2bras_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM rushplay_resellers WHERE panel_id IN (SELECT id FROM rushplay_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM painelfoda_resellers WHERE panel_id IN (SELECT id FROM painelfoda_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM dashboardbz_resellers WHERE panel_id IN (SELECT id FROM dashboardbz_panels WHERE tenant_id = ?)
                )
            )
        `, [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId]),
        
        // Configs
        configs: await get(db, 'SELECT COUNT(*) as total FROM tenant_config WHERE tenant_id = ?', [tenantId])
    };
    
    const totalPanels = data.sigmaPanels.total + data.kofficePanels.total + 
                        data.gesofficePanels.total + data.p2brasPanels.total + 
                        data.rushplayPanels.total + data.painelfodaPanels.total + 
                        data.dashboardbzPanels.total;
    
    const totalResellers = data.sigmaResellers.total + data.kofficeResellers.total + 
                           data.gesofficeResellers.total + data.p2brasResellers.total + 
                           data.rushplayResellers.total + data.painelfodaResellers.total + 
                           data.dashboardbzResellers.total;
    
    console.log(colors.yellow + '┌─────────────────────────────────────────┐');
    console.log('│          RESUMO DO CONTEÚDO             │');
    console.log('└─────────────────────────────────────────┘' + colors.reset);
    console.log(`  👤 Admins: ${colors.bright}${data.admins.total}${colors.reset}`);
    console.log(`  🖥️  Painéis: ${colors.bright}${totalPanels}${colors.reset}`);
    console.log(`     ├─ Sigma: ${data.sigmaPanels.total}`);
    console.log(`     ├─ Koffice: ${data.kofficePanels.total}`);
    console.log(`     ├─ GesOffice: ${data.gesofficePanels.total}`);
    console.log(`     ├─ P2Bras: ${data.p2brasPanels.total}`);
    console.log(`     ├─ RushPlay: ${data.rushplayPanels.total}`);
    console.log(`     ├─ PainelFoda: ${data.painelfodaPanels.total}`);
    console.log(`     └─ DashboardBz: ${data.dashboardbzPanels.total}`);
    console.log(`  👥 Revendedores: ${colors.bright}${totalResellers}${colors.reset}`);
    console.log(`  📦 Pacotes: ${colors.bright}${data.packages.total}${colors.reset}`);
    console.log(`  💳 Pagamentos: ${colors.bright}${data.payments.total}${colors.reset}`);
    console.log(`  🔄 Transações: ${colors.bright}${data.transactions.total}${colors.reset}`);
    console.log(`  ⚙️  Configurações: ${colors.bright}${data.configs.total}${colors.reset}`);
    console.log();
    
    return data;
}

// ═════════════════════════════════════════════════════════
// DELETAR TENANT COMPLETO
// ═════════════════════════════════════════════════════════
async function deleteTenantComplete(db) {
    showHeader();
    console.log(colors.bright + colors.red + '🗑️  DELETAR TENANT COMPLETO' + colors.reset);
    console.log(colors.yellow + '⚠️  ATENÇÃO: Esta ação é IRREVERSÍVEL e apagará TUDO!' + colors.reset);
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
            message: 'Selecione o tenant para DELETAR COMPLETAMENTE:',
            choices: tenants.map(t => ({
                name: `${t.name} (${t.slug}) - ${t.status}`,
                value: t.id
            }))
        }
    ]);
    
    const tenant = tenants.find(t => t.id === tenantId);
    
    // Analisar conteúdo
    await analyzeTenant(db, tenantId);
    
    console.log(colors.red + colors.bright + '╔═════════════════════════════════════════════════════════╗');
    console.log('║                    ⚠️  ATENÇÃO ⚠️                        ║');
    console.log('║                                                         ║');
    console.log('║  Será DELETADO PERMANENTEMENTE:                         ║');
    console.log('║  • Tenant e todas as configurações                      ║');
    console.log('║  • TODOS os admins deste tenant                         ║');
    console.log('║  • TODOS os painéis (7 tipos)                           ║');
    console.log('║  • TODOS os revendedores                                ║');
    console.log('║  • TODOS os pacotes de créditos                         ║');
    console.log('║  • TODOS os pagamentos                                  ║');
    console.log('║  • TODAS as transações                                  ║');
    console.log('║                                                         ║');
    console.log('║  Esta ação NÃO pode ser desfeita!                       ║');
    console.log('╚═════════════════════════════════════════════════════════╝' + colors.reset);
    console.log();
    
    const { confirm1 } = await inquirer.prompt([
        {
            type: 'input',
            name: 'confirm1',
            message: `Digite "${tenant.slug}" para confirmar:`,
        }
    ]);
    
    if (confirm1 !== tenant.slug) {
        console.log(colors.yellow + '\n❌ Exclusão cancelada\n' + colors.reset);
        return;
    }
    
    const { confirm2 } = await inquirer.prompt([
        {
            type: 'input',
            name: 'confirm2',
            message: 'Digite "DELETAR TUDO" para confirmar novamente:',
        }
    ]);
    
    if (confirm2 !== 'DELETAR TUDO') {
        console.log(colors.yellow + '\n❌ Exclusão cancelada\n' + colors.reset);
        return;
    }
    
    try {
        console.log(colors.cyan + '\n🔄 Iniciando limpeza profunda...\n' + colors.reset);
        
        // ═══════════════════════════════════════════════════════
        // ORDEM CORRETA DE EXCLUSÃO (do mais dependente ao menos)
        // ═══════════════════════════════════════════════════════
        
        // 1. Transações
        console.log('  🔄 Deletando transações...');
        await run(db, `
            DELETE FROM transactions 
            WHERE payment_id IN (
                SELECT id FROM payments WHERE reseller_id IN (
                    SELECT id FROM resellers WHERE panel_id IN (SELECT id FROM sigma_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM koffice_resellers WHERE panel_id IN (SELECT id FROM koffice_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM gesoffice_resellers WHERE panel_id IN (SELECT id FROM gesoffice_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM p2bras_resellers WHERE panel_id IN (SELECT id FROM p2bras_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM rushplay_resellers WHERE panel_id IN (SELECT id FROM rushplay_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM painelfoda_resellers WHERE panel_id IN (SELECT id FROM painelfoda_panels WHERE tenant_id = ?)
                    UNION
                    SELECT id FROM dashboardbz_resellers WHERE panel_id IN (SELECT id FROM dashboardbz_panels WHERE tenant_id = ?)
                )
            )
        `, [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId]);
        
        // 2. Pagamentos
        console.log('  💳 Deletando pagamentos...');
        await run(db, `
            DELETE FROM payments 
            WHERE reseller_id IN (
                SELECT id FROM resellers WHERE panel_id IN (SELECT id FROM sigma_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM koffice_resellers WHERE panel_id IN (SELECT id FROM koffice_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM gesoffice_resellers WHERE panel_id IN (SELECT id FROM gesoffice_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM p2bras_resellers WHERE panel_id IN (SELECT id FROM p2bras_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM rushplay_resellers WHERE panel_id IN (SELECT id FROM rushplay_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM painelfoda_resellers WHERE panel_id IN (SELECT id FROM painelfoda_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM dashboardbz_resellers WHERE panel_id IN (SELECT id FROM dashboardbz_panels WHERE tenant_id = ?)
            )
        `, [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId]);
        
        // 3. Pacotes
        console.log('  📦 Deletando pacotes...');
        await run(db, `
            DELETE FROM credit_packages 
            WHERE reseller_id IN (
                SELECT id FROM resellers WHERE panel_id IN (SELECT id FROM sigma_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM koffice_resellers WHERE panel_id IN (SELECT id FROM koffice_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM gesoffice_resellers WHERE panel_id IN (SELECT id FROM gesoffice_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM p2bras_resellers WHERE panel_id IN (SELECT id FROM p2bras_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM rushplay_resellers WHERE panel_id IN (SELECT id FROM rushplay_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM painelfoda_resellers WHERE panel_id IN (SELECT id FROM painelfoda_panels WHERE tenant_id = ?)
                UNION
                SELECT id FROM dashboardbz_resellers WHERE panel_id IN (SELECT id FROM dashboardbz_panels WHERE tenant_id = ?)
            )
        `, [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId, tenantId]);
        
        // 4. Revendedores (todos os tipos)
        console.log('  👥 Deletando revendedores...');
        await run(db, 'DELETE FROM resellers WHERE panel_id IN (SELECT id FROM sigma_panels WHERE tenant_id = ?)', [tenantId]);
        await run(db, 'DELETE FROM koffice_resellers WHERE panel_id IN (SELECT id FROM koffice_panels WHERE tenant_id = ?)', [tenantId]);
        await run(db, 'DELETE FROM gesoffice_resellers WHERE panel_id IN (SELECT id FROM gesoffice_panels WHERE tenant_id = ?)', [tenantId]);
        await run(db, 'DELETE FROM p2bras_resellers WHERE panel_id IN (SELECT id FROM p2bras_panels WHERE tenant_id = ?)', [tenantId]);
        await run(db, 'DELETE FROM rushplay_resellers WHERE panel_id IN (SELECT id FROM rushplay_panels WHERE tenant_id = ?)', [tenantId]);
        await run(db, 'DELETE FROM painelfoda_resellers WHERE panel_id IN (SELECT id FROM painelfoda_panels WHERE tenant_id = ?)', [tenantId]);
        await run(db, 'DELETE FROM dashboardbz_resellers WHERE panel_id IN (SELECT id FROM dashboardbz_panels WHERE tenant_id = ?)', [tenantId]);
        
        // 5. Painéis (todos os tipos)
        console.log('  🖥️  Deletando painéis...');
        await run(db, 'DELETE FROM sigma_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM koffice_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM gesoffice_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM p2bras_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM rushplay_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM painelfoda_panels WHERE tenant_id = ?', [tenantId]);
        await run(db, 'DELETE FROM dashboardbz_panels WHERE tenant_id = ?', [tenantId]);
        
        // 6. Configurações
        console.log('  ⚙️  Deletando configurações...');
        await run(db, 'DELETE FROM tenant_config WHERE tenant_id = ?', [tenantId]);
        
        // 7. Admins
        console.log('  👤 Deletando admins...');
        await run(db, 'DELETE FROM admin_users WHERE tenant_id = ?', [tenantId]);
        
        // 8. Tenant
        console.log('  🏢 Deletando tenant...');
        await run(db, 'DELETE FROM tenants WHERE id = ?', [tenantId]);
        
        console.log();
        console.log(colors.green + colors.bright + '╔═════════════════════════════════════════════════════════╗');
        console.log('║                                                         ║');
        console.log('║              ✅ TENANT DELETADO COM SUCESSO!             ║');
        console.log('║                                                         ║');
        console.log('║  Todas as informações foram removidas permanentemente.  ║');
        console.log('║                                                         ║');
        console.log('╚═════════════════════════════════════════════════════════╝' + colors.reset);
        console.log();
        
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro durante a exclusão: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// LIMPAR CONTEÚDOS ÓRFÃOS
// ═════════════════════════════════════════════════════════
async function cleanOrphans(db) {
    showHeader();
    console.log(colors.bright + '🔍 LIMPAR CONTEÚDOS ÓRFÃOS' + colors.reset);
    console.log(colors.cyan + 'Buscando registros sem relacionamentos...\n' + colors.reset);
    
    const orphans = {
        // Revendedores sem painéis
        sigmaResellers: await query(db, `
            SELECT r.* FROM resellers r
            LEFT JOIN sigma_panels sp ON r.panel_id = sp.id
            WHERE sp.id IS NULL
        `),
        
        kofficeResellers: await query(db, `
            SELECT kr.* FROM koffice_resellers kr
            LEFT JOIN koffice_panels kp ON kr.panel_id = kp.id
            WHERE kp.id IS NULL
        `),
        
        gesofficeResellers: await query(db, `
            SELECT gr.* FROM gesoffice_resellers gr
            LEFT JOIN gesoffice_panels gp ON gr.panel_id = gp.id
            WHERE gp.id IS NULL
        `),
        
        p2brasResellers: await query(db, `
            SELECT pr.* FROM p2bras_resellers pr
            LEFT JOIN p2bras_panels pp ON pr.panel_id = pp.id
            WHERE pp.id IS NULL
        `),
        
        rushplayResellers: await query(db, `
            SELECT rpr.* FROM rushplay_resellers rpr
            LEFT JOIN rushplay_panels rpp ON rpr.panel_id = rpp.id
            WHERE rpp.id IS NULL
        `),
        
        painelfodaResellers: await query(db, `
            SELECT pfr.* FROM painelfoda_resellers pfr
            LEFT JOIN painelfoda_panels pfp ON pfr.panel_id = pfp.id
            WHERE pfp.id IS NULL
        `),
        
        dashboardbzResellers: await query(db, `
            SELECT dbr.* FROM dashboardbz_resellers dbr
            LEFT JOIN dashboardbz_panels dbp ON dbr.panel_id = dbp.id
            WHERE dbp.id IS NULL
        `),
        
        // Painéis sem tenant
        sigmaPanels: await query(db, `
            SELECT sp.* FROM sigma_panels sp
            LEFT JOIN tenants t ON sp.tenant_id = t.id
            WHERE t.id IS NULL
        `),
        
        kofficePanels: await query(db, `
            SELECT kp.* FROM koffice_panels kp
            LEFT JOIN tenants t ON kp.tenant_id = t.id
            WHERE t.id IS NULL
        `),
        
        gesofficePanels: await query(db, `
            SELECT gp.* FROM gesoffice_panels gp
            LEFT JOIN tenants t ON gp.tenant_id = t.id
            WHERE t.id IS NULL
        `),
        
        p2brasPanels: await query(db, `
            SELECT pp.* FROM p2bras_panels pp
            LEFT JOIN tenants t ON pp.tenant_id = t.id
            WHERE t.id IS NULL
        `),
        
        rushplayPanels: await query(db, `
            SELECT rpp.* FROM rushplay_panels rpp
            LEFT JOIN tenants t ON rpp.tenant_id = t.id
            WHERE t.id IS NULL
        `),
        
        painelfodaPanels: await query(db, `
            SELECT pfp.* FROM painelfoda_panels pfp
            LEFT JOIN tenants t ON pfp.tenant_id = t.id
            WHERE t.id IS NULL
        `),
        
        dashboardbzPanels: await query(db, `
            SELECT dbp.* FROM dashboardbz_panels dbp
            LEFT JOIN tenants t ON dbp.tenant_id = t.id
            WHERE t.id IS NULL
        `),
        
        // Admins sem tenant
        admins: await query(db, `
            SELECT a.* FROM admin_users a
            LEFT JOIN tenants t ON a.tenant_id = t.id
            WHERE t.id IS NULL AND a.id != 1
        `),
        
        // Pagamentos sem revendedor
        payments: await query(db, `
            SELECT p.* FROM payments p
            WHERE (
                (p.reseller_type = 'sigma' AND NOT EXISTS (SELECT 1 FROM resellers WHERE id = p.reseller_id))
                OR (p.reseller_type = 'koffice' AND NOT EXISTS (SELECT 1 FROM koffice_resellers WHERE id = p.reseller_id))
                OR (p.reseller_type = 'gesoffice' AND NOT EXISTS (SELECT 1 FROM gesoffice_resellers WHERE id = p.reseller_id))
                OR (p.reseller_type = 'p2bras' AND NOT EXISTS (SELECT 1 FROM p2bras_resellers WHERE id = p.reseller_id))
                OR (p.reseller_type = 'rushplay' AND NOT EXISTS (SELECT 1 FROM rushplay_resellers WHERE id = p.reseller_id))
                OR (p.reseller_type = 'painelfoda' AND NOT EXISTS (SELECT 1 FROM painelfoda_resellers WHERE id = p.reseller_id))
                OR (p.reseller_type = 'dashboardbz' AND NOT EXISTS (SELECT 1 FROM dashboardbz_resellers WHERE id = p.reseller_id))
            )
        `),
        
        // Transações sem pagamento
        transactions: await query(db, `
            SELECT t.* FROM transactions t
            LEFT JOIN payments p ON t.payment_id = p.id
            WHERE p.id IS NULL
        `),
        
        // Pacotes sem revendedor
        packages: await query(db, `
            SELECT cp.* FROM credit_packages cp
            WHERE (
                (cp.reseller_type = 'sigma' AND NOT EXISTS (SELECT 1 FROM resellers WHERE id = cp.reseller_id))
                OR (cp.reseller_type = 'koffice' AND NOT EXISTS (SELECT 1 FROM koffice_resellers WHERE id = cp.reseller_id))
                OR (cp.reseller_type = 'gesoffice' AND NOT EXISTS (SELECT 1 FROM gesoffice_resellers WHERE id = cp.reseller_id))
                OR (cp.reseller_type = 'p2bras' AND NOT EXISTS (SELECT 1 FROM p2bras_resellers WHERE id = cp.reseller_id))
                OR (cp.reseller_type = 'rushplay' AND NOT EXISTS (SELECT 1 FROM rushplay_resellers WHERE id = cp.reseller_id))
                OR (cp.reseller_type = 'painelfoda' AND NOT EXISTS (SELECT 1 FROM painelfoda_resellers WHERE id = cp.reseller_id))
                OR (cp.reseller_type = 'dashboardbz' AND NOT EXISTS (SELECT 1 FROM dashboardbz_resellers WHERE id = cp.reseller_id))
            )
        `)
    };
    
    const totalOrphans = 
        orphans.sigmaResellers.length + orphans.kofficeResellers.length + 
        orphans.gesofficeResellers.length + orphans.p2brasResellers.length +
        orphans.rushplayResellers.length + orphans.painelfodaResellers.length +
        orphans.dashboardbzResellers.length + orphans.sigmaPanels.length + 
        orphans.kofficePanels.length + orphans.gesofficePanels.length +
        orphans.p2brasPanels.length + orphans.rushplayPanels.length +
        orphans.painelfodaPanels.length + orphans.dashboardbzPanels.length +
        orphans.admins.length + orphans.payments.length + 
        orphans.transactions.length + orphans.packages.length;
    
    if (totalOrphans === 0) {
        console.log(colors.green + '✅ Nenhum conteúdo órfão encontrado! Sistema limpo.\n' + colors.reset);
        return;
    }
    
    console.log(colors.yellow + '📊 REGISTROS ÓRFÃOS ENCONTRADOS:\n' + colors.reset);
    
    if (orphans.sigmaResellers.length > 0)
        console.log(`  • ${orphans.sigmaResellers.length} revendedor(es) Sigma sem painel`);
    if (orphans.kofficeResellers.length > 0)
        console.log(`  • ${orphans.kofficeResellers.length} revendedor(es) Koffice sem painel`);
    if (orphans.gesofficeResellers.length > 0)
        console.log(`  • ${orphans.gesofficeResellers.length} revendedor(es) GesOffice sem painel`);
    if (orphans.p2brasResellers.length > 0)
        console.log(`  • ${orphans.p2brasResellers.length} revendedor(es) P2Bras sem painel`);
    if (orphans.rushplayResellers.length > 0)
        console.log(`  • ${orphans.rushplayResellers.length} revendedor(es) RushPlay sem painel`);
    if (orphans.painelfodaResellers.length > 0)
        console.log(`  • ${orphans.painelfodaResellers.length} revendedor(es) PainelFoda sem painel`);
    if (orphans.dashboardbzResellers.length > 0)
        console.log(`  • ${orphans.dashboardbzResellers.length} revendedor(es) DashboardBz sem painel`);
    
    if (orphans.sigmaPanels.length > 0)
        console.log(`  • ${orphans.sigmaPanels.length} painel(éis) Sigma sem tenant`);
    if (orphans.kofficePanels.length > 0)
        console.log(`  • ${orphans.kofficePanels.length} painel(éis) Koffice sem tenant`);
    if (orphans.gesofficePanels.length > 0)
        console.log(`  • ${orphans.gesofficePanels.length} painel(éis) GesOffice sem tenant`);
    if (orphans.p2brasPanels.length > 0)
        console.log(`  • ${orphans.p2brasPanels.length} painel(éis) P2Bras sem tenant`);
    if (orphans.rushplayPanels.length > 0)
        console.log(`  • ${orphans.rushplayPanels.length} painel(éis) RushPlay sem tenant`);
    if (orphans.painelfodaPanels.length > 0)
        console.log(`  • ${orphans.painelfodaPanels.length} painel(éis) PainelFoda sem tenant`);
    if (orphans.dashboardbzPanels.length > 0)
        console.log(`  • ${orphans.dashboardbzPanels.length} painel(éis) DashboardBz sem tenant`);
    
    if (orphans.admins.length > 0)
        console.log(`  • ${orphans.admins.length} admin(s) sem tenant`);
    if (orphans.payments.length > 0)
        console.log(`  • ${orphans.payments.length} pagamento(s) sem revendedor`);
    if (orphans.transactions.length > 0)
        console.log(`  • ${orphans.transactions.length} transação(ões) sem pagamento`);
    if (orphans.packages.length > 0)
        console.log(`  • ${orphans.packages.length} pacote(s) sem revendedor`);
    
    console.log();
    console.log(colors.yellow + `Total: ${totalOrphans} registro(s) órfão(s)\n` + colors.reset);
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Deseja DELETAR todos esses registros órfãos?',
            default: false
        }
    ]);
    
    if (!confirm) {
        console.log(colors.yellow + '\n❌ Limpeza cancelada\n' + colors.reset);
        return;
    }
    
    try {
        console.log(colors.cyan + '\n🔄 Limpando registros órfãos...\n' + colors.reset);
        
        // Deletar na ordem correta
        if (orphans.transactions.length > 0) {
            console.log('  🔄 Deletando transações órfãs...');
            await run(db, `DELETE FROM transactions WHERE id IN (${orphans.transactions.map(t => t.id).join(',')})`);
        }
        
        if (orphans.payments.length > 0) {
            console.log('  💳 Deletando pagamentos órfãos...');
            await run(db, `DELETE FROM payments WHERE id IN (${orphans.payments.map(p => p.id).join(',')})`);
        }
        
        if (orphans.packages.length > 0) {
            console.log('  📦 Deletando pacotes órfãos...');
            await run(db, `DELETE FROM credit_packages WHERE id IN (${orphans.packages.map(p => p.id).join(',')})`);
        }
        
        // Revendedores órfãos
        if (orphans.sigmaResellers.length > 0) {
            console.log('  👥 Deletando revendedores Sigma órfãos...');
            await run(db, `DELETE FROM resellers WHERE id IN (${orphans.sigmaResellers.map(r => r.id).join(',')})`);
        }
        if (orphans.kofficeResellers.length > 0) {
            console.log('  👥 Deletando revendedores Koffice órfãos...');
            await run(db, `DELETE FROM koffice_resellers WHERE id IN (${orphans.kofficeResellers.map(r => r.id).join(',')})`);
        }
        if (orphans.gesofficeResellers.length > 0) {
            console.log('  👥 Deletando revendedores GesOffice órfãos...');
            await run(db, `DELETE FROM gesoffice_resellers WHERE id IN (${orphans.gesofficeResellers.map(r => r.id).join(',')})`);
        }
        if (orphans.p2brasResellers.length > 0) {
            console.log('  👥 Deletando revendedores P2Bras órfãos...');
            await run(db, `DELETE FROM p2bras_resellers WHERE id IN (${orphans.p2brasResellers.map(r => r.id).join(',')})`);
        }
        if (orphans.rushplayResellers.length > 0) {
            console.log('  👥 Deletando revendedores RushPlay órfãos...');
            await run(db, `DELETE FROM rushplay_resellers WHERE id IN (${orphans.rushplayResellers.map(r => r.id).join(',')})`);
        }
        if (orphans.painelfodaResellers.length > 0) {
            console.log('  👥 Deletando revendedores PainelFoda órfãos...');
            await run(db, `DELETE FROM painelfoda_resellers WHERE id IN (${orphans.painelfodaResellers.map(r => r.id).join(',')})`);
        }
        if (orphans.dashboardbzResellers.length > 0) {
            console.log('  👥 Deletando revendedores DashboardBz órfãos...');
            await run(db, `DELETE FROM dashboardbz_resellers WHERE id IN (${orphans.dashboardbzResellers.map(r => r.id).join(',')})`);
        }
        
        // Painéis órfãos
        if (orphans.sigmaPanels.length > 0) {
            console.log('  🖥️  Deletando painéis Sigma órfãos...');
            await run(db, `DELETE FROM sigma_panels WHERE id IN (${orphans.sigmaPanels.map(p => p.id).join(',')})`);
        }
        if (orphans.kofficePanels.length > 0) {
            console.log('  🖥️  Deletando painéis Koffice órfãos...');
            await run(db, `DELETE FROM koffice_panels WHERE id IN (${orphans.kofficePanels.map(p => p.id).join(',')})`);
        }
        if (orphans.gesofficePanels.length > 0) {
            console.log('  🖥️  Deletando painéis GesOffice órfãos...');
            await run(db, `DELETE FROM gesoffice_panels WHERE id IN (${orphans.gesofficePanels.map(p => p.id).join(',')})`);
        }
        if (orphans.p2brasPanels.length > 0) {
            console.log('  🖥️  Deletando painéis P2Bras órfãos...');
            await run(db, `DELETE FROM p2bras_panels WHERE id IN (${orphans.p2brasPanels.map(p => p.id).join(',')})`);
        }
        if (orphans.rushplayPanels.length > 0) {
            console.log('  🖥️  Deletando painéis RushPlay órfãos...');
            await run(db, `DELETE FROM rushplay_panels WHERE id IN (${orphans.rushplayPanels.map(p => p.id).join(',')})`);
        }
        if (orphans.painelfodaPanels.length > 0) {
            console.log('  🖥️  Deletando painéis PainelFoda órfãos...');
            await run(db, `DELETE FROM painelfoda_panels WHERE id IN (${orphans.painelfodaPanels.map(p => p.id).join(',')})`);
        }
        if (orphans.dashboardbzPanels.length > 0) {
            console.log('  🖥️  Deletando painéis DashboardBz órfãos...');
            await run(db, `DELETE FROM dashboardbz_panels WHERE id IN (${orphans.dashboardbzPanels.map(p => p.id).join(',')})`);
        }
        
        // Admins órfãos
        if (orphans.admins.length > 0) {
            console.log('  👤 Deletando admins órfãos...');
            await run(db, `DELETE FROM admin_users WHERE id IN (${orphans.admins.map(a => a.id).join(',')})`);
        }
        
        console.log();
        console.log(colors.green + '✅ Limpeza concluída com sucesso!\n' + colors.reset);
        
    } catch (error) {
        console.log();
        console.log(colors.red + '❌ Erro durante a limpeza: ' + error.message + colors.reset);
        console.log();
    }
}

// ═════════════════════════════════════════════════════════
// LIMPAR PAGAMENTOS PENDENTES ANTIGOS
// ═════════════════════════════════════════════════════════
async function cleanOldPendingPayments(db) {
    showHeader();
    console.log(colors.bright + '🧹 LIMPAR PAGAMENTOS PENDENTES ANTIGOS' + colors.reset);
    console.log();
    
    const { days } = await inquirer.prompt([
        {
            type: 'number',
            name: 'days',
            message: 'Deletar pagamentos pendentes com mais de quantos dias?',
            default: 7,
            validate: (input) => input > 0 || 'Digite um número positivo'
        }
    ]);
    
    const oldPayments = await query(db, `
        SELECT * FROM payments 
        WHERE status = 'pending' 
        AND created_at < datetime('now', '-${days} days')
    `);
    
    if (oldPayments.length === 0) {
        console.log(colors.green + `\n✅ Nenhum pagamento pendente com mais de ${days} dias encontrado.\n` + colors.reset);
        return;
    }
    
    console.log(colors.yellow + `\n📊 Encontrados ${oldPayments.length} pagamento(s) pendente(s) com mais de ${days} dias.\n` + colors.reset);
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Deseja deletar esses pagamentos?',
            default: false
        }
    ]);
    
    if (!confirm) {
        console.log(colors.yellow + '\n❌ Limpeza cancelada\n' + colors.reset);
        return;
    }
    
    try {
        await run(db, `DELETE FROM payments WHERE status = 'pending' AND created_at < datetime('now', '-${days} days')`);
        console.log(colors.green + `\n✅ ${oldPayments.length} pagamento(s) deletado(s) com sucesso!\n` + colors.reset);
    } catch (error) {
        console.log(colors.red + '\n❌ Erro: ' + error.message + '\n' + colors.reset);
    }
}

// ═════════════════════════════════════════════════════════
// MENU PRINCIPAL
// ═════════════════════════════════════════════════════════
async function mainMenu() {
    const db = new Database();
    
    while (true) {
        showHeader();
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'O que deseja fazer?',
                choices: [
                    { name: '🗑️  Deletar Tenant Completo (TUDO)', value: 'delete_tenant' },
                    { name: '🔍 Limpar Conteúdos Órfãos', value: 'clean_orphans' },
                    { name: '🧹 Limpar Pagamentos Pendentes Antigos', value: 'clean_old_payments' },
                    { name: '❌ Sair', value: 'exit' }
                ]
            }
        ]);
        
        if (action === 'exit') {
            console.log(colors.cyan + '\n👋 Até logo!\n' + colors.reset);
            db.close();
            process.exit(0);
        }
        
        if (action === 'delete_tenant') {
            await deleteTenantComplete(db);
        } else if (action === 'clean_orphans') {
            await cleanOrphans(db);
        } else if (action === 'clean_old_payments') {
            await cleanOldPendingPayments(db);
        }
        
        console.log(colors.cyan + 'Pressione ENTER para voltar ao menu...' + colors.reset);
        await inquirer.prompt([{ type: 'input', name: 'continue', message: '' }]);
    }
}

// ═════════════════════════════════════════════════════════
// INICIAR
// ═════════════════════════════════════════════════════════
mainMenu().catch(error => {
    console.error(colors.red + 'Erro fatal:', error + colors.reset);
    process.exit(1);
});
