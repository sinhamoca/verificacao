#!/bin/bash

# Teste de Proxy para Koffice
# Verifica se o proxy está funcionando corretamente

echo "🧪 TESTE DE PROXY - KOFFICE"
echo "======================================"
echo ""

# 1. Testar proxy básico
echo "1️⃣ Testando proxy básico..."
echo ""
proxychains4 curl -I https://google.com 2>&1 | head -n 20
echo ""

# 2. Testar proxy com painel Koffice
echo "2️⃣ Testando proxy com painel Koffice..."
echo ""
read -p "Digite a URL do painel Koffice (ex: https://painel.acticon.top): " PAINEL_URL
echo ""
proxychains4 curl -I "$PAINEL_URL" 2>&1 | head -n 20
echo ""

# 3. Testar sem proxy
echo "3️⃣ Testando SEM proxy (direto)..."
echo ""
curl -I "$PAINEL_URL" 2>&1 | head -n 20
echo ""

# 4. Verificar latência
echo "4️⃣ Verificando latência..."
echo ""
echo "COM proxy:"
time proxychains4 curl -s "$PAINEL_URL/login/" -o /dev/null 2>&1 | grep real
echo ""
echo "SEM proxy:"
time curl -s "$PAINEL_URL/login/" -o /dev/null | grep real
echo ""

echo "======================================"
echo "✅ Teste concluído!"
echo ""
echo "📊 Análise:"
echo "- Se AMBOS funcionarem: Proxy OK, use qualquer um"
echo "- Se SÓ DIRETO funcionar: Proxy bloqueado, desabilite"
echo "- Se SÓ PROXY funcionar: IP bloqueado, proxy necessário"
echo ""
