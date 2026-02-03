-- Query para verificar as colunas da tabela inspection_items
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'inspection_items' 
ORDER BY ordinal_position;
