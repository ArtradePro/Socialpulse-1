import dotenv from 'dotenv';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../../.env.test') });

import crypto from 'crypto';
import {
    encryptSecret,
    decryptSecretEnvelope,
    decryptSecretWithDualRead,
    reencryptSecret,
    isEncryptedEnvelope,
    getSalesPageStripeKeyAAD,
    getKeyRegistry,
    validateCanonicalBase64
} from '../utils/crypto';
import { migrateSalesPageSecrets } from '../database/scripts/encryptExistingSecrets';
import { pool, db } from '../config/database';
import { closeTestPool } from './helpers/db';

// Generate synthetic 32-byte test keys (fake test fixtures only)
const TEST_KEY_1_BASE64 = Buffer.from('TEST_KEY_32_BYTES_NUMBER_ONE!!__').toString('base64');
const TEST_KEY_2_BASE64 = Buffer.from('TEST_KEY_32_BYTES_NUMBER_TWO!!__').toString('base64');

describe('Cryptographic Engine & Secret Encryption at Rest (Phase SP-1D-R1)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k1';
        process.env.ENCRYPTION_KEYS_JSON = JSON.stringify({
            k1: TEST_KEY_1_BASE64,
            k2: TEST_KEY_2_BASE64,
        });
    });

    afterAll(async () => {
        process.env = originalEnv;
        await pool.end();
        await closeTestPool();
    });

    const workspaceA = '11111111-1111-4111-a111-111111111111';
    const workspaceB = '22222222-2222-4222-a222-222222222222';
    const sampleStripeKey = 'sk_test_fake_sample_stripe_credential_secret_12345';

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. KEY REGISTRY & CANONICAL BASE64 VALIDATION
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Key Registry & Canonical Base64 Validation', () => {
        it('successfully loads valid key registry', () => {
            const { activeKeyId, keys } = getKeyRegistry();
            expect(activeKeyId).toBe('k1');
            expect(keys.k1).toBeInstanceOf(Buffer);
            expect(keys.k1.length).toBe(32);
            expect(keys.k2.length).toBe(32);
        });

        it('rejects key ID containing colons, spaces, or envelope delimiters', () => {
            process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k:1';
            process.env.ENCRYPTION_KEYS_JSON = JSON.stringify({
                'k:1': TEST_KEY_1_BASE64,
            });
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');

            process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k 1';
            process.env.ENCRYPTION_KEYS_JSON = JSON.stringify({
                'k 1': TEST_KEY_1_BASE64,
            });
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');
        });

        it('rejects key ID exceeding 64 characters', () => {
            const longId = 'k'.repeat(65);
            process.env.ACTIVE_ENCRYPTION_KEY_ID = longId;
            process.env.ENCRYPTION_KEYS_JSON = JSON.stringify({
                [longId]: TEST_KEY_1_BASE64,
            });
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');
        });

        it('fails closed when ACTIVE_ENCRYPTION_KEY_ID is missing', () => {
            delete process.env.ACTIVE_ENCRYPTION_KEY_ID;
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');
        });

        it('fails closed when ENCRYPTION_KEYS_JSON is missing', () => {
            delete process.env.ENCRYPTION_KEYS_JSON;
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');
        });

        it('fails closed when ENCRYPTION_KEYS_JSON is malformed JSON', () => {
            process.env.ENCRYPTION_KEYS_JSON = '{ bad_json ';
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');
        });

        it('fails closed when active key ID does not exist in the registry', () => {
            process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k999_missing';
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');
        });

        it('fails closed when key length is shorter than 32 bytes', () => {
            process.env.ENCRYPTION_KEYS_JSON = JSON.stringify({
                k1: Buffer.from('SHORT_KEY_16B!').toString('base64'),
            });
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');
        });

        it('fails closed when key length is longer than 32 bytes', () => {
            process.env.ENCRYPTION_KEYS_JSON = JSON.stringify({
                k1: Buffer.from('TOO_LONG_KEY_48_BYTES_THIS_IS_DEFINITELY_OVER_LIMIT!').toString('base64'),
            });
            expect(() => getKeyRegistry()).toThrow('ENCRYPTION_CONFIG_INVALID');
        });

        it('fails closed on non-canonical base64 encoding (e.g. invalid padding or bits)', () => {
            // "Zm9v" is canonical for 'foo'. "Zm9v=" has improper padding
            expect(() => validateCanonicalBase64('Zm9v=')).toThrow('CANONICAL_BASE64_INVALID');
            expect(() => validateCanonicalBase64('NOT_B64!@#$')).toThrow('CANONICAL_BASE64_INVALID');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. CANONICAL AAD & UUID VALIDATION
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Canonical Authenticated Additional Data (AAD) & UUID Validation', () => {
        it('constructs exact canonical AAD format with lowercased UUID', () => {
            const uppercaseWs = '11111111-1111-4111-A111-111111111111';
            const aad = getSalesPageStripeKeyAAD(uppercaseWs);
            expect(aad).toBe(`socialpulse:v1:sales_pages:${workspaceA}:stripe_secret_key`);
        });

        it('proves encryption with uppercase UUID context decrypts with lowercase UUID context', () => {
            const uppercaseWs = '11111111-1111-4111-A111-111111111111';
            const aadUpper = getSalesPageStripeKeyAAD(uppercaseWs);
            const aadLower = getSalesPageStripeKeyAAD(workspaceA);

            expect(aadUpper).toBe(aadLower);

            const envelope = encryptSecret(sampleStripeKey, aadUpper);
            const decrypted = decryptSecretEnvelope(envelope, aadLower);
            expect(decrypted).toBe(sampleStripeKey);
        });

        it('fails closed when workspace ID is not a valid UUID', () => {
            expect(() => getSalesPageStripeKeyAAD('not-a-valid-uuid')).toThrow('ENCRYPTION_FAILED');
            expect(() => getSalesPageStripeKeyAAD('')).toThrow('ENCRYPTION_FAILED');
            expect(() => getSalesPageStripeKeyAAD('   ')).toThrow('ENCRYPTION_FAILED');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. ENCRYPTION & DECRYPTION ROUNDTRIP & INTEGRITY
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Encryption, Nonce Randomness & Envelope Structure', () => {
        it('performs deterministic roundtrip decryption of plaintext', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const envelope = encryptSecret(sampleStripeKey, aad);

            expect(isEncryptedEnvelope(envelope)).toBe(true);
            const decrypted = decryptSecretEnvelope(envelope, aad);
            expect(decrypted).toBe(sampleStripeKey);
        });

        it('generates unique nonces and different envelopes for identical plaintext', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const env1 = encryptSecret(sampleStripeKey, aad);
            const env2 = encryptSecret(sampleStripeKey, aad);

            expect(env1).not.toBe(env2);

            const parts1 = env1.split(':');
            const parts2 = env2.split(':');

            // Nonces must differ
            expect(parts1[3]).not.toBe(parts2[3]);
        });

        it('constructs standard 6-part envelope with 12-byte nonce and 16-byte tag', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const envelope = encryptSecret(sampleStripeKey, aad);
            const parts = envelope.split(':');

            expect(parts.length).toBe(6);
            expect(parts[0]).toBe('enc');
            expect(parts[1]).toBe('v1');
            expect(parts[2]).toBe('k1'); // Active key ID

            const nonceBuf = validateCanonicalBase64(parts[3], 12);
            const tagBuf = validateCanonicalBase64(parts[4], 16);
            const ciphertextBuf = validateCanonicalBase64(parts[5]);

            expect(nonceBuf.length).toBe(12);
            expect(tagBuf.length).toBe(16);
            expect(ciphertextBuf.length).toBeGreaterThan(0);
        });

        it('refuses to double-encrypt an already encrypted envelope', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const envelope = encryptSecret(sampleStripeKey, aad);

            expect(() => encryptSecret(envelope, aad)).toThrow('ENCRYPTION_FAILED');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. TAMPERING DETECTION & FAIL-CLOSED BEHAVIOR
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Tampering Detection & Fail-Closed Behavior', () => {
        it('fails closed and rejects cross-workspace ciphertext decryption (wrong AAD)', () => {
            const aadA = getSalesPageStripeKeyAAD(workspaceA);
            const aadB = getSalesPageStripeKeyAAD(workspaceB);

            const envelopeA = encryptSecret(sampleStripeKey, aadA);

            expect(() => decryptSecretEnvelope(envelopeA, aadB)).toThrow('DECRYPTION_FAILED');
        });

        it('fails closed when authentication tag is tampered', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const envelope = encryptSecret(sampleStripeKey, aad);
            const parts = envelope.split(':');

            const tagBuf = Buffer.from(parts[4], 'base64');
            tagBuf[0] ^= 0xff;
            parts[4] = tagBuf.toString('base64');

            const tamperedEnvelope = parts.join(':');
            expect(() => decryptSecretEnvelope(tamperedEnvelope, aad)).toThrow('DECRYPTION_FAILED');
        });

        it('fails closed when ciphertext is tampered', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const envelope = encryptSecret(sampleStripeKey, aad);
            const parts = envelope.split(':');

            const ctBuf = Buffer.from(parts[5], 'base64');
            ctBuf[0] ^= 0xff;
            parts[5] = ctBuf.toString('base64');

            const tamperedEnvelope = parts.join(':');
            expect(() => decryptSecretEnvelope(tamperedEnvelope, aad)).toThrow('DECRYPTION_FAILED');
        });

        it('fails closed when nonce is tampered', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const envelope = encryptSecret(sampleStripeKey, aad);
            const parts = envelope.split(':');

            const nonceBuf = Buffer.from(parts[3], 'base64');
            nonceBuf[0] ^= 0xff;
            parts[3] = nonceBuf.toString('base64');

            const tamperedEnvelope = parts.join(':');
            expect(() => decryptSecretEnvelope(tamperedEnvelope, aad)).toThrow('DECRYPTION_FAILED');
        });

        it('fails closed when envelope is truncated', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            expect(() => decryptSecretEnvelope('enc:v1:k1:part', aad)).toThrow('DECRYPTION_FAILED');
            expect(() => decryptSecretEnvelope('enc:v1:', aad)).toThrow('DECRYPTION_FAILED');
            expect(() => decryptSecretEnvelope('enc:', aad)).toThrow('DECRYPTION_FAILED');
        });

        it('fails closed with UNKNOWN_KEY_ID when envelope specifies an unconfigured key ID', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const envelope = encryptSecret(sampleStripeKey, aad);
            const parts = envelope.split(':');
            parts[2] = 'k99_unknown';

            const modifiedKeyEnvelope = parts.join(':');
            expect(() => decryptSecretEnvelope(modifiedKeyEnvelope, aad)).toThrow('UNKNOWN_KEY_ID');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. KEY ROTATION READINESS
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Key Rotation & Re-encryption', () => {
        it('decrypts historical envelope with key k1 when active key is set to k2', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k1';
            const envelopeK1 = encryptSecret(sampleStripeKey, aad);
            expect(envelopeK1.startsWith('enc:v1:k1:')).toBe(true);

            process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k2';

            const decrypted = decryptSecretEnvelope(envelopeK1, aad);
            expect(decrypted).toBe(sampleStripeKey);

            const envelopeK2 = encryptSecret(sampleStripeKey, aad);
            expect(envelopeK2.startsWith('enc:v1:k2:')).toBe(true);
        });

        it('re-encrypts historical envelope to active key with fresh nonce', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k1';
            const envelopeK1 = encryptSecret(sampleStripeKey, aad);

            process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k2';
            const reencrypted = reencryptSecret(envelopeK1, aad);

            expect(reencrypted.changed).toBe(true);
            expect(reencrypted.envelope.startsWith('enc:v1:k2:')).toBe(true);

            const decrypted = decryptSecretEnvelope(reencrypted.envelope, aad);
            expect(decrypted).toBe(sampleStripeKey);
        });

        it('skips re-encryption idempotently if already encrypted with active key', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            process.env.ACTIVE_ENCRYPTION_KEY_ID = 'k2';
            const envelopeK2 = encryptSecret(sampleStripeKey, aad);

            const reencrypted = reencryptSecret(envelopeK2, aad);
            expect(reencrypted.changed).toBe(false);
            expect(reencrypted.envelope).toBe(envelopeK2);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. DUAL-READ COMPATIBILITY
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Dual-Read Transition Helper', () => {
        it('decrypts encrypted envelope correctly', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const envelope = encryptSecret(sampleStripeKey, aad);

            const decrypted = decryptSecretWithDualRead(envelope, aad);
            expect(decrypted).toBe(sampleStripeKey);
        });

        it('reads legacy plaintext string directly during transition', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const plaintextLegacy = 'sk_test_legacy_unencrypted_secret_123';

            const readValue = decryptSecretWithDualRead(plaintextLegacy, aad);
            expect(readValue).toBe(plaintextLegacy);
        });

        it('never treats malformed enc: prefix as legacy plaintext', () => {
            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const malformedEnc = 'enc:v1:corrupted_envelope_string';

            expect(() => decryptSecretWithDualRead(malformedEnc, aad)).toThrow('DECRYPTION_FAILED');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. OFFLINE MIGRATION UTILITY UNIT & CONCURRENCY TESTS
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Offline Migration Utility Controls & Concurrency Safety', () => {
        it('dry-run performs zero updates and processes keyset batches', async () => {
            const spyDbQuery = jest.spyOn(db, 'query').mockImplementation((sql: string, params?: any[]) => {
                if (sql.includes('FROM sales_pages')) {
                    return Promise.resolve({
                        rows: [
                            { id: '11111111-1111-4111-a111-111111111111', workspace_id: workspaceA, stripe_secret_key: 'sk_test_legacy_1' },
                            { id: '22222222-2222-4222-a222-222222222222', workspace_id: workspaceA, stripe_secret_key: null },
                        ]
                    } as any);
                }
                return Promise.resolve({ rows: [] } as any);
            });

            const summary = await migrateSalesPageSecrets({ apply: false, batchSize: 50 });

            expect(summary.isDryRun).toBe(true);
            expect(summary.totalRecords).toBe(2);
            expect(summary.legacyPlaintextCount).toBe(1);
            expect(summary.nullOrEmptyCount).toBe(1);
            expect(summary.migratedCount).toBe(0); // Zero writes

            spyDbQuery.mockRestore();
        });

        it('production apply is always prohibited, even with legacy environment override variables', async () => {
            process.env.NODE_ENV = 'production';
            process.env.ALLOW_SECRET_MIGRATION = 'true';
            (process.env as any).ALLOW_PRODUCTION_SECRET_MIGRATION = 'true';

            const summary = await migrateSalesPageSecrets({ apply: true });
            expect(summary.errorCode).toBe('PRODUCTION_MIGRATION_PROHIBITED');
            expect(summary.migratedCount).toBe(0);
        });

        it('missing apply authorization is rejected when ALLOW_SECRET_MIGRATION is not true', async () => {
            delete process.env.ALLOW_SECRET_MIGRATION;

            const summary = await migrateSalesPageSecrets({ apply: true });
            expect(summary.errorCode).toBe('MIGRATION_NOT_AUTHORIZED');
            expect(summary.migratedCount).toBe(0);
        });

        it('valid apply encrypts plaintext using compare-and-swap', async () => {
            process.env.ALLOW_SECRET_MIGRATION = 'true';

            const mockClient = {
                query: jest.fn().mockImplementation((sql: string, params?: any[]) => {
                    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
                        return Promise.resolve({ rowCount: 1 });
                    }
                    if (sql.includes('UPDATE sales_pages')) {
                        return Promise.resolve({ rowCount: 1 });
                    }
                    return Promise.resolve({ rows: [], rowCount: 0 });
                }),
                release: jest.fn(),
            };

            const spyPoolConnect = jest.spyOn(pool, 'connect').mockImplementation(() => Promise.resolve(mockClient as any));
            const spyDbQuery = jest.spyOn(db, 'query').mockImplementation((sql: string, params?: any[]) => {
                if (sql.includes('LIMIT $1')) {
                    return Promise.resolve({
                        rows: [
                            { id: '11111111-1111-4111-a111-111111111111', workspace_id: workspaceA, stripe_secret_key: 'sk_test_legacy_1' },
                        ]
                    } as any);
                }
                return Promise.resolve({ rows: [] } as any);
            });

            const summary = await migrateSalesPageSecrets({ apply: true, batchSize: 10 });

            expect(summary.migratedCount).toBe(1);
            expect(summary.errorCode).toBeUndefined();
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

            spyPoolConnect.mockRestore();
            spyDbQuery.mockRestore();
        });

        it('skips already encrypted valid envelopes idempotently', async () => {
            process.env.ALLOW_SECRET_MIGRATION = 'true';

            const aad = getSalesPageStripeKeyAAD(workspaceA);
            const validCiphertext = encryptSecret(sampleStripeKey, aad);

            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({
                rows: [
                    { id: '11111111-1111-4111-a111-111111111111', workspace_id: workspaceA, stripe_secret_key: validCiphertext },
                ]
            } as any);

            const summary = await migrateSalesPageSecrets({ apply: true });

            expect(summary.alreadyEncryptedCount).toBe(1);
            expect(summary.legacyPlaintextCount).toBe(0);
            expect(summary.migratedCount).toBe(0);

            spyDbQuery.mockRestore();
        });

        it('detects concurrent update when compare-and-swap rowCount === 0 and aborts with CONCURRENT_UPDATE_DETECTED', async () => {
            process.env.ALLOW_SECRET_MIGRATION = 'true';

            const mockClient = {
                query: jest.fn().mockImplementation((sql: string) => {
                    if (sql === 'BEGIN' || sql === 'ROLLBACK') {
                        return Promise.resolve({ rowCount: 1 });
                    }
                    if (sql.includes('UPDATE sales_pages')) {
                        return Promise.resolve({ rowCount: 0 }); // Concurrent change caused 0 rows to match
                    }
                    return Promise.resolve({ rows: [], rowCount: 0 });
                }),
                release: jest.fn(),
            };

            const spyPoolConnect = jest.spyOn(pool, 'connect').mockImplementation(() => Promise.resolve(mockClient as any));
            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({
                rows: [
                    { id: '11111111-1111-4111-a111-111111111111', workspace_id: workspaceA, stripe_secret_key: 'sk_test_legacy_1' },
                ]
            } as any);

            const summary = await migrateSalesPageSecrets({ apply: true });

            expect(summary.errorCode).toBe('CONCURRENT_UPDATE_DETECTED');
            expect(summary.migratedCount).toBe(0); // Zero committed writes
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');

            spyPoolConnect.mockRestore();
            spyDbQuery.mockRestore();
        });

        it('stops all writes on malformed encrypted envelopes', async () => {
            process.env.ALLOW_SECRET_MIGRATION = 'true';

            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({
                rows: [
                    { id: '11111111-1111-4111-a111-111111111111', workspace_id: workspaceA, stripe_secret_key: 'enc:v1:corrupt:bad:parts' },
                ]
            } as any);

            const summary = await migrateSalesPageSecrets({ apply: true });

            expect(summary.errorCode).toBe('MALFORMED_ENVELOPE_DETECTED');
            expect(summary.malformedEncryptedCount).toBe(1);
            expect(summary.migratedCount).toBe(0);

            spyDbQuery.mockRestore();
        });

        it('never includes plaintext, ciphertext, or keys in summary object', async () => {
            const summary = await migrateSalesPageSecrets({ apply: false });
            const json = JSON.stringify(summary);

            expect(json).not.toContain('sk_');
            expect(json).not.toContain('enc:v1:');
            expect(json).not.toContain(TEST_KEY_1_BASE64);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. SALES PAGES WRITE-PATH & DELETION SAFETY (HTTP INTEGRATION)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Sales Pages API Integration (Write Encryption, Deletion Blocking & Response Sanitization)', () => {
        it('encrypts stripe_secret_key on createSalesPage and returns sanitized response', async () => {
            const { createSalesPage } = require('../controllers/salesPages.controller');

            let insertedRow: any;
            const spyDbQuery = jest.spyOn(db, 'query').mockImplementation((sql: string, params?: any[]) => {
                if (sql.includes('SELECT 1 FROM sales_pages')) {
                    return Promise.resolve({ rows: [] } as any);
                }
                if (sql.includes('INSERT INTO sales_pages')) {
                    insertedRow = {
                        id: 'sp-test-id-1',
                        workspace_id: workspaceA,
                        title: 'Test Offer',
                        stripe_secret_key: params?.[12], // encryptedStripeKey
                    };
                    return Promise.resolve({ rows: [insertedRow] } as any);
                }
                return Promise.resolve({ rows: [] } as any);
            });

            const req: any = {
                workspaceId: workspaceA,
                body: {
                    title: 'Test Offer',
                    headline: 'Test Headline',
                    price: 99.00,
                    stripe_secret_key: 'sk_test_incoming_secret_from_user',
                },
            };

            let responseStatus = 200;
            let responseBody: any;
            const res: any = {
                status: (code: number) => { responseStatus = code; return res; },
                json: (data: any) => { responseBody = data; return res; },
            };

            await createSalesPage(req, res);

            expect(responseStatus).toBe(201);
            expect(insertedRow.stripe_secret_key).toMatch(/^enc:v1:k1:/);
            expect(insertedRow.stripe_secret_key).not.toContain('sk_test_incoming_secret_from_user');
            expect(responseBody.stripe_secret_key).toBeUndefined();
            expect(responseBody.has_stripe_credentials).toBe(true);

            spyDbQuery.mockRestore();
        });

        it('rejects createSalesPage when client sends an enc: prefix envelope', async () => {
            const { createSalesPage } = require('../controllers/salesPages.controller');

            const req: any = {
                workspaceId: workspaceA,
                body: {
                    title: 'Malicious Page',
                    headline: 'Test Headline',
                    price: 99.00,
                    stripe_secret_key: 'enc:v1:k1:fake_attempted_envelope_injection',
                },
            };

            let responseStatus = 200;
            let responseBody: any;
            const res: any = {
                status: (code: number) => { responseStatus = code; return res; },
                json: (data: any) => { responseBody = data; return res; },
            };

            await createSalesPage(req, res);

            expect(responseStatus).toBe(400);
            expect(responseBody.message).toBe('Invalid Stripe credential format');
        });

        it('preserves existing stored ciphertext when updateSalesPage omits stripe_secret_key', async () => {
            const { updateSalesPage } = require('../controllers/salesPages.controller');

            let updateSql = '';
            let updateParams: any[] = [];
            const spyDbQuery = jest.spyOn(db, 'query').mockImplementation((sql: string, params?: any[]) => {
                if (sql.includes('UPDATE sales_pages')) {
                    updateSql = sql;
                    updateParams = params || [];
                    return Promise.resolve({
                        rows: [{
                            id: 'sp-test-id-1',
                            workspace_id: workspaceA,
                            title: 'Updated Title',
                            stripe_secret_key: 'enc:v1:k1:existing_stored_envelope',
                        }]
                    } as any);
                }
                return Promise.resolve({ rows: [] } as any);
            });

            const req: any = {
                params: { id: 'sp-test-id-1' },
                workspaceId: workspaceA,
                body: {
                    title: 'Updated Title',
                    // stripe_secret_key is omitted (undefined)
                },
            };

            let responseBody: any;
            const res: any = {
                status: () => res,
                json: (data: any) => { responseBody = data; return res; },
            };

            await updateSalesPage(req, res);

            expect(updateParams[9]).toBe(false); // shouldUpdateStripeKey = false
            expect(responseBody.stripe_secret_key).toBeUndefined();
            expect(responseBody.has_stripe_credentials).toBe(true);

            spyDbQuery.mockRestore();
        });

        it('rejects updateSalesPage when stripe_secret_key is null (blocks implicit deletion)', async () => {
            const { updateSalesPage } = require('../controllers/salesPages.controller');

            const req: any = {
                params: { id: 'sp-test-id-1' },
                workspaceId: workspaceA,
                body: {
                    title: 'Attempted Key Clear',
                    stripe_secret_key: null,
                },
            };

            let responseStatus = 200;
            let responseBody: any;
            const res: any = {
                status: (code: number) => { responseStatus = code; return res; },
                json: (data: any) => { responseBody = data; return res; },
            };

            await updateSalesPage(req, res);

            expect(responseStatus).toBe(400);
            expect(responseBody.message).toBe('Invalid Stripe credential format');
        });

        it('rejects updateSalesPage when stripe_secret_key is an empty string (blocks implicit deletion)', async () => {
            const { updateSalesPage } = require('../controllers/salesPages.controller');

            const req: any = {
                params: { id: 'sp-test-id-1' },
                workspaceId: workspaceA,
                body: {
                    title: 'Attempted Key Clear Empty',
                    stripe_secret_key: '',
                },
            };

            let responseStatus = 200;
            let responseBody: any;
            const res: any = {
                status: (code: number) => { responseStatus = code; return res; },
                json: (data: any) => { responseBody = data; return res; },
            };

            await updateSalesPage(req, res);

            expect(responseStatus).toBe(400);
            expect(responseBody.message).toBe('Invalid Stripe credential format');
        });

        it('rejects updateSalesPage when stripe_secret_key is whitespace-only', async () => {
            const { updateSalesPage } = require('../controllers/salesPages.controller');

            const req: any = {
                params: { id: 'sp-test-id-1' },
                workspaceId: workspaceA,
                body: {
                    title: 'Attempted Key Clear Whitespace',
                    stripe_secret_key: '    ',
                },
            };

            let responseStatus = 200;
            let responseBody: any;
            const res: any = {
                status: (code: number) => { responseStatus = code; return res; },
                json: (data: any) => { responseBody = data; return res; },
            };

            await updateSalesPage(req, res);

            expect(responseStatus).toBe(400);
            expect(responseBody.message).toBe('Invalid Stripe credential format');
        });

        it('encrypts valid replacement stripe_secret_key on updateSalesPage', async () => {
            const { updateSalesPage } = require('../controllers/salesPages.controller');

            let updateSql = '';
            let updateParams: any[] = [];
            const spyDbQuery = jest.spyOn(db, 'query').mockImplementation((sql: string, params?: any[]) => {
                if (sql.includes('UPDATE sales_pages')) {
                    updateSql = sql;
                    updateParams = params || [];
                    return Promise.resolve({
                        rows: [{
                            id: 'sp-test-id-1',
                            workspace_id: workspaceA,
                            title: 'Updated Offer',
                            stripe_secret_key: params?.[10], // encryptedStripeKey
                        }]
                    } as any);
                }
                return Promise.resolve({ rows: [] } as any);
            });

            const req: any = {
                params: { id: 'sp-test-id-1' },
                workspaceId: workspaceA,
                body: {
                    title: 'Updated Offer',
                    stripe_secret_key: 'sk_test_replacement_secret_valid',
                },
            };

            let responseBody: any;
            const res: any = {
                status: () => res,
                json: (data: any) => { responseBody = data; return res; },
            };

            await updateSalesPage(req, res);

            expect(updateParams[9]).toBe(true); // shouldUpdateStripeKey = true
            expect(updateParams[10]).toMatch(/^enc:v1:k1:/);
            expect(updateParams[10]).not.toContain('sk_test_replacement_secret_valid');
            expect(responseBody.stripe_secret_key).toBeUndefined();
            expect(responseBody.has_stripe_credentials).toBe(true);

            spyDbQuery.mockRestore();
        });

        it('sanitizes getSalesPage response to return has_stripe_credentials without exposing ciphertext', async () => {
            const { getSalesPage } = require('../controllers/salesPages.controller');

            const spyDbQuery = jest.spyOn(db, 'query').mockResolvedValueOnce({
                rows: [{
                    id: 'sp-test-id-1',
                    workspace_id: workspaceA,
                    title: 'Existing Page',
                    stripe_secret_key: 'enc:v1:k1:sensitive_encrypted_blob',
                }]
            } as any);

            const req: any = {
                params: { id: 'sp-test-id-1' },
                workspaceId: workspaceA,
            };

            let responseBody: any;
            const res: any = {
                status: () => res,
                json: (data: any) => { responseBody = data; return res; },
            };

            await getSalesPage(req, res);

            expect(responseBody.stripe_secret_key).toBeUndefined();
            expect(responseBody.has_stripe_credentials).toBe(true);

            spyDbQuery.mockRestore();
        });
    });
});
