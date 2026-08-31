import axios from 'axios';
import { db } from '../../config/database';
import { encryptSecret, decryptSecretWithDualRead, getIntegrationKeyAAD } from '../../utils/crypto';

export interface OmnisendContactInput {
    email: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    tags?: string[];
    customProperties?: Record<string, any>;
}

export class OmnisendService {
    private static readonly BASE_URL = 'https://api.omnisend.com/v3';

    /**
     * Retrieves decrypted API key for a workspace.
     */
    public static async getApiKey(workspaceId: string): Promise<string | null> {
        const { rows } = await db.query(
            `SELECT api_key_encrypted FROM omnisend_integrations WHERE workspace_id = $1 AND is_active = true LIMIT 1`,
            [workspaceId]
        );
        if (rows.length === 0 || !rows[0].api_key_encrypted) return null;

        const raw = rows[0].api_key_encrypted;
        try {
            const aad = getIntegrationKeyAAD('omnisend', workspaceId, 'api_key');
            return decryptSecretWithDualRead(raw, aad);
        } catch {
            return raw; // Dual-read transition fallback
        }
    }

    /**
     * Saves or updates the encrypted Omnisend API key for a workspace.
     */
    public static async saveIntegration(
        workspaceId: string,
        apiKey: string,
        brandName?: string
    ): Promise<void> {
        let encryptedKey = apiKey;
        try {
            const aad = getIntegrationKeyAAD('omnisend', workspaceId, 'api_key');
            encryptedKey = encryptSecret(apiKey, aad);
        } catch (err) {
            console.warn('[OmnisendService] Encryption unavailable, saving raw key (transition mode)');
        }

        await db.query(
            `INSERT INTO omnisend_integrations (workspace_id, api_key_encrypted, brand_name, is_active, updated_at)
             VALUES ($1, $2, $3, true, NOW())
             ON CONFLICT (workspace_id)
             DO UPDATE SET api_key_encrypted = EXCLUDED.api_key_encrypted,
                           brand_name = EXCLUDED.brand_name,
                           is_active = true,
                           updated_at = NOW()`,
            [workspaceId, encryptedKey, brandName || null]
        );
    }

    /**
     * Creates or updates a contact in Omnisend.
     */
    public static async createOrUpdateContact(
        workspaceId: string,
        contact: OmnisendContactInput
    ): Promise<{ success: boolean; contactId?: string; status: 'LIVE_PROVIDER' | 'SIMULATED' }> {
        const apiKey = await this.getApiKey(workspaceId);

        if (!apiKey) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('OMNISEND_CONFIG_MISSING: No active Omnisend credentials for workspace');
            }
            if (process.env.ALLOW_SIMULATED_DELIVERY === 'true' || process.env.NODE_ENV === 'test') {
                return { success: true, contactId: `omni_sim_${Date.now()}`, status: 'SIMULATED' };
            }
            throw new Error('OMNISEND_CONFIG_MISSING');
        }

        // Test environment or dummy key simulation
        if (process.env.NODE_ENV === 'test' || apiKey.startsWith('omni_test_')) {
            return { success: true, contactId: `omni_sim_${Date.now()}`, status: 'SIMULATED' };
        }

        try {
            const payload: any = {
                email: contact.email,
                status: 'subscribed',
                statusDate: new Date().toISOString(),
                ...(contact.phone ? { phone: contact.phone } : {}),
                ...(contact.firstName ? { firstName: contact.firstName } : {}),
                ...(contact.lastName ? { lastName: contact.lastName } : {}),
                ...(contact.tags?.length ? { tags: contact.tags } : {}),
                ...(contact.customProperties ? { customProperties: contact.customProperties } : {})
            };

            const res = await axios.post(`${this.BASE_URL}/contacts`, payload, {
                headers: {
                    'X-API-KEY': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            return { success: true, contactId: res.data?.contactID || 'ok', status: 'LIVE_PROVIDER' };
        } catch (err: any) {
            console.error('[OmnisendService] Contact sync failed:', err.response?.data?.message || err.message);
            throw new Error('OMNISEND_DISPATCH_FAILED');
        }
    }

    /**
     * Triggers a custom transactional or automation event in Omnisend.
     */
    public static async triggerEvent(
        workspaceId: string,
        eventName: string,
        email: string,
        fields?: Record<string, any>
    ): Promise<{ success: boolean; status: 'LIVE_PROVIDER' | 'SIMULATED' }> {
        const apiKey = await this.getApiKey(workspaceId);

        if (!apiKey) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('OMNISEND_CONFIG_MISSING');
            }
            if (process.env.ALLOW_SIMULATED_DELIVERY === 'true' || process.env.NODE_ENV === 'test') {
                return { success: true, status: 'SIMULATED' };
            }
            throw new Error('OMNISEND_CONFIG_MISSING');
        }

        // Test environment or dummy key simulation
        if (process.env.NODE_ENV === 'test' || apiKey.startsWith('omni_test_')) {
            return { success: true, status: 'SIMULATED' };
        }

        try {
            await axios.post(
                `${this.BASE_URL}/events`,
                {
                    eventName,
                    email,
                    eventID: `evt_${Date.now()}`,
                    fields: fields || {}
                },
                {
                    headers: {
                        'X-API-KEY': apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            );

            return { success: true, status: 'LIVE_PROVIDER' };
        } catch (err: any) {
            console.error('[OmnisendService] Event trigger failed:', err.response?.data?.message || err.message);
            throw new Error('OMNISEND_EVENT_FAILED');
        }
    }
}
