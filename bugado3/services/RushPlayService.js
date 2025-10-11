// services/RushPlayService.js - COM DEBUG AVANÇADO
const axios = require('axios');

class RushPlayService {
    constructor(domain, username, password) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.token = null;
        this.client = null;
        this.maxRetries = 3;
    }

    createClient() {
        return axios.create({
            timeout: 30000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
    }

    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    log(message, type = 'info') {
        const symbols = { 
            info: '[RushPlay]', 
            success: '[RushPlay ✓]', 
            error: '[RushPlay ✗]', 
            loading: '[RushPlay ...]',
            debug: '[RushPlay 🔍]'
        };
        console.log(`${symbols[type]} ${message}`);
    }

    async login() {
        this.client = this.createClient();
        
        try {
            this.log('Fazendo login...', 'loading');
            
            const loginData = {
                username: this.username,
                password: this.password
            };

            const response = await this.client.post(`${this.domain}/auth/login`, loginData);

            // 🔍 DEBUG: Mostrar resposta completa
            this.log(`Status da resposta: ${response.status}`, 'debug');
            this.log(`Tipo da resposta: ${typeof response.data}`, 'debug');
            
            // Se a resposta for string, tentar fazer parse
            let data = response.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                    this.log('Resposta era string, convertida para JSON', 'debug');
                } catch (e) {
                    this.log('Não foi possível fazer parse da resposta', 'error');
                }
            }

            // 🔍 DEBUG: Mostrar chaves da resposta
            if (data && typeof data === 'object') {
                this.log(`Chaves na resposta: ${Object.keys(data).join(', ')}`, 'debug');
            }

            // ✅ Aceitar 200 OU 201 como sucesso
            if (response.status === 200 || response.status === 201) {
                // Verificar token ou access_token
                let token = null;
                
                // Tentar várias possibilidades de nome do campo
                if (data.token) {
                    token = data.token;
                    this.log('Token encontrado no campo "token"', 'debug');
                } else if (data.access_token) {
                    token = data.access_token;
                    this.log('Token encontrado no campo "access_token"', 'debug');
                } else if (data.accessToken) {
                    token = data.accessToken;
                    this.log('Token encontrado no campo "accessToken"', 'debug');
                } else if (data.jwt) {
                    token = data.jwt;
                    this.log('Token encontrado no campo "jwt"', 'debug');
                } else if (data.data && data.data.token) {
                    token = data.data.token;
                    this.log('Token encontrado no campo "data.token"', 'debug');
                } else if (data.data && data.data.access_token) {
                    token = data.data.access_token;
                    this.log('Token encontrado no campo "data.access_token"', 'debug');
                }

                if (token) {
                    this.token = token;
                    this.log('Login bem-sucedido!', 'success');
                    this.log(`Token (primeiros 30 chars): ${token.substring(0, 30)}...`, 'debug');
                    return true;
                }
                
                // Se não encontrou token, mostrar estrutura completa
                this.log('Estrutura da resposta:', 'error');
                console.error(JSON.stringify(data, null, 2));
                throw new Error('Token não encontrado na resposta');
            }

            throw new Error(`Login falhou: Status ${response.status}`);

        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    async addCredits(rushplayId, credits, reason = '', sale = 0) {
        if (!this.token) {
            throw new Error('Token não disponível');
        }

        this.log(`Adicionando ${credits} créditos para ID ${rushplayId}...`, 'loading');

        try {
            // Payload conforme API RushPlay
            const creditData = {
                id: rushplayId,
                credits: credits.toString(),
                reason: reason,
                sale: sale
            };

            // URL com credenciais conforme padrão RushPlay
            const url = `${this.domain}/resale/add-credits/${rushplayId}?username=${this.username}&password=${this.password}&token=${this.token}`;

            const response = await this.client.patch(url, creditData, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            // ✅ Aceitar 200 OU 201 como sucesso
            if (response.status === 200 || response.status === 201) {
                this.log('Créditos adicionados com sucesso!', 'success');
                return response.data;
            }

            throw new Error(`Falha ao adicionar créditos: Status ${response.status}`);

        } catch (error) {
            this.log(`Erro ao adicionar créditos: ${error.message}`, 'error');
            throw error;
        }
    }

    async addCreditsWithRetry(username, rushplayId, credits) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Tentativa ${attempt}/${this.maxRetries}`, 'info');
                
                // Reset completo
                this.token = null;
                this.client = null;
                
                await this.login();
                const result = await this.addCredits(rushplayId, credits, '', 0);
                
                return {
                    success: true,
                    attempt: attempt,
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

module.exports = RushPlayService;
