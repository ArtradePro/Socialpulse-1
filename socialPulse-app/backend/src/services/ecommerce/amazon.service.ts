import axios from 'axios';
import { EcommerceBaseService, EcommerceProduct } from './base.service';

export class AmazonService extends EcommerceBaseService {
    platform = 'amazon';

    private async getAccessToken() {
        const { apiKey: clientId, apiSecret: clientSecret, apiUrl: refreshToken } = this.config;
        
        const response = await axios.post('https://api.amazon.com/auth/o2/token', {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        });

        return response.data.access_token;
    }

    private getRegion(marketplaceId: string) {
        // Mapping of Marketplace ID to SP-API Region
        const regions: Record<string, string> = {
            'A1F83G8C2ARO7P': 'eu-west-1', // South Africa
            'A1PA6795UKMFR9': 'eu-west-1', // Germany
            'A1RKKUPIHCS9HS': 'eu-west-1', // Spain
            'A13V1IB3VIYZZH': 'eu-west-1', // France
            'A1F83G8C2ARO7P_UK': 'eu-west-1', // UK (Example)
            'ATVPDKIKX0DER':  'us-east-1', // US
        };
        return regions[marketplaceId] || 'eu-west-1';
    }

    private getEndpoint(region: string) {
        const endpoints: Record<string, string> = {
            'eu-west-1': 'https://sellingpartnerapi-eu.amazon.com',
            'us-east-1': 'https://sellingpartnerapi-na.amazon.com',
            'us-west-2': 'https://sellingpartnerapi-na.amazon.com',
            'us-east-4': 'https://sellingpartnerapi-na.amazon.com',
            'fe-east-1': 'https://sellingpartnerapi-fe.amazon.com',
        };
        return endpoints[region] || 'https://sellingpartnerapi-eu.amazon.com';
    }

    private async getClient() {
        const token = await this.getAccessToken();
        const marketplaceId = this.config.apiUrl || 'A1F83G8C2ARO7P';
        const region = this.getRegion(marketplaceId);
        const baseURL = this.getEndpoint(region);

        return axios.create({
            baseURL,
            headers: {
                'x-amz-access-token': token,
                'Content-Type': 'application/json',
            },
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            const client = await this.getClient();
            await client.get('/sellers/v1/marketplaceParticipations');
            return true;
        } catch (err) {
            console.error('[Amazon] Connection test failed:', err);
            return false;
        }
    }

    async fetchProducts(): Promise<EcommerceProduct[]> {
        try {
            const client = await this.getClient();
            const marketplaceId = this.config.apiUrl || 'A1F83G8C2ARO7P';
            
            // 1. Fetch listings
            const response = await client.get(`/listings/2021-08-01/items/${this.config.sellerId}`, {
                params: {
                    marketplaceIds: marketplaceId,
                    includedData: 'summaries,attributes'
                }
            });

            // 2. Fetch prices (separate call for performance or batching if needed)
            // For now, we'll try to get pricing for each item
            const items = response.data.items || [response.data]; // Handle both list and single item response
            const productsWithPrice = await Promise.all(items.map(async (item: any) => {
                const sku = item.sku || item.summaries?.[0]?.asin;
                let price = 0;
                try {
                    const priceRes = await client.get('/products/pricing/v0/price', {
                        params: {
                            MarketplaceId: marketplaceId,
                            ItemType: 'Asin',
                            Asins: item.summaries?.[0]?.asin
                        }
                    });
                    const offer = priceRes.data.payload?.[0]?.Product?.Offers?.[0];
                    price = offer?.BuyingPrice?.ListingPrice?.Amount || 0;
                } catch (pErr) {
                    console.warn(`[Amazon] Could not fetch price for ${sku}`, pErr);
                }
                return this.mapProduct(item, price);
            }));

            return productsWithPrice;
        } catch (err) {
            console.error('[Amazon] Fetch products failed:', err);
            throw err;
        }
    }

    async getProduct(externalId: string): Promise<EcommerceProduct | null> {
        try {
            const client = await this.getClient();
            const marketplaceId = this.config.apiUrl || 'A1F83G8C2ARO7P';
            const response = await client.get(`/listings/2021-08-01/items/${this.config.sellerId}/${externalId}`, {
                params: {
                    marketplaceIds: marketplaceId
                }
            });
            
            let price = 0;
            try {
                const priceRes = await client.get('/products/pricing/v0/price', {
                    params: {
                        MarketplaceId: marketplaceId,
                        ItemType: 'Asin',
                        Asins: response.data.summaries?.[0]?.asin
                    }
                });
                price = priceRes.data.payload?.[0]?.Product?.Offers?.[0]?.BuyingPrice?.ListingPrice?.Amount || 0;
            } catch {}

            return this.mapProduct(response.data, price);
        } catch (err: any) {
            if (err.response?.status === 404) return null;
            throw err;
        }
    }

    private mapProduct(p: any, price: number = 0): EcommerceProduct {
        const summary = p.summaries?.[0] || {};
        return {
            externalId: p.sku || summary.asin,
            title: summary.itemName || 'Amazon Product',
            description: '',
            price: price,
            currency: 'ZAR',
            imageUrl: summary.mainImage?.link || '',
            productUrl: `https://www.amazon.co.za/dp/${summary.asin}`,
            category: summary.productType,
            tags: [],
            status: 'active',
        };
    }
}
