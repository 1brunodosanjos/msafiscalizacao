-- Adiciona coluna de quantidade para registros de fiscalização do Telegram
ALTER TABLE public.registros_fiscalizacao 
ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 1;

-- Adiciona coluna de quantidade para itens de fiscalização de Call
ALTER TABLE public.inspection_items 
ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 1;
