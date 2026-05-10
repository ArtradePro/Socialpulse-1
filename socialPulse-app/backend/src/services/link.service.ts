import crypto from 'crypto';
import { db } from '../config/database';

export class LinkService {
    /**
     * Shortens a URL and stores it in the database.
     * Returns the full shortened URL.
     */
    static async shorten(longUrl: string, workspaceId?: string): Promise<string> {
        if (!longUrl) return '';

        // Check if this URL is already shortened for this workspace
        const existing = await db.query(
            'SELECT short_code FROM short_links WHERE long_url = $1 AND (workspace_id = $2 OR workspace_id IS NULL) LIMIT 1',
            [longUrl, workspaceId || null]
        );

        if (existing.rows.length > 0) {
            return this.buildShortUrl(existing.rows[0].short_code);
        }

        // Generate a unique 8-character code
        let shortCode = '';
        let isUnique = false;
        while (!isUnique) {
            shortCode = crypto.randomBytes(6).toString('base64url').slice(0, 8);
            const check = await db.query('SELECT id FROM short_links WHERE short_code = $1', [shortCode]);
            if (check.rows.length === 0) isUnique = true;
        }

        await db.query(
            'INSERT INTO short_links (workspace_id, long_url, short_code) VALUES ($1, $2, $3)',
            [workspaceId || null, longUrl, shortCode]
        );

        return this.buildShortUrl(shortCode);
    }

    /**
     * Resolves a short code to a long URL and increments click count.
     */
    static async resolve(shortCode: string): Promise<string | null> {
        const { rows } = await db.query(
            'UPDATE short_links SET clicks = clicks + 1 WHERE short_code = $1 RETURNING long_url',
            [shortCode]
        );

        return rows.length > 0 ? rows[0].long_url : null;
    }

    private static buildShortUrl(code: string): string {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        return `${baseUrl}/l/${code}`;
    }
}
