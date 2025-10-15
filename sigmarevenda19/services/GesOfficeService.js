// services/GesOfficeService.js
const axios = require('axios');

class GesOfficeService {
    constructor(domain, username, password) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.token = null;
        this.client = null;
        this.maxRetries = 3;
    }

    createClient() {
        const isProxychains = !!process.env.PROXYCHAINS_CONF_FILE;
        
        const config = {
            timeout: 30000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Origin': 'https://gestordefender.com',              // ✅ ATUALIZADO
                'Referer': 'https://gestordefender.com/',            // ✅ ATUALIZADO
                'Cache-Control': 'no-cache',                         // ✅ NOVO
                'Pragma': 'no-cache',                                // ✅ NOVO
                'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',  // ✅ ATUALIZADO
                'sec-ch-ua-mobile': '?1',                            // ✅ MUDADO PARA MOBILE
                'sec-ch-ua-platform': '"Android"',                   // ✅ MUDADO PARA ANDROID
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site'
            }
        };

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
            info: '[GesOffice]', 
            success: '[GesOffice ✓]', 
            error: '[GesOffice ✗]', 
            loading: '[GesOffice ...]' 
        };
        console.log(`${symbols[type]} ${message}`);
    }

    async login() {
        this.client = this.createClient();
        
        try {
            this.log('Fazendo login...', 'loading');
            
            const loginData = {
                username: this.username,
                password: this.password,
                code: ""
            };

            const response = await this.client.post(`${this.domain}/api/login`, loginData);

            if (response.status === 200 && response.data.access_token) {
                this.token = response.data.access_token;
                this.log('Login bem-sucedido!', 'success');
                return response.data;
            }

            throw new Error(`Login falhou: Status ${response.status}`);

        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    async addCredits(gesOfficeId, credits) {
        if (!this.token) {
            throw new Error('Token não disponível');
        }

        this.log(`Adicionando ${credits} créditos para ID ${gesOfficeId}...`, 'loading');

        try {
            const recargaData = {
                action: 0, // 0 = adicionar (fixo, nunca remover)
                credits: String(credits),
                sale: "",
                reason: ""
            };

            const response = await this.client.put(
                `${this.domain}/api/reg-users/${gesOfficeId}`,
                recargaData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                }
            );

            if (response.status === 200) {
                this.log('Créditos adicionados com sucesso!', 'success');
                return response.data;
            }

            throw new Error(`Falha ao adicionar créditos: Status ${response.status}`);

        } catch (error) {
            this.log(`Erro ao adicionar créditos: ${error.message}`, 'error');
            throw error;
        }
    }

    async addCreditsWithRetry(gesOfficeId, credits) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Tentativa ${attempt}/${this.maxRetries}`, 'info');
                
                // Reset completo
                this.token = null;
                this.client = null;
                
                await this.login();
                const result = await this.addCredits(gesOfficeId, credits);
                
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

module.exports = GesOfficeService;
