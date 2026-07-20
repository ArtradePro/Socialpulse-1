import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';

export interface Q2CLeadPayload {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    source?: string;
    services?: string[];
    description?: string;
    budget?: string;
    timeline?: string;
    organizationId?: string;
}

export class Q2CSyncService {
    private static getQ2CBaseUrl(): string {
        return process.env.Q2C_API_URL || 'http://localhost:3000';
    }

    private static getWebhookSecret(): string {
        return process.env.WEBHOOK_SECRET || 'QwaszX!@#1939S';
    }

    /**
     * Pushes a qualified lead from SocialPulse outward to Quote2ContractPro's /api/leads endpoint.
     */
    static async syncLeadToQ2C(leadData: Q2CLeadPayload): Promise<{ success: boolean; data?: any; error?: string }> {
        const baseUrl = this.getQ2CBaseUrl();
        const secret = this.getWebhookSecret();
        const url = `${baseUrl}/api/leads`;

        const payload = {
            firstName: leadData.firstName,
            lastName: leadData.lastName || 'Lead',
            email: leadData.email,
            phone: leadData.phone || '',
            address: leadData.address || 'Not Provided',
            city: leadData.city || 'Johannesburg',
            state: leadData.state || 'Gauteng',
            zipCode: leadData.zipCode || '2000',
            source: leadData.source || 'SOCIALPULSE',
            services: leadData.services || ['SocialPulse Lead Intake'],
            description: leadData.description || 'Lead imported from SocialPulse marketing campaign',
            budget: leadData.budget || null,
            timeline: leadData.timeline || null,
            priority: 'HIGH',
        };

        const payloadString = JSON.stringify(payload);
        const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

        try {
            console.log(`[Q2CSyncService] Pushing lead ${leadData.email} to Quote2ContractPro at ${url}`);
            
            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-webhook-secret': secret,
                    'X-Webhook-Signature': signature,
                    'X-Source-System': 'SocialPulse',
                },
                timeout: 10000,
            });

            console.log(`[Q2CSyncService] ✓ Lead synced to Q2C successfully. Response status: ${response.status}`);
            return { success: true, data: response.data };
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
            console.error(`[Q2CSyncService] ❌ Failed to sync lead to Q2C: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }
}
