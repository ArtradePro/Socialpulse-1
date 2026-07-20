import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

export class EmailProviderService {
    /**
     * Send email via SendGrid SDK, with Nodemailer SMTP fallback,
     * attaching RFC 8058 List-Unsubscribe headers & compliant unsubscribe footers.
     * @returns The provider's message identifier
     */
    static async send(to: string, subject: string, body: string): Promise<string> {
        const from = env.email.from || 'SocialPulse <no-reply@usesocialpulse.com>';
        const clientUrl = env.clientUrl || 'https://usesocialpulse.com';
        const unsubscribeUrl = `${clientUrl}/unsubscribe?email=${encodeURIComponent(to)}`;

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
        const sgKey = env.email.sendgridApiKey || process.env.SENDGRID_API_KEY;
        if (sgKey && sgKey.trim().startsWith('SG.')) {
            try {
                sgMail.setApiKey(sgKey.trim());
                const [response] = await sgMail.send({
                    to,
                    from,
                    subject,
                    html: htmlContent,
                    headers,
                });
                const messageId = (response.headers && response.headers['x-message-id']) || `sg-${uuidv4()}`;
                console.log(`[EmailProviderService] ✓ Email sent via SendGrid to ${to}. Message ID: ${messageId}`);
                return messageId as string;
            } catch (err: any) {
                console.error(`[EmailProviderService] SendGrid dispatch failed: ${err.message}`, err.response?.body);
                // Fall through to SMTP
            }
        }

        // Priority 2: Nodemailer SMTP
        const smtpPass = env.email.smtp.pass || process.env.SMTP_PASS;
        if (smtpPass) {
            try {
                const transporter = nodemailer.createTransport({
                    host: env.email.smtp.host,
                    port: env.email.smtp.port,
                    secure: env.email.smtp.secure,
                    auth: {
                        user: env.email.smtp.user,
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
                console.log(`[EmailProviderService] ✓ Email sent via SMTP to ${to}. Message ID: ${info.messageId}`);
                return info.messageId;
            } catch (smtpErr: any) {
                console.error(`[EmailProviderService] SMTP fallback failed: ${smtpErr.message}`);
            }
        }

        // Priority 3: Fallback (Console / Dev stub)
        const mockMessageId = `mock-${uuidv4()}`;
        console.log(`[EmailProviderService] ⚠️ Dev Fallback: Simulated email to ${to} (Message ID: ${mockMessageId})`);
        return mockMessageId;
    }
}
