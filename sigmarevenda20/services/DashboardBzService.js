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
        console.log(`[DashboardBz] 🔥 Solicitação recebida: ${searchTerm} (${credits} créditos)`);
        
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

            // 2. ✅ DETECTAR PROXYCHAINS (igual ao Sigma/Koffice/GesOffice)
            const isProxychains = !!process.env.PROXYCHAINS_CONF_FILE;
            
            if (isProxychains) {
                console.log('[DashboardBz] ✓ Proxychains DETECTADO - usando proxy do processo');
            } else {
                console.log('[DashboardBz] ⚠️ Proxychains NÃO DETECTADO - usando IP direto');
            }

            // 3. ABRIR NAVEGADOR (herda proxy do processo via proxychains)
            console.log('[DashboardBz] 🌐 Abrindo navegador...');
            
            // ✅ Args otimizados para máxima stealth (baseado no manual + melhorias)
            const launchOptions = {
                headless: 'new',  // Modo headless moderno
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--disable-extensions',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
                    '--disable-web-security',
                    '--single-process',
                    '--no-zygote',
                    '--window-size=1366,768',
                    // ✅ NOVOS: Simular navegador real
                    '--disable-infobars',
                    '--disable-notifications',
                    '--disable-popup-blocking',
                    '--disable-save-password-bubble',
                    '--disable-translate',
                    '--disable-default-apps',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-breakpad',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                    '--disable-ipc-flooding-protection',
                    '--disable-renderer-backgrounding',
                    '--enable-features=NetworkService,NetworkServiceInProcess',
                    '--force-color-profile=srgb',
                    '--hide-scrollbars',
                    '--metrics-recording-only',
                    '--mute-audio'
                ],
                ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
                defaultViewport: null
            };

            browser = await puppeteer.launch(launchOptions);

            page = await browser.newPage();
            page.setDefaultNavigationTimeout(90000);
            page.setDefaultTimeout(90000);
            
            await page.setViewport({ width: 1366, height: 768 });
            
            // ✅ User agents MUITO RECENTES e realistas
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            ];
            const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
            await page.setUserAgent(randomUA);
            
            // ✅ Anti-detecção MÁXIMA (todas as técnicas combinadas)
            await page.evaluateOnNewDocument(() => {
                // 1. Remover webdriver
                Object.defineProperty(navigator, 'webdriver', { 
                    get: () => false 
                });
                
                // 2. Plugins fake realistas
                Object.defineProperty(navigator, 'plugins', { 
                    get: () => [
                        {
                            0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
                            description: "Portable Document Format",
                            filename: "internal-pdf-viewer",
                            length: 1,
                            name: "Chrome PDF Plugin"
                        },
                        {
                            0: {type: "application/pdf", suffixes: "pdf", description: ""},
                            description: "",
                            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                            length: 1,
                            name: "Chrome PDF Viewer"
                        },
                        {
                            0: {type: "application/x-nacl", suffixes: "", description: "Native Client Executable"},
                            1: {type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable"},
                            description: "",
                            filename: "internal-nacl-plugin",
                            length: 2,
                            name: "Native Client"
                        }
                    ]
                });
                
                // 3. Languages realistas
                Object.defineProperty(navigator, 'languages', { 
                    get: () => ['pt-BR', 'pt', 'en-US', 'en'] 
                });
                
                // 4. Chrome object completo
                window.chrome = {
                    app: {},
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {}
                };
                
                // 5. Permissions API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                // 6. Battery API fake
                Object.defineProperty(navigator, 'getBattery', {
                    get: () => () => Promise.resolve({
                        charging: true,
                        chargingTime: 0,
                        dischargingTime: Infinity,
                        level: 1
                    })
                });
                
                // 7. Connection API
                Object.defineProperty(navigator, 'connection', {
                    get: () => ({
                        effectiveType: '4g',
                        downlink: 10,
                        rtt: 50,
                        saveData: false
                    })
                });
                
                // 8. Hardwares Concurrency
                Object.defineProperty(navigator, 'hardwareConcurrency', {
                    get: () => 8
                });
                
                // 9. Device Memory
                Object.defineProperty(navigator, 'deviceMemory', {
                    get: () => 8
                });
                
                // 10. Screen realista
                Object.defineProperty(screen, 'availWidth', { get: () => 1366 });
                Object.defineProperty(screen, 'availHeight', { get: () => 728 });
                Object.defineProperty(screen, 'width', { get: () => 1366 });
                Object.defineProperty(screen, 'height', { get: () => 768 });
                Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
                Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
            });

            console.log('[DashboardBz] ✓ Navegador configurado');

            // ✅ Verificar IP (se proxychains habilitado)
            if (isProxychains) {
                try {
                    console.log('[DashboardBz] 🔍 Verificando IP através do proxy...');
                    await page.goto('https://api.ipify.org?format=json', { 
                        waitUntil: 'networkidle0', 
                        timeout: 30000 
                    });
                    await this.delay(2000);
                    
                    const ipInfo = await page.evaluate(() => {
                        return document.body.innerText;
                    });
                    
                    console.log(`[DashboardBz] 🌍 IP detectado: ${ipInfo}`);
                } catch (e) {
                    console.log('[DashboardBz] ⚠️ Não foi possível verificar IP:', e.message);
                }
            }

            // 4. FAZER LOGIN
            console.log('[DashboardBz] 🔐 Acessando página de login...');
            const loginUrl = `${this.panel.url}/login.php`;
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
            await this.delay(5000);

            // ✅ SCREENSHOT DA PÁGINA DE LOGIN (para debug)
            try {
                const screenshotPath = `/tmp/dashboardbz-login-page-${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`[DashboardBz] 📸 Screenshot da página de login salvo: ${screenshotPath}`);
            } catch (e) {
                console.log('[DashboardBz] ⚠️ Não foi possível tirar screenshot:', e.message);
            }

            // ✅ Verificar se reCAPTCHA está presente no HTML
            const captchaDebug = await page.evaluate(() => {
                return {
                    hasGRecaptchaClass: !!document.querySelector('.g-recaptcha'),
                    hasGRecaptchaId: !!document.getElementById('g-recaptcha'),
                    hasRecaptchaIframe: !!document.querySelector('iframe[src*="recaptcha"]'),
                    recaptchaScripts: Array.from(document.querySelectorAll('script[src*="recaptcha"]')).map(s => s.src),
                    totalScripts: document.querySelectorAll('script').length,
                    bodyClasses: document.body.className,
                    htmlContent: document.documentElement.innerHTML.substring(0, 500)
                };
            });
            
            console.log('[DashboardBz] 🔍 Debug do reCAPTCHA:', JSON.stringify(captchaDebug, null, 2));

            // ✅ Aguardar container do reCAPTCHA (aumentar timeout)
            console.log('[DashboardBz] ⏳ Aguardando container do reCAPTCHA...');
            try {
                await page.waitForSelector('.g-recaptcha, iframe[src*="recaptcha"]', { timeout: 30000 });
                console.log('[DashboardBz] ✓ Container do reCAPTCHA encontrado');
            } catch (e) {
                console.log('[DashboardBz] ❌ reCAPTCHA não encontrado após 30s');
                console.log('[DashboardBz] 💡 Possível bloqueio de automação detectado');
                
                // Screenshot do erro
                try {
                    const errorScreenshot = `/tmp/dashboardbz-no-captcha-${Date.now()}.png`;
                    await page.screenshot({ path: errorScreenshot, fullPage: true });
                    console.log(`[DashboardBz] 📸 Screenshot do erro salvo: ${errorScreenshot}`);
                } catch {}
                
                throw new Error('Container do reCAPTCHA não encontrado - possível bloqueio de automação');
            }
            
            await this.delay(2000);

            // Preencher credenciais
            console.log('[DashboardBz] ✏️  Preenchendo credenciais...');
            await page.type('#username', this.panel.admin_username, { delay: 100 });
            await page.type('#password', this.panel.admin_password, { delay: 100 });
            await this.delay(1000);

            // Resolver CAPTCHA
            console.log('[DashboardBz] 🤖 Resolvendo reCAPTCHA...');
            const captchaToken = await this.solveRecaptchaV2(page, this.panel.site_key, anticaptchaKey);
            console.log(`[DashboardBz] 🔑 Token obtido (${captchaToken.length} caracteres)`);

            // ✅ SCREENSHOT ANTES DA INJEÇÃO (para debug)
            try {
                const screenshotPath = `/tmp/dashboardbz-before-inject-${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath, fullPage: false });
                console.log(`[DashboardBz] 📸 Screenshot salvo: ${screenshotPath}`);
            } catch (e) {
                console.log('[DashboardBz] ⚠️ Não foi possível tirar screenshot:', e.message);
            }

            // ✅ Injetar token do CAPTCHA
            await this.injectCaptchaToken(page, captchaToken);

            // Submeter formulário
            console.log('[DashboardBz] 🖱️  Submetendo login...');
            await page.click('#submitt');
            
            // ✅ Aguardar resposta (sem Promise.all, mais simples como no manual)
            await this.delay(4000);

            // Verificar popup
            console.log('[DashboardBz] ⏳ Verificando resposta do login...');
            
            // ✅ Verificar URL ANTES de processar popup
            let currentUrl = page.url();
            console.log(`[DashboardBz] 🌐 URL imediata: ${currentUrl}`);
            
            const popupExists = await page.$('.swal2-popup');
            if (popupExists) {
                const popupContent = await page.evaluate(() => {
                    const title = document.querySelector('.swal2-title');
                    const content = document.querySelector('.swal2-html-container, .swal2-content');
                    const icon = document.querySelector('.swal2-icon');
                    
                    return {
                        title: title ? title.innerText : '',
                        content: content ? content.innerText : '',
                        iconType: icon ? icon.className : '',
                        hasError: icon?.classList.contains('swal2-error'),
                        hasWarning: icon?.classList.contains('swal2-warning'),
                        hasSuccess: icon?.classList.contains('swal2-success')
                    };
                });

                console.log(`[DashboardBz] 📋 Popup detectado:`);
                console.log(`[DashboardBz]    Título: ${popupContent.title}`);
                
                // Mostrar preview do conteúdo
                const contentPreview = popupContent.content.length > 150 
                    ? popupContent.content.substring(0, 150) + '...' 
                    : popupContent.content;
                console.log(`[DashboardBz]    Conteúdo: ${contentPreview}`);
                console.log(`[DashboardBz]    Tipo: ${popupContent.hasError ? 'ERROR' : popupContent.hasWarning ? 'WARNING' : popupContent.hasSuccess ? 'SUCCESS' : 'UNKNOWN'}`);

                // ✅ Verificar se é ERRO DE CAPTCHA (melhorado como no manual)
                const contentLower = popupContent.content.toLowerCase();
                if (contentLower.includes('captcha') && 
                    (contentLower.includes('erro') || 
                     contentLower.includes('falha') || 
                     contentLower.includes('interpretar') ||
                     contentLower.includes('dados do captcha'))) {
                    console.log('[DashboardBz] ❌ ERRO: Falha na validação do CAPTCHA pelo servidor');
                    console.log('[DashboardBz]    O servidor rejeitou o token do CAPTCHA');
                    await page.click('.swal2-confirm').catch(() => {});
                    throw new Error('CAPTCHA rejeitado pelo servidor - token não foi aceito');
                }

                // ✅ Popup de aviso normal (continua)
                console.log('[DashboardBz] ✅ Popup de aviso (normal). Fechando...');
                await page.waitForSelector('.swal2-confirm', { timeout: 5000 });
                await this.delay(500);
                await page.click('.swal2-confirm');
                console.log('[DashboardBz] ✓ Popup fechado');
                
                // Aguardar navegação após fechar popup
                await this.delay(4000);
            }

            // ✅ VERIFICAR URL FINAL
            currentUrl = page.url();
            console.log('[DashboardBz] 🔗 URL final:', currentUrl);

            if (!currentUrl.includes('index.php') && !currentUrl.includes('dashboard')) {
                // Tentar capturar erro adicional
                const hasErrorPopup = await page.$('.swal2-popup');
                if (hasErrorPopup) {
                    const errorContent = await page.evaluate(() => {
                        const content = document.querySelector('.swal2-html-container, .swal2-content');
                        return content ? content.innerText : '';
                    });
                    console.error(`[DashboardBz] ❌ Erro adicional detectado: ${errorContent}`);
                }
                
                throw new Error(`Login falhou - não redirecionou para index.php (URL: ${currentUrl})`);
            }

            console.log('[DashboardBz] ✅ Login realizado com sucesso!');

            // 5. NAVEGAR PARA REVENDEDORES
            console.log('[DashboardBz] 📂 Acessando página de revendedores...');
            await page.goto(`${this.panel.url}/revendedores.php`, { 
                waitUntil: 'domcontentloaded', 
                timeout: 30000 
            });
            await this.delay(2000);

            // 6. BUSCAR USUÁRIO
            console.log(`[DashboardBz] 🔍 Pesquisando usuário: ${searchTerm}`);
            const searchInput = await page.waitForSelector('input[type="search"][aria-controls="dataTable"]', { 
                timeout: 10000 
            });
            
            await searchInput.click({ clickCount: 3 });
            await searchInput.type(searchTerm, { delay: 100 });
            await this.delay(2000);

            // 7. ENCONTRAR DROPDOWN DINÂMICO
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

            // 8. ABRIR DROPDOWN
            console.log('[DashboardBz] 🖱️  Abrindo dropdown...');
            await page.click(`a[onclick*="toogleshow('${dropdownId}')"]`);
            await this.delay(1500);

            // 9. CLICAR EM ADICIONAR CRÉDITOS
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

            // 10. PREENCHER VALOR
            console.log(`[DashboardBz] ✏️  Digitando créditos: ${credits}`);
            const creditInput = await page.waitForSelector('#swal-input1', { timeout: 10000 });
            await creditInput.click();
            await creditInput.type(credits.toString(), { delay: 100 });
            await this.delay(500);

            // 11. CONFIRMAR
            console.log('[DashboardBz] ✅ Confirmando...');
            await page.click('button.swal2-confirm.swal2-styled');
            await this.delay(2000);

            // 12. VERIFICAR RESULTADO
            console.log('[DashboardBz] 📋 Verificando resultado...');
            const resultPopup = await page.$('.swal2-popup');
            let resultText = 'Sucesso';
            
            if (resultPopup) {
                resultText = await page.evaluate(() => {
                    const popup = document.querySelector('.swal2-popup');
                    return popup ? popup.innerText : 'Sucesso';
                });
                
                console.log(`[DashboardBz] 📋 Resposta do sistema: ${resultText}`);
                
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
                searchTerm: searchTerm,
                usedProxy: isProxychains
            };

        } catch (error) {
            console.error('[DashboardBz] ❌ Erro durante automação:', error.message);
            throw error;
            
        } finally {
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
        console.log('[DashboardBz] 📤 Enviando CAPTCHA para resolução...');
        const pageUrl = page.url();

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

        let solution = null;
        let attempts = 0;
        const maxAttempts = 60;

        while (!solution && attempts < maxAttempts) {
            await this.delay(3000);

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
     * Injetar token do CAPTCHA na página (MELHORADO baseado no código manual)
     */
    async injectCaptchaToken(page, token) {
        console.log('[DashboardBz] 💉 Injetando token do CAPTCHA (método avançado)...');
        
        // ✅ Habilitar logs do browser
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('✅') || text.includes('⚠️') || text.includes('❌') || text.includes('🎯') || text.includes('📢')) {
                console.log('[DashboardBz] 🌐 [Browser]:', text);
            }
        });
        
        const injected = await page.evaluate((captchaToken) => {
            try {
                let results = {
                    textareaFound: false,
                    textareaInjected: false,
                    callbackExecuted: false,
                    widgetFound: false
                };

                // 1. Injetar no textarea principal
                const textarea = document.getElementById('g-recaptcha-response');
                if (textarea) {
                    results.textareaFound = true;
                    textarea.innerHTML = captchaToken;
                    textarea.value = captchaToken;
                    textarea.style.display = 'block';
                    results.textareaInjected = true;
                    console.log('✅ Token injetado no textarea principal');
                }

                // 2. Procurar TODOS os textareas do reCAPTCHA (pode haver múltiplos)
                const allTextareas = document.querySelectorAll('textarea[name="g-recaptcha-response"]');
                allTextareas.forEach((ta, index) => {
                    ta.innerHTML = captchaToken;
                    ta.value = captchaToken;
                    ta.style.display = 'block';
                    console.log(`✅ Token injetado em textarea ${index + 1}`);
                });

                // 3. Procurar e executar callbacks do reCAPTCHA
                if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
                    const clients = window.___grecaptcha_cfg.clients;
                    results.widgetFound = true;
                    
                    Object.keys(clients).forEach((clientId) => {
                        const client = clients[clientId];
                        
                        Object.keys(client).forEach((key) => {
                            const obj = client[key];
                            
                            if (obj && typeof obj === 'object') {
                                // Callback direto
                                if (obj.callback && typeof obj.callback === 'function') {
                                    console.log('🎯 Executando callback principal do widget');
                                    try {
                                        obj.callback(captchaToken);
                                        results.callbackExecuted = true;
                                    } catch (e) {
                                        console.log('⚠️ Erro ao executar callback:', e.message);
                                    }
                                }
                                
                                // Procurar callbacks aninhados
                                Object.keys(obj).forEach((subKey) => {
                                    const subObj = obj[subKey];
                                    if (subObj && typeof subObj === 'object') {
                                        if (subObj.callback && typeof subObj.callback === 'function') {
                                            console.log('🎯 Executando callback aninhado');
                                            try {
                                                subObj.callback(captchaToken);
                                                results.callbackExecuted = true;
                                            } catch (e) {
                                                console.log('⚠️ Erro ao executar callback aninhado:', e.message);
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    });
                }

                // 4. Disparar eventos
                if (textarea) {
                    const events = ['input', 'change', 'blur'];
                    events.forEach(eventType => {
                        const event = new Event(eventType, { bubbles: true, cancelable: true });
                        textarea.dispatchEvent(event);
                    });
                    console.log('📢 Eventos disparados no textarea');
                }

                // 5. Tentar marcar o widget como resolvido
                if (window.___grecaptcha_cfg) {
                    try {
                        const widgets = document.querySelectorAll('.g-recaptcha');
                        widgets.forEach(widget => {
                            widget.setAttribute('data-callback', 'console.log');
                            widget.setAttribute('data-response', captchaToken);
                        });
                    } catch (e) {
                        console.log('⚠️ Erro ao marcar widget:', e.message);
                    }
                }

                return results;
                
            } catch (error) {
                console.error('❌ Erro na injeção:', error.message);
                return {
                    success: false,
                    error: error.message
                };
            }
        }, token);

        console.log('[DashboardBz] 📋 Resultado da injeção:', JSON.stringify(injected, null, 2));
        
        // Aguardar processamento
        await this.delay(3000);
        
        // Verificar injeção
        const verification = await page.evaluate(() => {
            const textarea = document.getElementById('g-recaptcha-response');
            const allTextareas = document.querySelectorAll('textarea[name="g-recaptcha-response"]');
            return {
                mainTextareaHasValue: textarea && textarea.value && textarea.value.length > 0,
                mainTextareaLength: textarea ? textarea.value.length : 0,
                totalTextareas: allTextareas.length,
                allFilled: Array.from(allTextareas).every(ta => ta.value && ta.value.length > 0)
            };
        });
        
        console.log('[DashboardBz] 🔍 Verificação:', JSON.stringify(verification, null, 2));
        
        if (!verification.mainTextareaHasValue) {
            throw new Error('Token do CAPTCHA não foi injetado corretamente!');
        }
        
        console.log('[DashboardBz] ✅ Token injetado e verificado com sucesso!');
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