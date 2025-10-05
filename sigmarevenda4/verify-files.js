#!/usr/bin/env node

/**
 * Script de Verificação de Arquivos
 * Verifica se todos os arquivos necessários para o frontend modular foram criados
 * 
 * Uso: node verify-files.js
 */

const fs = require('fs');
const path = require('path');

// Cores para o terminal
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

// Lista de arquivos necessários
const requiredFiles = {
    'HTML': [
        'public-recharge/index.html',
        'public-recharge/admin.html'
    ],
    'CSS': [
        'public-recharge/css/main.css',
        'public-recharge/css/login.css',
        'public-recharge/css/dashboard.css',
        'public-recharge/css/components.css'
    ],
    'JS Shared': [
        'public-recharge/js/shared/utils.js',
        'public-recharge/js/shared/api.js',
        'public-recharge/js/shared/components.js'
    ],
    'JS Client': [
        'public-recharge/js/client/app.js',
        'public-recharge/js/client/auth.js',
        'public-recharge/js/client/packages.js',
        'public-recharge/js/client/payment.js',
        'public-recharge/js/client/dashboard.js'
    ],
    'JS Admin': [
        'public-recharge/js/admin/app.js',
        'public-recharge/js/admin/auth.js',
        'public-recharge/js/admin/dashboard.js',
        'public-recharge/js/admin/panels.js',
        'public-recharge/js/admin/resellers.js',
        'public-recharge/js/admin/packages.js',
        'public-recharge/js/admin/payments.js'
    ]
};

// Função para verificar se arquivo existe
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
}

// Função para verificar se arquivo está vazio
function isFileEmpty(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size === 0;
    } catch (error) {
        return true;
    }
}

// Função para obter tamanho do arquivo
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

// Função principal
function verifyFiles() {
    console.log('\n' + colors.cyan + colors.bold + '='.repeat(70));
    console.log('VERIFICAÇÃO DE ARQUIVOS - FRONTEND MODULAR');
    console.log('='.repeat(70) + colors.reset + '\n');

    let totalFiles = 0;
    let existingFiles = 0;
    let emptyFiles = 0;
    let missingFiles = [];

    // Verificar cada categoria
    for (const [category, files] of Object.entries(requiredFiles)) {
        console.log(colors.blue + colors.bold + `\n📁 ${category}:` + colors.reset);
        
        files.forEach(file => {
            totalFiles++;
            const exists = fileExists(file);
            const isEmpty = exists && isFileEmpty(file);
            const size = getFileSize(file);

            if (exists) {
                existingFiles++;
                
                if (isEmpty) {
                    emptyFiles++;
                    console.log(`  ${colors.yellow}⚠️  ${file}${colors.reset} ${colors.yellow}(vazio - 0 bytes)${colors.reset}`);
                } else {
                    const sizeKB = (size / 1024).toFixed(2);
                    console.log(`  ${colors.green}✅ ${file}${colors.reset} ${colors.cyan}(${sizeKB} KB)${colors.reset}`);
                }
            } else {
                missingFiles.push(file);
                console.log(`  ${colors.red}❌ ${file}${colors.reset} ${colors.red}(não encontrado)${colors.reset}`);
            }
        });
    }

    // Resumo
    console.log('\n' + colors.cyan + colors.bold + '='.repeat(70));
    console.log('RESUMO');
    console.log('='.repeat(70) + colors.reset);
    
    console.log(`\n📊 Total de arquivos: ${colors.bold}${totalFiles}${colors.reset}`);
    console.log(`${colors.green}✅ Existentes: ${existingFiles}${colors.reset}`);
    console.log(`${colors.red}❌ Faltando: ${missingFiles.length}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Vazios: ${emptyFiles}${colors.reset}`);

    // Porcentagem
    const percentage = ((existingFiles / totalFiles) * 100).toFixed(1);
    const percentageColor = percentage >= 100 ? colors.green : 
                           percentage >= 80 ? colors.yellow : 
                           colors.red;
    
    console.log(`\n${percentageColor}📈 Progresso: ${percentage}%${colors.reset}`);

    // Barra de progresso
    const barLength = 50;
    const filledLength = Math.round((existingFiles / totalFiles) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    console.log(`${percentageColor}[${bar}]${colors.reset}`);

    // Arquivos faltando
    if (missingFiles.length > 0) {
        console.log('\n' + colors.red + colors.bold + '⚠️  ARQUIVOS FALTANDO:' + colors.reset);
        missingFiles.forEach(file => {
            console.log(`  ${colors.red}• ${file}${colors.reset}`);
        });
    }

    // Arquivos vazios
    if (emptyFiles > 0) {
        console.log('\n' + colors.yellow + colors.bold + '⚠️  ARQUIVOS VAZIOS (necessário adicionar conteúdo):' + colors.reset);
        
        for (const [category, files] of Object.entries(requiredFiles)) {
            files.forEach(file => {
                if (fileExists(file) && isFileEmpty(file)) {
                    console.log(`  ${colors.yellow}• ${file}${colors.reset}`);
                }
            });
        }
    }

    // Verificação de estrutura de pastas
    console.log('\n' + colors.blue + colors.bold + '📂 ESTRUTURA DE PASTAS:' + colors.reset);
    
    const requiredDirs = [
        'public-recharge',
        'public-recharge/css',
        'public-recharge/js',
        'public-recharge/js/shared',
        'public-recharge/js/client',
        'public-recharge/js/admin'
    ];

    let allDirsExist = true;
    requiredDirs.forEach(dir => {
        const exists = fs.existsSync(dir);
        if (exists) {
            console.log(`  ${colors.green}✅ ${dir}/${colors.reset}`);
        } else {
            console.log(`  ${colors.red}❌ ${dir}/${colors.reset}`);
            allDirsExist = false;
        }
    });

    // Status final
    console.log('\n' + colors.cyan + colors.bold + '='.repeat(70) + colors.reset);
    
    if (missingFiles.length === 0 && emptyFiles === 0 && allDirsExist) {
        console.log(colors.green + colors.bold + '\n✅ SUCESSO! Todos os arquivos foram criados e preenchidos!' + colors.reset);
        console.log(colors.green + '🚀 O frontend está 100% modularizado e pronto para uso!\n' + colors.reset);
    } else if (missingFiles.length === 0 && emptyFiles > 0) {
        console.log(colors.yellow + colors.bold + '\n⚠️  ATENÇÃO! Todos os arquivos foram criados, mas alguns estão vazios.' + colors.reset);
        console.log(colors.yellow + '📝 Preencha os arquivos vazios com o conteúdo dos artifacts.\n' + colors.reset);
    } else {
        console.log(colors.red + colors.bold + '\n❌ INCOMPLETO! Alguns arquivos ainda não foram criados.' + colors.reset);
        console.log(colors.yellow + '📝 Crie os arquivos faltando e preencha com o conteúdo dos artifacts.\n' + colors.reset);
    }

    console.log(colors.cyan + colors.bold + '='.repeat(70) + colors.reset + '\n');

    // Retornar código de saída
    process.exit(missingFiles.length > 0 || emptyFiles > 0 ? 1 : 0);
}

// Executar
verifyFiles();
