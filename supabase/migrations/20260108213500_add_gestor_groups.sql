-- Add new fields to gestores table
ALTER TABLE public.gestores
ADD COLUMN IF NOT EXISTS grupos_calls TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS no_grupo_telegram BOOLEAN DEFAULT false;
