#!/bin/bash

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  🔨 CORREÇÃO MANUAL - RECRIAR api.js COM TIMESTAMP"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Criar backup
TIMESTAMP=$(date +%s)
cp public-recharge/js/shared/api.js public-recharge/js/shared/api.js.backup-$TIMESTAMP

echo "📋 Backup criado: api.js.backup-$TIMESTAMP"
echo ""

# Adicionar comentário com timestamp no início do arquivo
# Isso força o navegador a ver como arquivo "novo"
echo "// Updated: $TIMESTAMP - GesOffice Methods Added" > /tmp/api-header.js
cat public-recharge/js/shared/api.js >> /tmp/api-header.js
mv /tmp/api-header.js public-recharge/js/shared/api.js

echo "✅ Timestamp adicionado ao api.js"
echo ""

# Verificar se métodos GesOffice estão presentes
if grep -q "getGesOfficePanels" public-recharge/js/shared/api.js; then
    echo "✅ Métodos GesOffice encontrados no arquivo"
else
    echo "❌ ERRO: Métodos GesOffice NÃO estão no arquivo!"
    echo ""
    echo "Restaurando backup..."
    cp public-recharge/js/shared/api.js.backup-$TIMESTAMP public-recharge/js/shared/api.js
    exit 1
fi

echo ""
echo "📋 Conteúdo do api.js (métodos GesOffice):"
echo ""
grep -A 8 "Painéis GesOffice" public-recharge/js/shared/api.js

echo ""
echo "📋 Reiniciando servidor..."
pm2 restart sigma-recharge

sleep 2

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ ARQUIVO ATUALIZADO!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🔥 ÚLTIMA TENTATIVA - TESTE NO NAVEGADOR:"
echo ""
echo "1. Abra aba anônima (CTRL + SHIFT + N)"
echo ""
echo "2. Cole esta URL (vai forçar reload):"
echo "   http://localhost:3010/admin.html?nocache=$TIMESTAMP"
echo ""
echo "3. Abra console (F12) e cole isso:"
echo ""
cat << 'EOF'
// Forçar reload do api.js
var script = document.createElement('script');
script.src = '/js/shared/api.js?t=' + Date.now();
document.head.appendChild(script);

// Aguardar 1 segundo e testar
setTimeout(() => {
    console.log('Testando API.admin.getGesOfficePanels:');
    console.log(typeof API.admin.getGesOfficePanels);
    
    if (typeof API.admin.getGesOfficePanels === 'function') {
        console.log('✅ FUNCIONOU! Métodos GesOffice carregados!');
    } else {
        console.log('❌ AINDA NÃO FUNCIONOU');
        console.log('Métodos disponíveis:', Object.keys(API.admin).filter(k => k.includes('GesOffice')));
    }
}, 1000);
EOF

echo ""
echo "4. Se mostrar '✅ FUNCIONOU!', recarregue a página normalmente"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
