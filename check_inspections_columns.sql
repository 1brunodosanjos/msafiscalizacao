-- Query para verificar as colunas da tabela inspections
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'inspections' 
ORDER BY ordinal_position;
