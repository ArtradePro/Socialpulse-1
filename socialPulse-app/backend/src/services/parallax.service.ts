import axios, { AxiosInstance } from 'axios';

export type ParallaxKind = 'image' | 'video' | 'audio' | 'music';

export interface ParallaxModel {
    id: string;
    kind: ParallaxKind;
    name: string;
    vendor: string;
    tagline: string;
    status: string;
    output: string;
    eta: number;
}

export interface ParallaxGeneration {
    id: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
    kind: string;
    output: string;
    modelId: string;
    modelName: string;
    prompt: string;
    cost: number;
    error: { code: string; message: string } | null;
    eta: number;
    files: Array<{
        id: string;
        kind: string;
        mime: string;
        bytes: number;
        width: number | null;
        height: number | null;
        duration: number | null;
        url: string;
    }>;
}

/**
 * HTTP client for a private Parallax instance (/api/v1/*).
 * Keeps the Parallax API key strictly on the SocialPulse backend.
 */
export class ParallaxService {
    private static get baseUrl(): string {
        return (process.env.PARALLAX_URL || 'http://localhost:3000').replace(/\/+$/, '');
    }

    private static get apiKey(): string {
        return process.env.PARALLAX_API_KEY || '';
    }

    static isConfigured(): boolean {
        return Boolean(this.apiKey.trim());
    }

    private static client(): AxiosInstance {
        if (!this.isConfigured()) {
            throw new Error('PARALLAX_API_KEY is not configured on the server.');
        }
        return axios.create({
            baseURL: `${this.baseUrl}/api/v1`,
            timeout: 30000,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    /** Convert Parallax millicredits (1000 = 1 credit) to SocialPulse AI credits (minimum 1). */
    static toSocialPulseCredits(millicredits: number): number {
        return Math.max(1, Math.ceil((millicredits || 0) / 100));
    }

    static async listModels(kind?: ParallaxKind): Promise<ParallaxModel[]> {
        const params: Record<string, string> = { available: '1' };
        if (kind) params.kind = kind;
        const { data } = await this.client().get('/models', { params });
        return data.models || [];
    }

    static async getModel(modelId: string): Promise<any> {
        const { data } = await this.client().get(`/models/${encodeURIComponent(modelId)}`);
        return data;
    }

    static async quote(input: {
        modelId: string;
        prompt?: string;
        values?: Record<string, unknown>;
        count?: number;
    }): Promise<any> {
        const { data } = await this.client().post('/quote', input);
        return data;
    }

    static async generate(input: {
        modelId: string;
        prompt?: string;
        values?: Record<string, unknown>;
        count?: number;
        idempotencyKey?: string;
    }): Promise<{ generations: ParallaxGeneration[]; balance: number }> {
        const headers: Record<string, string> = {};
        if (input.idempotencyKey) {
            headers['Idempotency-Key'] = input.idempotencyKey;
        }
        const { data } = await this.client().post(
            '/generations',
            {
                modelId: input.modelId,
                prompt: input.prompt,
                values: input.values ?? {},
                count: input.count ?? 1,
            },
            { headers },
        );
        return data;
    }

    static async getGeneration(id: string): Promise<ParallaxGeneration> {
        const { data } = await this.client().get(`/generations/${encodeURIComponent(id)}`);
        return data.generation;
    }

    static async downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
        const { data, headers } = await this.client().get(
            `/files/${encodeURIComponent(fileId)}/content`,
            { responseType: 'arraybuffer', timeout: 120000 },
        );
        return {
            buffer: Buffer.from(data),
            mimeType: (headers['content-type'] as string) || 'application/octet-stream',
        };
    }
}
