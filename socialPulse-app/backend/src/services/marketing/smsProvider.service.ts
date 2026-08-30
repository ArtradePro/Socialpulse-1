import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

export interface SmsDeliveryResult {
    provider: 'twilio' | 'simulated';
    status: 'LIVE_PROVIDER' | 'SIMULATED';
    messageId: string;
}

function maskPhone(phone: string): string {
    if (!phone || phone.length < 5) return '***';
    const start = phone.slice(0, 2);
    const end = phone.slice(-3);
    return `${start}***${end}`;
}

export class SmsProviderService {
    /**
     * Send SMS via Twilio SDK.
     * Fails closed in production if Twilio credentials are absent or dispatch fails.
     */
    static async send(to: string, body: string): Promise<SmsDeliveryResult> {
        const maskedTo = maskPhone(to);
        const isProduction = process.env.NODE_ENV === 'production';

        const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
        const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
        const fromNumber = (process.env.TWILIO_PHONE_NUMBER || env.twilio.phoneNumber)?.trim();

        if (accountSid && authToken && fromNumber) {
            try {
                const client = twilio(accountSid, authToken);
                const message = await client.messages.create({
                    body,
                    from: fromNumber,
                    to,
                });
                console.log(`[SmsProviderService] SMS_DISPATCHED_TWILIO (SID: ${message.sid})`);
                return {
                    provider: 'twilio',
                    status: 'LIVE_PROVIDER',
                    messageId: message.sid,
                };
            } catch {
                console.error('[SmsProviderService] TWILIO_DELIVERY_FAILED');
                throw new Error('TWILIO_DELIVERY_FAILED');
            }
        }

        // Simulation is ONLY permitted when NODE_ENV !== 'production' AND ALLOW_SIMULATED_DELIVERY === 'true'
        const allowSimulation = !isProduction && process.env.ALLOW_SIMULATED_DELIVERY === 'true';
        if (allowSimulation) {
            const mockSid = `SM${uuidv4().replace(/-/g, '')}`;
            console.log(`[SmsProviderService] SMS_SIMULATED_NON_PRODUCTION (SID: ${mockSid})`);
            return {
                provider: 'simulated',
                status: 'SIMULATED',
                messageId: mockSid,
            };
        }

        // Without explicit simulation opt-in, fail closed in all environments
        throw new Error('PROVIDER_DELIVERY_FAILED');
    }
}
