import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

export interface EmailDeliveryResult {
    provider: 'sendgrid' | 'smtp' | 'simulated';
    status: 'LIVE_PROVIDER' | 'SIMULATED';
    messageId: string;
}

function maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
    return `${maskedName}@${domain}`;
}

export class EmailProviderService {
    /**
     * Send email via SendGrid SDK, with Nodemailer SMTP fallback,
     * attaching RFC 8058 List-Unsubscribe headers & compliant unsubscribe footers.
     * Fails closed in production if no valid provider succeeds.
     */
    static async send(to: string, subject: string, body: string): Promise<EmailDeliveryResult> {
        const from = process.env.EMAIL_FROM || env.email.from || 'SocialPulse <no-reply@usesocialpulse.com>';
        const clientUrl = process.env.CLIENT_URL || env.clientUrl || 'https://usesocialpulse.com';
        const unsubscribeUrl = `${clientUrl}/unsubscribe?email=${encodeURIComponent(to)}`;
        const isProduction = process.env.NODE_ENV === 'production';
        const maskedTo = maskEmail(to);

        // RFC 8058 headers for one-click unsubscribe
        const headers = {
            'List-Unsubscribe': `<mailto:unsubscribe@usesocialpulse.com?subject=unsubscribe>, <${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        };

        // Append compliant HTML unsubscribe footer if not present
        let htmlContent = body;
        if (!body.toLowerCase().includes('unsubscribe')) {
            htmlContent += `
<br><hr style="border:none;border-top:1px solid #eaeaea;margin:20px 0;" />
<p style="font-size:12px;color:#888888;font-family:sans-serif;">
  You are receiving this email because you opted in to updates.
  <a href="${unsubscribeUrl}" style="color:#6366f1;text-decoration:underline;">Unsubscribe from marketing emails</a>
</p>`;
        }

        // Priority 1: SendGrid SDK
        const sgKey = process.env.SENDGRID_API_KEY?.trim();
        if (sgKey && sgKey.startsWith('SG.')) {
            try {
                sgMail.setApiKey(sgKey);
                const [response] = await sgMail.send({
                    to,
                    from,
                    subject,
                    html: htmlContent,
                    headers,
                });
                const messageId = (response.headers && response.headers['x-message-id']) || `sg-${uuidv4()}`;
                console.log(`[EmailProviderService] EMAIL_DISPATCHED_SENDGRID (Message ID: ${messageId})`);
                return {
                    provider: 'sendgrid',
                    status: 'LIVE_PROVIDER',
                    messageId: messageId as string,
                };
            } catch {
                console.error('[EmailProviderService] SENDGRID_DELIVERY_FAILED');
                // Fall through to SMTP
            }
        } else if (sgKey) {
            console.warn('[EmailProviderService] Invalid SendGrid key format. Falling through to SMTP.');
        }

        // Priority 2: Nodemailer SMTP
        const smtpPass = process.env.SMTP_PASS?.trim();
        if (smtpPass) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || env.email.smtp.host,
                    port: parseInt(process.env.SMTP_PORT || String(env.email.smtp.port) || '587'),
                    secure: process.env.SMTP_SECURE === 'true' || env.email.smtp.secure,
                    auth: {
                        user: process.env.SMTP_USER || env.email.smtp.user,
                        pass: smtpPass,
                    },
                });
                const info = await transporter.sendMail({
                    from,
                    to,
                    subject,
                    html: htmlContent,
                    headers,
                });
                console.log(`[EmailProviderService] EMAIL_DISPATCHED_SMTP (Message ID: ${info.messageId})`);
                return {
                    provider: 'smtp',
                    status: 'LIVE_PROVIDER',
                    messageId: info.messageId,
                };
            } catch {
                console.error('[EmailProviderService] SMTP_DELIVERY_FAILED');
            }
        }

        // Simulation is ONLY permitted when NODE_ENV !== 'production' AND ALLOW_SIMULATED_DELIVERY === 'true'
        const allowSimulation = !isProduction && process.env.ALLOW_SIMULATED_DELIVERY === 'true';
        if (allowSimulation) {
            const mockMessageId = `mock-${uuidv4()}`;
            console.log(`[EmailProviderService] EMAIL_SIMULATED_NON_PRODUCTION (Message ID: ${mockMessageId})`);
            return {
                provider: 'simulated',
                status: 'SIMULATED',
                messageId: mockMessageId,
            };
        }

        // Without explicit simulation opt-in, fail closed in all environments
        throw new Error('PROVIDER_DELIVERY_FAILED');
    }
}
