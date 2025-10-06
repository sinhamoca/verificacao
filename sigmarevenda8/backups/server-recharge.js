// server-recharge.js - Sigma Recharge System
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public-recharge'));

// Log de requisições
app.use('/api', (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
    next();
});

// Inicializar banco de dados
const db = new sqlite3.Database('sigma_recharge.db', (err) => {
    if (err) {
        console.error('Erro ao conectar com banco de dados:', err);
        process.exit(1);
    } else {
        console.log('Conectado ao banco de dados SQLite');
    }
});

// Criar tabelas
db.serialize(() => {
    console.log('Criando/verificando tabelas...');
    
    // Configurações do sistema
    db.run(`CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Usuários admin
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Painéis Sigma
    db.run(`CREATE TABLE IF NOT EXISTS sigma_panels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        admin_username TEXT NOT NULL,
        admin_password TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Revendedores
    db.run(`CREATE TABLE IF NOT EXISTS resellers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        panel_id INTEGER NOT NULL,
        sigma_user_id TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (panel_id) REFERENCES sigma_panels (id)
    )`);

    // Pacotes de créditos
    db.run(`CREATE TABLE IF NOT EXISTS credit_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reseller_id INTEGER NOT NULL,
        credits INTEGER NOT NULL,
        price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reseller_id) REFERENCES resellers (id)
    )`);

    // Pagamentos
    db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reseller_id INTEGER NOT NULL,
        package_id INTEGER NOT NULL,
        credits INTEGER NOT NULL,
        amount REAL NOT NULL,
        mp_payment_id TEXT,
        qr_code TEXT,
        qr_code_base64 TEXT,
        status TEXT DEFAULT 'pending',
        expires_at DATETIME,
        paid_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reseller_id) REFERENCES resellers (id),
        FOREIGN KEY (package_id) REFERENCES credit_packages (id)
    )`);

    // Transações (histórico de recargas)
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        reseller_id INTEGER NOT NULL,
        credits INTEGER NOT NULL,
        amount REAL NOT NULL,
        sigma_response TEXT,
        success BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments (id),
        FOREIGN KEY (reseller_id) REFERENCES resellers (id)
    )`);

    // Inserir configurações padrão
    db.get('SELECT * FROM system_config WHERE key = ?', ['access_question'], (err, row) => {
        if (!row) {
            db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                ['access_question', 'Com quantos paus se faz uma canoa?']);
            db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                ['access_answer', hashPassword('eusouandroid2029')]);
            db.run('INSERT INTO system_config (key, value) VALUES (?, ?)', 
                ['mp_access_token', '']);
            console.log('Configurações padrão criadas');
        }
    });

    // Criar admin padrão (admin/admin123)
    db.get('SELECT * FROM admin_users WHERE username = ?', ['admin'], (err, row) => {
        if (!row) {
            db.run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', 
                ['admin', hashPassword('admin123')], () => {
                console.log('Usuario admin criado: admin/admin123');
            });
        }
    });

    console.log('Tabelas verificadas/criadas com sucesso!');
});

// Funções auxiliares
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hash) {
    return hashPassword(password) === hash;
}

// Classe para automação Sigma (adaptada dos scripts)
class SigmaAutomation {
    constructor(domain, username, password) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.authToken = null;
        this.client = null;
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

    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async login() {
        this.client = this.createClient();
        
        const homeResponse = await this.client.get('/', { 
            validateStatus: () => true,
            maxRedirects: 3,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        
        if (homeResponse.status !== 200) {
            throw new Error(`Falha ao acessar página inicial: ${homeResponse.status}`);
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
            this.authToken = loginResponse.data.token;
            this.client.defaults.headers['Authorization'] = `Bearer ${this.authToken}`;
            return true;
        } else {
            throw new Error(`Login falhou: Status ${loginResponse.status}`);
        }
    }

    async findResellerByUsername(username) {
        const params = new URLSearchParams({
            page: '1',
            username: username,
            status: '',
            membershipActive: '',
            role: '',
            onlyThisReseller: '',
            creditsReadonly: '',
            countServer: 'true',
            perPage: '20'
        });

        const response = await this.client.get(`/api/resellers?${params.toString()}`, {
            validateStatus: () => true
        });

        if (response.status !== 200) {
            throw new Error(`Busca falhou: Status ${response.status}`);
        }

        if (!response.data.data || response.data.data.length === 0) {
            throw new Error(`Revendedor ${username} não encontrado`);
        }

        const exactMatch = response.data.data.find(r => 
            r.username.toLowerCase() === username.toLowerCase()
        );

        return exactMatch || response.data.data[0];
    }

    async addCredits(resellerId, credits) {
        const endpoint = `/api/resellers/${resellerId}/add-credits`;
        const payload = { credits: parseInt(credits) };

        const response = await this.client.post(endpoint, payload, {
            validateStatus: () => true
        });

        if (response.status === 200) {
            return response.data;
        } else {
            throw new Error(`Falha ao adicionar créditos: Status ${response.status}`);
        }
    }
}

// Monitor de pagamentos
class PaymentMonitor {
    constructor() {
        this.running = false;
        this.interval = null;
        this.processing = new Set(); // IDs sendo processados
    }

    start() {
        if (this.running) return;
        
        this.running = true;
        console.log('[Monitor] Iniciado - verificando pagamentos a cada 10 segundos');
        
        this.interval = setInterval(async () => {
            await this.checkPendingPayments();
        }, 10000); // 10 segundos
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.running = false;
        console.log('[Monitor] Parado');
    }

    async checkPendingPayments() {
        try {
            const payments = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT p.*, r.username, r.panel_id, sp.url, sp.admin_username, sp.admin_password, r.sigma_user_id
                    FROM payments p
                    JOIN resellers r ON p.reseller_id = r.id
                    JOIN sigma_panels sp ON r.panel_id = sp.id
                    WHERE p.status = 'pending'
                    AND (p.expires_at IS NULL OR p.expires_at > datetime('now'))
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            if (payments.length === 0) return;

            console.log(`[Monitor] Verificando ${payments.length} pagamento(s) pendente(s)`);

            for (const payment of payments) {
                // Evitar processar o mesmo pagamento múltiplas vezes simultaneamente
                if (this.processing.has(payment.id)) {
                    continue;
                }

                this.processing.add(payment.id);
                
                try {
                    await this.checkPaymentStatus(payment);
                } finally {
                    // Remover do set após 5 segundos
                    setTimeout(() => {
                        this.processing.delete(payment.id);
                    }, 5000);
                }
            }

        } catch (error) {
            console.error('[Monitor] Erro:', error.message);
        }
    }

    async checkPaymentStatus(payment) {
        try {
            // Verificar se temos o mp_payment_id
            if (!payment.mp_payment_id) {
                console.log(`[Monitor] Pagamento ${payment.id} sem mp_payment_id, ignorando`);
                return;
            }

            // Limpar mp_payment_id (remover .0 se houver)
            const cleanPaymentId = String(payment.mp_payment_id).replace('.0', '');

            // Buscar access token do Mercado Pago
            const mpToken = await new Promise((resolve, reject) => {
                db.get('SELECT value FROM system_config WHERE key = ?', ['mp_access_token'], (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.value : null);
                });
            });

            if (!mpToken) {
                console.log('[Monitor] Token Mercado Pago não configurado');
                return;
            }

            // Verificar status no Mercado Pago usando o mp_payment_id correto
            console.log(`[Monitor] Verificando MP Payment ID: ${cleanPaymentId}`);
            
            const response = await axios.get(
                `https://api.mercadopago.com/v1/payments/${cleanPaymentId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${mpToken}`
                    },
                    validateStatus: () => true
                }
            );

            if (response.status !== 200) {
                console.log(`[Monitor] Erro ao buscar pagamento MP: Status ${response.status}`);
                return;
            }

            const mpPayment = response.data;

            // Se foi aprovado
            if (mpPayment.status === 'approved') {
                console.log(`[Monitor] Pagamento ${payment.id} aprovado! Processando recarga...`);
                await this.processRecharge(payment);
            }
            
            // Se expirou
            else if (mpPayment.status === 'cancelled' || mpPayment.status === 'expired') {
                console.log(`[Monitor] Pagamento ${payment.id} expirado/cancelado`);
                await this.expirePayment(payment.id);
            }

        } catch (error) {
            console.error(`[Monitor] Erro ao verificar pagamento ${payment.id}:`, error.message);
        }
    }

    async processRecharge(payment) {
        try {
            // Fazer login e adicionar créditos
            const automation = new SigmaAutomation(
                payment.url,
                payment.admin_username,
                payment.admin_password
            );

            await automation.login();
            
            // Se não temos sigma_user_id, buscar
            let sigmaUserId = payment.sigma_user_id;
            if (!sigmaUserId) {
                const reseller = await automation.findResellerByUsername(payment.username);
                sigmaUserId = reseller.id;
                
                // Salvar para próximas vezes
                await new Promise((resolve, reject) => {
                    db.run('UPDATE resellers SET sigma_user_id = ? WHERE id = ?', 
                        [sigmaUserId, payment.reseller_id], 
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }

            const result = await automation.addCredits(sigmaUserId, payment.credits);

            // Atualizar pagamento como pago
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE payments 
                    SET status = 'paid', paid_at = datetime('now')
                    WHERE id = ?
                `, [payment.id], (err) => err ? reject(err) : resolve());
            });

            // Registrar transação
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO transactions 
                    (payment_id, reseller_id, credits, amount, sigma_response, success)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    payment.id,
                    payment.reseller_id,
                    payment.credits,
                    payment.amount,
                    JSON.stringify(result),
                    1
                ], (err) => err ? reject(err) : resolve());
            });

            console.log(`[Monitor] Recarga concluída: ${payment.credits} créditos para ${payment.username}`);

        } catch (error) {
            console.error(`[Monitor] Erro ao processar recarga:`, error.message);
            
            // Marcar como erro
            await new Promise((resolve) => {
                db.run(`
                    UPDATE payments 
                    SET status = 'error'
                    WHERE id = ?
                `, [payment.id], () => resolve());
            });
        }
    }

    async expirePayment(paymentId) {
        await new Promise((resolve, reject) => {
            db.run('UPDATE payments SET status = ? WHERE id = ?', 
                ['expired', paymentId], 
                (err) => err ? reject(err) : resolve()
            );
        });
    }
}

const paymentMonitor = new PaymentMonitor();

// ========================================
// ROTAS PÚBLICAS
// ========================================

// Página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-recharge', 'index.html'));
});

// Verificar senha de acesso
app.post('/api/public/verify-access', async (req, res) => {
    try {
        const { answer } = req.body;
        
        const config = await new Promise((resolve, reject) => {
            db.get('SELECT value FROM system_config WHERE key = ?', ['access_answer'], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!config) {
            return res.status(500).json({ error: 'Configuração não encontrada' });
        }

        const isValid = verifyPassword(answer, config.value);
        res.json({ valid: isValid });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buscar pergunta de acesso
app.get('/api/public/access-question', async (req, res) => {
    try {
        const config = await new Promise((resolve, reject) => {
            db.get('SELECT value FROM system_config WHERE key = ?', ['access_question'], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({ question: config ? config.value : 'Qual a senha de acesso?' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login do revendedor
app.post('/api/public/login', async (req, res) => {
    try {
        const { username } = req.body;
        
        const reseller = await new Promise((resolve, reject) => {
            db.get(`
                SELECT r.*, sp.name as panel_name, sp.url as panel_url
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE r.username = ? AND r.status = 'active'
            `, [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!reseller) {
            return res.status(404).json({ error: 'Revendedor não encontrado' });
        }

        res.json({
            id: reseller.id,
            username: reseller.username,
            panel_name: reseller.panel_name,
            panel_url: reseller.panel_url
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Listar pacotes do revendedor
app.get('/api/public/packages/:resellerId', async (req, res) => {
    try {
        const packages = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM credit_packages
                WHERE reseller_id = ?
                ORDER BY credits ASC
            `, [req.params.resellerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(packages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar pagamento
app.post('/api/public/create-payment', async (req, res) => {
    try {
        const { resellerId, packageId } = req.body;
        
        // Buscar dados do pacote
        const package = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM credit_packages WHERE id = ?', [packageId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!package) {
            return res.status(404).json({ error: 'Pacote não encontrado' });
        }

        // Buscar token do Mercado Pago
        const mpToken = await new Promise((resolve, reject) => {
            db.get('SELECT value FROM system_config WHERE key = ?', ['mp_access_token'], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });

        if (!mpToken) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }

        // Buscar informações do revendedor
        const resellerInfo = await new Promise((resolve, reject) => {
            db.get('SELECT username FROM resellers WHERE id = ?', [resellerId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Criar pagamento no Mercado Pago (formato mínimo que funciona)
        const mpResponse = await axios.post(
            'https://api.mercadopago.com/v1/payments',
            {
                transaction_amount: package.price,
                description: `${package.credits} creditos Sigma - ${resellerInfo.username}`,
                payment_method_id: 'pix',
                payer: {
                    email: 'cliente@example.com'
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${mpToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const mpPayment = mpResponse.data;
        const qrCodeData = mpPayment.point_of_interaction.transaction_data;

        // Salvar pagamento no banco (garantir que mp_payment_id seja string)
        const paymentId = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO payments 
                (reseller_id, package_id, credits, amount, mp_payment_id, qr_code, qr_code_base64, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 minutes'))
            `, [
                resellerId,
                packageId,
                package.credits,
                package.price,
                String(mpPayment.id), // Converter para string
                qrCodeData.qr_code,
                qrCodeData.qr_code_base64
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });

        res.json({
            payment_id: paymentId,
            qr_code: qrCodeData.qr_code,
            qr_code_base64: qrCodeData.qr_code_base64,
            amount: package.price,
            credits: package.credits,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        });

    } catch (error) {
        console.error('Erro ao criar pagamento:', error);
        
        // Extrair mensagem de erro do Mercado Pago se disponível
        let errorMessage = 'Erro ao criar pagamento';
        
        if (error.response && error.response.data) {
            console.error('Resposta do Mercado Pago:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.data.message) {
                errorMessage = error.response.data.message;
            } else if (error.response.data.cause) {
                errorMessage = error.response.data.cause[0]?.description || errorMessage;
            }
        }
        
        res.status(500).json({ error: errorMessage });
    }
});

// Verificar status do pagamento
app.get('/api/public/payment-status/:paymentId', async (req, res) => {
    try {
        const payment = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM payments WHERE id = ?', [req.params.paymentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!payment) {
            return res.status(404).json({ error: 'Pagamento não encontrado' });
        }

        res.json({
            status: payment.status,
            paid_at: payment.paid_at,
            expires_at: payment.expires_at
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NOVA ROTA: Verificação manual de pagamento
app.post('/api/public/check-payment/:paymentId', async (req, res) => {
    try {
        const payment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT p.*, r.username, r.panel_id, sp.url, sp.admin_username, sp.admin_password
                FROM payments p
                JOIN resellers r ON p.reseller_id = r.id
                JOIN sigma_panels sp ON r.panel_id = sp.id
                WHERE p.id = ?
            `, [req.params.paymentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!payment) {
            return res.status(404).json({ error: 'Pagamento não encontrado' });
        }

        if (payment.status === 'paid') {
            return res.json({ status: 'paid', message: 'Pagamento já foi processado' });
        }

        // Buscar token do Mercado Pago
        const mpToken = await new Promise((resolve, reject) => {
            db.get('SELECT value FROM system_config WHERE key = ?', ['mp_access_token'], (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            });
        });

        if (!mpToken) {
            return res.status(500).json({ error: 'Mercado Pago não configurado' });
        }

        // Limpar mp_payment_id
        const cleanPaymentId = String(payment.mp_payment_id).replace('.0', '');

        // Verificar no Mercado Pago
        const mpResponse = await axios.get(
            `https://api.mercadopago.com/v1/payments/${cleanPaymentId}`,
            {
                headers: {
                    'Authorization': `Bearer ${mpToken}`
                },
                validateStatus: () => true
            }
        );

        if (mpResponse.status !== 200) {
            return res.status(500).json({ error: 'Erro ao verificar pagamento no Mercado Pago' });
        }

        const mpPayment = mpResponse.data;

        if (mpPayment.status === 'approved') {
            // Processar pagamento
            const paymentMonitor = new PaymentMonitor();
            await paymentMonitor.processRecharge(payment);
            
            return res.json({ 
                status: 'paid', 
                message: 'Pagamento confirmado e créditos adicionados!' 
            });
        } else {
            return res.json({ 
                status: mpPayment.status, 
                message: `Pagamento ainda não foi aprovado. Status: ${mpPayment.status}` 
            });
        }

    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        res.status(500).json({ error: error.message });
    }
});

// Dashboard do revendedor
app.get('/api/public/dashboard/:resellerId', async (req, res) => {
    try {
        // Últimos pagamentos
        const payments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT p.*, cp.credits as package_credits
                FROM payments p
                LEFT JOIN credit_packages cp ON p.package_id = cp.id
                WHERE p.reseller_id = ?
                ORDER BY p.created_at DESC
                LIMIT 10
            `, [req.params.resellerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Estatísticas
        const stats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as total_payments,
                    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'paid' THEN credits ELSE 0 END) as total_credits,
                    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_spent
                FROM payments
                WHERE reseller_id = ?
            `, [req.params.resellerId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            payments,
            stats
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// ROTAS ADMIN
// ========================================

// Login admin
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const admin = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM admin_users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!admin || !verifyPassword(password, admin.password_hash)) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        res.json({ success: true, admin_id: admin.id });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configurações do sistema
app.get('/api/admin/config', async (req, res) => {
    try {
        const configs = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM system_config', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/config/:key', async (req, res) => {
    try {
        const { value } = req.body;
        const { key } = req.params;
        
        let finalValue = value;
        
        // Hash para senha de acesso
        if (key === 'access_answer') {
            finalValue = hashPassword(value);
        }

        await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO system_config (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
            `, [key, finalValue], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CRUD Painéis Sigma
app.get('/api/admin/panels', async (req, res) => {
    try {
        const panels = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM sigma_panels ORDER BY created_at DESC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        res.json(panels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/panels', async (req, res) => {
    try {
        const { name, url, admin_username, admin_password } = req.body;
        
        const id = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO sigma_panels (name, url, admin_username, admin_password)
                VALUES (?, ?, ?, ?)
            `, [name, url, admin_username, admin_password], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });

        res.json({ id, message: 'Painel criado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/panels/:id', async (req, res) => {
    try {
        const { name, url, admin_username, admin_password, status } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE sigma_panels 
                SET name = ?, url = ?, admin_username = ?, admin_password = ?, status = ?
                WHERE id = ?
            `, [name, url, admin_username, admin_password, status, req.params.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ message: 'Painel atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/panels/:id', async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM sigma_panels WHERE id = ?', [req.params.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ message: 'Painel excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CRUD Revendedores
app.get('/api/admin/resellers', async (req, res) => {
    try {
        const resellers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT r.*, sp.name as panel_name, sp.url as panel_url
                FROM resellers r
                JOIN sigma_panels sp ON r.panel_id = sp.id
                ORDER BY r.created_at DESC
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        res.json(resellers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/resellers', async (req, res) => {
    try {
        const { username, panel_id } = req.body;
        
        const id = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO resellers (username, panel_id)
                VALUES (?, ?)
            `, [username, panel_id], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });

        res.json({ id, message: 'Revendedor criado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/resellers/:id', async (req, res) => {
    try {
        const { username, panel_id, status } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE resellers 
                SET username = ?, panel_id = ?, status = ?
                WHERE id = ?
            `, [username, panel_id, status, req.params.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ message: 'Revendedor atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/resellers/:id', async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM resellers WHERE id = ?', [req.params.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ message: 'Revendedor excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CRUD Pacotes de Créditos
app.get('/api/admin/packages/:resellerId', async (req, res) => {
    try {
        const packages = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM credit_packages
                WHERE reseller_id = ?
                ORDER BY credits ASC
            `, [req.params.resellerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        res.json(packages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/packages', async (req, res) => {
    try {
        const { reseller_id, credits, price } = req.body;
        
        const id = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO credit_packages (reseller_id, credits, price)
                VALUES (?, ?, ?)
            `, [reseller_id, credits, price], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });

        res.json({ id, message: 'Pacote criado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/packages/:id', async (req, res) => {
    try {
        const { credits, price } = req.body;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE credit_packages 
                SET credits = ?, price = ?
                WHERE id = ?
            `, [credits, price, req.params.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ message: 'Pacote atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/packages/:id', async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM credit_packages WHERE id = ?', [req.params.id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ message: 'Pacote excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Relatórios e estatísticas admin
app.get('/api/admin/stats', async (req, res) => {
    try {
        const stats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM sigma_panels WHERE status = 'active') as active_panels,
                    (SELECT COUNT(*) FROM resellers WHERE status = 'active') as active_resellers,
                    (SELECT COUNT(*) FROM payments WHERE status = 'paid') as total_payments,
                    (SELECT SUM(amount) FROM payments WHERE status = 'paid') as total_revenue,
                    (SELECT SUM(credits) FROM payments WHERE status = 'paid') as total_credits_sold,
                    (SELECT COUNT(*) FROM payments WHERE status = 'pending') as pending_payments
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/transactions', async (req, res) => {
    try {
        const transactions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT t.*, r.username, p.amount
                FROM transactions t
                JOIN resellers r ON t.reseller_id = r.id
                JOIN payments p ON t.payment_id = p.id
                ORDER BY t.created_at DESC
                LIMIT 50
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NOVA ROTA: Listar todos os pagamentos
app.get('/api/admin/payments', async (req, res) => {
    try {
        const payments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT p.*, r.username as reseller_username
                FROM payments p
                LEFT JOIN resellers r ON p.reseller_id = r.id
                ORDER BY p.created_at DESC
                LIMIT 200
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NOVA ROTA: Excluir todos os pagamentos pendentes (DEVE VIR ANTES da rota com :id)
app.delete('/api/admin/payments/pending', async (req, res) => {
    try {
        const result = await new Promise((resolve, reject) => {
            db.run('DELETE FROM payments WHERE status = ?', ['pending'], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        res.json({ message: `${result} pagamento(s) excluído(s) com sucesso` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NOVA ROTA: Excluir pagamento específico
app.delete('/api/admin/payments/:id', async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM payments WHERE id = ? AND status = ?', [req.params.id, 'pending'], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        res.json({ message: 'Pagamento excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('SIGMA RECHARGE - SISTEMA DE VENDA DE CREDITOS');
    console.log('='.repeat(60));
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Porta: ${PORT}`);
    console.log(`Banco: sigma_recharge.db`);
    console.log('='.repeat(60));
    console.log('Admin padrao: admin / admin123');
    console.log('Senha acesso: eusouandroid2029');
    console.log('='.repeat(60));
    console.log('');
    
    // Iniciar monitor de pagamentos
    paymentMonitor.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nEncerrando servidor...');
    paymentMonitor.stop();
    db.close();
    process.exit(0);
});

module.exports = app;
