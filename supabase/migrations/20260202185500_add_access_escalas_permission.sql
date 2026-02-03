DO $$
BEGIN
    -- Check if access_escalas column exists in user_permissions table
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_permissions'
        AND column_name = 'access_escalas'
    ) THEN
        -- Add access_escalas column with default false
        ALTER TABLE public.user_permissions
        ADD COLUMN access_escalas BOOLEAN DEFAULT false;
    END IF;
END $$;
