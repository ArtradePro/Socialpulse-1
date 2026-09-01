import dotenv from 'dotenv';
dotenv.config();

export interface FeatureStatus {
    enabled: boolean;
    status: 'ready' | 'disabled' | 'misconfigured' | 'unavailable';
    reason?: string;
}

export interface EnvironmentDiagnostic {
    nodeEnv: string;
    startupReady: boolean;
    features: {
        database: FeatureStatus;
        redis: FeatureStatus;
        encryption: FeatureStatus;
        evergreen: FeatureStatus;
        quote2contract: FeatureStatus;
        stripe: FeatureStatus;
        omnisend: FeatureStatus;
        sendgrid: FeatureStatus;
        twilio: FeatureStatus;
        gemini: FeatureStatus;
    };
}

export class EnvironmentConfig {
    public static isProduction(): boolean {
        return process.env.NODE_ENV === 'production';
    }

    public static isTest(): boolean {
        return process.env.NODE_ENV === 'test';
    }

    /**
     * Validates startup-critical variables. Throws descriptive, redacted error if missing.
     */
    public static validateStartup(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL && !(process.env.DB_HOST && process.env.DB_USER)) {
            errors.push('DATABASE_URL is required for database connectivity.');
        }

        if (!process.env.JWT_SECRET && this.isProduction()) {
            errors.push('JWT_SECRET must be configured in production.');
        }

        if (this.isProduction() && process.env.ALLOW_SIMULATED_DELIVERY === 'true') {
            console.warn('[SECURITY WARNING] ALLOW_SIMULATED_DELIVERY=true is ignored in production mode.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Returns allowed CORS origins based on environment.
     * In production, localhost origins are excluded unless explicitly permitted.
     */
    public static getAllowedOrigins(): string[] {
        const prodOrigins = [
            'https://usesocialpulse.com',
            'https://www.usesocialpulse.com',
            'https://silver-opossum-812035.hostingersite.com',
            process.env.FRONTEND_URL,
            process.env.CLIENT_URL,
            process.env.CLIENT_URL_ALT
        ].filter(Boolean) as string[];

        const devOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5000',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5000',
            'http://127.0.0.1:5173'
        ];

        if (this.isProduction() && process.env.ALLOW_LOCALHOST_IN_PRODUCTION !== 'true') {
            return prodOrigins;
        }

        return Array.from(new Set([...prodOrigins, ...devOrigins]));
    }

    /**
     * Inspects features and returns safe, redacted diagnostic readiness states.
     */
    public static getDiagnostics(): EnvironmentDiagnostic {
        const hasDb = Boolean(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || process.env.DB_HOST);
        const hasRedis = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
        const hasEncryption = Boolean(process.env.ACTIVE_ENCRYPTION_KEY_ID && process.env.ENCRYPTION_KEYS_JSON);
        const hasEvergreen = Boolean(process.env.EVERGREEN_INTEGRATION_SECRET);
        const hasQ2C = Boolean(process.env.Q2C_WEBHOOK_SECRET || process.env.EVERGREEN_INTEGRATION_SECRET);
        const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
        const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);
        const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
        const hasGemini = Boolean(process.env.GEMINI_API_KEY);

        return {
            nodeEnv: process.env.NODE_ENV || 'development',
            startupReady: hasDb,
            features: {
                database: {
                    enabled: true,
                    status: hasDb ? 'ready' : 'unavailable',
                    reason: hasDb ? undefined : 'DATABASE_URL missing'
                },
                redis: {
                    enabled: hasRedis,
                    status: hasRedis ? 'ready' : 'disabled',
                    reason: hasRedis ? undefined : 'REDIS_URL or REDIS_HOST not configured'
                },
                encryption: {
                    enabled: hasEncryption,
                    status: hasEncryption ? 'ready' : 'misconfigured',
                    reason: hasEncryption ? undefined : 'ACTIVE_ENCRYPTION_KEY_ID or ENCRYPTION_KEYS_JSON missing'
                },
                evergreen: {
                    enabled: hasEvergreen,
                    status: hasEvergreen ? 'ready' : 'disabled',
                    reason: hasEvergreen ? undefined : 'EVERGREEN_INTEGRATION_SECRET not configured'
                },
                quote2contract: {
                    enabled: hasQ2C,
                    status: hasQ2C ? 'ready' : 'disabled',
                    reason: hasQ2C ? undefined : 'Q2C_WEBHOOK_SECRET not configured'
                },
                stripe: {
                    enabled: hasStripe,
                    status: hasStripe ? 'ready' : 'disabled',
                    reason: hasStripe ? undefined : 'STRIPE_SECRET_KEY not configured'
                },
                omnisend: {
                    enabled: true,
                    status: 'ready',
                    reason: 'Per-workspace API keys used'
                },
                sendgrid: {
                    enabled: hasSendGrid,
                    status: hasSendGrid ? 'ready' : (this.isProduction() ? 'disabled' : 'ready'),
                    reason: hasSendGrid ? undefined : (this.isProduction() ? 'SENDGRID_API_KEY missing' : 'Simulated non-production')
                },
                twilio: {
                    enabled: hasTwilio,
                    status: hasTwilio ? 'ready' : (this.isProduction() ? 'disabled' : 'ready'),
                    reason: hasTwilio ? undefined : (this.isProduction() ? 'TWILIO credentials missing' : 'Simulated non-production')
                },
                gemini: {
                    enabled: hasGemini,
                    status: hasGemini ? 'ready' : 'ready',
                    reason: hasGemini ? undefined : 'Template fallback engine active'
                }
            }
        };
    }
}
