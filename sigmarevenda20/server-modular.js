// server-modular.js - Sigma Recharge (Modular) - COM MULTI-TENANT + EXPIRAÇÃO
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

// Limpar locks expirados ao iniciar
const cleanupExpiredLocks = require('./cleanup-locks');

// ═════════════════════════════════════════════════════════════════
// ⭐ MIDDLEWARE PARA DETECTAR TENANT E VALIDAR EXPIRAÇÃO
// ═════════════════════════════════════════════════════════════════
app.use(async (req, res, next) => {
    // Pegar tenant da query: ?tenant=joao ou ?t=joao
    const tenantSlug = req.query.tenant || req.query.t;
    
    if (tenantSlug) {
        try {
            // ⭐ USAR O NOVO MÉTODO QUE JÁ VALIDA EXPIRAÇÃO
            const tenant = await db.getValidTenant(tenantSlug);
            
            if (tenant) {
                // ✅ Tenant encontrado e válido (ativo + não expirado)
                req.tenantId = tenant.id;
                req.tenantSlug = tenant.slug;
                req.tenantName = tenant.name;
                req.tenantExpiresAt = tenant.expires_at;
                
                const expInfo = tenant.expires_at ? 
                    `Expira: ${tenant.expires_at}` : 
                    'Sem expiração';
                
                console.log(`[Tenant] ✅ ${tenantSlug} → ID ${tenant.id} (${tenant.name}) - ${expInfo}`);
            } else {
                // ❌ Tenant não encontrado, inativo ou expirado
                console.log(`[Tenant] ⚠️ Inativo/Expirado/Não encontrado: ${tenantSlug}`);
                
                // ⭐ VERIFICAR DETALHES DA EXPIRAÇÃO
                const checkTenant = await db.get(
                    'SELECT id, name, slug, status, expires_at FROM tenants WHERE slug = ?',
                    [tenantSlug]
                );
                
                if (checkTenant) {
                    const now = new Date().toISOString().split('T')[0];
                    const isExpired = checkTenant.expires_at && checkTenant.expires_at < now;
                    
                    if (isExpired) {
                        console.log(`[Tenant] 🔒 ${tenantSlug} EXPIRADO em ${checkTenant.expires_at}`);
                    } else if (checkTenant.status !== 'active') {
                        console.log(`[Tenant] 🔒 ${tenantSlug} está INATIVO`);
                    }
                }
                
                // Para rotas de API, retornar erro JSON
                if (req.path.startsWith('/api/')) {
                    return res.status(403).json({ 
                        error: 'Acesso não disponível. Entre em contato com o suporte.',
                        code: 'TENANT_UNAVAILABLE',
                        details: checkTenant && checkTenant.expires_at && checkTenant.expires_at < new Date().toISOString().split('T')[0] 
                            ? 'Sistema expirado' 
                            : 'Sistema indisponível'
                    });
                }
                
                // Para páginas HTML, pode mostrar mensagem customizada depois
                // Por enquanto, deixa passar mas sem definir tenantId
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

// ⭐ Rota de teste com info do tenant
app.get('/api/test', async (req, res) => {
    let tenantInfo = null;
    
    if (req.tenantId) {
        // Se tenant está definido, buscar info de expiração
        const expInfo = await db.getTenantExpirationInfo(req.tenantId);
        tenantInfo = {
            id: req.tenantId,
            slug: req.tenantSlug,
            name: req.tenantName,
            expires_at: req.tenantExpiresAt,
            expiration_info: expInfo
        };
    }
    
    res.json({ 
        message: 'API funcionando!', 
        timestamp: new Date().toISOString(),
        status: 'ok',
        version: '3.1.0-multitenant-expiration',
        tenant: tenantInfo
    });
});

// Inicializar monitor de pagamentos
const paymentMonitor = new MonitorService(db);

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('SIGMA RECHARGE - SISTEMA MULTI-TENANT + EXPIRAÇÃO');
    console.log('='.repeat(60));
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Porta: ${PORT}`);
    console.log(`Versao: 3.1.0-multitenant-expiration`);
    console.log('='.repeat(60));
    console.log('Estrutura:');
    console.log('  - models/Database.js (✅ com validação de expiração)');
    console.log('  - services/SigmaService.js');
    console.log('  - services/KofficeService.js');
    console.log('  - services/GesOfficeService.js');
    console.log('  - services/PaymentService.js');
    console.log('  - services/MonitorService.js');
    console.log('  - routes/public.js');
    console.log('  - routes/admin.js');
    console.log('='.repeat(60));
    console.log('Multi-Tenant com Expiração:');
    console.log('  - Exemplo: http://localhost:3010/?tenant=teste');
    console.log('  - Curto:   http://localhost:3010/?t=teste');
    console.log('  - Tenants expirados são bloqueados automaticamente');
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
