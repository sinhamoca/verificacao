// server-modular.js - Sigma Recharge (Modular)
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

// Middleware
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

// Rotas públicas
app.use('/api/public', publicRoutes(db));

// Rotas admin
app.use('/api/admin', adminRoutes(db));

// Páginas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-recharge', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-recharge', 'admin.html'));
});

// Rota de teste
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API funcionando!', 
        timestamp: new Date().toISOString(),
        status: 'ok',
        version: '2.0.0-modular'
    });
});

// Inicializar monitor de pagamentos
const paymentMonitor = new MonitorService(db);

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('SIGMA RECHARGE - SISTEMA MODULAR');
    console.log('='.repeat(60));
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Porta: ${PORT}`);
    console.log(`Versao: 2.0.0-modular`);
    console.log('='.repeat(60));
    console.log('Estrutura:');
    console.log('  - models/Database.js');
    console.log('  - services/SigmaService.js');
    console.log('  - services/PaymentService.js');
    console.log('  - services/MonitorService.js');
    console.log('  - routes/public.js');
    console.log('  - routes/admin.js');
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
