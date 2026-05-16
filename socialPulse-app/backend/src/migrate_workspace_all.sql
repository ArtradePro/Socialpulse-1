DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') 
    LOOP 
        BEGIN
            EXECUTE 'ALTER TABLE "' || t || '" ADD COLUMN IF NOT EXISTS workspace_id UUID;';
            RAISE NOTICE 'Processed table %', t;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping table %: %', t, SQLERRM;
        END;
    END LOOP; 
END $$;
