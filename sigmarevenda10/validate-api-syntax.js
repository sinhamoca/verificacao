#!/usr/bin/env node

/**
 * Validador de Sintaxe API.js
 * Ignora erros de 'window' e verifica apenas sintaxe
 */

const fs = require('fs');
const vm = require('vm');

console.log('\n' + '='.repeat(80));
console.log('🔍 VALIDAÇÃO DE SINTAXE - API.js');
console.log('='.repeat(80) + '\n');

const API_FILE = 'public-recharge/js/shared/api.js';

if (!fs.existsSync(API_FILE)) {
    console.log('❌ Arquivo não encontrado:', API_FILE);
    process.exit(1);
}

let content = fs.readFileSync(API_FILE, 'utf8');

console.log('📖 Lendo arquivo...\n');

// =====================================================
// VERIFICAR VÍRGULAS E CHAVES
// =====================================================

console.log('🔍 Verificando estrutura...\n');

// Contar chaves
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
const openBrackets = (content.match(/\[/g) || []).length;
const closeBrackets = (content.match(/\]/g) || []).length;
const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;

console.log(`   Chaves: { ${openBraces} } ${closeBraces} ${openBraces === closeBraces ? '✅' : '❌'}`);
console.log(`   Colchetes: [ ${openBrackets} ] ${closeBrackets} ${openBrackets === closeBrackets ? '✅' : '❌'}`);
console.log(`   Parênteses: ( ${openParens} ) ${closeParens} ${openParens === closeParens ? '✅' : '❌'}`);
console.log('');

// =====================================================
// VERIFICAR MÉTODOS GESOFFICE
// =====================================================

console.log('🔍 Verificando métodos GesOffice...\n');

const gesOfficeMethods = [
    'getGesOfficePanels',
    'createGesOfficePanel',
    'updateGesOfficePanel',
    'deleteGesOfficePanel',
    'getGesOfficeResellers',
    'createGesOfficeReseller',
    'updateGesOfficeReseller',
    'deleteGesOfficeReseller'
];

let allFound = true;
gesOfficeMethods.forEach(method => {
    const regex = new RegExp(`${method}:\\s*\\([^)]*\\)\\s*=>`, 'g');
    const found = regex.test(content);
    console.log(`   ${method}: ${found ? '✅' : '❌'}`);
    if (!found) allFound = false;
});

console.log('');

if (!allFound) {
    console.log('❌ Alguns métodos GesOffice não foram encontrados ou estão mal formatados!\n');
    console.log('Execute: node force-fix-api.js\n');
    process.exit(1);
}

// =====================================================
// VERIFICAR VÍRGULAS ENTRE MÉTODOS
// =====================================================

console.log('🔍 Verificando vírgulas...\n');

// Extrair apenas o bloco admin
const adminMatch = content.match(/admin:\s*{([\s\S]*?)}\s*}/);
if (!adminMatch) {
    console.log('❌ Não foi possível encontrar o bloco admin!\n');
    process.exit(1);
}

const adminBlock = adminMatch[1];

// Verificar se tem vírgulas entre os métodos GesOffice
const hasCommaAfterDeleteGesOfficePanel = /deleteGesOfficePanel:[^}]+},/.test(content);
const hasCommaAfterDeleteGesOfficeReseller = /deleteGesOfficeReseller:[^}]+},/.test(content);

console.log(`   Vírgula após deleteGesOfficePanel: ${hasCommaAfterDeleteGesOfficePanel ? '✅' : '⚠️'}`);
console.log(`   Vírgula após deleteGesOfficeReseller: ${hasCommaAfterDeleteGesOfficeReseller ? '✅' : '⚠️'}`);
console.log('');

// =====================================================
// TENTAR PARSEAR COMO JSON (SEM FUNÇÕES)
// =====================================================

console.log('🔍 Verificando estrutura de objeto...\n');

// Remover todas as funções e testar estrutura
let testContent = content
    .replace(/:\s*\([^)]*\)\s*=>[^,}]+/g, ': null')
    .replace(/window\.API\s*=\s*API;?/, '');

try {
    // Extrair apenas o objeto API
    const apiObjMatch = testContent.match(/const\s+API\s*=\s*({[\s\S]*?});/);
    if (apiObjMatch) {
        const apiObj = apiObjMatch[1];
        // Tentar avaliar
        eval('(' + apiObj + ')');
        console.log('   ✅ Estrutura de objeto válida\n');
    } else {
        console.log('   ⚠️  Não foi possível extrair objeto API\n');
    }
} catch (error) {
    console.log('   ❌ ERRO NA ESTRUTURA:', error.message);
    console.log('   Linha aproximada:', error.stack?.split('\n')[0]);
    console.log('');
}

// =====================================================
// VERIFICAR admin.html
// =====================================================

console.log('🔍 Verificando admin.html...\n');

if (fs.existsSync('public-recharge/admin.html')) {
    const htmlContent = fs.readFileSync('public-recharge/admin.html', 'utf8');
    const hasApiScript = htmlContent.includes('/js/shared/api.js');
    const apiScriptLine = htmlContent.split('\n').findIndex(line => line.includes('/js/shared/api.js'));
    const gesOfficePanelsScriptLine = htmlContent.split('\n').findIndex(line => line.includes('gesoffice-panels.js'));
    
    console.log(`   Script api.js carregado: ${hasApiScript ? '✅' : '❌'}`);
    
    if (hasApiScript && gesOfficePanelsScriptLine > -1) {
        const apiLoadedFirst = apiScriptLine < gesOfficePanelsScriptLine;
        console.log(`   api.js carregado ANTES de gesoffice-panels.js: ${apiLoadedFirst ? '✅' : '❌'}`);
        
        if (!apiLoadedFirst) {
            console.log('\n   ⚠️  PROBLEMA ENCONTRADO!');
            console.log('   O arquivo api.js DEVE ser carregado ANTES dos scripts admin!');
            console.log('');
            console.log('   Ordem correta:');
            console.log('   1. <script src="/js/shared/utils.js"></script>');
            console.log('   2. <script src="/js/shared/api.js"></script>');
            console.log('   3. <script src="/js/shared/components.js"></script>');
            console.log('   4. <script src="/js/admin/auth.js"></script>');
            console.log('   5. ... outros scripts admin ...');
            console.log('');
        }
    }
} else {
    console.log('   ⚠️  admin.html não encontrado\n');
}

// =====================================================
// RESUMO E RECOMENDAÇÕES
// =====================================================

console.log('='.repeat(80));
console.log('📋 RESUMO');
console.log('='.repeat(80) + '\n');

if (allFound && openBraces === closeBraces && openBrackets === closeBrackets && openParens === closeParens) {
    console.log('✅ Sintaxe do arquivo parece estar correta!\n');
    console.log('🔧 SOLUÇÕES PARA O ERRO no navegador:\n');
    console.log('1. LIMPAR CACHE DO NAVEGADOR:');
    console.log('   - Pressione Ctrl+Shift+R (hard refresh)');
    console.log('   - OU F12 > Application > Clear site data > Reload\n');
    console.log('2. VERIFICAR ORDEM DOS SCRIPTS no admin.html:');
    console.log('   - api.js deve vir ANTES de gesoffice-panels.js\n');
    console.log('3. REINICIAR O SERVIDOR:');
    console.log('   - pm2 restart sigma-recharge\n');
    console.log('4. TESTAR NO CONSOLE (F12):');
    console.log('   - Digite: API');
    console.log('   - Digite: API.admin');
    console.log('   - Digite: API.admin.getGesOfficePanels');
    console.log('   - Se algum retornar undefined, o arquivo não carregou\n');
    console.log('5. SE NADA FUNCIONAR:');
    console.log('   - Verifique logs do PM2: pm2 logs sigma-recharge');
    console.log('   - Verifique erros 404 na aba Network do DevTools');
    console.log('');
} else {
    console.log('⚠️  Possível problema de sintaxe detectado!\n');
    console.log('Execute: node force-fix-api.js\n');
}

console.log('='.repeat(80) + '\n');
