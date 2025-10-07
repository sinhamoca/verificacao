// server-modular.js - Sigma Recharge (Modular) - COM MULTI-TENANT
const express = require('express');
const path = require('path');

// Importar models e services
const Database = require('./models/Database');
const MonitorService = require('./services/MonitorService');

// Importar rotas
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware básico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public-recharge'));

// Log de requisições API
app.use('/api', (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
    next();
});

// Inicializar banco de dados
const db = new Database();

// ⭐ NOVO: MIDDLEWARE PARA DETECTAR TENANT VIA QUERY PARAMETER
app.use(async (req, res, next) => {
    // Pegar tenant da query: ?tenant=joao ou ?t=joao
    const tenantSlug = req.query.tenant || req.query.t;
    
    if (tenantSlug) {
        try {
            const tenant = await db.get(
                'SELECT * FROM tenants WHERE slug = ? AND status = ?',
                [tenantSlug, 'active']
            );
            
            if (tenant) {
                // ⭐ Adicionar informações do tenant no request
                req.tenantId = tenant.id;
                req.tenantSlug = tenant.slug;
                req.tenantName = tenant.name;
                
                console.log(`[Tenant] ${tenantSlug} → ID ${tenant.id} (${tenant.name})`);
            } else {
                console.log(`[Tenant] ⚠️ Não encontrado: ${tenantSlug}`);
            }
        } catch (error) {
            console.error('[Tenant] Erro ao buscar:', error.message);
        }
    }
    
    next();
});

// Rotas públicas (agora recebem req.tenantId automaticamente)
app.use('/api/public', publicRoutes(db));

// Rotas admin (agora recebem req.tenantId automaticamente)
app.use('/api/admin', adminRoutes(db));

// Páginas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-recharge', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-recharge', 'admin.html'));
});

// ⭐ NOVO: Rota de teste com info do tenant
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API funcionando!', 
        timestamp: new Date().toISOString(),
        status: 'ok',
        version: '3.0.0-multitenant',
        tenant: req.tenantId ? {
            id: req.tenantId,
            slug: req.tenantSlug,
            name: req.tenantName
        } : null
    });
});

// Inicializar monitor de pagamentos
const paymentMonitor = new MonitorService(db);

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('SIGMA RECHARGE - SISTEMA MULTI-TENANT');
    console.log('='.repeat(60));
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Porta: ${PORT}`);
    console.log(`Versao: 3.0.0-multitenant`);
    console.log('='.repeat(60));
    console.log('Estrutura:');
    console.log('  - models/Database.js');
    console.log('  - services/SigmaService.js');
    console.log('  - services/PaymentService.js');
    console.log('  - services/MonitorService.js');
    console.log('  - routes/public.js');
    console.log('  - routes/admin.js');
    console.log('='.repeat(60));
    console.log('Multi-Tenant:');
    console.log('  - Exemplo: http://localhost:3010/?tenant=teste');
    console.log('  - Curto:   http://localhost:3010/?t=teste');
    console.log('='.repeat(60));
    console.log('');
    
    // Iniciar monitor
    paymentMonitor.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nEncerrando servidor...');
    paymentMonitor.stop();
    db.close();
    process.exit(0);
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promise rejeitada:', reason);
});

module.exports = app;
