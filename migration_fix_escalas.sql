-- Migration to fix Escalas functionality in the original database
-- Run this in the Supabase SQL Editor for project 'mepvmarhsjdkwbutytad'

-- 1. Ensure 'grupos' table exists and has data
CREATE TABLE IF NOT EXISTS public.grupos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- Active RLS for grupos
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.grupos FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON public.grupos FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Seed groups
INSERT INTO public.grupos (nome) VALUES 
('Grupo Geral'), ('Grupo Start'), ('Grupo Vip'), ('Grupo Premium'), ('Grupo Elite')
ON CONFLICT (nome) DO NOTHING;


-- 2. Add 'setor' to 'gestores' table
ALTER TABLE public.gestores 
ADD COLUMN IF NOT EXISTS setor text NOT NULL DEFAULT 'calls';

-- Add check constraint for data integrity
ALTER TABLE public.gestores DROP CONSTRAINT IF EXISTS gestores_setor_check;
ALTER TABLE public.gestores ADD CONSTRAINT gestores_setor_check CHECK (setor IN ('calls', 'telegram'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_gestores_setor ON public.gestores(setor);


-- 3. Create 'gestor_telegram_escala' table (Matches Frontend Escalas.tsx)
CREATE TABLE IF NOT EXISTS public.gestor_telegram_escala (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id uuid NOT NULL REFERENCES public.gestores(id) ON DELETE CASCADE,
    grupo_id uuid REFERENCES public.grupos(id),
    dia_semana text NOT NULL,
    status text NOT NULL DEFAULT 'trabalho',
    entrada text,
    saida text,
    intervalo_inicio text,
    intervalo_fim text,
    observacao text,
    created_at timestamptz DEFAULT now(),
    
    -- Constraint to ensure one record per day per manager
    UNIQUE(gestor_id, dia_semana)
);

-- Enable RLS
ALTER TABLE public.gestor_telegram_escala ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.gestor_telegram_escala FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON public.gestor_telegram_escala FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Enable update for fiscalizadores" ON public.gestor_telegram_escala FOR UPDATE USING (true);
CREATE POLICY "Enable insert for fiscalizadores" ON public.gestor_telegram_escala FOR INSERT WITH CHECK (true);


-- 4. Create 'gestor_calls_escala' table (Matches Frontend Escalas.tsx)
CREATE TABLE IF NOT EXISTS public.gestor_calls_escala (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id uuid NOT NULL REFERENCES public.gestores(id) ON DELETE CASCADE,
    grupo_id uuid REFERENCES public.grupos(id),
    dia_semana text NOT NULL,
    horario text NOT NULL,
    observacao text,
    created_at timestamptz DEFAULT now(),

    -- Constraint to prevent duplicate calls at the same time for the same manager
    UNIQUE(gestor_id, dia_semana, horario)
);

-- Enable RLS
ALTER TABLE public.gestor_calls_escala ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.gestor_calls_escala FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON public.gestor_calls_escala FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Enable update for fiscalizadores" ON public.gestor_calls_escala FOR UPDATE USING (true);
CREATE POLICY "Enable insert for fiscalizadores" ON public.gestor_calls_escala FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable delete for fiscalizadores" ON public.gestor_calls_escala FOR DELETE USING (true);
