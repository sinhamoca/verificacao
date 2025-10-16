// services/KofficeService.js
const axios = require('axios');
const cheerio = require('cheerio');

class KofficeService {
    constructor(domain, username, password, hasCaptcha = false, anticaptchaKey = null) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.hasCaptcha = hasCaptcha;
        this.anticaptchaKey = anticaptchaKey;
        this.client = null;
        this.cookies = {};
        this.loggedIn = false;
        this.maxRetries = 3;
    }

    createClient() {
        // Detectar se está rodando com Proxychains
        const isProxychains = !!process.env.PROXYCHAINS_CONF_FILE;
        
        const config = {
            timeout: 30000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        // Se estiver com Proxychains, força conexão direta (sem proxy do axios)
        if (isProxychains) {
            config.proxy = false;
            config.httpAgent = false;
            config.httpsAgent = false;
            this.log('Proxychains detectado - usando conexão direta', 'info');
        }

        return axios.create(config);
    }

    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    log(message, type = 'info') {
        const symbols = { 
            info: '[Koffice]', 
            success: '[Koffice ✓]', 
            error: '[Koffice ✗]', 
            loading: '[Koffice ...]' 
        };
        console.log(`${symbols[type]} ${message}`);
    }

    async getCsrfToken() {
        this.log('Acessando página de login...', 'loading');
        
        const response = await this.client.get(`${this.domain}/login/`);
        
        if (response.status !== 200) {
            throw new Error(`Falha ao acessar página: Status ${response.status}`);
        }

        // Capturar cookies
        if (response.headers['set-cookie']) {
            response.headers['set-cookie'].forEach(cookie => {
                const match = cookie.match(/^([^=]+)=([^;]+)/);
                if (match) {
                    this.cookies[match[1]] = match[2];
                }
            });
        }

        // Parsear HTML
        const $ = cheerio.load(response.data);
        const csrfToken = $('input[name="csrf_token"]').val();
        const hcaptchaSiteKey = $('.h-captcha').attr('data-sitekey') || 
                                $('[data-sitekey]').attr('data-sitekey');
        
        if (!csrfToken) {
            throw new Error('CSRF Token não encontrado');
        }

        this.log('CSRF Token obtido', 'success');

        return {
            csrfToken,
            hasHCaptcha: !!hcaptchaSiteKey,
            hcaptchaSiteKey
        };
    }

    async solveHCaptcha(siteKey) {
        if (!this.anticaptchaKey) {
            throw new Error('Anti-Captcha API Key não configurada');
        }

        this.log('Resolvendo hCaptcha...', 'loading');
        
        // Criar tarefa
        const createTask = await axios.post('https://api.anti-captcha.com/createTask', {
            clientKey: this.anticaptchaKey,
            task: {
                type: 'HCaptchaTaskProxyless',
                websiteURL: `${this.domain}/login/`,
                websiteKey: siteKey
            }
        });

        if (createTask.data.errorId !== 0) {
            throw new Error(`Anti-Captcha: ${createTask.data.errorDescription}`);
        }

        const taskId = createTask.data.taskId;
        this.log(`Tarefa criada: ${taskId}`, 'info');

        // Aguardar resolução (máximo 60 tentativas = 3 minutos)
        let attempts = 0;
        while (attempts < 60) {
            await this.delay(3);
            attempts++;

            const getResult = await axios.post('https://api.anti-captcha.com/getTaskResult', {
                clientKey: this.anticaptchaKey,
                taskId: taskId
            });

            if (getResult.data.status === 'ready') {
                this.log('Captcha resolvido!', 'success');
                return getResult.data.solution.gRecaptchaResponse;
            }

            if (getResult.data.errorId !== 0) {
                throw new Error(`Anti-Captcha: ${getResult.data.errorDescription}`);
            }
        }

        throw new Error('Timeout aguardando resolução do captcha');
    }

    async login() {
        this.client = this.createClient();
        
        try {
            const { csrfToken, hasHCaptcha, hcaptchaSiteKey } = await this.getCsrfToken();

            let captchaToken = null;

            // Se painel tem captcha E hasCaptcha está ativado
            if (this.hasCaptcha && hasHCaptcha) {
                this.log('hCaptcha detectado', 'info');
                captchaToken = await this.solveHCaptcha(hcaptchaSiteKey);
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
                    'Origin': this.domain
                },
                maxRedirects: 0,
                validateStatus: () => true
            });

            // Capturar cookies do login
            if (loginResponse.headers['set-cookie']) {
                loginResponse.headers['set-cookie'].forEach(cookie => {
                    const parts = cookie.split(';')[0].split('=');
                    if (parts.length === 2) {
                        this.cookies[parts[0]] = parts[1];
                    }
                });
            }

            // Seguir redirecionamentos manualmente
            let currentResponse = loginResponse;
            let redirectCount = 0;
            
            while ((currentResponse.status === 302 || currentResponse.status === 301) && redirectCount < 5) {
                const location = currentResponse.headers.location;
                
                if (!location || location.includes('login')) {
                    throw new Error('Login falhou - redirecionado para login');
                }
                
                redirectCount++;
                const fullUrl = location.startsWith('http') ? location : `${this.domain}${location}`;
                const cookieStr = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
                
                currentResponse = await this.client.get(fullUrl, {
                    headers: {
                        'Cookie': cookieStr
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

            this.log('Login bem-sucedido!', 'success');
            this.loggedIn = true;
            return true;

        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    async addCredits(kofficeId, credits) {
        if (!this.loggedIn) {
            throw new Error('Não está logado');
        }

        this.log(`Adicionando ${credits} créditos para ID ${kofficeId}...`, 'loading');

        const timestamp = Date.now();
        const cookieString = Object.entries(this.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');

        const apiUrl = `${this.domain}/resellers/api/?change_credits&reseller_id=${kofficeId}&credits=${credits}&timestamp=${timestamp}`;

        const response = await this.client.post(apiUrl, '', {
            headers: {
                'Cookie': cookieString,
                'Referer': `${this.domain}/resellers/`,
                'Origin': this.domain,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        // Verificar se redirecionou para login (sessão expirou)
        if (typeof response.data === 'string' && response.data.includes('login')) {
            throw new Error('Sessão expirou');
        }

        // ============================================
        // CORREÇÃO: VERIFICAR O CONTEÚDO DA RESPOSTA
        // ============================================
        if (response.status === 200) {
            // Se a resposta é um objeto JSON
            if (response.data && typeof response.data === 'object') {
                // ✅ Verificar se result === "success"
                if (response.data.result === 'success') {
                    this.log('Créditos adicionados com sucesso!', 'success');
                    return response.data;
                }
                // ❌ Verificar se result === "failed"
                else if (response.data.result === 'failed') {
                    this.log('Falha ao adicionar créditos (result: failed)', 'error');
                    throw new Error('Falha ao adicionar créditos no painel Koffice (result: failed)');
                }
                // ⚠️ Outras respostas com "success" no objeto
                else if (response.data.success) {
                    this.log('Créditos adicionados com sucesso!', 'success');
                    return response.data;
                }
                // ⚠️ Resposta inesperada
                else {
                    this.log(`Resposta inesperada: ${JSON.stringify(response.data)}`, 'error');
                    throw new Error(`Resposta inesperada do servidor: ${JSON.stringify(response.data)}`);
                }
            }
            // Se a resposta é string
            else if (typeof response.data === 'string') {
                const lowerData = response.data.toLowerCase();
                // Verificar palavras-chave de sucesso
                if (lowerData.includes('success') || lowerData === 'ok') {
                    this.log('Créditos adicionados com sucesso!', 'success');
                    return { success: true, message: response.data };
                }
                // Verificar palavras-chave de falha
                else if (lowerData.includes('failed') || lowerData.includes('error')) {
                    this.log(`Falha: ${response.data}`, 'error');
                    throw new Error(`Falha ao adicionar créditos: ${response.data}`);
                }
                // String desconhecida
                else {
                    this.log(`Resposta string inesperada: ${response.data}`, 'error');
                    throw new Error(`Resposta inesperada do servidor: ${response.data}`);
                }
            }
            // Resposta vazia ou outro tipo
            else {
                this.log('Resposta vazia ou formato desconhecido', 'error');
                throw new Error('Resposta vazia ou formato desconhecido do servidor');
            }
        } else {
            throw new Error(`Erro ao adicionar créditos: Status ${response.status}`);
        }
    }

    async addCreditsWithRetry(kofficeId, credits) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Tentativa ${attempt}/${this.maxRetries}`, 'info');
                
                // Reset
                this.loggedIn = false;
                this.client = null;
                this.cookies = {};
                
                await this.login();
                const result = await this.addCredits(kofficeId, credits);
                
                return {
                    success: true,
                    attempt: attempt,
                    response: result
                };
                
            } catch (error) {
                lastError = error;
                this.log(`Tentativa ${attempt} falhou: ${error.message}`, 'error');
                
                if (attempt < this.maxRetries) {
                    await this.delay(10);
                }
            }
        }
        
        throw lastError;
    }
}

module.exports = KofficeService;
