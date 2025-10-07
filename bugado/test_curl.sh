#!/bin/bash
# Script de teste manual com cURL
# Este script vai replicar EXATAMENTE a requisição que o navegador faz

echo "🧪 Teste Manual de Recarga com cURL"
echo "===================================="
echo ""

# Variáveis (substitua com seus valores atuais)
PHPSESSID="m9ihg3nkltus7egckopfboeie7"  # Do último teste
TKN="b38b12de0c52e60436e7e764e05c6719f22f55a1cfca3152766f22e7d9d22c871dbbb7d231eee381bfc80cb10581480d65f8349b0b367e0b576776285c8f8c47"  # Do último teste
RECAPTCHA_TOKEN="0cAFcWeA5yxU4tTM5uxWEVMHEfxciMg8CtATBT_DTXeeJi7KKgEXKe7A4QaF21T-nLDn7ut4x4_vYHWPrS5GzHAEAN2nFiUHiJRSBrPCRXw9w4K3QFWf856ChzMoFAw6Bj7mYDe7TlAH_qO8MwFD1iUMJBpSjehR0oiw69ekTljS1v-oHES3KW4WRkZORbPYiOlo_af16MonQnL24GCS9n8ZUPqIvLW3CJ_dDq5DDUKBevKU-m_2FD7hzEJZS8xqTdR2CcS2pk8f2UbBYiqqoLs9eDOBAGs5nnQhSxZoHSNgxNe0aR8WA7-BnSggUH_x6nVrBc5nyCYXa0uF5MsdNctAMpQSKyN02nhmR3MQb6urPE2HQ7PlHotsKW81ncbtqHBFJE9WDMQOWuxCzb7I8HdwPGd1GkE7Pj0fLXT8s0aET9Famz7rEDB1krTfN3IjB52Y9-2yk4GiIShvGog8v_YMtg28513hRz72DCkbT1w_9gkCqX48pZKVtxqOcUj8SqeW1-GbeqoklcQzRsCKwEstCYpBwSDVuuitW-pjPsj4zNFO3GscBCsKMnuW8vX_vp82RovW9w5OucjOC9E1RlwIPhxlY-AK9hiwgvzczYYDCy5ctEagHakN7CT6pgqtcg5pnYWzNUUtewjDDI8D4gI2rUqkO3YfSgymuhv8BRrsOYWqgpJlbnkD1y-nNFA9rxdXGEU6MSOx-Ib_ThI1ZyECJuh3GkEo2mPhVQ7w6oUDvdmLX3DFLIwN3if9bYYP0YGi9liew0oj44_IMK5z8FiM7L_CwxbXkeT-xS29CIj_J_5pNWtJOZYbg"
RESELLER_ID="137729"

echo "📋 Dados a serem usados:"
echo "  PHPSESSID: ${PHPSESSID:0:20}..."
echo "  TKN: ${TKN:0:20}..."
echo "  RESELLER_ID: $RESELLER_ID"
echo ""

# Teste 1: Com header tkn
echo "🧪 TESTE 1: Com header 'tkn'"
echo "----------------------------"
curl -v -X POST "https://pdcapi.io/revendedores/$RESELLER_ID/creditos/adicionar" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Cookie: PHPSESSID=$PHPSESSID" \
  -H "tkn: $TKN" \
  -H "Origin: https://dashboard.bz" \
  -H "Referer: https://dashboard.bz/revendedores.php" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data-urlencode "amount=1" \
  --data-urlencode "reason=" \
  --data-urlencode "g-recaptcha-response=$RECAPTCHA_TOKEN"

echo ""
echo ""

# Teste 2: Com token no body
echo "🧪 TESTE 2: Com 'tkn' no body"
echo "----------------------------"
curl -v -X POST "https://pdcapi.io/revendedores/$RESELLER_ID/creditos/adicionar" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Cookie: PHPSESSID=$PHPSESSID" \
  -H "Origin: https://dashboard.bz" \
  -H "Referer: https://dashboard.bz/revendedores.php" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data-urlencode "amount=1" \
  --data-urlencode "reason=" \
  --data-urlencode "tkn=$TKN" \
  --data-urlencode "g-recaptcha-response=$RECAPTCHA_TOKEN"

echo ""
echo ""

# Teste 3: Com ambos
echo "🧪 TESTE 3: Com 'tkn' no header E no body"
echo "----------------------------"
curl -v -X POST "https://pdcapi.io/revendedores/$RESELLER_ID/creditos/adicionar" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Cookie: PHPSESSID=$PHPSESSID" \
  -H "tkn: $TKN" \
  -H "Origin: https://dashboard.bz" \
  -H "Referer: https://dashboard.bz/revendedores.php" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  --data-urlencode "amount=1" \
  --data-urlencode "reason=" \
  --data-urlencode "tkn=$TKN" \
  --data-urlencode "g-recaptcha-response=$RECAPTCHA_TOKEN"

echo ""
echo "✅ Testes concluídos!"
