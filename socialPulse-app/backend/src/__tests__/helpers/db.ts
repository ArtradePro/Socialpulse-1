import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export function getTestPool(): Pool {
    if (!pool) {
        const url = process.env.TEST_DATABASE_URL;
        if (!url) throw new Error('TEST_DATABASE_URL not set');
        pool = new Pool({ connectionString: url });
    }
    return pool;
}

export async function closeTestPool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

/** Truncate all user-data tables between tests for isolation. */
export async function cleanDb(client: PoolClient): Promise<void> {
    await client.query(`
        TRUNCATE TABLE
            referrals,
            inbox_messages,
            listening_results,
            listening_rules,
            api_keys,
            rss_entries,
            rss_feeds,
            notifications,
            team_invites,
            team_members,
            teams,
            workspace_invites,
            workspace_members,
            workspaces,
            post_analytics,
            posts,
            social_accounts,
            media_files,
            usage_events,
            password_reset_tokens,
            stripe_customers,
            hashtag_sets,
            templates,
            campaigns,
            users
        CASCADE
    `);
}
