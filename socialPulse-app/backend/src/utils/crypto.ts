import crypto from 'crypto';

export interface KeyRegistry {
    [keyId: string]: Buffer;
}

const KEY_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Validates canonical base64 encoding strictly.
 * Ensures the string contains only valid base64 characters,
 * decodes to a buffer, and re-encoding matches the normalized input exactly.
 */
export function validateCanonicalBase64(b64Str: string, expectedLength?: number): Buffer {
    if (typeof b64Str !== 'string') {
        throw new Error('CANONICAL_BASE64_INVALID');
    }
    const trimmed = b64Str.trim();
    if (trimmed.length === 0) {
        throw new Error('CANONICAL_BASE64_INVALID');
    }

    // Must match strict standard base64 pattern (with padding)
    const b64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    if (!b64Regex.test(trimmed)) {
        throw new Error('CANONICAL_BASE64_INVALID');
    }

    // Base64 string length must be a multiple of 4
    if (trimmed.length % 4 !== 0) {
        throw new Error('CANONICAL_BASE64_INVALID');
    }

    const buf = Buffer.from(trimmed, 'base64');
    if (expectedLength !== undefined && buf.length !== expectedLength) {
        throw new Error('CANONICAL_BASE64_INVALID');
    }

    if (buf.length === 0) {
        throw new Error('CANONICAL_BASE64_INVALID');
    }

    // Canonical check: re-encoding must match trimmed string exactly
    if (buf.toString('base64') !== trimmed) {
        throw new Error('CANONICAL_BASE64_INVALID');
    }

    return buf;
}

/**
 * Validates and loads the encryption key registry from environment variables.
 * Fails closed with generic error codes without logging sensitive material.
 */
export function getKeyRegistry(): { activeKeyId: string; keys: KeyRegistry } {
    const activeKeyId = process.env.ACTIVE_ENCRYPTION_KEY_ID?.trim();
    const rawKeysJson = process.env.ENCRYPTION_KEYS_JSON?.trim();

    if (!activeKeyId || !rawKeysJson) {
        throw new Error('ENCRYPTION_CONFIG_INVALID');
    }

    if (!KEY_ID_REGEX.test(activeKeyId)) {
        throw new Error('ENCRYPTION_CONFIG_INVALID');
    }

    let parsed: Record<string, string>;
    try {
        parsed = JSON.parse(rawKeysJson);
    } catch {
        throw new Error('ENCRYPTION_CONFIG_INVALID');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('ENCRYPTION_CONFIG_INVALID');
    }

    const keys: KeyRegistry = {};
    for (const [keyId, b64Key] of Object.entries(parsed)) {
        if (!keyId || typeof keyId !== 'string' || !KEY_ID_REGEX.test(keyId)) {
            throw new Error('ENCRYPTION_CONFIG_INVALID');
        }

        try {
            const keyBuf = validateCanonicalBase64(b64Key, 32);
            keys[keyId] = keyBuf;
        } catch {
            throw new Error('ENCRYPTION_CONFIG_INVALID');
        }
    }

    if (!keys[activeKeyId]) {
        throw new Error('ENCRYPTION_CONFIG_INVALID');
    }

    return { activeKeyId, keys };
}

/**
 * Generates the canonical Authenticated Additional Data (AAD) for sales_pages.stripe_secret_key.
 * Enforces UUID validation and lowercases workspace_id.
 * Canonical pattern: socialpulse:v1:sales_pages:<lowercase_workspace_id>:stripe_secret_key
 */
export function getSalesPageStripeKeyAAD(workspaceId: string): string {
    if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('ENCRYPTION_FAILED');
    }
    const trimmed = workspaceId.trim();
    if (!UUID_REGEX.test(trimmed)) {
        throw new Error('ENCRYPTION_FAILED');
    }
    const normalizedWsId = trimmed.toLowerCase();
    return `socialpulse:v1:sales_pages:${normalizedWsId}:stripe_secret_key`;
}

/**
 * Generates canonical AAD for any integration credential bound to a workspace.
 */
export function getIntegrationKeyAAD(namespace: string, workspaceId: string, keyName: string): string {
    if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error('ENCRYPTION_FAILED');
    }
    const trimmed = workspaceId.trim();
    if (!UUID_REGEX.test(trimmed)) {
        throw new Error('ENCRYPTION_FAILED');
    }
    const normalizedWsId = trimmed.toLowerCase();
    return `socialpulse:v1:${namespace}:${normalizedWsId}:${keyName}`;
}

/**
 * Checks if a string is formatted as a versioned ciphertext envelope.
 */
export function isEncryptedEnvelope(value: string | null | undefined): boolean {
    if (!value || typeof value !== 'string') return false;
    return value.startsWith('enc:v1:');
}

/**
 * Encrypts a plaintext UTF-8 string using AES-256-GCM with a random 12-byte nonce,
 * 16-byte authentication tag, canonical AAD, and active key ID.
 *
 * Envelope Format:
 * enc:v1:<key_id>:<base64_nonce>:<base64_auth_tag>:<base64_ciphertext>
 */
export function encryptSecret(plaintext: string, aad: string): string {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
        throw new Error('ENCRYPTION_FAILED');
    }
    if (typeof aad !== 'string' || aad.length === 0) {
        throw new Error('ENCRYPTION_FAILED');
    }

    // Do not double-encrypt an existing envelope
    if (isEncryptedEnvelope(plaintext)) {
        throw new Error('ENCRYPTION_FAILED');
    }

    const { activeKeyId, keys } = getKeyRegistry();
    const keyBuf = keys[activeKeyId];
    if (!keyBuf) {
        throw new Error('ENCRYPTION_CONFIG_INVALID');
    }

    // 12-byte cryptographically secure random nonce (never reused)
    const nonce = crypto.randomBytes(12);

    try {
        const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, nonce);
        cipher.setAAD(Buffer.from(aad, 'utf8'));

        const ciphertext = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();
        if (authTag.length !== 16) {
            throw new Error('ENCRYPTION_FAILED');
        }

        const b64Nonce = nonce.toString('base64');
        const b64AuthTag = authTag.toString('base64');
        const b64Ciphertext = ciphertext.toString('base64');

        return `enc:v1:${activeKeyId}:${b64Nonce}:${b64AuthTag}:${b64Ciphertext}`;
    } catch (err: any) {
        if (err.message === 'ENCRYPTION_CONFIG_INVALID') throw err;
        throw new Error('ENCRYPTION_FAILED');
    }
}

/**
 * Decrypts a versioned ciphertext envelope using AES-256-GCM, verifying authentication tag and AAD.
 * Fails closed with generic error codes without leaking key or plaintext material.
 */
export function decryptSecretEnvelope(envelope: string, aad: string): string {
    if (typeof envelope !== 'string' || !envelope.startsWith('enc:v1:')) {
        throw new Error('DECRYPTION_FAILED');
    }
    if (typeof aad !== 'string' || aad.length === 0) {
        throw new Error('DECRYPTION_FAILED');
    }

    const parts = envelope.split(':');
    // Format: enc:v1:<key_id>:<base64_nonce>:<base64_auth_tag>:<base64_ciphertext> -> 6 parts
    if (parts.length !== 6 || parts[0] !== 'enc' || parts[1] !== 'v1') {
        throw new Error('DECRYPTION_FAILED');
    }

    const keyId = parts[2];
    const b64Nonce = parts[3];
    const b64AuthTag = parts[4];
    const b64Ciphertext = parts[5];

    if (!keyId || !KEY_ID_REGEX.test(keyId) || !b64Nonce || !b64AuthTag || !b64Ciphertext) {
        throw new Error('DECRYPTION_FAILED');
    }

    const { keys } = getKeyRegistry();
    const keyBuf = keys[keyId];
    if (!keyBuf) {
        throw new Error('UNKNOWN_KEY_ID');
    }

    let nonce: Buffer;
    let authTag: Buffer;
    let ciphertext: Buffer;

    try {
        nonce = validateCanonicalBase64(b64Nonce, 12);
        authTag = validateCanonicalBase64(b64AuthTag, 16);
        ciphertext = validateCanonicalBase64(b64Ciphertext);
    } catch {
        throw new Error('DECRYPTION_FAILED');
    }

    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, nonce);
        decipher.setAuthTag(authTag);
        decipher.setAAD(Buffer.from(aad, 'utf8'));

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch {
        throw new Error('DECRYPTION_FAILED');
    }
}

/**
 * Dual-read helper:
 * If value starts with 'enc:v1:', decrypts and verifies tag with AAD.
 * If value is legacy plaintext, returns plaintext directly (for internal transitional use).
 * If value looks like an invalid/malformed 'enc:' string, fails closed and throws DECRYPTION_FAILED.
 */
export function decryptSecretWithDualRead(storedValue: string, aad: string): string {
    if (!storedValue || typeof storedValue !== 'string') {
        throw new Error('DECRYPTION_FAILED');
    }

    if (storedValue.startsWith('enc:')) {
        // Must be a valid enc:v1: envelope, never fall back to plaintext for corrupted enc: prefixes
        return decryptSecretEnvelope(storedValue, aad);
    }

    // Transitional legacy plaintext reading
    return storedValue;
}

/**
 * Re-encrypts an existing envelope using the current active encryption key and a fresh nonce.
 * Idempotent: skips re-encryption if the envelope already uses activeKeyId unless force=true.
 */
export function reencryptSecret(
    envelope: string,
    aad: string,
    force = false
): { changed: boolean; envelope: string } {
    if (!isEncryptedEnvelope(envelope)) {
        throw new Error('ENCRYPTION_FAILED');
    }

    const parts = envelope.split(':');
    const envelopeKeyId = parts[2];

    const { activeKeyId } = getKeyRegistry();

    if (envelopeKeyId === activeKeyId && !force) {
        return { changed: false, envelope };
    }

    // Decrypt with historical key
    const plaintext = decryptSecretEnvelope(envelope, aad);

    // Encrypt with active key (generates fresh nonce)
    const newEnvelope = encryptSecret(plaintext, aad);

    return { changed: true, envelope: newEnvelope };
}
