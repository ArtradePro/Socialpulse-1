import axios from 'axios';
import { EcommerceBaseService, EcommerceProduct } from './base.service';

export class WoocommerceService extends EcommerceBaseService {
    platform = 'woocommerce';

    private get client() {
        if (!this.config.apiUrl || !this.config.apiKey || !this.config.apiSecret) {
            throw new Error('WooCommerce configuration is incomplete');
        }

        const auth = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');
        
        return axios.create({
            baseURL: `${this.config.apiUrl.replace(/\/$/, '')}/wp-json/wc/v3`,
            headers: {
                Authorization: `Basic ${auth}`,
            },
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.get('/products', { params: { per_page: 1 } });
            return true;
        } catch (err) {
            console.error('[WooCommerce] Connection test failed:', err);
            return false;
        }
    }

    async fetchProducts(): Promise<EcommerceProduct[]> {
        try {
            const response = await this.client.get('/products', {
                params: {
                    per_page: 100, // Max per page
                    status: 'publish',
                }
            });

            return response.data.map((p: any) => this.mapProduct(p));
        } catch (err) {
            console.error('[WooCommerce] Fetch products failed:', err);
            throw err;
        }
    }

    async getProduct(externalId: string): Promise<EcommerceProduct | null> {
        try {
            const response = await this.client.get(`/products/${externalId}`);
            return this.mapProduct(response.data);
        } catch (err: any) {
            if (err.response?.status === 404) return null;
            throw err;
        }
    }

    private mapProduct(p: any): EcommerceProduct {
        return {
            externalId: p.id.toString(),
            title: p.name,
            description: p.description?.replace(/<[^>]*>?/gm, '') || '', // Strip HTML
            price: parseFloat(p.price || '0'),
            currency: 'ZAR', // WooCommerce usually provides this in settings, but we can default or fetch from store info
            imageUrl: p.images?.[0]?.src || '',
            productUrl: p.permalink,
            category: p.categories?.[0]?.name,
            tags: p.tags?.map((t: any) => t.name),
            status: p.stock_status === 'instock' ? 'active' : 'out_of_stock',
        };
    }
}
