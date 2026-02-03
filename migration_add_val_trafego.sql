-- Migration to add 'trafego' sector and scale table
-- Run this in the Supabase SQL Editor

-- 1. Update Check Constraint on 'gestores' to include 'trafego'
ALTER TABLE public.gestores DROP CONSTRAINT IF EXISTS gestores_setor_check;
ALTER TABLE public.gestores ADD CONSTRAINT gestores_setor_check 
CHECK (setor IN ('calls', 'telegram', 'trafego'));

-- 2. Create 'gestor_trafego_escala' table (Clone of Telegram model)
CREATE TABLE IF NOT EXISTS public.gestor_trafego_escala (
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
    
    UNIQUE(gestor_id, dia_semana)
);

-- 3. Enable RLS
ALTER TABLE public.gestor_trafego_escala ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.gestor_trafego_escala FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON public.gestor_trafego_escala FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Enable update for fiscalizadores" ON public.gestor_trafego_escala FOR UPDATE USING (true);
CREATE POLICY "Enable insert for fiscalizadores" ON public.gestor_trafego_escala FOR INSERT WITH CHECK (true);
