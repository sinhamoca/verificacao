// server-modular.js - Sigma Recharge com Database Dinâmico por Admin + Super Admin
const express = require('express');
const path = require('path');
const fs = require('fs');

// Importar DatabaseManager
const dbManager = require('./models/DatabaseManager');
const MonitorService = require('./services/MonitorService');

// Importar rotas
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const superAdminRoutes = require('./routes/super-admin');

const app = express();
const PORT = process.env.PORT || 3010;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public-recharge'));
app.use('/super-admin', express.static('super-admin'));

// Log de requisições API
app.use('/api', (req, res, next) => {
    console.log(`[API] ${req.method} ${req.path} - ${new Date().toLocaleTimeString()}`);
    next();
});

// ========================================
// ROTAS PÚBLICAS
// ========================================
// NOTA: Rotas públicas ainda usam o database padrão
// porque não requerem autenticação
const Database = require('./models/Database');

// Criar pasta databases se não existir
const dbDir = path.join(__dirname, 'databases');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database padrão na pasta databases/
const defaultDbPath = path.join(dbDir, 'sigma_recharge_default.db');
const defaultDb = new Database(defaultDbPath);

app.use('/api/public', publicRoutes(defaultDb));

// ========================================
// ROTAS ADMIN
// ========================================
// NOTA: Rotas admin usam DatabaseManager
// Cada admin tem seu próprio database
app.use('/api/admin', adminRoutes);

// ========================================
// ROTAS SUPER ADMIN
// ========================================
app.use('/api/super-admin', superAdminRoutes);

// ========================================
// PÁGINAS
// ========================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-recharge', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public-recharge', 'admin.html'));
});

app.get('/super-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'super-admin', 'index.html'));
});

// Rota de teste
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API funcionando!', 
        timestamp: new Date().toISOString(),
        status: 'ok',
        version: '3.0.0-multi-admin',
        features: [
            'Database dinâmico por admin',
            'Isolamento total de dados',
            'Sessões independentes',
            'Sistema de licenciamento',
            'Super Admin Panel',
            'Suporte Sigma + Koffice + UNIPLAY'
        ]
    });
});

// Rota de estatísticas do manager (apenas para debug)
app.get('/api/manager-stats', (req, res) => {
    const stats = dbManager.getStats();
    res.json(stats);
});

// ========================================
// MONITOR DE PAGAMENTOS
// ========================================
// NOTA: O monitor ainda usa o database padrão
// Se quiser monitorar pagamentos de todos os admins,
// você precisará modificar o MonitorService
const paymentMonitor = new MonitorService(defaultDb);

// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('SIGMA RECHARGE - MULTI-ADMIN + SUPER ADMIN');
    console.log('='.repeat(60));
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Porta: ${PORT}`);
    console.log(`Versao: 3.0.0-multi-admin`);
    console.log('='.repeat(60));
    console.log('Arquitetura:');
    console.log('  ✓ Database dinâmico por admin');
    console.log('  ✓ Isolamento total de dados');
    console.log('  ✓ Cache de databases ativos');
    console.log('  ✓ Sessões independentes');
    console.log('  ✓ Sistema de licenciamento');
    console.log('  ✓ Super Admin Panel');
    console.log('='.repeat(60));
    console.log('Estrutura:');
    console.log('  - models/Database.js (base)');
    console.log('  - models/DatabaseManager.js (gerenciador)');
    console.log('  - models/SuperAdmin.js (super admin)');
    console.log('  - services/SigmaService.js');
    console.log('  - services/PaymentService.js');
    console.log('  - services/MonitorService.js');
    console.log('  - routes/public.js');
    console.log('  - routes/admin.js (atualizado)');
    console.log('  - routes/super-admin.js (novo)');
    console.log('='.repeat(60));
    console.log('Acessos:');
    console.log(`  Cliente:      http://localhost:${PORT}/`);
    console.log(`  Admin:        http://localhost:${PORT}/admin`);
    console.log(`  Super Admin:  http://localhost:${PORT}/super-admin`);
    console.log('='.repeat(60));
    console.log('Scripts de gerenciamento:');
    console.log('  node create-new-admin.js <username> <senha> [--days <dias>]');
    console.log('  node renew-admin.js <username> [--days <dias>]');
    console.log('  node list-admins.js');
    console.log('  node check-expired-admins.js');
    console.log('='.repeat(60));
    console.log('');
    
    // Iniciar monitor
    paymentMonitor.start();
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

process.on('SIGINT', () => {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('Encerrando servidor...');
    console.log('='.repeat(60));
    
    // Parar monitor
    paymentMonitor.stop();
    
    // Fechar database padrão
    defaultDb.close();
    
    // Fechar todos os databases do manager
    dbManager.closeAll();
    
    console.log('✓ Monitor parado');
    console.log('✓ Databases fechados');
    console.log('✓ Servidor encerrado');
    console.log('='.repeat(60));
    console.log('');
    
    process.exit(0);
});

// ========================================
// TRATAMENTO DE ERROS
// ========================================

process.on('uncaughtException', (error) => {
    console.error('');
    console.error('='.repeat(60));
    console.error('ERRO NÃO CAPTURADO');
    console.error('='.repeat(60));
    console.error(error);
    console.error('='.repeat(60));
    console.error('');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('');
    console.error('='.repeat(60));
    console.error('PROMISE REJEITADA');
    console.error('='.repeat(60));
    console.error('Motivo:', reason);
    console.error('='.repeat(60));
    console.error('');
});

module.exports = app;
