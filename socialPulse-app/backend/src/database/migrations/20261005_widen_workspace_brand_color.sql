-- Widen workspace branding columns to TEXT so multi-color palettes and long brand names never fail with VARCHAR(20) overflow
ALTER TABLE workspaces ALTER COLUMN brand_color TYPE TEXT;
ALTER TABLE workspaces ALTER COLUMN brand_name TYPE TEXT;
