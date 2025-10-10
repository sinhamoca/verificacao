// services/SigmaService.js
const axios = require('axios');

class SigmaService {
    constructor(domain, username, password) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.authToken = null;
        this.client = null;
        this.maxRetries = 3;
        this.delaySeconds = 5;
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

    async delay(seconds = this.delaySeconds) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async login() {
        this.client = this.createClient();
        
        try {
            console.log(`[Sigma] Acessando: ${this.domain}`);
            
            const homeResponse = await this.client.get('/', { 
                validateStatus: () => true,
                maxRedirects: 3,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            
            if (homeResponse.status !== 200) {
                throw new Error(`Página inicial falhou: ${homeResponse.status}`);
            }

            const cookies = homeResponse.headers['set-cookie'];
            if (cookies) {
                const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
                this.client.defaults.headers['Cookie'] = cookieString;
            }

            await this.delay(2);

            this.client.defaults.headers['Content-Type'] = 'application/json';
            this.client.defaults.headers['Origin'] = this.domain;
            this.client.defaults.headers['Referer'] = this.domain + '/';

            console.log(`[Sigma] Login: ${this.username}`);
            
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
                const userData = loginResponse.data;
                this.authToken = userData.token;
                this.client.defaults.headers['Authorization'] = `Bearer ${this.authToken}`;
                console.log('[Sigma] Login OK');
                return userData;
            } else {
                throw new Error(`Login falhou: Status ${loginResponse.status}`);
            }
            
        } catch (error) {
            console.error('[Sigma] Erro no login:', error.message);
            throw error;
        }
    }

    async findResellerByUsername(targetUsername) {
        const searchParams = new URLSearchParams({
            page: '1',
            username: targetUsername,
            serverId: '',
            packageId: '',
            expiryFrom: '',
            expiryTo: '',
            status: '',
            isTrial: '',
            connections: '',
            perPage: '20'
        });
        
        const searchUrl = `/api/customers?${searchParams.toString()}`;
        const response = await this.client.get(searchUrl, { validateStatus: () => true });
        
        if (response.status !== 200) {
            throw new Error(`Busca falhou: ${response.status}`);
        }

        let customers = [];
        if (Array.isArray(response.data)) {
            customers = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
            customers = response.data.data;
        }

        let customer = customers.find(c => c.username === targetUsername);
        
        if (!customer) {
            customer = customers.find(c => c.note && c.note.toLowerCase().includes(targetUsername.toLowerCase()));
        }

        if (customer) {
            return customer;
        } else {
            throw new Error(`Cliente ${targetUsername} não encontrado`);
        }
    }

    async findResellerById(resellerId) {
        const searchParams = new URLSearchParams({
            page: '1',
            username: resellerId,
            status: '',
            membershipActive: '',
            role: '',
            onlyThisReseller: '',
            creditsReadonly: '',
            countServer: 'true',
            perPage: '20'
        });

        const response = await this.client.get(`/api/resellers?${searchParams.toString()}`, {
            validateStatus: () => true
        });

        if (response.status !== 200) {
            throw new Error(`Busca falhou: ${response.status}`);
        }

        if (!response.data.data || !Array.isArray(response.data.data)) {
            throw new Error('Formato de resposta inválido');
        }

        if (response.data.data.length === 0) {
            throw new Error('Revendedor não encontrado');
        }

        const exactMatch = response.data.data.find(r => 
            r.username.toLowerCase() === resellerId.toLowerCase()
        );

        return exactMatch || response.data.data[0];
    }

    async addCredits(resellerId, credits) {
        const endpoint = `/api/resellers/${resellerId}/add-credits`;
        const payload = { credits: parseInt(credits) };

        console.log(`[Sigma] Adicionando ${credits} créditos para ${resellerId}`);

        const response = await this.client.post(endpoint, payload, {
            validateStatus: () => true,
            timeout: 45000
        });

        if (response.status === 200) {
            console.log('[Sigma] Créditos adicionados');
            return response.data;
        } else {
            throw new Error(`Falha ao adicionar créditos: Status ${response.status}`);
        }
    }

    async addCreditsWithRetry(targetUsername, sigmaUserId, credits) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[Sigma] Tentativa ${attempt}/${this.maxRetries}`);
                
                this.authToken = null;
                this.client = null;
                
                await this.login();
                
                let userId = sigmaUserId;
                if (!userId) {
                    const reseller = await this.findResellerById(targetUsername);
                    userId = reseller.id;
                }
                
                const result = await this.addCredits(userId, credits);
                
                return {
                    success: true,
                    attempt: attempt,
                    userId: userId,
                    response: result
                };
                
            } catch (error) {
                lastError = error;
                console.error(`[Sigma] Tentativa ${attempt} falhou:`, error.message);
                
                if (attempt < this.maxRetries) {
                    await this.delay(10);
                }
            }
        }
        
        throw lastError;
    }
}

module.exports = SigmaService;
