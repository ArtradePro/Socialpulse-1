// server/src/jobs/mediaCleanup.job.ts
import cron from 'node-cron';
import { db }             from '../config/database';
import { StorageService } from '../services/storage.service';

/**
 * Permanently remove soft-deleted files older than 30 days.
 * Runs daily at 02:00 UTC.
 */
export const initMediaCleanup = () => {
    cron.schedule('0 2 * * *', async () => {
        console.log('[MediaCleanup] Starting…');
        try {
            const { rows } = await db.query(
                `SELECT id, provider_id, mime_type FROM media_files
                 WHERE is_deleted = true
                   AND updated_at < NOW() - INTERVAL '30 days'
                 LIMIT 200`
            );

            let deleted = 0;
            for (const file of rows) {
                try {
                    await StorageService.delete(file.provider_id, file.mime_type);
                    await db.query(`DELETE FROM media_files WHERE id = $1`, [file.id]);
                    deleted++;
                } catch (err) {
                    console.error(`[MediaCleanup] Failed to delete ${file.id}:`, err);
                }
            }
            console.log(`[MediaCleanup] Done — ${deleted} files purged.`);
        } catch (err) {
            console.error('[MediaCleanup] Error:', err);
        }
    });

    console.log('🗑️  Media cleanup job scheduled (daily 02:00 UTC)');
};

export const runMediaCleanup = async (): Promise<void> => {
  console.log('[MediaCleanup] Starting orphan cleanup...');

  try {
    // Find media files that have been flagged for deletion or are not
    // referenced in any post's media_urls array for > 7 days
    const { rows: orphans } = await db.query(`
      SELECT mf.id, mf.public_id, mf.provider
      FROM media_files mf
      WHERE mf.created_at < NOW() - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM posts p
          WHERE p.media_urls @> ARRAY[mf.url]::text[]
            AND p.user_id = mf.user_id
        )
        AND (mf.deleted_at IS NOT NULL OR mf.flagged_for_cleanup = true)
    `);

    if (orphans.length === 0) {
      console.log('[MediaCleanup] No orphans found.');
      return;
    }

    console.log(`[MediaCleanup] Found ${orphans.length} orphan(s) to remove.`);

    let deleted = 0;
    let failed  = 0;

    for (const orphan of orphans) {
      try {
        await StorageService.delete(orphan.public_id, orphan.provider);
        await db.query('DELETE FROM media_files WHERE id = $1', [orphan.id]);
        deleted++;
      } catch (err) {
        console.error(`[MediaCleanup] Failed to delete media ${orphan.id}:`, err);
        failed++;
      }
    }

    console.log(`[MediaCleanup] Done — deleted: ${deleted}, failed: ${failed}`);
  } catch (err) {
    console.error('[MediaCleanup] Job error:', err);
  }
};
