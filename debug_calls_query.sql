-- Query para verificar fiscalizações de calls no banco
-- Execute isso no Supabase SQL Editor

-- 1. Verificar todas as fiscalizações do tipo 'call'
SELECT 
    i.id,
    i.date,
    i.type,
    i.score,
    g.nome as gestor_nome,
    COUNT(ii.id) as total_items
FROM inspections i
LEFT JOIN gestores g ON i.gestor_id = g.id
LEFT JOIN inspection_items ii ON ii.inspection_id = i.id
WHERE i.type = 'call'
GROUP BY i.id, i.date, i.type, i.score, g.nome
ORDER BY i.date DESC
LIMIT 20;

-- 2. Verificar inspection_items das fiscalizações de calls
SELECT 
    ii.id,
    ii.inspection_id,
    ii.category,
    ii.criterion,
    ii.status,
    ii.observation,
    ii.quantity,
    i.date,
    i.type
FROM inspection_items ii
JOIN inspections i ON ii.inspection_id = i.id
WHERE i.type = 'call'
ORDER BY i.date DESC
LIMIT 50;

-- 3. Contar fiscalizações por tipo
SELECT 
    type,
    COUNT(*) as total,
    COUNT(CASE WHEN DATE_PART('year', date::date) = 2026 AND DATE_PART('month', date::date) = 1 THEN 1 END) as janeiro_2026
FROM inspections
GROUP BY type;
