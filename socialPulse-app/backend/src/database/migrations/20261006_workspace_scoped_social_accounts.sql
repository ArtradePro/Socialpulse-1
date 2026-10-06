-- Allow each workspace to connect its own independent set of social media accounts
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_user_id_platform_key;
ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_user_workspace_platform_key;
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_user_workspace_platform_key UNIQUE (user_id, workspace_id, platform);
