#!/usr/bin/env node

/**
 * SIGMA TEST - Script de Teste de Login e Conexão
 * 
 * IMPORTANTE: Execute com proxychains4 para contornar restrições de IP
 * 
 * Uso: proxychains4 node testsigma.js <URL> <USERNAME> <PASSWORD>
 * Exemplo: proxychains4 node testsigma.js https://dash.turbox.tv.br usuario123 senha123
 * 
 * Ou configure a variável de ambiente:
 * USE_PROXYCHAINS=1 node testsigma.js <URL> <USERNAME> <PASSWORD>
 */

const axios = require('axios');

class SigmaTestConnection {
    constructor(domain, username, password) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.authToken = null;
        this.client = null;
        this.userData = null;
    }

    createClient() {
        return axios.create({
            baseURL: this.domain,
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
                'Accept': 'application/json, text/html, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            proxy: false,
            withCredentials: false,
            responseType: 'json'
        });
    }

    async delay(seconds = 3) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        const symbols = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            loading: '⏳'
        };
        console.log(`[${timestamp}] ${symbols[type]} ${message}`);
    }

    async testConnection() {
        this.log('Iniciando teste de conexão...', 'loading');
        this.log(`Domínio: ${this.domain}`, 'info');
        this.log(`Usuário: ${this.username}`, 'info');
        console.log('');

        try {
            // Passo 1: Testar página inicial
            this.log('Passo 1: Testando acesso à página inicial...', 'loading');
            this.client = this.createClient();
            
            const homeResponse = await this.client.get('/', { 
                validateStatus: () => true,
                maxRedirects: 3,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            
            if (homeResponse.status === 200) {
                this.log(`Página inicial acessada com sucesso (Status: ${homeResponse.status})`, 'success');
            } else {
                throw new Error(`Falha ao acessar página inicial: Status ${homeResponse.status}`);
            }

            // Configurar cookies
            const cookies = homeResponse.headers['set-cookie'];
            if (cookies) {
                const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
                this.client.defaults.headers['Cookie'] = cookieString;
                this.log('Cookies configurados', 'success');
            }

            await this.delay(2);

            // Passo 2: Fazer login
            this.log('Passo 2: Tentando fazer login...', 'loading');
            
            this.client.defaults.headers['Content-Type'] = 'application/json';
            this.client.defaults.headers['Origin'] = this.domain;
            this.client.defaults.headers['Referer'] = this.domain + '/';

            const loginResponse = await this.client.post('/api/auth/login', {
                captcha: "not-a-robot",
                captchaChecked: true,
                username: this.username,
                password: this.password,
                twofactor_code: "",
                twofactor_recovery_code: "",
                twofactor_trusted_device_id: ""
            }, { 
                validateStatus: () => true,
                maxRedirects: 0
            });

            if (loginResponse.status === 200) {
                this.userData = loginResponse.data;
                this.authToken = this.userData.token;
                this.client.defaults.headers['Authorization'] = `Bearer ${this.authToken}`;
                
                this.log('Login realizado com sucesso!', 'success');
                console.log('');
                this.log('=== DADOS DO USUÁRIO ===', 'info');
                console.log(JSON.stringify(this.userData, null, 2));
                console.log('');
                
                return true;
            } else {
                this.log(`Falha no login: Status ${loginResponse.status}`, 'error');
                console.log('Resposta:', loginResponse.data);
                return false;
            }
            
        } catch (error) {
            this.log(`Erro durante teste: ${error.message}`, 'error');
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Data:', error.response.data);
            }
            return false;
        }
    }

    async testAPI(endpoint) {
        if (!this.authToken) {
            this.log('Token de autenticação não disponível. Faça login primeiro.', 'error');
            return null;
        }

        try {
            this.log(`Testando endpoint: ${endpoint}`, 'loading');
            const response = await this.client.get(endpoint, { validateStatus: () => true });
            
            if (response.status === 200) {
                this.log(`Endpoint acessado com sucesso (Status: ${response.status})`, 'success');
                return response.data;
            } else {
                this.log(`Falha ao acessar endpoint: Status ${response.status}`, 'warning');
                return null;
            }
        } catch (error) {
            this.log(`Erro ao testar endpoint: ${error.message}`, 'error');
            return null;
        }
    }

    async exploreAPI() {
        if (!this.authToken) {
            this.log('Não é possível explorar API sem autenticação', 'error');
            return;
        }

        console.log('');
        this.log('=== EXPLORANDO API ===', 'info');
        console.log('');

        const endpoints = [
            '/api/user',
            '/api/users',
            '/api/customers',
            '/api/servers',
            '/api/packages',
            '/api/resellers',
            '/api/credits',
            '/api/balance',
            '/api/sellers'
        ];

        for (const endpoint of endpoints) {
            const data = await this.testAPI(endpoint);
            if (data) {
                console.log(`\n📊 Dados de ${endpoint}:`);
                console.log(JSON.stringify(data, null, 2).substring(0, 500));
                if (JSON.stringify(data).length > 500) {
                    console.log('... (dados truncados)');
                }
            }
            await this.delay(1);
        }
    }

    async run() {
        console.log('');
        console.log('═'.repeat(60));
        console.log('🔐 SIGMA TEST - TESTE DE CONEXÃO E LOGIN');
        console.log('═'.repeat(60));
        console.log('');

        const success = await this.testConnection();
        
        if (success) {
            console.log('');
            console.log('═'.repeat(60));
            this.log('TESTE CONCLUÍDO COM SUCESSO!', 'success');
            console.log('═'.repeat(60));
            console.log('');
            
            // Perguntar se deseja explorar API
            this.log('Deseja explorar endpoints da API? (explorando em 3 segundos...)', 'info');
            await this.delay(3);
            await this.exploreAPI();
            
        } else {
            console.log('');
            console.log('═'.repeat(60));
            this.log('TESTE FALHOU - Verifique as credenciais e tente novamente', 'error');
            console.log('═'.repeat(60));
            console.log('');
        }
    }
}

// Execução do script
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('');
        console.log('❌ Uso incorreto!');
        console.log('');
        console.log('Uso correto:');
        console.log('  node testsigma.js <URL> <USERNAME> <PASSWORD>');
        console.log('');
        console.log('Exemplo:');
        console.log('  node testsigma.js https://dash.turbox.tv.br usuario123 senha123');
        console.log('');
        process.exit(1);
    }

    const [domain, username, password] = args;
    
    const tester = new SigmaTestConnection(domain, username, password);
    await tester.run();
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
    console.error('\n❌ Erro não tratado:', error.message);
    process.exit(1);
});

// Executar
main().catch(error => {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
});
