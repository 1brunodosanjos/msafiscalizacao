-- Adiciona a coluna access_scales na tabela user_permissions
ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS access_scales BOOLEAN DEFAULT FALSE;

-- Força o recarregamento do cache do schema do PostgREST para reconhecer a nova coluna imediatamente
NOTIFY pgrst, 'reload schema';
