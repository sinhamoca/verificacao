// services/P2brasService.js
const axios = require('axios');

class P2brasService {
    constructor(domain, username, password, captchaApiKey) {
        this.domain = domain.replace(/\/$/, ''); // Remove trailing slash
        this.username = username;
        this.password = password;
        this.captchaApiKey = captchaApiKey;
        this.token = null;
        this.client = null;
        this.maxRetries = 3;
        this.delaySeconds = 5;
    }

    createClient() {
        return axios.create({
            timeout: 60000, // 60 segundos (captcha pode demorar)
            validateStatus: () => true,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }

    async delay(seconds = this.delaySeconds) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    log(message, type = 'info') {
        const symbols = { 
            info: '[P2BRAS]', 
            success: '[P2BRAS ✓]', 
            error: '[P2BRAS ✗]', 
            loading: '[P2BRAS ...]' 
        };
        console.log(`${symbols[type]} ${message}`);
    }

    // ============================================
    // RESOLVER reCAPTCHA com 2Captcha
    // ============================================
    async solveCaptcha() {
        this.log('Resolvendo reCAPTCHA...', 'loading');
        
        if (!this.captchaApiKey) {
            throw new Error('2Captcha API Key não configurada');
        }

        const CAPTCHA_SUBMIT_URL = 'https://2captcha.com/in.php';
        const CAPTCHA_RESULT_URL = 'https://2captcha.com/res.php';
        const RECAPTCHA_SITEKEY = '6LcAl7orAAAAAHQvOYRO9yXb7AuaneKnyl_iuP-X';
        const SITE_URL = 'https://controle.vip';

        try {
            // Enviar captcha para resolução
            const submitResponse = await axios.get(CAPTCHA_SUBMIT_URL, {
                params: {
                    key: this.captchaApiKey,
                    method: 'userrecaptcha',
                    googlekey: RECAPTCHA_SITEKEY,
                    pageurl: SITE_URL,
                    json: 1
                }
            });

            if (submitResponse.data.status !== 1) {
                throw new Error(`Erro ao enviar captcha: ${submitResponse.data.request}`);
            }

            const captchaId = submitResponse.data.request;
            this.log(`Captcha enviado. ID: ${captchaId}`, 'info');
            this.log('Aguardando resolução (15-60 segundos)...', 'loading');

            // Aguardar resolução
            let attempts = 0;
            const maxAttempts = 30; // 30 tentativas x 5 segundos = 150 segundos max

            while (attempts < maxAttempts) {
                await this.delay(5);
                
                const resultResponse = await axios.get(CAPTCHA_RESULT_URL, {
                    params: {
                        key: this.captchaApiKey,
                        action: 'get',
                        id: captchaId,
                        json: 1
                    }
                });

                if (resultResponse.data.status === 1) {
                    this.log('Captcha resolvido com sucesso!', 'success');
                    return resultResponse.data.request;
                }

                if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
                    throw new Error(`Erro ao resolver captcha: ${resultResponse.data.request}`);
                }

                attempts++;
            }

            throw new Error('Timeout: Captcha não foi resolvido a tempo');

        } catch (error) {
            this.log(`Erro ao resolver captcha: ${error.message}`, 'error');
            throw error;
        }
    }

    // ============================================
    // LOGIN
    // ============================================
    async login() {
        this.client = this.createClient();
        
        try {
            this.log(`Fazendo login em ${this.domain}...`, 'loading');
            this.log(`Usuário: ${this.username}`, 'info');

            // Resolver captcha
            const captchaResponse = await this.solveCaptcha();

            // Fazer login
            const loginPayload = {
                username: this.username,
                password: this.password,
                'g-recaptcha-response': captchaResponse
            };

            const response = await this.client.post(
                `${this.domain}/api/auth/sign-in`,
                loginPayload
            );

            if (response.status !== 200) {
                throw new Error(`Login falhou: Status ${response.status}`);
            }

            if (!response.data || !response.data.token) {
                throw new Error('Resposta de login inválida - token não encontrado');
            }

            this.token = response.data.token;
            this.log('Login realizado com sucesso!', 'success');
            
            if (response.data.user && response.data.user.credits !== undefined) {
                this.log(`Créditos disponíveis: ${response.data.user.credits}`, 'info');
            }

            return true;

        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    // ============================================
    // ADICIONAR CRÉDITOS
    // ============================================
    async addCredits(p2brasId, creditsAmount) {
        if (!this.token) {
            throw new Error('Token não disponível. Faça login primeiro.');
        }

        this.log(`Adicionando ${creditsAmount} créditos para revendedor ID: ${p2brasId}...`, 'loading');

        try {
            const payload = {
                id: p2brasId,
                value: creditsAmount
            };

            const response = await this.client.post(
                `${this.domain}/api/resellers/${p2brasId}/credits`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json',
                        'Origin': 'https://controle.vip',
                        'Referer': 'https://controle.vip/'
                    }
                }
            );

            if (response.status !== 200 && response.status !== 201) {
                throw new Error(`Erro ao adicionar créditos: Status ${response.status}`);
            }

            this.log('Créditos adicionados com sucesso!', 'success');

            return {
                success: true,
                message: `${creditsAmount} créditos adicionados ao revendedor ${p2brasId}`,
                data: response.data
            };

        } catch (error) {
            this.log(`Erro ao adicionar créditos: ${error.message}`, 'error');
            throw error;
        }
    }

    // ============================================
    // ADICIONAR CRÉDITOS COM RETRY
    // ============================================
    async addCreditsWithRetry(username, p2brasId, creditsAmount) {
        this.log(`Iniciando processo de recarga para ${username} (ID: ${p2brasId})`, 'info');

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.log(`Tentativa ${attempt}/${this.maxRetries}`, 'info');

                // Sempre fazer login novo (conforme definido)
                await this.login();

                // Adicionar créditos
                const result = await this.addCredits(p2brasId, creditsAmount);

                return result;

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

module.exports = P2brasService;
