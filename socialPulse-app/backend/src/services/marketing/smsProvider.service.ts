import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

export class SmsProviderService {
    /**
     * Send SMS via Twilio SDK
     * @returns The provider's message identifier (SID)
     */
    static async send(to: string, body: string): Promise<string> {
        console.log(`[SmsProviderService] 📱 Sending SMS to: ${to}`);

        const accountSid = env.twilio.accountSid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = env.twilio.authToken || process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = env.twilio.phoneNumber || process.env.TWILIO_PHONE_NUMBER;

        if (accountSid && authToken && fromNumber) {
            try {
                const client = twilio(accountSid, authToken);
                const message = await client.messages.create({
                    body,
                    from: fromNumber,
                    to,
                });
                console.log(`[SmsProviderService] ✓ SMS sent successfully via Twilio. SID: ${message.sid}`);
                return message.sid;
            } catch (err: any) {
                console.error(`[SmsProviderService] Twilio SMS dispatch failed: ${err.message}`);
                throw new Error(`Twilio SMS dispatch failed: ${err.message}`);
            }
        }

        // Development / Fallback stub when Twilio credentials are not configured
        console.warn(`[SmsProviderService] ⚠️ Twilio credentials missing. Falling back to dev stub.`);
        const mockSid = `SM${uuidv4().replace(/-/g, '')}`;
        console.log(`[SmsProviderService] Simulated SMS sent. Mock SID: ${mockSid}`);
        return mockSid;
    }
}
