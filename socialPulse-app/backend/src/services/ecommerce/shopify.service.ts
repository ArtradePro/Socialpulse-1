import axios from 'axios';
import { EcommerceBaseService, EcommerceProduct } from './base.service';

export class ShopifyService extends EcommerceBaseService {
    platform = 'shopify';

    private get client() {
        if (!this.config.apiUrl || !this.config.apiSecret) {
            // In Shopify context, apiSecret usually stores the Access Token for private/custom apps
            throw new Error('Shopify configuration is incomplete');
        }

        // Shopify URL usually looks like https://{shop}.myshopify.com
        const baseUrl = this.config.apiUrl.replace(/\/$/, '');
        
        return axios.create({
            baseURL: `${baseUrl}/admin/api/2024-01`,
            headers: {
                'X-Shopify-Access-Token': this.config.apiSecret,
                'Content-Type': 'application/json',
            },
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.get('/shop.json');
            return true;
        } catch (err) {
            console.error('[Shopify] Connection test failed:', err);
            return false;
        }
    }

    async fetchProducts(): Promise<EcommerceProduct[]> {
        try {
            const response = await this.client.get('/products.json', {
                params: { limit: 250 }
            });

            return response.data.products.map((p: any) => this.mapProduct(p));
        } catch (err) {
            console.error('[Shopify] Fetch products failed:', err);
            throw err;
        }
    }

    async getProduct(externalId: string): Promise<EcommerceProduct | null> {
        try {
            const response = await this.client.get(`/products/${externalId}.json`);
            return this.mapProduct(response.data.product);
        } catch (err: any) {
            if (err.response?.status === 404) return null;
            throw err;
        }
    }

    private mapProduct(p: any): EcommerceProduct {
        // Shopify products have multiple variants; we'll use the first one for price
        const variant = p.variants?.[0];
        
        return {
            externalId: p.id.toString(),
            title: p.title,
            description: p.body_html?.replace(/<[^>]*>?/gm, '') || '', // Strip HTML
            price: parseFloat(variant?.price || '0'),
            currency: 'ZAR', // We can fetch this from shop.json if needed, defaulting for now
            imageUrl: p.image?.src || p.images?.[0]?.src || '',
            productUrl: `${(this.config.apiUrl || '').replace(/\/$/, '')}/products/${p.handle}`,
            category: p.product_type,
            tags: p.tags?.split(',').map((t: string) => t.trim()),
            status: p.status === 'active' ? 'active' : 'draft',
        };
    }
}
