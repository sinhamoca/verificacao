// services/PainelFodaService.js
const axios = require('axios');
const cheerio = require('cheerio');

class PainelFodaService {
    constructor(domain, username, password) {
        this.baseURL = this.normalizeDomain(domain);
        this.username = username;
        this.password = password;
        this.cookies = {};
        this.maxRetries = 3;
        this.delaySeconds = 2;

        // ✅ ENDPOINTS FIXOS (Padrão PainelFoda)
        this.endpoints = {
            login: '/login',
            addCredits: '/api/users/{userId}/credits'
        };

        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            withCredentials: true,
            maxRedirects: 5,
        });
    }

    normalizeDomain(domain) {
        let normalized = domain.trim();
        
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = 'https://' + normalized;
        }
        
        normalized = normalized.replace(/\/$/, '');
        return normalized;
    }

    extractCookies(response) {
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
            setCookieHeader.forEach(cookie => {
                const parts = cookie.split(';')[0].split('=');
                this.cookies[parts[0]] = parts[1];
            });
        }
    }

    getCookieString() {
        return Object.entries(this.cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
    }

    async delay(seconds = null) {
        const waitTime = seconds || this.delaySeconds;
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    }

    log(message, type = 'info') {
        const symbols = { 
            info: '[PainelFoda]', 
            success: '[PainelFoda ✓]', 
            error: '[PainelFoda ✗]', 
            loading: '[PainelFoda ...]' 
        };
        console.log(`${symbols[type]} ${message}`);
    }

    async getLoginPage() {
        this.log('Acessando página de login...', 'loading');
        
        try {
            const response = await this.client.get(this.endpoints.login);
            this.extractCookies(response);
            
            const $ = cheerio.load(response.data);
            
            const csrfToken = $('input[name="csrf"]').val() || 
                            $('input[name="_csrf"]').val() ||
                            $('input[name="csrf_token"]').val() ||
                            $('meta[name="csrf-token"]').attr('content');
            
            if (!csrfToken) {
                this.log('Token CSRF não encontrado', 'error');
                return null;
            }
            
            this.log('Token CSRF obtido', 'success');
            return csrfToken;
            
        } catch (error) {
            this.log(`Erro ao acessar página de login: ${error.message}`, 'error');
            throw error;
        }
    }

    async login() {
        this.log('Iniciando processo de login...', 'loading');
        
        const csrfToken = await this.getLoginPage();
        
        if (!csrfToken) {
            throw new Error('Não foi possível obter o token CSRF');
        }
        
        const loginData = new URLSearchParams({
            csrf: csrfToken,
            username: this.username,
            password: this.password
        });
        
        this.log('Enviando credenciais de login...', 'loading');
        
        try {
            const response = await this.client.post(this.endpoints.login, loginData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': this.getCookieString(),
                    'Referer': `${this.baseURL}${this.endpoints.login}`,
                    'Origin': this.baseURL,
                }
            });
            
            this.extractCookies(response);
            
            const responseText = typeof response.data === 'string' 
                ? response.data 
                : JSON.stringify(response.data);
            
            if (response.status === 200) {
                if (responseText.includes('login') && responseText.includes('password')) {
                    this.log('Login falhou - credenciais inválidas', 'error');
                    return false;
                }
                
                this.log('Login realizado com sucesso!', 'success');
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.log(`Erro ao fazer login: ${error.message}`, 'error');
            throw error;
        }
    }

    async addCredits(painelFodaId, credits) {
        this.log(`Adicionando ${credits} créditos ao usuário ${painelFodaId}...`, 'loading');
        
        try {
            const creditData = new URLSearchParams({
                action: 'add',
                credits: credits.toString()
            });
            
            const url = this.endpoints.addCredits.replace('{userId}', painelFodaId);
            
            const response = await this.client.post(url, creditData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': this.getCookieString(),
                    'Referer': `${this.baseURL}/users`,
                    'Origin': this.baseURL,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (response.status === 200 && response.data) {
                if (response.data.message && response.data.message.includes('sucesso')) {
                    this.log('Créditos adicionados com sucesso!', 'success');
                    return {
                        success: true,
                        data: response.data
                    };
                } else if (response.data.message) {
                    const cleanMessage = response.data.message.replace(/<[^>]*>/g, '');
                    this.log(`Resposta: ${cleanMessage}`, 'info');
                    return {
                        success: false,
                        message: cleanMessage,
                        data: response.data
                    };
                } else {
                    this.log('Resposta inesperada', 'error');
                    return {
                        success: false,
                        data: response.data
                    };
                }
            }
            
            return {
                success: false,
                message: 'Resposta inválida do servidor'
            };
            
        } catch (error) {
            this.log(`Erro ao adicionar créditos: ${error.message}`, 'error');
            throw error;
        }
    }

    async addCreditsWithRetry(username, painelFodaId, credits) {
        this.log(`Iniciando recarga para ${username} (ID: ${painelFodaId})`, 'info');

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Tentativa ${attempt}/${this.maxRetries}`, 'info');

                await this.login();
                const result = await this.addCredits(painelFodaId, credits);

                if (result.success) {
                    return result;
                } else {
                    throw new Error(result.message || 'Falha ao adicionar créditos');
                }

            } catch (error) {
                this.log(`Tentativa ${attempt} falhou: ${error.message}`, 'error');

                if (attempt < this.maxRetries) {
                    this.log(`Aguardando ${this.delaySeconds}s antes da próxima tentativa...`, 'loading');
                    await this.delay();
                } else {
                    this.log('Todas as tentativas falharam', 'error');
                    throw error;
                }
            }
        }
    }
}

module.exports = PainelFodaService;
