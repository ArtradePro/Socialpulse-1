import { pool } from '../config/database';
import { WoocommerceService } from './ecommerce/woocommerce.service';
import { ShopifyService } from './ecommerce/shopify.service';
import { AmazonService } from './ecommerce/amazon.service';
import { TakealotService } from './ecommerce/takealot.service';
import { EcommerceBaseService } from './ecommerce/base.service';

export class EcommerceService {
    /**
     * Get the appropriate service instance for a store
     */
    static async getService(storeId: string): Promise<EcommerceBaseService> {
        const { rows } = await pool.query(
            'SELECT * FROM ecommerce_stores WHERE id = $1',
            [storeId]
        );

        if (rows.length === 0) throw new Error('Store not found');
        const store = rows[0];

        switch (store.platform) {
            case 'woocommerce':
                return new WoocommerceService(store.workspace_id, {
                    apiUrl: store.api_url,
                    apiKey: store.api_key,
                    apiSecret: store.api_secret,
                    sellerId: store.seller_id,
                });
            case 'shopify':
                return new ShopifyService(store.workspace_id, {
                    apiUrl: store.api_url,
                    apiKey: store.api_key,
                    apiSecret: store.api_secret,
                    sellerId: store.seller_id,
                });
            case 'amazon':
                return new AmazonService(store.workspace_id, {
                    apiUrl: store.api_url,
                    apiKey: store.api_key,
                    apiSecret: store.api_secret,
                    sellerId: store.seller_id,
                });
            case 'takealot':
                return new TakealotService(store.workspace_id, {
                    apiUrl: store.api_url,
                    apiKey: store.api_key,
                    apiSecret: store.api_secret,
                    sellerId: store.seller_id,
                });
            default:
                throw new Error(`Unsupported e-commerce platform: ${store.platform}`);
        }
    }

    /**
     * Sync products for a store
     */
    static async syncProducts(storeId: string) {
        const service = await this.getService(storeId);
        const products = await service.fetchProducts();

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (const p of products) {
                await client.query(`
                    INSERT INTO products (
                        store_id, workspace_id, external_id, title, description, 
                        price, currency, image_url, product_url, category, tags, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (store_id, external_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        price = EXCLUDED.price,
                        currency = EXCLUDED.currency,
                        image_url = EXCLUDED.image_url,
                        product_url = EXCLUDED.product_url,
                        category = EXCLUDED.category,
                        tags = EXCLUDED.tags,
                        status = EXCLUDED.status,
                        updated_at = NOW()
                `, [
                    storeId, service['workspaceId'], p.externalId, p.title, p.description,
                    p.price, p.currency, p.imageUrl, p.productUrl, p.category, p.tags, p.status
                ]);
            }

            await client.query(
                'UPDATE ecommerce_stores SET last_sync_at = NOW(), status = $1 WHERE id = $2',
                ['active', storeId]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            await pool.query(
                'UPDATE ecommerce_stores SET status = $1 WHERE id = $2',
                ['error', storeId]
            );
            throw err;
        } finally {
            client.release();
        }
    }
}
