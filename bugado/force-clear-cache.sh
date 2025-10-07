#!/bin/bash

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  🔥 FORÇAR LIMPEZA DE CACHE - GESOFFICE"
echo "════════════════════════════════════════════════════════════════"
echo ""

# 1. Parar servidor
echo "📋 1. Parando servidor..."
pm2 stop sigma-recharge

echo ""
echo "📋 2. Adicionando versão aos arquivos JS..."
echo ""

# Timestamp único
VERSION=$(date +%s)

# Backup
cp public-recharge/admin.html public-recharge/admin.html.backup-$VERSION

# Adicionar versão em TODOS os scripts
sed -i "s|/js/shared/utils.js|/js/shared/utils.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/shared/api.js|/js/shared/api.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/shared/components.js|/js/shared/components.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/auth.js|/js/admin/auth.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/dashboard.js|/js/admin/dashboard.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/panels.js|/js/admin/panels.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/resellers.js|/js/admin/resellers.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/packages.js|/js/admin/packages.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/koffice-panels.js|/js/admin/koffice-panels.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/koffice-resellers.js|/js/admin/koffice-resellers.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/koffice-packages.js|/js/admin/koffice-packages.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/gesoffice-panels.js|/js/admin/gesoffice-panels.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/gesoffice-resellers.js|/js/admin/gesoffice-resellers.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/gesoffice-packages.js|/js/admin/gesoffice-packages.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/payments.js|/js/admin/payments.js?v=$VERSION|g" public-recharge/admin.html
sed -i "s|/js/admin/app.js|/js/admin/app.js?v=$VERSION|g" public-recharge/admin.html

echo "   ✅ Versão $VERSION adicionada"

echo ""
echo "📋 3. Reiniciando servidor..."
echo ""

pm2 start sigma-recharge

sleep 3

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ CACHE FORÇADO A LIMPAR!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🎯 AGORA FAÇA ISSO NO NAVEGADOR:"
echo ""
echo "1. Feche TODAS as abas do admin"
echo ""
echo "2. Pressione CTRL + SHIFT + DELETE"
echo "   - Marque: Imagens e arquivos em cache"
echo "   - Período: Última hora"
echo "   - Clique em Limpar dados"
echo ""
echo "3. Abra NOVA aba anônima (CTRL + SHIFT + N)"
echo ""
echo "4. Acesse: http://localhost:3010/admin.html?v=$VERSION"
echo ""
echo "5. Faça login"
echo ""
echo "6. Abra console (F12) e digite:"
echo "   typeof API.admin.getGesOfficePanels"
echo ""
echo "   DEVE RETORNAR: 'function'"
echo ""
echo "7. Se retornar 'function', clique em 🔵 Painéis UNIPLAY"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "💾 Backup salvo em: admin.html.backup-$VERSION"
echo ""
