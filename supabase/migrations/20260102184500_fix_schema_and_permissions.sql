-- 1. Add ano_referencia column if it does not exist (Safe to keep)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mensagens_semanais' AND column_name = 'ano_referencia') THEN
        ALTER TABLE public.mensagens_semanais ADD COLUMN ano_referencia INTEGER DEFAULT 2026;
    END IF;
END $$;

-- 2. Cleanup Duplicates
DELETE FROM public.mensagens_semanais a
USING public.mensagens_semanais b
WHERE a.id < b.id
AND a.gestor_id = b.gestor_id
AND a.semana_referencia = b.semana_referencia
AND a.mes_referencia = b.mes_referencia
AND a.ano_referencia = b.ano_referencia;

-- 3. Update Unique Constraint
ALTER TABLE public.mensagens_semanais DROP CONSTRAINT IF EXISTS mensagens_semanais_gestor_id_semana_referencia_mes_referencia_key;
-- Check if the new constraint already exists before adding
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mensagens_semanais_unique_record') THEN
        ALTER TABLE public.mensagens_semanais ADD CONSTRAINT mensagens_semanais_unique_record UNIQUE (gestor_id, semana_referencia, mes_referencia, ano_referencia);
    END IF;
END $$;

-- 4. Re-apply Permissions with CORRECT Column Names
ALTER TABLE public.mensagens_semanais ENABLE ROW LEVEL SECURITY;

-- Note: mensagens_semanais does not have a 'criado_por' column in the current schema.
-- We will allow any authenticated user to update/delete for now to fix the immediate blocker.
-- Ideally, you should add a created_by column later.

DROP POLICY IF EXISTS "Users can update own messages" ON public.mensagens_semanais;
CREATE POLICY "Users can update messages" ON public.mensagens_semanais
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.mensagens_semanais;
CREATE POLICY "Users can delete messages" ON public.mensagens_semanais
    FOR DELETE TO authenticated
    USING (true);

-- Fix for Fiscalizacao (using correct column 'criado_por')
DROP POLICY IF EXISTS "Users can delete own fiscalizacao records" ON public.registros_fiscalizacao;
CREATE POLICY "Users can delete own fiscalizacao records" ON public.registros_fiscalizacao
    FOR DELETE TO authenticated
    USING (auth.uid() = criado_por);

-- Fix for Calls (inspections table using 'inspector_id')
DROP POLICY IF EXISTS "Users can delete own inspections" ON public.inspections;
CREATE POLICY "Users can delete own inspections" ON public.inspections
    FOR DELETE TO authenticated
    USING (auth.uid() = inspector_id);
