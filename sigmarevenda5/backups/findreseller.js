#!/usr/bin/env node

/**
 * SIGMA FIND RESELLER - Script para Buscar ID de Revendedor por Username
 * 
 * IMPORTANTE: Execute com proxychains4 para contornar restrições de IP
 * 
 * Uso: proxychains4 node findreseller.js <URL> <USERNAME> <PASSWORD> <RESELLER_USERNAME>
 * Exemplo: proxychains4 node findreseller.js https://starplay.sigma.st usuario123 senha123 ostenes
 */

const axios = require('axios');

class SigmaResellerFinder {
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

    async delay(seconds = 2) {
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
            // Acessar página inicial
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

            // Fazer login
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
                return true;
            } else {
                throw new Error(`Login falhou: Status ${loginResponse.status}`);
            }
            
        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    async searchReseller(resellerUsername) {
        try {
            this.log(`Buscando revendedor: ${resellerUsername}...`, 'loading');
            
            // Construir URL com parâmetros de busca
            const params = new URLSearchParams({
                page: '1',
                username: resellerUsername,
                status: '',
                membershipActive: '',
                role: '',
                onlyThisReseller: '',
                creditsReadonly: '',
                countServer: 'true',
                perPage: '20'
            });

            const endpoint = `/api/resellers?${params.toString()}`;
            this.log(`Endpoint: ${endpoint}`, 'info');

            const response = await this.client.get(endpoint, {
                validateStatus: () => true
            });

            if (response.status === 200) {
                const data = response.data;
                
                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('Formato de resposta invalido');
                }

                if (data.data.length === 0) {
                    this.log('Nenhum revendedor encontrado com esse username', 'warning');
                    return null;
                }

                this.log(`Encontrados ${data.data.length} revendedor(es)`, 'success');
                
                // Se encontrou exatamente 1, retornar
                if (data.data.length === 1) {
                    return data.data[0];
                }

                // Se encontrou múltiplos, filtrar por username exato (case-insensitive)
                const exactMatch = data.data.find(r => 
                    r.username.toLowerCase() === resellerUsername.toLowerCase()
                );

                if (exactMatch) {
                    this.log('Match exato encontrado!', 'success');
                    return exactMatch;
                }

                // Se não encontrou match exato, retornar todos para o usuário escolher
                this.log('Multiplos revendedores encontrados', 'warning');
                return data.data;

            } else {
                throw new Error(`Busca falhou: Status ${response.status}`);
            }

        } catch (error) {
            this.log(`Erro ao buscar revendedor: ${error.message}`, 'error');
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Data:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

    formatResellerInfo(reseller) {
        const info = {
            'ID': reseller.id,
            'Username': reseller.username,
            'Nome': reseller.name || 'N/A',
            'Criado em': reseller.created_at,
            'Ultimo login': reseller.last_login_at || 'N/A',
            'Status': reseller.status || 'N/A',
            'Creditos': reseller.credits !== undefined ? reseller.credits : 'N/A',
            'Telegram': reseller.telegram || 'N/A',
            'WhatsApp': reseller.whatsapp || 'N/A'
        };

        return info;
    }

    async run(resellerUsername) {
        console.log('');
        console.log('='.repeat(70));
        console.log('SIGMA FIND RESELLER - BUSCAR ID DE REVENDEDOR');
        console.log('='.repeat(70));
        console.log('');
        
        // Verificar proxychains
        if (!process.env.PROXYCHAINS_CONF_FILE) {
            this.log('ATENCAO: Proxychains nao detectado!', 'warning');
            this.log('Execute com: proxychains4 node findreseller.js ...', 'warning');
            console.log('');
        } else {
            this.log('Proxychains detectado e ativo', 'success');
            console.log('');
        }

        this.log(`Dominio: ${this.domain}`, 'info');
        this.log(`Usuario admin: ${this.username}`, 'info');
        this.log(`Buscando revendedor: ${resellerUsername}`, 'info');
        console.log('');

        try {
            // Fazer login
            await this.login();
            console.log('');

            await this.delay(1);

            // Buscar revendedor
            const result = await this.searchReseller(resellerUsername);

            if (!result) {
                console.log('');
                console.log('='.repeat(70));
                this.log('REVENDEDOR NAO ENCONTRADO', 'warning');
                console.log('='.repeat(70));
                console.log('');
                return null;
            }

            console.log('');
            console.log('='.repeat(70));

            // Se for um único revendedor
            if (!Array.isArray(result)) {
                this.log('REVENDEDOR ENCONTRADO!', 'success');
                console.log('='.repeat(70));
                console.log('');
                
                const info = this.formatResellerInfo(result);
                
                Object.entries(info).forEach(([key, value]) => {
                    console.log(`  ${key.padEnd(15)}: ${value}`);
                });

                console.log('');
                console.log('='.repeat(70));
                console.log('');
                this.log(`ID DO REVENDEDOR: ${result.id}`, 'success');
                console.log('='.repeat(70));
                console.log('');
                this.log('Use este ID para adicionar creditos:', 'info');
                console.log(`  proxychains4 node addcredits.js ${this.domain} ${this.username} *** ${result.id} <CREDITOS>`);
                console.log('');

                return result;
            }

            // Se forem múltiplos revendedores
            this.log('MULTIPLOS REVENDEDORES ENCONTRADOS', 'warning');
            console.log('='.repeat(70));
            console.log('');

            result.forEach((reseller, index) => {
                console.log(`[${index + 1}] ${reseller.username} (ID: ${reseller.id})`);
                console.log(`    Nome: ${reseller.name || 'N/A'}`);
                console.log(`    Criado: ${reseller.created_at}`);
                console.log(`    Creditos: ${reseller.credits !== undefined ? reseller.credits : 'N/A'}`);
                console.log('');
            });

            console.log('='.repeat(70));
            this.log('Especifique melhor o username para obter resultado unico', 'info');
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
    
    if (args.length < 4) {
        console.log('');
        console.log('X Uso incorreto!');
        console.log('');
        console.log('Uso correto (COM PROXYCHAINS):');
        console.log('  proxychains4 node findreseller.js <URL> <USERNAME> <PASSWORD> <RESELLER_USERNAME>');
        console.log('');
        console.log('Exemplo:');
        console.log('  proxychains4 node findreseller.js https://starplay.sigma.st admin123 senha123 ostenes');
        console.log('');
        console.log('Parametros:');
        console.log('  URL               - Dominio do painel Sigma');
        console.log('  USERNAME          - Usuario administrador');
        console.log('  PASSWORD          - Senha do administrador');
        console.log('  RESELLER_USERNAME - Username do revendedor a buscar');
        console.log('');
        console.log('IMPORTANTE: O proxychains4 e necessario para contornar restricoes de IP!');
        console.log('');
        process.exit(1);
    }

    const [domain, username, password, resellerUsername] = args;
    
    const finder = new SigmaResellerFinder(domain, username, password);
    await finder.run(resellerUsername);
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
