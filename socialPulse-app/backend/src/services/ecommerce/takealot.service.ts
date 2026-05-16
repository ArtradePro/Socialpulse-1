import axios from 'axios';
import { EcommerceBaseService, EcommerceProduct } from './base.service';

export class TakealotService extends EcommerceBaseService {
    platform = 'takealot';

    private get client() {
        if (!this.config.apiSecret) {
            throw new Error('Takealot API Key (apiSecret) is required');
        }

        return axios.create({
            baseURL: 'https://seller-api.takealot.com/v2',
            headers: {
                'Authorization': `Key ${this.config.apiSecret}`,
                'Content-Type': 'application/json',
            },
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.get('/seller/statistics');
            return true;
        } catch (err) {
            console.error('[Takealot] Connection test failed:', err);
            return false;
        }
    }

    async fetchProducts(): Promise<EcommerceProduct[]> {
        try {
            // Takealot uses "offers" for products listed by the seller
            const response = await this.client.get('/offers', {
                params: { page_size: 100 }
            });

            return response.data.offers.map((o: any) => this.mapProduct(o));
        } catch (err) {
            console.error('[Takealot] Fetch products failed:', err);
            throw err;
        }
    }

    async getProduct(externalId: string): Promise<EcommerceProduct | null> {
        try {
            const response = await this.client.get(`/offers/${externalId}`);
            return this.mapProduct(response.data);
        } catch (err: any) {
            if (err.response?.status === 404) return null;
            throw err;
        }
    }

    private mapProduct(o: any): EcommerceProduct {
        const tsin = o.tsin || '';
        return {
            externalId: o.offer_id.toString(),
            title: o.product_title,
            description: o.comments || '', 
            price: parseFloat(o.selling_price || '0'),
            currency: 'ZAR',
            // Takealot image pattern: covers_tsin/{tsin}/pdpxl.jpg
            imageUrl: tsin ? `https://media.takealot.com/covers_tsin/${tsin}/pdpxl.jpg` : '',
            productUrl: `https://www.takealot.com/${o.product_title.toLowerCase().replace(/ /g, '-')}/PLID${o.plid}`,
            category: '',
            tags: [],
            status: o.status === 'Active' ? 'active' : 'draft',
        };
    }
}
