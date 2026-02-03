-- Migration: Adicionar coluna 'setores' (array) e migrar dados da coluna 'setor'

-- 1. Adicionar coluna 'setores' como array de texto
ALTER TABLE gestores ADD COLUMN IF NOT EXISTS setores text[] DEFAULT ARRAY[]::text[];

-- 2. Migrar dados existentes: se 'setor' tem valor, adiciona ao array 'setores'
-- Isso garante que quem era 'telegram' vire ['telegram'] e 'calls' vire ['calls']
UPDATE gestores 
SET setores = array_append(setores, setor)
WHERE setor IS NOT NULL AND NOT (setor = ANY(setores));

-- 3. Garantir que o array não seja nulo (opcional, mas bom pra evitar null checks excessivos)
UPDATE gestores SET setores = ARRAY[]::text[] WHERE setores IS NULL;
ALTER TABLE gestores ALTER COLUMN setores SET DEFAULT ARRAY[]::text[];

-- 4. Criar índice para performance em queries com 'contains' (@>)
CREATE INDEX IF NOT EXISTS idx_gestores_setores ON gestores USING GIN(setores);
