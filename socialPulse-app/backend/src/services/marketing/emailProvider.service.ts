import { v4 as uuidv4 } from 'uuid';

export class EmailProviderService {
    /**
     * Send email via AWS SES (mock stub for Phase 1)
     * @returns The provider's message identifier
     */
    static async send(to: string, subject: string, body: string): Promise<string> {
        console.log(`[EmailProviderService] ✉️ Sending Email to: ${to}`);
        console.log(`[EmailProviderService] Subject: "${subject}"`);
        console.log(`[EmailProviderService] Body snippet: "${body.substring(0, 100)}..."`);
        
        // Simulate minor network delay
        await new Promise((resolve) => setTimeout(resolve, 300));
        
        const mockMessageId = `ses-${uuidv4()}`;
        console.log(`[EmailProviderService] ✓ Email sent successfully. Message ID: ${mockMessageId}`);
        return mockMessageId;
    }
}
