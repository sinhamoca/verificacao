// services/PainelFodaService.js
const axios = require('axios');
const cheerio = require('cheerio');

class PainelFodaService {
    constructor(domain, username, password) {
        // Normalizar domínio
        this.domain = this.normalizeDomain(domain);
        this.username = username;
        this.password = password;
        this.cookies = {};
        this.client = null;
        this.maxRetries = 3;
    }

    // Normalizar domínio (adicionar https:// se necessário, remover barra final)
    normalizeDomain(domain) {
        let normalized = domain.trim();
        
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = 'https://' + normalized;
        }
        
        normalized = normalized.replace(/\/$/, '');
        
        return normalized;
    }

    createClient() {
        return axios.create({
            baseURL: this.domain,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            withCredentials: true,
            maxRedirects: 5,
            validateStatus: () => true
        });
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

    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    // Extrair cookies da resposta
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

    // Passo 1: Acessar página de login e obter CSRF token
    async getLoginPage() {
        this.log('Acessando página de login...', 'loading');
        
        try {
            const response = await this.client.get('/login');
            
            // Salvar cookies da sessão
            this.extractCookies(response);
            
            // Parsear HTML para extrair CSRF token
            const $ = cheerio.load(response.data);
            
            // Procurar pelo token CSRF
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

    // Passo 2: Fazer login
    async login() {
        this.client = this.createClient();
        
        this.log('Iniciando processo de login...', 'info');
        
        // Obter CSRF token
        const csrfToken = await this.getLoginPage();
        
        if (!csrfToken) {
            throw new Error('Não foi possível obter o token CSRF');
        }
        
        // Preparar dados do login
        const loginData = new URLSearchParams({
            csrf: csrfToken,
            username: this.username,
            password: this.password
        });
        
        this.log('Enviando credenciais de login...', 'loading');
        
        try {
            const response = await this.client.post('/login', loginData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': this.getCookieString(),
                    'Referer': `${this.domain}/login`,
                    'Origin': this.domain,
                }
            });
            
            // Atualizar cookies
            this.extractCookies(response);
            
            // Converter resposta para string
            const responseText = typeof response.data === 'string' 
                ? response.data 
                : JSON.stringify(response.data);
            
            // Verificar se login foi bem-sucedido
            if (response.status === 200) {
                // Se voltou para página de login, credenciais inválidas
                if (responseText.includes('login') && responseText.includes('password')) {
                    this.log('Login falhou - credenciais inválidas', 'error');
                    throw new Error('Credenciais inválidas');
                }
                
                this.log('Login realizado com sucesso!', 'success');
                return true;
            }
            
            throw new Error(`Falha no login: Status ${response.status}`);
            
        } catch (error) {
            this.log(`Erro ao fazer login: ${error.message}`, 'error');
            throw error;
        }
    }

    // Adicionar créditos a um usuário
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
                        'Referer': `${this.domain}/users`,
                        'Origin': this.domain,
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );
            
            // Verificar resposta
            if (response.status === 200 && response.data) {
                // Verificar se tem mensagem de sucesso
                if (response.data.message && response.data.message.includes('sucesso')) {
                    this.log('Créditos adicionados com sucesso!', 'success');
                    return {
                        success: true,
                        data: response.data
                    };
                } else if (response.data.message) {
                    // Extrair mensagem sem HTML
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
                this.log(`Tentativa ${attempt}/${this.maxRetries}`, 'info');
                
                // Reset completo
                this.cookies = {};
                this.client = null;
                
                await this.login();
                const result = await this.addCredits(userId, credits);
                
                return {
                    success: true,
                    attempt: attempt,
                    userId: userId,
                    response: result
                };
                
            } catch (error) {
                lastError = error;
                this.log(`Tentativa ${attempt} falhou: ${error.message}`, 'error');
                
                if (attempt < this.maxRetries) {
                    this.log('Aguardando 10 segundos antes de tentar novamente...', 'info');
                    await this.delay(10);
                }
            }
        }
        
        throw lastError;
    }
}

module.exports = PainelFodaService;
