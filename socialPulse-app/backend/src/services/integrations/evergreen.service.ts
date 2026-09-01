import crypto from 'crypto';
import { db } from '../../config/database';
import { AutomationEngineService } from '../marketing/automationEngine.service';
import { SuppressionService } from '../marketing/suppression.service';

export interface EvergreenEventPayload {
    eventId: string;
    eventType: string;
    workspaceId: string;
    timestamp: number;
    payload: Record<string, any>;
}

export class EvergreenIntegrationService {
    /**
     * Verifies the cryptographic HMAC SHA-256 signature for Evergreen events.
     * Uses timingSafeEqual to prevent timing attacks.
     */
    public static verifySignature(
        rawBody: string,
        timestampStr: string,
        signature: string,
        secret: string
    ): boolean {
        if (!rawBody || !timestampStr || !signature || !secret) {
            return false;
        }

        try {
            const expectedSig = crypto
                .createHmac('sha256', secret)
                .update(`${timestampStr}.${rawBody}`)
                .digest('hex');

            const sigBuf = Buffer.from(signature, 'hex');
            const expectedBuf = Buffer.from(expectedSig, 'hex');

            if (sigBuf.length !== expectedBuf.length) {
                return false;
            }

            return crypto.timingSafeEqual(sigBuf, expectedBuf);
        } catch {
            return false;
        }
    }

    /**
     * Ingests, authenticates, deduplicates, and processes an inbound Evergreen OS event.
     */
    public static async ingestEvent(
        rawBody: string,
        signatureHeader: string | undefined,
        timestampHeader: string | undefined,
        eventIdHeader: string | undefined
    ): Promise<{ status: 'PROCESSED' | 'DUPLICATE' | 'REJECTED'; message: string; eventId?: string }> {
        const secret = process.env.EVERGREEN_INTEGRATION_SECRET;
        if (!secret) {
            console.error('[EvergreenIntegration] EVERGREEN_INTEGRATION_SECRET is not configured');
            return { status: 'REJECTED', message: 'Integration secret not configured' };
        }

        if (!signatureHeader || !timestampHeader) {
            return { status: 'REJECTED', message: 'Missing authentication headers' };
        }

        // 1. Replay attack window check (±300 seconds / 5 minutes)
        const eventTimestamp = parseInt(timestampHeader, 10);
        if (isNaN(eventTimestamp)) {
            return { status: 'REJECTED', message: 'Invalid timestamp format' };
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - eventTimestamp) > 300) {
            return { status: 'REJECTED', message: 'Timestamp outside replay tolerance window' };
        }

        // 2. HMAC SHA-256 Signature Verification
        const isValid = this.verifySignature(rawBody, timestampHeader, signatureHeader, secret);
        if (!isValid) {
            return { status: 'REJECTED', message: 'Invalid cryptographic signature' };
        }

        // 3. Parse Event Body
        let parsed: any;
        try {
            parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch {
            return { status: 'REJECTED', message: 'Malformed JSON payload' };
        }

        const eventId = eventIdHeader || parsed.eventId || parsed.id;
        const eventType = parsed.eventType || parsed.event;
        const workspaceId = parsed.workspaceId || parsed.tenantId;
        const data = parsed.data || parsed.payload || parsed;

        if (!eventId || !eventType || !workspaceId) {
            return { status: 'REJECTED', message: 'Missing required event fields (eventId, eventType, workspaceId)' };
        }

        // 4. Idempotency & Deduplication Check
        const { rows: existing } = await db.query(
            `SELECT id, status FROM evergreen_inbound_events WHERE event_id = $1 LIMIT 1`,
            [eventId]
        );

        if (existing.length > 0) {
            console.log(`[EvergreenIntegration] Duplicate event ignored (eventId: ${eventId})`);
            return { status: 'DUPLICATE', message: 'Event already processed', eventId };
        }

        // 5. Insert Inbound Record
        await db.query(
            `INSERT INTO evergreen_inbound_events (event_id, event_type, workspace_id, payload, status)
             VALUES ($1, $2, $3, $4, 'received')`,
            [eventId, eventType, workspaceId, JSON.stringify(data)]
        );

        // 6. Route Event
        try {
            if (eventType === 'customer.suppressed') {
                const channel = data.channel || 'EMAIL';
                const identifier = data.email || data.phone || data.identifier;
                const reason = data.reason || 'UNSUBSCRIBED';
                if (identifier) {
                    await SuppressionService.addSuppression(workspaceId, channel, identifier, reason);
                }
            } else if (eventType === 'consent.updated') {
                if (data.contactIdentifier && data.channel) {
                    await SuppressionService.recordConsent(workspaceId, data);
                }
            } else if (eventType === 'product.created' || eventType === 'product.updated' || eventType === 'product.sync') {
                await this.syncProduct(workspaceId, data);
            } else {
                // Dispatch to general automation engine
                await AutomationEngineService.triggerEvent(eventType, workspaceId, data);
            }

            // 7. Mark Processed
            await db.query(
                `UPDATE evergreen_inbound_events
                 SET status = 'processed', processed_at = NOW()
                 WHERE event_id = $1`,
                [eventId]
            );

            return { status: 'PROCESSED', message: 'Event ingested and processed successfully', eventId };
        } catch (err: any) {
            console.error(`[EvergreenIntegration] Error processing event ${eventId}:`, err);
            await db.query(
                `UPDATE evergreen_inbound_events
                 SET status = 'failed'
                 WHERE event_id = $1`,
                [eventId]
            );
            return { status: 'PROCESSED', message: 'Event received but processing error occurred', eventId };
        }
    }

    /**
     * Synchronizes a product from Evergreen OS into the SocialPulse catalog.
     */
    public static async syncProduct(workspaceId: string, data: any): Promise<void> {
        const externalId = data.id || data.productId || data.externalId || `eg_${Date.now()}`;
        const title = data.title || data.name || 'Untitled Product';
        const description = data.description || '';
        const price = parseFloat(data.price) || 0.00;
        const currency = data.currency || 'ZAR';
        const imageUrl = data.imageUrl || data.image_url || null;
        const productUrl = data.productUrl || data.product_url || `https://usesocialpulse.com/products/${externalId}`;
        const category = data.category || 'Skincare';
        const tags = Array.isArray(data.tags) ? data.tags : [];

        // Ensure Evergreen store exists
        let storeId: string;
        const { rows: store } = await db.query(
            `SELECT id FROM ecommerce_stores WHERE workspace_id = $1 AND platform = 'evergreen' LIMIT 1`,
            [workspaceId]
        );
        if (store.length > 0) {
            storeId = store[0].id;
        } else {
            const { rows: newStore } = await db.query(
                `INSERT INTO ecommerce_stores (workspace_id, platform, name, status)
                 VALUES ($1, 'evergreen', 'Higiene Evergreen OS Catalog', 'active')
                 RETURNING id`,
                [workspaceId]
            );
            storeId = newStore[0].id;
        }

        // Upsert product
        await db.query(
            `INSERT INTO products (store_id, workspace_id, external_id, title, description, price, currency, image_url, product_url, category, tags, status, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW())
             ON CONFLICT (store_id, external_id)
             DO UPDATE SET title = EXCLUDED.title,
                           description = EXCLUDED.description,
                           price = EXCLUDED.price,
                           currency = EXCLUDED.currency,
                           image_url = EXCLUDED.image_url,
                           product_url = EXCLUDED.product_url,
                           category = EXCLUDED.category,
                           tags = EXCLUDED.tags,
                           status = 'active',
                           updated_at = NOW()`,
            [storeId, workspaceId, externalId, title, description, price, currency, imageUrl, productUrl, category, tags]
        );
    }
}
