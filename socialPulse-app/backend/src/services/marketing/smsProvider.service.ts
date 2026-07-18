import { v4 as uuidv4 } from 'uuid';

export class SmsProviderService {
    /**
     * Send SMS via Twilio (mock stub for Phase 1)
     * @returns The provider's message identifier (SID)
     */
    static async send(to: string, body: string): Promise<string> {
        console.log(`[SmsProviderService] 📱 Sending SMS to: ${to}`);
        console.log(`[SmsProviderService] Body: "${body}"`);
        
        // Simulate minor network delay
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        // Mock Twilio SID starts with SM...
        const mockSid = `SM${uuidv4().replace(/-/g, '')}`;
        console.log(`[SmsProviderService] ✓ SMS sent successfully. SID: ${mockSid}`);
        return mockSid;
    }
}
