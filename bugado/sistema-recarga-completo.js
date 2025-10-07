const axios = require('axios');

class GesOfficeAPI {
    constructor() {
        this.baseURL = 'https://gesapioffice.com';
        this.token = null;
        this.userInfo = null;
    }

    async login(username, password) {
        try {
            console.log('\n🔐 Fazendo login...');
            console.log(`   Usuário: ${username}`);
            
            const loginData = {
                username: username,
                password: password,
                code: ""
            };

            const response = await axios.post(`${this.baseURL}/api/login`, loginData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                    'Origin': 'https://onlineoffice.zip',
                    'Referer': 'https://onlineoffice.zip/',
                    'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'cross-site'
                },
                timeout: 30000,
                validateStatus: (status) => status < 500
            });

            if (response.status === 200 && response.data.access_token) {
                this.token = response.data.access_token;
                this.userInfo = {
                    id: response.data.id,
                    username: response.data.username,
                    tokenType: response.data.token_type,
                    expiresIn: response.data.expires_in,
                    cryptPass: response.data.crypt_pass,
                    whatsappEnable: response.data.whatsapp_enable
                };

                console.log('   ✅ Login realizado com sucesso!');
                console.log(`   Token expira em: ${Math.floor(this.userInfo.expiresIn / 3600)} horas\n`);

                return { success: true, data: response.data };
            }

            console.log('   ❌ Falha no login');
            return { success: false, error: response.data, status: response.status };

        } catch (error) {
            console.log('   ❌ Erro no login:', error.message);
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async recarregarRevendedor(revendedorId, creditos, action = 0, sale = "", reason = "") {
        if (!this.token) {
            return { success: false, error: 'Token não disponível. Faça login primeiro.' };
        }

        try {
            console.log('\n💳 Processando recarga...');
            console.log(`   Revendedor ID: ${revendedorId}`);
            console.log(`   Créditos: ${creditos}`);
            console.log(`   Ação: ${action === 0 ? 'Adicionar' : 'Remover'}`);

            const recargaData = {
                action: action,
                credits: String(creditos),
                sale: sale,
                reason: reason
            };

            const response = await axios.put(
                `${this.baseURL}/api/reg-users/${revendedorId}`,
                recargaData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                        'Origin': 'https://onlineoffice.zip',
                        'Referer': 'https://onlineoffice.zip/',
                        'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Windows"',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'cross-site'
                    },
                    timeout: 30000,
                    validateStatus: (status) => status < 500
                }
            );

            if (response.status === 200) {
                console.log('   ✅ Recarga realizada com sucesso!\n');
                console.log('   Resposta da API:');
                console.log('   ' + JSON.stringify(response.data, null, 2).replace(/\n/g, '\n   '));
                
                return {
                    success: true,
                    data: response.data,
                    status: response.status
                };
            }

            console.log('   ❌ Falha na recarga');
            console.log('   Status:', response.status);
            console.log('   Resposta:', response.data);

            return {
                success: false,
                error: response.data,
                status: response.status
            };

        } catch (error) {
            console.log('   ❌ Erro na recarga:', error.message);
            
            if (error.response) {
                console.log('   Status:', error.response.status);
                console.log('   Dados:', error.response.data);
            }

            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    async recarregarMultiplosRevendedores(revendedores) {
        console.log(`\n📋 Processando ${revendedores.length} recargas...\n`);
        
        const resultados = [];

        for (let i = 0; i < revendedores.length; i++) {
            const { id, creditos, action, sale, reason } = revendedores[i];
            
            console.log(`[${i + 1}/${revendedores.length}] ────────────────────────────────`);
            
            const resultado = await this.recarregarRevendedor(id, creditos, action, sale, reason);
            
            resultados.push({
                revendedorId: id,
                creditos: creditos,
                sucesso: resultado.success,
                resposta: resultado.data || resultado.error
            });

            // Aguardar 1 segundo entre requisições para não sobrecarregar
            if (i < revendedores.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return resultados;
    }
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL - EXECUTE AQUI
// ═══════════════════════════════════════════════════════════════

async function executarRecarga() {
    console.log('═══════════════════════════════════════════════════');
    console.log('     SISTEMA DE RECARGA AUTOMÁTICA - GES OFFICE');
    console.log('═══════════════════════════════════════════════════\n');

    // Capturar argumentos da linha de comando
    const args = process.argv.slice(2);

    // Validar argumentos
    if (args.length < 4) {
        console.log('❌ Argumentos insuficientes!\n');
        console.log('📖 USO CORRETO:');
        console.log('   proxychains4 node sistema-recarga-completo.js <usuario> <senha> <revendedor_id> <creditos> [action]\n');
        console.log('📝 EXEMPLOS:');
        console.log('   proxychains4 node sistema-recarga-completo.js claro11880 @padrouni105 90284 10');
        console.log('   proxychains4 node sistema-recarga-completo.js claro11880 @padrouni105 90284 10 0\n');
        console.log('📋 PARÂMETROS:');
        console.log('   <usuario>        - Seu nome de usuário');
        console.log('   <senha>          - Sua senha');
        console.log('   <revendedor_id>  - ID do revendedor alvo');
        console.log('   <creditos>       - Quantidade de créditos');
        console.log('   [action]         - Opcional: 0=adicionar (padrão) | 1=remover\n');
        process.exit(1);
    }

    const USERNAME = args[0];
    const PASSWORD = args[1];
    const REVENDEDOR_ID = args[2];
    const CREDITOS = parseInt(args[3]);
    const ACTION = args[4] ? parseInt(args[4]) : 0;

    // Validar créditos
    if (isNaN(CREDITOS) || CREDITOS <= 0) {
        console.log('❌ Quantidade de créditos inválida! Deve ser um número maior que 0.\n');
        process.exit(1);
    }

    // Validar action
    if (ACTION !== 0 && ACTION !== 1) {
        console.log('❌ Action inválida! Use 0 para adicionar ou 1 para remover.\n');
        process.exit(1);
    }

    // Exibir resumo
    console.log('📋 PARÂMETROS RECEBIDOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Usuário:       ${USERNAME}`);
    console.log(`   Senha:         ${'*'.repeat(PASSWORD.length)}`);
    console.log(`   Revendedor ID: ${REVENDEDOR_ID}`);
    console.log(`   Créditos:      ${CREDITOS}`);
    console.log(`   Ação:          ${ACTION === 0 ? 'Adicionar' : 'Remover'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const api = new GesOfficeAPI();

    // ─────────────────────────────────────────────────────────────
    // PASSO 1: FAZER LOGIN
    // ─────────────────────────────────────────────────────────────
    
    const loginResult = await api.login(USERNAME, PASSWORD);

    if (!loginResult.success) {
        console.log('❌ Falha no login. Abortando...\n');
        process.exit(1);
    }

    // ─────────────────────────────────────────────────────────────
    // PASSO 2: RECARREGAR REVENDEDOR
    // ─────────────────────────────────────────────────────────────

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PROCESSANDO RECARGA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const resultado = await api.recarregarRevendedor(
        REVENDEDOR_ID,
        CREDITOS,
        ACTION,
        "",
        ""
    );

    console.log('\n═══════════════════════════════════════════════════');
    if (resultado.success) {
        console.log('           ✅ RECARGA CONCLUÍDA COM SUCESSO');
    } else {
        console.log('           ❌ RECARGA FALHOU');
    }
    console.log('═══════════════════════════════════════════════════\n');

    process.exit(resultado.success ? 0 : 1);
}

// Executar
executarRecarga().catch(error => {
    console.error('\n💥 Erro fatal:', error.message);
    process.exit(1);
});
