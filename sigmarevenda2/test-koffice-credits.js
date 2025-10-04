#!/usr/bin/env node

/**
 * Test Koffice Add Credits
 * 
 * Uso: node test-koffice-credits.js <URL> <USERNAME> <PASSWORD> <RESELLER_ID> <CREDITS> [ANTICAPTCHA_KEY]
 * 
 * Exemplo:
 * node test-koffice-credits.js https://painel.acticon.top usuario senha 1673 5
 */

const axios = require('axios');
const cheerio = require('cheerio');

const args = process.argv.slice(2);

if (args.length < 5) {
    console.log('\nUso: node test-koffice-credits.js <URL> <USERNAME> <PASSWORD> <RESELLER_ID> <CREDITS> [ANTICAPTCHA_KEY]\n');
    console.log('Exemplo:');
    console.log('  node test-koffice-credits.js https://painel.acticon.top usuario senha 1673 5\n');
    process.exit(1);
}

const [url, username, password, resellerId, credits, anticaptchaKey] = args;
const domain = url.replace(/\/$/, '');

console.log('\n' + '='.repeat(70));
console.log('KOFFICE ADD CREDITS TEST');
console.log('='.repeat(70));
console.log(`\nDominio: ${domain}`);
console.log(`Usuario: ${username}`);
console.log(`Revendedor ID: ${resellerId}`);
console.log(`Creditos: ${credits}\n`);

class KofficeCredits {
    constructor(domain, username, password, anticaptchaKey) {
        this.domain = domain;
        this.username = username;
        this.password = password;
        this.anticaptchaKey = anticaptchaKey;
        this.client = axios.create({
            timeout: 30000,
            validateStatus: () => true
        });
        this.cookies = {};
        this.loggedIn = false;
    }

    log(message, type = 'info') {
        const symbols = { info: '[i]', success: '[OK]', error: '[X]', loading: '[...]' };
        console.log(`${symbols[type]} ${message}`);
    }

    async getCsrfToken() {
        this.log('Acessando pagina de login...', 'loading');
        
        const response = await this.client.get(`${this.domain}/login/`);
        
        if (response.status !== 200) {
            throw new Error(`Falha ao acessar pagina: Status ${response.status}`);
        }

        if (response.headers['set-cookie']) {
            response.headers['set-cookie'].forEach(cookie => {
                const match = cookie.match(/^([^=]+)=([^;]+)/);
                if (match) {
                    this.cookies[match[1]] = match[2];
                }
            });
        }

        const $ = cheerio.load(response.data);
        const csrfToken = $('input[name="csrf_token"]').val();
        const hcaptchaSiteKey = $('.h-captcha').attr('data-sitekey') || $('[data-sitekey]').attr('data-sitekey');
        
        if (!csrfToken) {
            throw new Error('CSRF Token nao encontrado');
        }

        return {
            csrfToken,
            hasHCaptcha: !!hcaptchaSiteKey,
            hcaptchaSiteKey
        };
    }

    async solveHCaptcha(siteKey) {
        if (!this.anticaptchaKey) {
            throw new Error('Anti-Captcha API Key nao configurada');
        }

        this.log('Resolvendo hCaptcha...', 'loading');
        
        const createTask = await axios.post('https://api.anti-captcha.com/createTask', {
            clientKey: this.anticaptchaKey,
            task: {
                type: 'HCaptchaTaskProxyless',
                websiteURL: `${this.domain}/login/`,
                websiteKey: siteKey
            }
        });

        if (createTask.data.errorId !== 0) {
            throw new Error(`Anti-Captcha erro: ${createTask.data.errorDescription}`);
        }

        const taskId = createTask.data.taskId;
        this.log(`Tarefa criada. ID: ${taskId}`, 'success');

        let attempts = 0;
        while (attempts < 60) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;

            const getResult = await axios.post('https://api.anti-captcha.com/getTaskResult', {
                clientKey: this.anticaptchaKey,
                taskId: taskId
            });

            if (getResult.data.status === 'ready') {
                this.log('Captcha resolvido!', 'success');
                return getResult.data.solution.gRecaptchaResponse;
            }

            if (getResult.data.status === 'processing') {
                process.stdout.write('.');
                continue;
            }

            if (getResult.data.errorId !== 0) {
                throw new Error(`Anti-Captcha erro: ${getResult.data.errorDescription}`);
            }
        }

        throw new Error('Timeout aguardando resolucao');
    }

    async login() {
        try {
            const { csrfToken, hasHCaptcha, hcaptchaSiteKey } = await this.getCsrfToken();

            let captchaToken = null;
            if (hasHCaptcha) {
                this.log('hCaptcha detectado', 'info');
                if (!this.anticaptchaKey) {
                    throw new Error('hCaptcha presente mas API key nao fornecida');
                }
                captchaToken = await this.solveHCaptcha(hcaptchaSiteKey);
                console.log('');
            }

            this.log('Fazendo login...', 'loading');

            const payload = {
                try_login: '1',
                csrf_token: csrfToken,
                username: this.username,
                password: this.password
            };

            if (captchaToken) {
                payload['g-recaptcha-response'] = captchaToken;
                payload['h-captcha-response'] = captchaToken;
            }

            const cookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            const loginResponse = await this.client.post(`${this.domain}/login/`, payload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookieString,
                    'Referer': `${this.domain}/login/`,
                    'Origin': this.domain,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                maxRedirects: 0,
                validateStatus: () => true
            });

            // Capturar TODOS os cookies
            if (loginResponse.headers['set-cookie']) {
                loginResponse.headers['set-cookie'].forEach(cookie => {
                    const parts = cookie.split(';')[0].split('=');
                    if (parts.length === 2) {
                        this.cookies[parts[0]] = parts[1];
                    }
                });
            }

            this.log(`Cookies apos login: ${Object.keys(this.cookies).join(', ')}`, 'info');

            // Seguir redirecionamentos MANUALMENTE para capturar cookies
            let currentResponse = loginResponse;
            let redirectCount = 0;
            
            while ((currentResponse.status === 302 || currentResponse.status === 301) && redirectCount < 5) {
                const location = currentResponse.headers.location;
                
                if (!location || location.includes('login')) {
                    throw new Error('Login falhou - redirecionado para login');
                }
                
                redirectCount++;
                this.log(`Seguindo redirect ${redirectCount}: ${location}`, 'info');
                
                const fullUrl = location.startsWith('http') ? location : `${this.domain}${location}`;
                const cookieStr = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
                
                currentResponse = await this.client.get(fullUrl, {
                    headers: {
                        'Cookie': cookieStr,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    maxRedirects: 0,
                    validateStatus: () => true
                });
                
                // Capturar novos cookies
                if (currentResponse.headers['set-cookie']) {
                    currentResponse.headers['set-cookie'].forEach(cookie => {
                        const parts = cookie.split(';')[0].split('=');
                        if (parts.length === 2) {
                            this.cookies[parts[0]] = parts[1];
                        }
                    });
                }
            }

            this.log(`Cookies finais: ${Object.keys(this.cookies).join(', ')}`, 'info');
            this.log('Login bem-sucedido!', 'success');
            this.loggedIn = true;
            return true;

        } catch (error) {
            throw error;
        }
    }

    async addCredits(resellerId, credits) {
        if (!this.loggedIn) {
            throw new Error('Nao esta logado');
        }

        this.log('Adicionando creditos...', 'loading');

        const timestamp = Date.now();
        const cookieString = Object.entries(this.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');

        this.log(`Usando cookies: ${cookieString}`, 'info');

        // URL baseada no que você capturou
        const apiUrl = `${this.domain}/resellers/api/?change_credits&reseller_id=${resellerId}&credits=${credits}&timestamp=${timestamp}`;
        
        this.log(`URL: ${apiUrl}`, 'info');

        const response = await this.client.post(apiUrl, '', {
            headers: {
                'Cookie': cookieString,
                'Referer': `${this.domain}/resellers/`,
                'Origin': this.domain,
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        this.log(`Status: ${response.status}`, 'info');
        
        // Mostrar resposta completa para debug
        if (typeof response.data === 'string' && response.data.length < 500) {
            this.log(`Resposta: ${response.data}`, 'info');
        } else if (typeof response.data === 'object') {
            this.log(`Resposta: ${JSON.stringify(response.data)}`, 'info');
        } else {
            this.log(`Resposta (primeiros 200 chars): ${String(response.data).substring(0, 200)}`, 'info');
        }

        // Se redirecionou para login, sessão expirou
        if (typeof response.data === 'string' && response.data.includes('login')) {
            throw new Error('Sessao expirou - redirecionado para login');
        }

        if (response.status === 200) {
            // Verificar diversos formatos de sucesso
            if (response.data && (
                response.data.success || 
                response.data.status === 'ok' || 
                response.data === 'OK' ||
                response.data === 'ok' ||
                (typeof response.data === 'string' && response.data.toLowerCase().includes('success'))
            )) {
                this.log('Creditos adicionados com sucesso!', 'success');
                return true;
            } else {
                this.log('Resposta inesperada - verifique se creditos foram adicionados', 'error');
                return false;
            }
        } else {
            throw new Error(`Erro ao adicionar creditos: Status ${response.status}`);
        }
    }

    async run(resellerId, credits) {
        try {
            await this.login();
            console.log('');
            await this.addCredits(resellerId, credits);
            return true;
        } catch (error) {
            this.log(`Erro: ${error.message}`, 'error');
            return false;
        }
    }
}

async function main() {
    const koffice = new KofficeCredits(domain, username, password, anticaptchaKey);
    const success = await koffice.run(resellerId, credits);

    console.log('\n' + '='.repeat(70));
    if (success) {
        console.log('SUCESSO: Creditos adicionados!');
    } else {
        console.log('FALHA: Nao foi possivel adicionar creditos');
    }
    console.log('='.repeat(70) + '\n');
}

main().catch(error => {
    console.error('\nErro fatal:', error.message);
    process.exit(1);
});
