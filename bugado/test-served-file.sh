#!/bin/bash

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  🔍 VERIFICAR ARQUIVO SERVIDO PELO SERVIDOR"
echo "════════════════════════════════════════════════════════════════"
echo ""

# 1. Verificar arquivo no disco
echo "📋 1. ARQUIVO NO DISCO (public-recharge/js/shared/api.js):"
echo ""
echo "Procurando por 'getGesOfficePanels'..."
grep -n "getGesOfficePanels" public-recharge/js/shared/api.js | head -5

echo ""
echo "Contagem de métodos GesOffice no disco:"
grep -c "GesOffice" public-recharge/js/shared/api.js

# 2. Verificar arquivo servido pelo servidor
echo ""
echo "📋 2. ARQUIVO SERVIDO PELO SERVIDOR (http://localhost:3010):"
echo ""
echo "Procurando por 'getGesOfficePanels'..."
curl -s http://localhost:3010/js/shared/api.js | grep -n "getGesOfficePanels" | head -5

echo ""
echo "Contagem de métodos GesOffice servidos:"
curl -s http://localhost:3010/js/shared/api.js | grep -c "GesOffice"

# 3. Comparar tamanhos
echo ""
echo "📋 3. COMPARAÇÃO DE TAMANHOS:"
echo ""

SIZE_DISK=$(wc -c < public-recharge/js/shared/api.js)
SIZE_SERVER=$(curl -s http://localhost:3010/js/shared/api.js | wc -c)

echo "Tamanho no disco: $SIZE_DISK bytes"
echo "Tamanho servido:  $SIZE_SERVER bytes"

if [ "$SIZE_DISK" -ne "$SIZE_SERVER" ]; then
    echo ""
    echo "❌ PROBLEMA: Tamanhos diferentes!"
    echo "O servidor está servindo arquivo diferente do disco!"
else
    echo ""
    echo "✅ Tamanhos iguais"
fi

# 4. Verificar se métodos existem
echo ""
echo "📋 4. MÉTODOS GESOFFICE NO ARQUIVO SERVIDO:"
echo ""

curl -s http://localhost:3010/js/shared/api.js | grep "GesOffice" | head -10

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Salvar arquivo servido para comparação
curl -s http://localhost:3010/js/shared/api.js > /tmp/api-served.js

if grep -q "getGesOfficePanels" /tmp/api-served.js; then
    echo "✅ ARQUIVO SERVIDO CONTÉM getGesOfficePanels"
    echo ""
    echo "O problema então está no NAVEGADOR (cache do browser)"
    echo ""
    echo "SOLUÇÃO:"
    echo "1. Feche TODAS as abas do admin"
    echo "2. Limpe cache: CTRL+SHIFT+DELETE"
    echo "3. Abra aba ANÔNIMA: CTRL+SHIFT+N"
    echo "4. Acesse: http://localhost:3010/admin.html"
else
    echo "❌ ARQUIVO SERVIDO NÃO CONTÉM getGesOfficePanels"
    echo ""
    echo "O problema está no SERVIDOR!"
    echo ""
    echo "SOLUÇÃO:"
    echo "Execute: ./force-server-reload.sh"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
