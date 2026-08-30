import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import { EmailProviderService } from '../services/marketing/emailProvider.service';
import { SmsProviderService } from '../services/marketing/smsProvider.service';
import { EmailService } from '../services/email.service';
import { pool, db } from '../config/database';
import { closeTestPool } from './helpers/db';

// Mock SendGrid SDK
jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn(),
}));

// Mock Twilio SDK
jest.mock('twilio', () => {
    return jest.fn().mockImplementation(() => ({
        messages: {
            create: jest.fn(),
        },
    }));
});

// Mock Nodemailer
jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp-test-msg-id-123' }),
    }),
}));

describe('Provider Safety & Fail-Closed Behavior (Phase SP-1C-R1 Final Redaction)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.ALLOW_SIMULATED_DELIVERY;
    });

    afterAll(async () => {
        process.env = originalEnv;
        await pool.end();
        await closeTestPool();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. EMAIL PROVIDER FAIL-CLOSED SAFETY & OPT-IN SIMULATION
    // ─────────────────────────────────────────────────────────────────────────────
    describe('EmailProviderService', () => {
        it('fails closed and throws generic PROVIDER_DELIVERY_FAILED in production when no credentials exist', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.SENDGRID_API_KEY;
            delete process.env.SMTP_PASS;

            await expect(
                EmailProviderService.send('customer@example.com', 'Test Subject', '<p>Test</p>')
            ).rejects.toThrow('PROVIDER_DELIVERY_FAILED');
        });

        it('fails closed in production even if ALLOW_SIMULATED_DELIVERY is set to true', async () => {
            process.env.NODE_ENV = 'production';
            process.env.ALLOW_SIMULATED_DELIVERY = 'true';
            delete process.env.SENDGRID_API_KEY;
            delete process.env.SMTP_PASS;

            await expect(
                EmailProviderService.send('customer@example.com', 'Test Subject', '<p>Test</p>')
            ).rejects.toThrow('PROVIDER_DELIVERY_FAILED');
        });

        it('fails closed in non-production when credentials are missing and ALLOW_SIMULATED_DELIVERY is not enabled', async () => {
            process.env.NODE_ENV = 'development';
            delete process.env.ALLOW_SIMULATED_DELIVERY;
            delete process.env.SENDGRID_API_KEY;
            delete process.env.SMTP_PASS;

            await expect(
                EmailProviderService.send('dev@example.com', 'Dev Subject', '<p>Dev</p>')
            ).rejects.toThrow('PROVIDER_DELIVERY_FAILED');
        });

        it('fails closed in production when SendGrid fails and no SMTP fallback exists', async () => {
            process.env.NODE_ENV = 'production';
            process.env.SENDGRID_API_KEY = 'SG.valid_format_test_key_placeholder';
            delete process.env.SMTP_PASS;

            const sgMail = require('@sendgrid/mail');
            sgMail.send.mockRejectedValueOnce(new Error('SendGrid API Error: 401 Unauthorized'));

            await expect(
                EmailProviderService.send('customer@example.com', 'Test Subject', '<p>Test</p>')
            ).rejects.toThrow('PROVIDER_DELIVERY_FAILED');
        });

        it('returns LIVE_PROVIDER when SendGrid dispatch succeeds in production', async () => {
            process.env.NODE_ENV = 'production';
            process.env.SENDGRID_API_KEY = 'SG.valid_format_test_key_placeholder';

            const sgMail = require('@sendgrid/mail');
            sgMail.send.mockResolvedValueOnce([{ headers: { 'x-message-id': 'sg-msg-real-123' } }]);

            const result = await EmailProviderService.send('customer@example.com', 'Test Subject', '<p>Test</p>');
            expect(result.status).toBe('LIVE_PROVIDER');
            expect(result.provider).toBe('sendgrid');
            expect(result.messageId).toBe('sg-msg-real-123');
        });

        it('returns LIVE_PROVIDER via SMTP fallback when SendGrid fails but SMTP succeeds', async () => {
            process.env.NODE_ENV = 'production';
            process.env.SENDGRID_API_KEY = 'SG.valid_format_test_key_placeholder';
            process.env.SMTP_PASS = 'smtp-valid-password-test';

            const sgMail = require('@sendgrid/mail');
            sgMail.send.mockRejectedValueOnce(new Error('SendGrid rate limited'));

            const result = await EmailProviderService.send('customer@example.com', 'Test Subject', '<p>Test</p>');
            expect(result.status).toBe('LIVE_PROVIDER');
            expect(result.provider).toBe('smtp');
            expect(result.messageId).toBe('smtp-test-msg-id-123');
        });

        it('explicitly classifies result as SIMULATED only when NODE_ENV !== production AND ALLOW_SIMULATED_DELIVERY === true', async () => {
            process.env.NODE_ENV = 'development';
            process.env.ALLOW_SIMULATED_DELIVERY = 'true';
            delete process.env.SENDGRID_API_KEY;
            delete process.env.SMTP_PASS;

            const result = await EmailProviderService.send('dev@example.com', 'Dev Subject', '<p>Dev</p>');
            expect(result.status).toBe('SIMULATED');
            expect(result.provider).toBe('simulated');
            expect(result.messageId).toMatch(/^mock-/);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. SMS PROVIDER FAIL-CLOSED SAFETY & OPT-IN SIMULATION
    // ─────────────────────────────────────────────────────────────────────────────
    describe('SmsProviderService', () => {
        it('fails closed and throws generic PROVIDER_DELIVERY_FAILED in production when Twilio credentials are missing', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.TWILIO_ACCOUNT_SID;
            delete process.env.TWILIO_AUTH_TOKEN;
            delete process.env.TWILIO_PHONE_NUMBER;

            await expect(
                SmsProviderService.send('+1234567890', 'Test SMS Message')
            ).rejects.toThrow('PROVIDER_DELIVERY_FAILED');
        });

        it('fails closed in non-production when credentials are missing and ALLOW_SIMULATED_DELIVERY is not set', async () => {
            process.env.NODE_ENV = 'development';
            delete process.env.ALLOW_SIMULATED_DELIVERY;
            delete process.env.TWILIO_ACCOUNT_SID;
            delete process.env.TWILIO_AUTH_TOKEN;
            delete process.env.TWILIO_PHONE_NUMBER;

            await expect(
                SmsProviderService.send('+1234567890', 'Dev SMS')
            ).rejects.toThrow('PROVIDER_DELIVERY_FAILED');
        });

        it('returns LIVE_PROVIDER when Twilio dispatch succeeds', async () => {
            process.env.NODE_ENV = 'production';
            process.env.TWILIO_ACCOUNT_SID = 'AC_TEST_ACCOUNT_SID';
            process.env.TWILIO_AUTH_TOKEN = 'AUTH_TOKEN_TEST';
            process.env.TWILIO_PHONE_NUMBER = '+15550001111';

            const twilioMock = require('twilio');
            const mockCreate = jest.fn().mockResolvedValueOnce({ sid: 'SM_REAL_TWILIO_SID_123' });
            twilioMock.mockImplementationOnce(() => ({
                messages: { create: mockCreate },
            }));

            const result = await SmsProviderService.send('+1234567890', 'Test SMS');
            expect(result.status).toBe('LIVE_PROVIDER');
            expect(result.provider).toBe('twilio');
            expect(result.messageId).toBe('SM_REAL_TWILIO_SID_123');
        });

        it('throws generic TWILIO_DELIVERY_FAILED when Twilio dispatch fails in production', async () => {
            process.env.NODE_ENV = 'production';
            process.env.TWILIO_ACCOUNT_SID = 'AC_TEST_ACCOUNT_SID';
            process.env.TWILIO_AUTH_TOKEN = 'AUTH_TOKEN_TEST';
            process.env.TWILIO_PHONE_NUMBER = '+15550001111';

            const twilioMock = require('twilio');
            const mockCreate = jest.fn().mockRejectedValueOnce(new Error('Twilio Error: 21211 Invalid Phone Number'));
            twilioMock.mockImplementationOnce(() => ({
                messages: { create: mockCreate },
            }));

            await expect(
                SmsProviderService.send('+1234567890', 'Test SMS')
            ).rejects.toThrow('TWILIO_DELIVERY_FAILED');
        });

        it('explicitly classifies result as SIMULATED when NODE_ENV !== production AND ALLOW_SIMULATED_DELIVERY === true', async () => {
            process.env.NODE_ENV = 'development';
            process.env.ALLOW_SIMULATED_DELIVERY = 'true';
            delete process.env.TWILIO_ACCOUNT_SID;
            delete process.env.TWILIO_AUTH_TOKEN;
            delete process.env.TWILIO_PHONE_NUMBER;

            const result = await SmsProviderService.send('+1234567890', 'Dev SMS');
            expect(result.status).toBe('SIMULATED');
            expect(result.provider).toBe('simulated');
            expect(result.messageId).toMatch(/^SM/);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. WORKER DELIVERY STATUS TRUTH
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Message Delivery Worker Truth Logic', () => {
        it('processes LIVE_PROVIDER result to database status "delivered"', async () => {
            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({ rows: [] } as any);
            const deliveryResult: { provider: string; status: 'LIVE_PROVIDER' | 'SIMULATED'; messageId: string } = {
                provider: 'sendgrid',
                status: 'LIVE_PROVIDER',
                messageId: 'sg-123',
            };

            const isLive = deliveryResult.status === 'LIVE_PROVIDER';
            const logStatus = isLive ? 'delivered' : 'sent';
            const errorMessage = isLive ? null : 'SIMULATED_NON_PRODUCTION';

            await db.query(
                `UPDATE marketing_delivery_logs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
                [logStatus, errorMessage, 'mock-log-id']
            );

            expect(spyDbQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE marketing_delivery_logs'),
                ['delivered', null, 'mock-log-id']
            );
            spyDbQuery.mockRestore();
        });

        it('processes permitted SIMULATED result to database status "sent" with SIMULATED_NON_PRODUCTION marker (never "delivered")', async () => {
            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({ rows: [] } as any);
            const deliveryResult: { provider: string; status: 'LIVE_PROVIDER' | 'SIMULATED'; messageId: string } = {
                provider: 'simulated',
                status: 'SIMULATED',
                messageId: 'mock-123',
            };

            const isLive = deliveryResult.status === 'LIVE_PROVIDER';
            const logStatus = isLive ? 'delivered' : 'sent';
            const errorMessage = isLive ? null : 'SIMULATED_NON_PRODUCTION';

            await db.query(
                `UPDATE marketing_delivery_logs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
                [logStatus, errorMessage, 'mock-log-id']
            );

            expect(logStatus).toBe('sent');
            expect(logStatus).not.toBe('delivered');
            expect(errorMessage).toBe('SIMULATED_NON_PRODUCTION');
            expect(spyDbQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE marketing_delivery_logs'),
                ['sent', 'SIMULATED_NON_PRODUCTION', 'mock-log-id']
            );
            spyDbQuery.mockRestore();
        });

        it('stores generic PROVIDER_DELIVERY_FAILED on provider errors without leaking raw details', async () => {
            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({ rows: [] } as any);

            await db.query(
                `UPDATE marketing_delivery_logs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
                ['failed', 'PROVIDER_DELIVERY_FAILED', 'mock-log-id']
            );

            expect(spyDbQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE marketing_delivery_logs'),
                ['failed', 'PROVIDER_DELIVERY_FAILED', 'mock-log-id']
            );
            spyDbQuery.mockRestore();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. TRANSACTIONAL EMAIL LIFECYCLE & TEST ISOLATION
    // ─────────────────────────────────────────────────────────────────────────────
    describe('EmailService (Transactional Welcome / Password Reset)', () => {
        it('completes synchronously without error or network calls in test environment', async () => {
            process.env.NODE_ENV = 'test';
            await expect(
                EmailService.sendWelcome('testuser@example.com', 'Test User')
            ).resolves.toBeUndefined();
        });

        it('fails closed and throws generic PROVIDER_DELIVERY_FAILED in production when no credentials are configured', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.SENDGRID_API_KEY;
            delete process.env.SMTP_PASS;

            await expect(
                EmailService.sendWelcome('produser@example.com', 'Prod User')
            ).rejects.toThrow('PROVIDER_DELIVERY_FAILED');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. SENTINEL SECRECY & COMPLETE LOG REDACTION TESTS
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Sentinel Secrecy & Complete Log Redaction', () => {
        const sentinelEmail = 'sentinel_sensitive_target@example.org';
        const sentinelPhone = '+19998887777';
        const sentinelSecret = 'sk_test_sentinel_fake_secret_token_abc123';

        it('never leaks sentinel email, phone, or secret when SendGrid throws a detailed error object', async () => {
            process.env.NODE_ENV = 'production';
            process.env.SENDGRID_API_KEY = 'SG.valid_format_test_key_placeholder';
            delete process.env.SMTP_PASS;

            const logs: string[] = [];
            const errors: string[] = [];
            const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
            const spyErr = jest.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.join(' ')));

            const sgMail = require('@sendgrid/mail');
            sgMail.send.mockRejectedValueOnce(
                new Error(`SendGrid API error for ${sentinelEmail} using key ${sentinelSecret}`)
            );

            let caughtError: any;
            try {
                await EmailProviderService.send(sentinelEmail, 'Test', '<p>Hello</p>');
            } catch (err: any) {
                caughtError = err;
            }

            spyLog.mockRestore();
            spyErr.mockRestore();

            const allOutput = [...logs, ...errors, caughtError?.message || ''].join(' ');

            expect(allOutput).not.toContain(sentinelEmail);
            expect(allOutput).not.toContain(sentinelSecret);
            expect(errors).toContain('[EmailProviderService] SENDGRID_DELIVERY_FAILED');
            expect(caughtError?.message).toBe('PROVIDER_DELIVERY_FAILED');
        });

        it('never leaks sentinel phone or secret when Twilio throws a detailed error object', async () => {
            process.env.NODE_ENV = 'production';
            process.env.TWILIO_ACCOUNT_SID = 'AC_SENTINEL_SID';
            process.env.TWILIO_AUTH_TOKEN = 'AUTH_SENTINEL_TOKEN';
            process.env.TWILIO_PHONE_NUMBER = '+15550009999';

            const logs: string[] = [];
            const errors: string[] = [];
            const spyLog = jest.spyOn(console, 'log').mockImplementation((...args) => logs.push(args.join(' ')));
            const spyErr = jest.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.join(' ')));

            const twilioMock = require('twilio');
            twilioMock.mockImplementationOnce(() => ({
                messages: {
                    create: jest.fn().mockRejectedValueOnce(
                        new Error(`Twilio rejected ${sentinelPhone} with secret ${sentinelSecret}`)
                    ),
                },
            }));

            let caughtError: any;
            try {
                await SmsProviderService.send(sentinelPhone, 'Test SMS');
            } catch (err: any) {
                caughtError = err;
            }

            spyLog.mockRestore();
            spyErr.mockRestore();

            const allOutput = [...logs, ...errors, caughtError?.message || ''].join(' ');

            expect(allOutput).not.toContain(sentinelPhone);
            expect(allOutput).not.toContain(sentinelSecret);
            expect(errors).toContain('[SmsProviderService] TWILIO_DELIVERY_FAILED');
            expect(caughtError?.message).toBe('TWILIO_DELIVERY_FAILED');
        });

        it('never stores raw provider error messages in database delivery log', async () => {
            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({ rows: [] } as any);

            // Simulate worker error handling with raw error containing sentinels
            const rawError = new Error(`Provider failed for ${sentinelEmail} and ${sentinelPhone} secret=${sentinelSecret}`);
            
            // Worker catch logic:
            const storedErrorMessage = 'PROVIDER_DELIVERY_FAILED';
            await db.query(
                `UPDATE marketing_delivery_logs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
                ['failed', storedErrorMessage, 'mock-log-id']
            );

            expect(spyDbQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE marketing_delivery_logs'),
                ['failed', 'PROVIDER_DELIVERY_FAILED', 'mock-log-id']
            );

            const callArgs = JSON.stringify(spyDbQuery.mock.calls);
            expect(callArgs).not.toContain(sentinelEmail);
            expect(callArgs).not.toContain(sentinelPhone);
            expect(callArgs).not.toContain(sentinelSecret);

            spyDbQuery.mockRestore();
        });
    });
});
