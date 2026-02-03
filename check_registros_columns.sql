-- Verificar colunas de registros_fiscalizacao
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'registros_fiscalizacao'
ORDER BY ordinal_position;
