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

    // Logs padronizados
    log(message, type = 'info') {
        const prefix = '[PainelFoda]';
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'loading': '⏳',
            'debug': '🔍'
        }[type] || 'ℹ️';
        
        console.log(`${prefix} ${emoji} ${message}`);
    }

    // Normalizar domínio
    normalizeDomain(domain) {
        let normalized = domain.trim();
        
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = 'https://' + normalized;
        }
        
        normalized = normalized.replace(/\/$/, '');
        return normalized;
    }

    // Extrair cookies
    extractCookies(response) {
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
            setCookieHeader.forEach(cookie => {
                const parts = cookie.split(';')[0].split('=');
                this.cookies[parts[0]] = parts[1];
            });
        }
    }

    // Montar string de cookies
    getCookieString() {
        return Object.entries(this.cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
    }

    // Delay helper
    delay(seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    // Obter CSRF token da página de login
    async getLoginPage() {
        this.log('Acessando página de login...', 'loading');
        
        try {
            const response = await this.client.get('/login');
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

    // Fazer login
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
        
        this.log('Enviando credenciais...', 'loading');
        
        try {
            const response = await this.client.post('/login', loginData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': this.getCookieString(),
                    'Referer': `${this.baseURL}/login`,
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
                    throw new Error('Credenciais inválidas');
                }
                
                this.log('Login realizado com sucesso!', 'success');
                return true;
            }
            
            throw new Error(`Login falhou: Status ${response.status}`);
            
        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    // Adicionar créditos
    async addCredits(userId, credits) {
        this.log(`Adicionando ${credits} créditos ao usuário ${userId}...`, 'loading');
        
        try {
            const creditData = new URLSearchParams({
                action: 'add',
                credits: credits.toString()
            });
            
            const response = await this.client.post(
                `/api/users/${userId}/credits`,
                creditData.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': this.getCookieString(),
                        'Referer': `${this.baseURL}/users`,
                        'Origin': this.baseURL,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );
            
            if (response.status === 200 && response.data) {
                if (response.data.message && response.data.message.includes('sucesso')) {
                    this.log('Créditos adicionados com sucesso!', 'success');
                    return response.data;
                } else if (response.data.message) {
                    const cleanMessage = response.data.message.replace(/<[^>]*>/g, '');
                    this.log(`Resposta: ${cleanMessage}`, 'error');
                    throw new Error(cleanMessage);
                }
            }
            
            throw new Error('Resposta inválida do servidor');
            
        } catch (error) {
            this.log(`Erro ao adicionar créditos: ${error.message}`, 'error');
            throw error;
        }
    }

    // Adicionar créditos com retry
    async addCreditsWithRetry(username, userId, credits) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Tentativa ${attempt}/${this.maxRetries} para ${username}`, 'info');
                
                // Reset
                this.cookies = {};
                
                await this.login();
                const result = await this.addCredits(userId, credits);
                
                return {
                    success: true,
                    attempt: attempt,
                    response: result
                };
                
            } catch (error) {
                lastError = error;
                this.log(`Tentativa ${attempt} falhou: ${error.message}`, 'error');
                
                if (attempt < this.maxRetries) {
                    this.log('Aguardando 10 segundos...', 'info');
                    await this.delay(10);
                }
            }
        }
        
        throw lastError;
    }
}

module.exports = PainelFodaService;
