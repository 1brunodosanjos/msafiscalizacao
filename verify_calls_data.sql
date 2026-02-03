-- Query atualizada para verificar fiscalizações de calls
-- Execute no Supabase SQL Editor

-- 1. Ver todas as fiscalizações do tipo 'call'
SELECT 
    id,
    date,
    type,
    score,
    manager_id,
    inspector_id,
    is_cancelled,
    created_at
FROM inspections
WHERE type = 'call'
ORDER BY date DESC
LIMIT 20;

-- 2. Ver inspection_items de fiscalizações de calls
SELECT 
    i.id as inspection_id,
    i.date,
    i.score,
    ii.id as item_id,
    ii.category,
    ii.criterion,
    ii.status,
    ii.observation,
    ii.quantity
FROM inspections i
LEFT JOIN inspection_items ii ON ii.inspection_id = i.id
WHERE i.type = 'call'
ORDER BY i.date DESC, ii.id
LIMIT 50;

-- 3. Contar fiscalizações por mês/ano
SELECT 
    DATE_PART('year', date::date) as ano,
    DATE_PART('month', date::date) as mes,
    COUNT(*) as total
FROM inspections
WHERE type = 'call'
GROUP BY ano, mes
ORDER BY ano DESC, mes DESC;

-- 4. Ver se há dados para Janeiro 2026
SELECT 
    COUNT(*) as total_janeiro_2026
FROM inspections
WHERE type = 'call'
  AND date >= '2026-01-01'
  AND date <= '2026-01-31';
