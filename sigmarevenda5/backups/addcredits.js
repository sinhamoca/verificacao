#!/usr/bin/env node

/**
 * SIGMA ADD CREDITS - Script para Adicionar Créditos a Revendedores
 * 
 * IMPORTANTE: Execute com proxychains4 para contornar restrições de IP
 * 
 * Uso: proxychains4 node addcredits.js <URL> <USERNAME> <PASSWORD> <RESELLER_ID> <CREDITS>
 * Exemplo: proxychains4 node addcredits.js https://dash.turbox.tv.br usuario123 senha123 kaL4VbjWgr 10
 */

const axios = require('axios');

class SigmaCreditsManager {
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
            info: 'i',
            success: 'OK',
            error: 'X',
            warning: '!',
            loading: '...'
        };
        console.log(`[${timestamp}] [${symbols[type]}] ${message}`);
    }

    async login() {
        this.log('Iniciando processo de login...', 'loading');
        this.client = this.createClient();
        
        try {
            // Passo 1: Acessar página inicial
            this.log('Acessando pagina inicial...', 'loading');
            const homeResponse = await this.client.get('/', { 
                validateStatus: () => true,
                maxRedirects: 3,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            
            if (homeResponse.status !== 200) {
                throw new Error(`Falha ao acessar pagina inicial: Status ${homeResponse.status}`);
            }
            this.log('Pagina inicial acessada', 'success');

            // Configurar cookies
            const cookies = homeResponse.headers['set-cookie'];
            if (cookies) {
                const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
                this.client.defaults.headers['Cookie'] = cookieString;
            }

            await this.delay(2);

            // Passo 2: Fazer login
            this.log('Fazendo login...', 'loading');
            
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
                this.log(`Usuario logado: ${this.userData.username || this.username}`, 'info');
                
                return true;
            } else {
                throw new Error(`Login falhou: Status ${loginResponse.status}`);
            }
            
        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    async getResellerInfo(resellerId) {
        try {
            this.log(`Buscando informacoes do revendedor ${resellerId}...`, 'loading');
            
            const response = await this.client.get(`/api/resellers/${resellerId}`, {
                validateStatus: () => true
            });

            if (response.status === 200) {
                this.log('Informacoes do revendedor obtidas', 'success');
                return response.data;
            } else {
                this.log(`Aviso: Nao foi possivel obter info do revendedor (Status: ${response.status})`, 'warning');
                return null;
            }
        } catch (error) {
            this.log(`Aviso: Erro ao buscar revendedor: ${error.message}`, 'warning');
            return null;
        }
    }

    async addCredits(resellerId, credits) {
        try {
            this.log(`Preparando para adicionar ${credits} creditos...`, 'loading');
            
            const endpoint = `/api/resellers/${resellerId}/add-credits`;
            const payload = {
                credits: parseInt(credits)
            };

            this.log(`Endpoint: ${endpoint}`, 'info');
            this.log(`Payload: ${JSON.stringify(payload)}`, 'info');

            await this.delay(1);

            const response = await this.client.post(endpoint, payload, {
                validateStatus: () => true
            });

            if (response.status === 200) {
                this.log('Creditos adicionados com sucesso!', 'success');
                
                if (response.data && response.data.data) {
                    console.log('');
                    this.log('=== DADOS RETORNADOS ===', 'info');
                    console.log(JSON.stringify(response.data.data, null, 2));
                    console.log('');
                }
                
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(`Falha ao adicionar creditos: Status ${response.status} - ${JSON.stringify(response.data)}`);
            }

        } catch (error) {
            this.log(`Erro ao adicionar creditos: ${error.message}`, 'error');
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Data:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    async run(resellerId, credits) {
        console.log('');
        console.log('='.repeat(70));
        console.log('SIGMA ADD CREDITS - ADICIONAR CREDITOS A REVENDEDOR');
        console.log('='.repeat(70));
        console.log('');
        
        // Verificar proxychains
        if (!process.env.PROXYCHAINS_CONF_FILE) {
            this.log('ATENCAO: Proxychains nao detectado!', 'warning');
            this.log('Execute com: proxychains4 node addcredits.js ...', 'warning');
            console.log('');
        } else {
            this.log('Proxychains detectado e ativo', 'success');
            console.log('');
        }

        this.log(`Dominio: ${this.domain}`, 'info');
        this.log(`Usuario: ${this.username}`, 'info');
        this.log(`Revendedor ID: ${resellerId}`, 'info');
        this.log(`Creditos a adicionar: ${credits}`, 'info');
        console.log('');

        try {
            // Fazer login
            await this.login();
            console.log('');

            // Buscar informações do revendedor (opcional)
            const resellerInfo = await this.getResellerInfo(resellerId);
            if (resellerInfo) {
                console.log('');
                this.log('=== INFORMACOES DO REVENDEDOR (ANTES) ===', 'info');
                console.log(JSON.stringify(resellerInfo, null, 2));
                console.log('');
            }

            await this.delay(2);

            // Adicionar créditos
            const result = await this.addCredits(resellerId, credits);

            console.log('');
            console.log('='.repeat(70));
            this.log('OPERACAO CONCLUIDA COM SUCESSO!', 'success');
            console.log('='.repeat(70));
            console.log('');

            return result;

        } catch (error) {
            console.log('');
            console.log('='.repeat(70));
            this.log('OPERACAO FALHOU', 'error');
            console.log('='.repeat(70));
            console.log('');
            throw error;
        }
    }
}

// Execução do script
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 5) {
        console.log('');
        console.log('X Uso incorreto!');
        console.log('');
        console.log('Uso correto (COM PROXYCHAINS):');
        console.log('  proxychains4 node addcredits.js <URL> <USERNAME> <PASSWORD> <RESELLER_ID> <CREDITS>');
        console.log('');
        console.log('Exemplo:');
        console.log('  proxychains4 node addcredits.js https://dash.turbox.tv.br usuario123 senha123 kaL4VbjWgr 10');
        console.log('');
        console.log('Parametros:');
        console.log('  URL         - Dominio do painel Sigma');
        console.log('  USERNAME    - Usuario administrador');
        console.log('  PASSWORD    - Senha do administrador');
        console.log('  RESELLER_ID - ID do revendedor (ex: kaL4VbjWgr)');
        console.log('  CREDITS     - Quantidade de creditos a adicionar');
        console.log('');
        console.log('IMPORTANTE: O proxychains4 e necessario para contornar restricoes de IP!');
        console.log('');
        process.exit(1);
    }

    const [domain, username, password, resellerId, credits] = args;
    
    // Validar créditos
    const creditsNumber = parseInt(credits);
    if (isNaN(creditsNumber) || creditsNumber <= 0) {
        console.error('\nX Erro: A quantidade de creditos deve ser um numero positivo!');
        process.exit(1);
    }
    
    const manager = new SigmaCreditsManager(domain, username, password);
    await manager.run(resellerId, creditsNumber);
}

// Tratamento de erros
process.on('unhandledRejection', (error) => {
    console.error('\nX Erro nao tratado:', error.message);
    process.exit(1);
});

// Executar
main().catch(error => {
    console.error('\nX Erro fatal:', error.message);
    process.exit(1);
});
