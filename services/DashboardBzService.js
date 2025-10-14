// services/DashboardBzService.js
// Serviço de automação para dashboard.bz usando Puppeteer

const puppeteer = require('puppeteer');
const axios = require('axios');
const browserQueue = require('./BrowserQueueService');

class DashboardBzService {
    constructor(panel, tenantId, database) {
        this.panel = panel;           // Dados do painel (url, username, password, site_key)
        this.tenantId = tenantId;     // ID do tenant (para buscar configs)
        this.db = database;           // Instância do banco de dados
        this.maxRetries = 3;          // Tentativas em caso de falha
    }

    /**
     * MÉTODO PÚBLICO - Adicionar créditos (usa fila)
     */
    async addCredits(searchTerm, credits) {
        console.log(`[DashboardBz] 📝 Solicitação recebida: ${searchTerm} (${credits} créditos)`);
        
        // Adicionar à fila do Puppeteer
        return browserQueue.addToQueue(
            async () => {
                return await this._addCreditsInternal(searchTerm, credits);
            },
            {
                username: searchTerm,
                credits: credits,
                panel: this.panel.name
            }
        );
    }

    /**
     * MÉTODO PRIVADO - Executa a automação real
     */
    async _addCreditsInternal(searchTerm, credits) {
        let browser = null;
        let page = null;

        try {
            // 1. BUSCAR API KEY DO ANTI-CAPTCHA
            console.log('[DashboardBz] 🔑 Buscando configuração do Anti-Captcha...');
            const anticaptchaConfig = await this.db.get(
                'SELECT value FROM tenant_config WHERE tenant_id = ? AND key = ?',
                [this.tenantId, 'anticaptcha_api_key']
            );

            if (!anticaptchaConfig || !anticaptchaConfig.value) {
                throw new Error('Anti-Captcha API Key não configurada no tenant');
            }

            const anticaptchaKey = anticaptchaConfig.value;
            console.log(`[DashboardBz] ✓ Anti-Captcha configurado (${anticaptchaKey.substring(0, 8)}...)`);

            // 2. ABRIR NAVEGADOR
            console.log('[DashboardBz] 🌐 Abrindo navegador...');
            browser = await puppeteer.launch({
                headless: 'new', // Modo headless otimizado
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            page = await browser.newPage();
            page.setDefaultNavigationTimeout(60000);
            page.setDefaultTimeout(60000);
            
            await page.setViewport({ width: 1366, height: 768 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Evitar detecção de automação
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });

            console.log('[DashboardBz] ✓ Navegador configurado');

            // 3. FAZER LOGIN
            console.log('[DashboardBz] 🔐 Acessando página de login...');
            const loginUrl = `${this.panel.url}/login.php`;
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.delay(3000);

            // Aguardar reCAPTCHA aparecer
            console.log('[DashboardBz] ⏳ Aguardando reCAPTCHA...');
            await page.waitForSelector('.g-recaptcha, iframe[src*="recaptcha"]', { timeout: 10000 });
            await this.delay(2000);

            // Preencher credenciais
            console.log('[DashboardBz] ✏️  Preenchendo credenciais...');
            await page.type('#username', this.panel.admin_username, { delay: 100 });
            await page.type('#password', this.panel.admin_password, { delay: 100 });
            await this.delay(1000);

            // Resolver CAPTCHA
            console.log('[DashboardBz] 🤖 Resolvendo reCAPTCHA...');
            const captchaToken = await this.solveRecaptchaV2(page, this.panel.site_key, anticaptchaKey);

            // Injetar token do CAPTCHA
            await this.injectCaptchaToken(page, captchaToken);

            // Submeter formulário
            console.log('[DashboardBz] 🖱️  Submetendo login...');
            const navigationPromise = page.waitForNavigation({ 
                waitUntil: 'domcontentloaded', 
                timeout: 15000 
            }).catch(() => null);

            await page.click('#submitt');
            await this.delay(2000);

            // Verificar popup de erro
            console.log('[DashboardBz] ⏳ Verificando resposta do login...');
            const popupExists = await page.$('.swal2-popup');
            if (popupExists) {
                const popupContent = await page.evaluate(() => {
                    const title = document.querySelector('.swal2-title');
                    const content = document.querySelector('.swal2-html-container, .swal2-content');
                    return {
                        title: title ? title.innerText : '',
                        content: content ? content.innerText : ''
                    };
                });

                console.log(`[DashboardBz] 📋 Popup detectado: ${popupContent.title}`);

                // ⭐ SÓ FALHA SE FOR ERRO DE CAPTCHA
                if (popupContent.content.toLowerCase().includes('captcha') && 
                    popupContent.content.toLowerCase().includes('erro')) {
                    await page.click('.swal2-confirm');
                    throw new Error('Falha na verificação do CAPTCHA');
                }

                // ⭐ PARA QUALQUER OUTRO POPUP (incluindo WARNING), apenas clica OK e continua
                console.log('[DashboardBz] ✓ Clicando OK no popup...');
                await page.click('.swal2-confirm');
                await this.delay(1000);
            }

            // ⭐ AGUARDAR NAVEGAÇÃO ANTES DE VERIFICAR URL
            await navigationPromise;
            await this.delay(2000);

            // ⭐ VERIFICAR SE LOGIN TEVE SUCESSO (URL deve conter index.php)
            const currentUrl = page.url();
            if (!currentUrl.includes('index.php')) {
                throw new Error('Login falhou - não redirecionou para index.php');
            }

            console.log('[DashboardBz] ✅ Login realizado com sucesso!');

            // 4. NAVEGAR PARA REVENDEDORES
            console.log('[DashboardBz] 📂 Acessando página de revendedores...');
            await page.goto(`${this.panel.url}/revendedores.php`, { 
                waitUntil: 'domcontentloaded', 
                timeout: 30000 
            });
            await this.delay(2000);

            // 5. BUSCAR USUÁRIO
            console.log(`[DashboardBz] 🔍 Pesquisando usuário: ${searchTerm}`);
            const searchInput = await page.waitForSelector('input[type="search"][aria-controls="dataTable"]', { 
                timeout: 10000 
            });
            
            await searchInput.click({ clickCount: 3 }); // Selecionar tudo
            await searchInput.type(searchTerm, { delay: 100 });
            await this.delay(2000);

            // 6. ENCONTRAR DROPDOWN DINÂMICO
            console.log('[DashboardBz] 🔎 Buscando dropdown do usuário...');
            const dropdownId = await page.evaluate((term) => {
                const dropdowns = Array.from(document.querySelectorAll('a[onclick*="toogleshow"]'));
                for (const dropdown of dropdowns) {
                    const onclick = dropdown.getAttribute('onclick');
                    const match = onclick.match(/toogleshow\('(ddwo\d+)'\)/);
                    if (match) {
                        const row = dropdown.closest('tr');
                        if (row && window.getComputedStyle(row).display !== 'none') {
                            return match[1];
                        }
                    }
                }
                return null;
            }, searchTerm);

            if (!dropdownId) {
                throw new Error(`Usuário "${searchTerm}" não encontrado após busca`);
            }

            console.log(`[DashboardBz] ✓ Dropdown encontrado: ${dropdownId}`);

            // 7. ABRIR DROPDOWN
            console.log('[DashboardBz] 🖱️  Abrindo dropdown...');
            await page.click(`a[onclick*="toogleshow('${dropdownId}')"]`);
            await this.delay(1500);

            // 8. CLICAR EM ADICIONAR CRÉDITOS
            console.log('[DashboardBz] 💰 Clicando em "Adicionar créditos"...');
            await page.evaluate((id) => {
                const container = document.getElementById(id);
                const link = container.querySelector('a[onclick*="addcreditos"]');
                if (link) {
                    link.click();
                } else {
                    throw new Error('Botão de adicionar créditos não encontrado');
                }
            }, dropdownId);
            await this.delay(1500);

            // 9. PREENCHER VALOR
            console.log(`[DashboardBz] ✏️  Digitando créditos: ${credits}`);
            const creditInput = await page.waitForSelector('#swal-input1', { timeout: 10000 });
            await creditInput.click();
            await creditInput.type(credits.toString(), { delay: 100 });
            await this.delay(500);

            // 10. CONFIRMAR
            console.log('[DashboardBz] ✅ Confirmando...');
            await page.click('button.swal2-confirm.swal2-styled');
            await this.delay(2000);

            // 11. VERIFICAR RESULTADO
            console.log('[DashboardBz] 📋 Verificando resultado...');
            const resultPopup = await page.$('.swal2-popup');
            let resultText = 'Sucesso';
            
            if (resultPopup) {
                resultText = await page.evaluate(() => {
                    const popup = document.querySelector('.swal2-popup');
                    return popup ? popup.innerText : 'Sucesso';
                });
                
                console.log(`[DashboardBz] 📋 Resposta do sistema: ${resultText}`);
                
                // Clicar OK se tiver botão
                const okButton = await page.$('.swal2-confirm');
                if (okButton) {
                    await okButton.click();
                }
            }

            console.log('[DashboardBz] 🎉 Créditos adicionados com sucesso!');

            return {
                success: true,
                message: resultText,
                credits: credits,
                searchTerm: searchTerm
            };

        } catch (error) {
            console.error('[DashboardBz] ❌ Erro durante automação:', error.message);
            throw error;
            
        } finally {
            // SEMPRE FECHAR O NAVEGADOR (liberar recursos)
            if (browser) {
                console.log('[DashboardBz] 🔒 Fechando navegador...');
                await browser.close();
                console.log('[DashboardBz] ✓ Navegador fechado');
            }
        }
    }

    /**
     * Resolver reCAPTCHA v2 usando Anti-Captcha
     */
    async solveRecaptchaV2(page, siteKey, apiKey) {
        console.log('[DashboardBz] 🔄 Enviando CAPTCHA para resolução...');
        const pageUrl = page.url();

        // Criar tarefa no Anti-Captcha
        const createTaskResponse = await axios.post('https://api.anti-captcha.com/createTask', {
            clientKey: apiKey,
            task: {
                type: 'RecaptchaV2TaskProxyless',
                websiteURL: pageUrl,
                websiteKey: siteKey,
                isInvisible: false
            }
        });

        if (createTaskResponse.data.errorId !== 0) {
            throw new Error(`Anti-Captcha Error: ${createTaskResponse.data.errorDescription}`);
        }

        const taskId = createTaskResponse.data.taskId;
        console.log(`[DashboardBz] 🔑 Task ID: ${taskId}`);

        // Aguardar resolução
        let solution = null;
        let attempts = 0;
        const maxAttempts = 60; // 60 tentativas = 3 minutos

        while (!solution && attempts < maxAttempts) {
            await this.delay(3000); // 3 segundos entre tentativas

            const resultResponse = await axios.post('https://api.anti-captcha.com/getTaskResult', {
                clientKey: apiKey,
                taskId: taskId
            });

            if (resultResponse.data.errorId !== 0) {
                throw new Error(`Anti-Captcha Error: ${resultResponse.data.errorDescription}`);
            }

            if (resultResponse.data.status === 'ready') {
                solution = resultResponse.data.solution.gRecaptchaResponse;
                console.log('[DashboardBz] ✅ CAPTCHA resolvido com sucesso!');
            } else {
                attempts++;
                console.log(`[DashboardBz] ⏳ Aguardando resolução... (${attempts}/${maxAttempts})`);
            }
        }

        if (!solution) {
            throw new Error('Timeout: CAPTCHA não foi resolvido a tempo (3 minutos)');
        }

        return solution;
    }

    /**
     * Injetar token do CAPTCHA na página
     */
    async injectCaptchaToken(page, token) {
        console.log('[DashboardBz] 💉 Injetando token do CAPTCHA...');
        
        await page.evaluate((captchaToken) => {
            // Preencher textarea do reCAPTCHA
            const textarea = document.getElementById('g-recaptcha-response');
            if (textarea) {
                textarea.innerHTML = captchaToken;
                textarea.value = captchaToken;
                textarea.style.display = 'block';
            }

            // Chamar callbacks do reCAPTCHA
            if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
                const clients = window.___grecaptcha_cfg.clients;
                Object.keys(clients).forEach((clientId) => {
                    const client = clients[clientId];
                    Object.keys(client).forEach((key) => {
                        const instance = client[key];
                        if (instance && typeof instance === 'object') {
                            if (instance.callback && typeof instance.callback === 'function') {
                                instance.callback(captchaToken);
                            }
                            Object.keys(instance).forEach((subKey) => {
                                const subInstance = instance[subKey];
                                if (subInstance && subInstance.callback && typeof subInstance.callback === 'function') {
                                    subInstance.callback(captchaToken);
                                }
                            });
                        }
                    });
                });
            }
        }, token);

        await this.delay(1500);
        console.log('[DashboardBz] ✓ Token injetado');
    }

    /**
     * Helper: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Adicionar créditos com retry automático
     */
    async addCreditsWithRetry(searchTerm, credits) {
        let lastError;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`\n[DashboardBz] 🔄 Tentativa ${attempt}/${this.maxRetries}`);
                
                const result = await this.addCredits(searchTerm, credits);
                
                console.log(`[DashboardBz] ✅ Sucesso na tentativa ${attempt}`);
                return {
                    success: true,
                    attempt: attempt,
                    response: result
                };

            } catch (error) {
                lastError = error;
                console.error(`[DashboardBz] ❌ Tentativa ${attempt} falhou: ${error.message}`);

                if (attempt < this.maxRetries) {
                    console.log(`[DashboardBz] ⏳ Aguardando 10 segundos antes de tentar novamente...`);
                    await this.delay(10000);
                }
            }
        }

        console.error(`[DashboardBz] 💥 Todas as ${this.maxRetries} tentativas falharam`);
        throw lastError;
    }
}

module.exports = DashboardBzService;
