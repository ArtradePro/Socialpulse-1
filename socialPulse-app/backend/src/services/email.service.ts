// backend/src/services/email.service.ts
// Transactional email via nodemailer. Supports any SMTP provider
// (Resend SMTP, SendGrid, Mailgun, etc.) via env vars.

import nodemailer, { Transporter } from 'nodemailer';

// ─── Singleton transporter ────────────────────────────────────────────────────

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST || 'smtp.resend.com',
        port:   parseInt(process.env.SMTP_PORT ?? '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER || 'resend',
            pass: process.env.SMTP_PASS,
        },
    });

    return transporter;
}

const FROM = process.env.EMAIL_FROM ?? 'SocialPulse <no-reply@socialpulse.app>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

// ─── Send helper ─────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
    return `${maskedName}@${domain}`;
}

async function send(to: string, subject: string, html: string): Promise<void> {
    // In test environment, do not initiate real network requests or background logging
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    const FROM = process.env.EMAIL_FROM ?? 'SocialPulse <no-reply@socialpulse.app>';
    const isProduction = process.env.NODE_ENV === 'production';
    const maskedTo = maskEmail(to);

    // Priority 1: SendGrid
    const sgKey = process.env.SENDGRID_API_KEY?.trim();
    if (sgKey && sgKey.startsWith('SG.')) {
        try {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(sgKey);
            await sgMail.send({ to, from: FROM, subject, html });
            return;
        } catch {
            console.error('[Email] SENDGRID_DELIVERY_FAILED');
            // Fall through to SMTP
        }
    } else if (sgKey) {
        console.warn('[Email] Invalid SendGrid key format. Falling back to SMTP.');
    }

    // Priority 2: SMTP
    const smtpPass = process.env.SMTP_PASS?.trim();
    if (smtpPass) {
        try {
            await getTransporter().sendMail({ from: FROM, to, subject, html });
            return;
        } catch {
            console.error('[Email] SMTP_DELIVERY_FAILED');
        }
    }

    // Simulation is ONLY permitted when NODE_ENV !== 'production' AND ALLOW_SIMULATED_DELIVERY === 'true'
    const allowSimulation = !isProduction && process.env.ALLOW_SIMULATED_DELIVERY === 'true';
    if (allowSimulation) {
        return;
    }

    // Without explicit simulation opt-in, fail closed in all environments
    throw new Error('PROVIDER_DELIVERY_FAILED');
}

// ─── Templates ───────────────────────────────────────────────────────────────

function base(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background:#f5f5f5; margin:0; padding:0; }
    .wrap { max-width:560px; margin:40px auto; background:#fff;
            border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { background:#4f46e5; padding:32px 40px; }
    .header h1 { color:#fff; margin:0; font-size:22px; font-weight:700; }
    .body { padding:32px 40px; color:#374151; line-height:1.6; }
    .btn { display:inline-block; margin:24px 0; padding:14px 28px;
           background:#4f46e5; color:#fff; text-decoration:none;
           border-radius:8px; font-weight:600; font-size:15px; }
    .footer { padding:16px 40px 32px; color:#9ca3af; font-size:12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1>SocialPulse</h1></div>
    <div class="body">${content}</div>
    <div class="footer">You're receiving this because you have a SocialPulse account.
      <br>&copy; ${new Date().getFullYear()} SocialPulse. All rights reserved.</div>
  </div>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const EmailService = {
    /** Welcome email sent after account creation */
    async sendWelcome(to: string, fullName: string): Promise<void> {
        await send(
            to,
            'Welcome to SocialPulse 🎉',
            base(`
              <p>Hi ${fullName || 'there'},</p>
              <p>Welcome to <strong>SocialPulse</strong>! Your account is ready.
                 Start by connecting your social accounts and scheduling your first post.</p>
              <a class="btn" href="${APP_URL}/settings">Get Started</a>
              <p>If you have any questions, just reply to this email — we're always happy to help.</p>
            `)
        );
    },

    /** Password-reset email with a one-time link */
    async sendPasswordReset(to: string, token: string): Promise<void> {
        const link = `${APP_URL}/reset-password?token=${token}`;
        await send(
            to,
            'Reset your SocialPulse password',
            base(`
              <p>Hi,</p>
              <p>We received a request to reset the password for your SocialPulse account.
                 Click the button below — this link expires in <strong>1 hour</strong>.</p>
              <a class="btn" href="${link}">Reset Password</a>
              <p>If you didn't request this, you can safely ignore this email.
                 Your password will not change.</p>
              <p style="font-size:12px;color:#9ca3af;">Or copy this URL:<br>${link}</p>
            `)
        );
    },

    /** Sent when a Stripe payment fails */
    async sendPaymentFailed(to: string, fullName: string, nextRetry?: Date): Promise<void> {
        const retry = nextRetry
            ? `<p>Stripe will automatically retry on <strong>${nextRetry.toDateString()}</strong>.</p>`
            : '';
        await send(
            to,
            'Action required: payment failed',
            base(`
              <p>Hi ${fullName || 'there'},</p>
              <p>We were unable to process your latest SocialPulse subscription payment.
                 Please update your billing details to avoid service interruption.</p>
              ${retry}
              <a class="btn" href="${APP_URL}/billing">Update Billing</a>
            `)
        );
    },

    /** Sent when a scheduled post fails to publish on one or more platforms */
    async sendPostFailed(
        to:       string,
        postId:   string,
        failures: { platform: string; error: string }[]
    ): Promise<void> {
        const rows = failures
            .map(f => `<li><strong>${f.platform}</strong>: ${f.error}</li>`)
            .join('');
        await send(
            to,
            'Your scheduled post failed to publish',
            base(`
              <p>Hi,</p>
              <p>One or more of your scheduled posts failed to publish:</p>
              <ul>${rows}</ul>
              <a class="btn" href="${APP_URL}/content?id=${postId}">View Post</a>
              <p>Check that your social accounts are still connected and try republishing.</p>
            `)
        );
    },

    /** Trial-ending reminder (3 days before expiry) */
    async sendTrialEnding(to: string, fullName: string, daysLeft: number): Promise<void> {
        await send(
            to,
            `Your SocialPulse trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            base(`
              <p>Hi ${fullName || 'there'},</p>
              <p>Your SocialPulse free trial ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.
                 Upgrade now to keep access to all your scheduled posts and analytics.</p>
              <a class="btn" href="${APP_URL}/billing">Upgrade Now</a>
            `)
        );
    },

    /** Team invitation email with accept link */
    async sendTeamInvite(
        to:           string,
        inviterEmail: string,
        teamName:     string,
        role:         string,
        link:         string
    ): Promise<void> {
        await send(
            to,
            `You've been invited to join ${teamName} on SocialPulse`,
            base(`
              <p>Hi,</p>
              <p><strong>${inviterEmail}</strong> has invited you to join the
                 <strong>${teamName}</strong> team on SocialPulse as a
                 <strong>${role}</strong>.</p>
              <a class="btn" href="${link}">Accept Invitation</a>
              <p>This link expires in <strong>7 days</strong>. If you don't have
                 an account yet, you'll be prompted to create one.</p>
              <p style="font-size:12px;color:#9ca3af;">Or copy this URL:<br>${link}</p>
            `)
        );
    },
};
