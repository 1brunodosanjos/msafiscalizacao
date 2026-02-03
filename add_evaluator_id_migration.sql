-- Migration: Adicionar coluna evaluator_id à tabela inspections
-- Esta coluna armazena quem fez a fiscalização

-- 1. Verificar se a coluna já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'inspections' 
        AND column_name = 'evaluator_id'
    ) THEN
        -- 2. Adicionar a coluna
        ALTER TABLE inspections 
        ADD COLUMN evaluator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

        -- 3. Criar índice para melhorar performance de consultas
        CREATE INDEX IF NOT EXISTS idx_inspections_evaluator_id 
        ON inspections(evaluator_id);

        RAISE NOTICE 'Coluna evaluator_id adicionada à tabela inspections';
    ELSE
        RAISE NOTICE 'Coluna evaluator_id já existe na tabela inspections';
    END IF;
END $$;

-- 4. Atualizar RLS policies para incluir evaluator_id (se necessário)
-- A política deve permitir que usuários vejam fiscalizações que eles criaram

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view inspections" ON inspections;

-- Create new policy
CREATE POLICY "Users can view inspections" ON inspections
    FOR SELECT
    USING (true); -- Ajuste conforme suas regras de negócio

-- Para INSERT
DROP POLICY IF EXISTS "Users can create inspections" ON inspections;

CREATE POLICY "Users can create inspections" ON inspections
    FOR INSERT
    WITH CHECK (auth.uid() = evaluator_id);

-- Para UPDATE
DROP POLICY IF EXISTS "Users can update own inspections" ON inspections;

CREATE POLICY "Users can update own inspections" ON inspections
    FOR UPDATE
    USING (auth.uid() = evaluator_id);

-- Para DELETE (opcional)
DROP POLICY IF EXISTS "Users can delete own inspections" ON inspections;

CREATE POLICY "Users can delete own inspections" ON inspections
    FOR DELETE
    USING (auth.uid() = evaluator_id);

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';
