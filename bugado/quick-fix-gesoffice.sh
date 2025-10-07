#!/bin/bash

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  🔧 CORREÇÃO RÁPIDA - PROBLEMA GESOFFICE"
echo "════════════════════════════════════════════════════════════════"
echo ""

# 1. Verificar se admin.html tem os scripts na ordem correta
echo "📋 1. Verificando ordem dos scripts em admin.html..."
echo ""

if grep -q "gesoffice-panels.js" public-recharge/admin.html; then
    echo "   ✅ Script gesoffice-panels.js encontrado"
else
    echo "   ❌ Script gesoffice-panels.js NÃO encontrado"
fi

if grep -q "gesoffice-resellers.js" public-recharge/admin.html; then
    echo "   ✅ Script gesoffice-resellers.js encontrado"
else
    echo "   ❌ Script gesoffice-resellers.js NÃO encontrado"
fi

if grep -q "gesoffice-packages.js" public-recharge/admin.html; then
    echo "   ✅ Script gesoffice-packages.js encontrado"
else
    echo "   ❌ Script gesoffice-packages.js NÃO encontrado"
fi

echo ""
echo "📋 2. Verificando se api.js está ANTES dos scripts gesoffice..."
echo ""

# Pegar linha do api.js
API_LINE=$(grep -n "api.js" public-recharge/admin.html | head -1 | cut -d: -f1)
# Pegar linha do gesoffice-panels.js
GESOFFICE_LINE=$(grep -n "gesoffice-panels.js" public-recharge/admin.html | head -1 | cut -d: -f1)

if [ -z "$API_LINE" ]; then
    echo "   ❌ api.js não encontrado no admin.html!"
elif [ -z "$GESOFFICE_LINE" ]; then
    echo "   ⚠️  gesoffice-panels.js não encontrado no admin.html!"
elif [ "$API_LINE" -lt "$GESOFFICE_LINE" ]; then
    echo "   ✅ api.js (linha $API_LINE) está ANTES de gesoffice-panels.js (linha $GESOFFICE_LINE)"
else
    echo "   ❌ api.js (linha $API_LINE) está DEPOIS de gesoffice-panels.js (linha $GESOFFICE_LINE)"
    echo "   ⚠️  ISSO PODE CAUSAR O ERRO!"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  🔄 APLICANDO CORREÇÕES"
echo "════════════════════════════════════════════════════════════════"
echo ""

# 3. Limpar cache do navegador forçando reload
echo "📋 3. Adicionando timestamp aos scripts para forçar reload..."
echo ""

TIMESTAMP=$(date +%s)

# Criar backup
cp public-recharge/admin.html public-recharge/admin.html.backup

# Adicionar timestamp nos imports dos scripts gesoffice
sed -i "s|gesoffice-panels.js\"|gesoffice-panels.js?v=$TIMESTAMP\"|g" public-recharge/admin.html
sed -i "s|gesoffice-resellers.js\"|gesoffice-resellers.js?v=$TIMESTAMP\"|g" public-recharge/admin.html
sed -i "s|gesoffice-packages.js\"|gesoffice-packages.js?v=$TIMESTAMP\"|g" public-recharge/admin.html

echo "   ✅ Timestamp adicionado aos scripts"
echo ""

# 4. Reiniciar servidor
echo "📋 4. Reiniciando servidor..."
echo ""

pm2 restart sigma-recharge

sleep 2

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ CORREÇÃO APLICADA!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Abra o admin no navegador:"
echo "   http://localhost:3010/admin.html"
echo ""
echo "2. Pressione CTRL + SHIFT + R (hard refresh)"
echo ""
echo "3. Abra o Console (F12) e digite:"
echo "   API.admin.getGesOfficePanels"
echo ""
echo "   Deve retornar: () => API.get('/api/admin/gesoffice-panels')"
echo ""
echo "4. Faça login como admin"
echo ""
echo "5. Tente cadastrar um painel UNIPLAY"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
