import { db } from '../../config/database';
import crypto from 'crypto';

export type SuppressionChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';
export type SuppressionReason = 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINT' | 'MANUAL';

export interface ConsentLogInput {
    contactIdentifier: string;
    channel: SuppressionChannel;
    status: 'OPT_IN' | 'OPT_OUT' | 'SUPPRESSED';
    lawfulBasis?: string;
    consentVersion?: string;
    ipAddress?: string;
}

export class SuppressionService {
    /**
     * Normalizes an identifier (e.g. email lowercased, phone trimmed).
     */
    public static normalizeIdentifier(identifier: string): string {
        if (!identifier || typeof identifier !== 'string') return '';
        return identifier.trim().toLowerCase();
    }

    /**
     * Checks if a contact identifier is suppressed for a given channel in the workspace.
     * Fails closed: if invalid parameters are provided, returns true.
     */
    public static async isSuppressed(
        workspaceId: string,
        channel: SuppressionChannel,
        identifier: string
    ): Promise<boolean> {
        const normalized = this.normalizeIdentifier(identifier);
        if (!workspaceId || !channel || !normalized) {
            return true;
        }

        try {
            const { rows } = await db.query(
                `SELECT 1 FROM marketing_suppression_list
                 WHERE workspace_id = $1 AND channel = $2 AND identifier = $3
                 LIMIT 1`,
                [workspaceId, channel.toUpperCase(), normalized]
            );
            return rows.length > 0;
        } catch (err) {
            console.error('[SuppressionService] Error checking suppression status:', err);
            // Fail closed on database error
            return true;
        }
    }

    /**
     * Adds an identifier to the suppression list.
     */
    public static async addSuppression(
        workspaceId: string,
        channel: SuppressionChannel,
        identifier: string,
        reason: SuppressionReason = 'UNSUBSCRIBED'
    ): Promise<void> {
        const normalized = this.normalizeIdentifier(identifier);
        if (!workspaceId || !channel || !normalized) return;

        await db.query(
            `INSERT INTO marketing_suppression_list (workspace_id, channel, identifier, reason)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, channel, identifier)
             DO UPDATE SET reason = EXCLUDED.reason, created_at = NOW()`,
            [workspaceId, channel.toUpperCase(), normalized, reason]
        );
    }

    /**
     * Removes an identifier from the suppression list.
     */
    public static async removeSuppression(
        workspaceId: string,
        channel: SuppressionChannel,
        identifier: string
    ): Promise<boolean> {
        const normalized = this.normalizeIdentifier(identifier);
        if (!workspaceId || !channel || !normalized) return false;

        const { rowCount } = await db.query(
            `DELETE FROM marketing_suppression_list
             WHERE workspace_id = $1 AND channel = $2 AND identifier = $3`,
            [workspaceId, channel.toUpperCase(), normalized]
        );
        return (rowCount ?? 0) > 0;
    }

    /**
     * Records a POPIA compliance consent log entry.
     */
    public static async recordConsent(
        workspaceId: string,
        data: ConsentLogInput
    ): Promise<void> {
        const normalized = this.normalizeIdentifier(data.contactIdentifier);
        if (!workspaceId || !normalized) return;

        let ipHash: string | null = null;
        if (data.ipAddress) {
            ipHash = crypto.createHash('sha256').update(data.ipAddress).digest('hex').substring(0, 32);
        }

        await db.query(
            `INSERT INTO marketing_consent_logs (
                workspace_id, contact_identifier, channel, status, lawful_basis, consent_version, ip_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                workspaceId,
                normalized,
                data.channel.toUpperCase(),
                data.status,
                data.lawfulBasis || 'CONSENT',
                data.consentVersion || null,
                ipHash
            ]
        );

        if (data.status === 'OPT_OUT' || data.status === 'SUPPRESSED') {
            await this.addSuppression(workspaceId, data.channel, normalized, 'UNSUBSCRIBED');
        }
    }
}
