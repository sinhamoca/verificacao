-- ========================================
-- MIGRATION: Adicionar Suporte a Painéis Koffice
-- ========================================

-- 1. Adicionar campo reseller_type nas tabelas existentes
ALTER TABLE payments ADD COLUMN reseller_type TEXT DEFAULT 'sigma';
ALTER TABLE resellers ADD COLUMN reseller_type TEXT DEFAULT 'sigma';

-- 2. Criar tabela de painéis Koffice
CREATE TABLE IF NOT EXISTS koffice_panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    admin_username TEXT NOT NULL,
    admin_password TEXT NOT NULL,
    has_captcha BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Criar tabela de revendedores Koffice
CREATE TABLE IF NOT EXISTS koffice_resellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    koffice_id TEXT NOT NULL,
    panel_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (panel_id) REFERENCES koffice_panels (id)
);

-- 4. Adicionar configuração do Anti-Captcha
INSERT OR IGNORE INTO system_config (key, value) 
VALUES ('anticaptcha_api_key', '');

-- ========================================
-- ÍNDICES PARA PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_koffice_resellers_username 
ON koffice_resellers(username);

CREATE INDEX IF NOT EXISTS idx_koffice_resellers_panel 
ON koffice_resellers(panel_id);

CREATE INDEX IF NOT EXISTS idx_payments_reseller_type 
ON payments(reseller_type);

-- ========================================
-- VERIFICAÇÃO
-- ========================================

SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as koffice_panels_count FROM koffice_panels;
SELECT COUNT(*) as koffice_resellers_count FROM koffice_resellers;
SELECT value as anticaptcha_key FROM system_config WHERE key = 'anticaptcha_api_key';
