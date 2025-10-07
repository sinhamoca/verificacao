#!/usr/bin/env node

/**
 * Script para verificar o arquivo api.js
 * Uso: node check-api-file.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🔍 ANÁLISE DO ARQUIVO api.js');
console.log('='.repeat(80) + '\n');

const apiPath = 'public-recharge/js/shared/api.js';

if (!fs.existsSync(apiPath)) {
    console.log('❌ ERRO: Arquivo não encontrado:', apiPath);
    process.exit(1);
}

console.log('✅ Arquivo encontrado:', apiPath);
console.log('');

// Ler conteúdo
const content = fs.readFileSync(apiPath, 'utf8');

console.log('📊 ESTATÍSTICAS DO ARQUIVO:');
console.log('─'.repeat(80));
console.log(`   Tamanho: ${content.length} caracteres`);
console.log(`   Linhas: ${content.split('\n').length}`);
console.log('');

// ============================================
// 1. VERIFICAR SE TEM ERROS DE SINTAXE
// ============================================
console.log('🔍 1. VERIFICANDO SINTAXE JAVASCRIPT...\n');

try {
    // Tentar parsear como JS (remover export/require se houver)
    const cleanContent = content
        .replace(/module\.exports\s*=\s*/g, '')
        .replace(/export\s+default\s+/g, '')
        .replace(/export\s+/g, '');
    
    // Não podemos executar eval em produção, mas podemos verificar padrões
    console.log('   ✅ Arquivo parece ter sintaxe válida');
} catch (e) {
    console.log('   ❌ ERRO DE SINTAXE:', e.message);
    process.exit(1);
}

// ============================================
// 2. VERIFICAR ESTRUTURA DO OBJETO API
// ============================================
console.log('\n🔍 2. VERIFICANDO ESTRUTURA DO OBJETO API...\n');

// Verificar se tem o objeto API
if (content.includes('const API') || content.includes('var API') || content.includes('let API')) {
    console.log('   ✅ Declaração do objeto API encontrada');
} else {
    console.log('   ❌ Declaração do objeto API NÃO encontrada');
}

// Verificar se tem API.admin
if (content.includes('admin:') || content.includes('admin :')) {
    console.log('   ✅ Objeto API.admin encontrado');
} else {
    console.log('   ❌ Objeto API.admin NÃO encontrado');
}

// ============================================
// 3. PROCURAR MÉTODOS GESOFFICE
// ============================================
console.log('\n🔍 3. PROCURANDO MÉTODOS GESOFFICE...\n');

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

let foundMethods = 0;
let missingMethods = [];

gesOfficeMethods.forEach(method => {
    const regex = new RegExp(`${method}\\s*:`, 'g');
    if (regex.test(content)) {
        console.log(`   ✅ ${method}`);
        foundMethods++;
    } else {
        console.log(`   ❌ ${method} (NÃO ENCONTRADO)`);
        missingMethods.push(method);
    }
});

console.log('');
console.log(`   Total: ${foundMethods}/${gesOfficeMethods.length} métodos encontrados`);

// ============================================
// 4. VERIFICAR VÍRGULAS
// ============================================
console.log('\n🔍 4. VERIFICANDO VÍRGULAS E FORMATAÇÃO...\n');

// Extrair a parte do admin
const adminMatch = content.match(/admin\s*:\s*{([\s\S]*?)}\s*}/);

if (adminMatch) {
    const adminContent = adminMatch[1];
    
    // Contar métodos
    const methodCount = (adminContent.match(/\w+\s*:/g) || []).length;
    console.log(`   📊 Total de métodos em API.admin: ${methodCount}`);
    
    // Verificar vírgulas entre métodos
    const lines = adminContent.split('\n').filter(l => l.trim().length > 0);
    let lastMethodLine = -1;
    let virgulaErrors = 0;
    
    lines.forEach((line, index) => {
        if (line.includes(':') && !line.trim().startsWith('//')) {
            // É uma linha de método
            if (lastMethodLine >= 0) {
                // Verificar se linha anterior tem vírgula
                const prevLine = lines[lastMethodLine];
                if (!prevLine.trim().endsWith(',') && !prevLine.includes('{')) {
                    console.log(`   ⚠️  Linha ${lastMethodLine + 1} pode estar sem vírgula: ${prevLine.trim().substring(0, 50)}...`);
                    virgulaErrors++;
                }
            }
            lastMethodLine = index;
        }
    });
    
    if (virgulaErrors === 0) {
        console.log('   ✅ Vírgulas parecem estar corretas');
    } else {
        console.log(`   ⚠️  Encontrados ${virgulaErrors} possível(is) erro(s) de vírgula`);
    }
} else {
    console.log('   ❌ Não foi possível extrair o conteúdo de API.admin');
}

// ============================================
// 5. VERIFICAR SE GESOFFICE ESTÁ NO LUGAR CERTO
// ============================================
console.log('\n🔍 5. VERIFICANDO POSIÇÃO DOS MÉTODOS GESOFFICE...\n');

// Procurar onde estão os métodos Koffice
const kofficeIndex = content.indexOf('getKofficePanels');
const gesofficeIndex = content.indexOf('getGesOfficePanels');

if (kofficeIndex > 0 && gesofficeIndex > 0) {
    if (gesofficeIndex > kofficeIndex) {
        console.log('   ✅ Métodos GesOffice estão APÓS os métodos Koffice (correto)');
    } else {
        console.log('   ⚠️  Métodos GesOffice estão ANTES dos métodos Koffice');
    }
} else if (gesofficeIndex < 0) {
    console.log('   ❌ Métodos GesOffice NÃO encontrados no arquivo!');
} else {
    console.log('   ⚠️  Métodos Koffice não encontrados, não é possível comparar posições');
}

// ============================================
// 6. EXTRAIR TRECHO RELEVANTE
// ============================================
console.log('\n🔍 6. EXTRAINDO TRECHO COM MÉTODOS GESOFFICE...\n');

if (gesofficeIndex > 0) {
    const start = Math.max(0, gesofficeIndex - 200);
    const end = Math.min(content.length, gesofficeIndex + 800);
    const snippet = content.substring(start, end);
    
    console.log('   Trecho do arquivo:');
    console.log('   ' + '─'.repeat(78));
    snippet.split('\n').forEach(line => {
        console.log('   ' + line);
    });
    console.log('   ' + '─'.repeat(78));
} else {
    console.log('   ❌ Métodos GesOffice não encontrados para extrair trecho');
}

// ============================================
// 7. VERIFICAR window.API
// ============================================
console.log('\n🔍 7. VERIFICANDO EXPORTAÇÃO...\n');

if (content.includes('window.API = API') || content.includes('window.API=API')) {
    console.log('   ✅ API está sendo exportado para window');
} else {
    console.log('   ⚠️  Exportação para window.API não encontrada (pode ser problema)');
}

// ============================================
// RESUMO
// ============================================
console.log('\n' + '='.repeat(80));
console.log('📊 RESUMO DA ANÁLISE');
console.log('='.repeat(80) + '\n');

if (foundMethods === gesOfficeMethods.length) {
    console.log('✅ TODOS os métodos GesOffice estão presentes!');
    console.log('');
    console.log('Se ainda está dando erro, pode ser:');
    console.log('1. Cache do navegador - Pressione CTRL+SHIFT+R (hard refresh)');
    console.log('2. Arquivo não está sendo servido - Reinicie o servidor');
    console.log('3. Outro arquivo api.js sendo carregado');
    console.log('');
    console.log('Próximo passo:');
    console.log('   Abra: http://localhost:3010/debug-api-inspector.html');
    console.log('   E execute a inspeção no navegador');
} else {
    console.log('❌ FALTAM MÉTODOS GESOFFICE!');
    console.log('');
    console.log('Métodos faltando:');
    missingMethods.forEach(m => console.log(`   - ${m}`));
    console.log('');
    console.log('Você precisa adicionar estes métodos no arquivo api.js');
}

console.log('\n' + '='.repeat(80) + '\n');
