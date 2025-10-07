#!/usr/bin/env node

/**
 * Script para mover databases existentes para a pasta databases/
 * Uso: node move-databases-to-folder.js
 */

const fs = require('fs');
const path = require('path');

console.log('');
console.log('═'.repeat(60));
console.log('MOVER DATABASES PARA PASTA ORGANIZADA');
console.log('═'.repeat(60));
console.log('');

// Criar pasta databases se não existir
const dbDir = path.join(__dirname, 'databases');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✓ Pasta databases/ criada');
} else {
    console.log('✓ Pasta databases/ já existe');
}

// Procurar todos os arquivos .db na raiz do projeto
const files = fs.readdirSync(__dirname);
const dbFiles = files.filter(file => 
    file.endsWith('.db') && 
    !file.startsWith('.')
);

if (dbFiles.length === 0) {
    console.log('');
    console.log('⚠️  Nenhum arquivo .db encontrado na raiz do projeto');
    console.log('');
    console.log('Se você já moveu os arquivos, está tudo certo!');
    console.log('Se não, verifique se os databases estão em outro local.');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    process.exit(0);
}

console.log('');
console.log(`Encontrados ${dbFiles.length} arquivo(s) .db na raiz:`);
console.log('');

let moved = 0;
let skipped = 0;
let errors = 0;

dbFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file);
    const destPath = path.join(dbDir, file);
    
    // Verificar se o arquivo já existe no destino
    if (fs.existsSync(destPath)) {
        console.log(`⚠️  ${file} - já existe no destino (pulado)`);
        skipped++;
        return;
    }
    
    try {
        // Mover arquivo
        fs.renameSync(sourcePath, destPath);
        console.log(`✓ ${file} - movido com sucesso`);
        moved++;
    } catch (error) {
        console.log(`✗ ${file} - erro ao mover: ${error.message}`);
        errors++;
    }
});

console.log('');
console.log('═'.repeat(60));
console.log('RESULTADO');
console.log('═'.repeat(60));
console.log('');
console.log(`✓ Movidos: ${moved}`);
console.log(`⚠️  Pulados: ${skipped}`);
console.log(`✗ Erros: ${errors}`);
console.log('');

if (moved > 0) {
    console.log('Arquivos movidos para: databases/');
    console.log('');
    console.log('Próximos passos:');
    console.log('  1. Verifique se tudo está funcionando');
    console.log('  2. Reinicie o servidor: pm2 restart sigma-recharge');
    console.log('  3. Teste o login no painel admin');
    console.log('');
}

console.log('═'.repeat(60));
console.log('');
