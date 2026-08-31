import crypto from 'crypto';
import axios from 'axios';
import { db } from '../../config/database';
import { AutomationEngineService } from '../marketing/automationEngine.service';

export interface Q2CEventPayload {
    eventId: string;
    eventType: 'quote.created' | 'contract.signed' | 'lead.updated' | 'deal.won';
    workspaceId: string;
    customerEmail: string;
    dealValue?: number;
    currency?: string;
    data: Record<string, any>;
}

export class Q2CSyncService {
    private static getSecret(): string {
        return process.env.Q2C_WEBHOOK_SECRET || process.env.EVERGREEN_INTEGRATION_SECRET || '';
    }

    /**
     * Verifies HMAC signature for inbound Quote2ContractPro events.
     */
    public static verifySignature(rawBody: string, timestamp: string, signature: string): boolean {
        const secret = this.getSecret();
        if (!secret || !rawBody || !timestamp || !signature) return false;

        try {
            const expectedSig = crypto
                .createHmac('sha256', secret)
                .update(`${timestamp}.${rawBody}`)
                .digest('hex');

            const sigBuf = Buffer.from(signature, 'hex');
            const expBuf = Buffer.from(expectedSig, 'hex');

            if (sigBuf.length !== expBuf.length) return false;
            return crypto.timingSafeEqual(sigBuf, expBuf);
        } catch {
            return false;
        }
    }

    /**
     * Ingests and processes an inbound Quote2ContractPro event.
     */
    public static async processInboundEvent(
        rawBody: string,
        signature: string | undefined,
        timestamp: string | undefined
    ): Promise<{ status: 'PROCESSED' | 'REJECTED' | 'DUPLICATE'; message: string; eventId?: string }> {
        if (!signature || !timestamp) {
            return { status: 'REJECTED', message: 'Missing authentication headers' };
        }

        const isValid = this.verifySignature(rawBody, timestamp, signature);
        if (!isValid) {
            return { status: 'REJECTED', message: 'Invalid cryptographic signature' };
        }

        let parsed: any;
        try {
            parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch {
            return { status: 'REJECTED', message: 'Malformed JSON payload' };
        }

        const eventId = parsed.eventId || parsed.id || `q2c_${Date.now()}`;
        const eventType = parsed.eventType || parsed.event;
        const workspaceId = parsed.workspaceId || parsed.tenantId;

        if (!workspaceId || !eventType) {
            return { status: 'REJECTED', message: 'Missing required workspaceId or eventType' };
        }

        // Deduplication check
        const { rows: existing } = await db.query(
            `SELECT id FROM q2c_sync_logs WHERE external_id = $1 AND direction = 'INBOUND' LIMIT 1`,
            [eventId]
        );

        if (existing.length > 0) {
            return { status: 'DUPLICATE', message: 'Event already synchronized', eventId };
        }

        // Log inbound sync
        await db.query(
            `INSERT INTO q2c_sync_logs (workspace_id, direction, entity_type, external_id, payload, status)
             VALUES ($1, 'INBOUND', $2, $3, $4, 'PROCESSED')`,
            [workspaceId, eventType.toUpperCase(), eventId, JSON.stringify(parsed)]
        );

        // Trigger downstream automations (e.g. contract signed onboarding, lead nurture)
        await AutomationEngineService.triggerEvent(eventType, workspaceId, parsed.data || parsed);

        return { status: 'PROCESSED', message: 'Q2C event synchronized successfully', eventId };
    }

    /**
     * Pushes a captured lead or customer from SocialPulse to Quote2ContractPro.
     */
    public static async pushLeadToQ2C(
        workspaceId: string,
        lead: { email: string; name?: string; phone?: string; source?: string; value?: number }
    ): Promise<{ success: boolean; syncId: string }> {
        const syncId = `out_${Date.now()}`;

        await db.query(
            `INSERT INTO q2c_sync_logs (workspace_id, direction, entity_type, external_id, payload, status)
             VALUES ($1, 'OUTBOUND', 'LEAD', $2, $3, 'PROCESSED')`,
            [workspaceId, syncId, JSON.stringify(lead)]
        );

        const q2cUrl = process.env.Q2C_API_URL;
        if (q2cUrl && process.env.NODE_ENV === 'production') {
            try {
                const secret = this.getSecret();
                const timestamp = Math.floor(Date.now() / 1000).toString();
                const bodyStr = JSON.stringify({ workspaceId, lead });
                const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${bodyStr}`).digest('hex');

                await axios.post(`${q2cUrl}/api/integrations/socialpulse/lead`, bodyStr, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-q2c-signature': sig,
                        'x-q2c-timestamp': timestamp
                    },
                    timeout: 5000
                });
            } catch (err: any) {
                console.error('[Q2CSync] Outbound push failed:', err.message);
            }
        }

        return { success: true, syncId };
    }
}
