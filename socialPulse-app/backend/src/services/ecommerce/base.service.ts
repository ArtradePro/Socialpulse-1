export interface EcommerceProduct {
    externalId: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    imageUrl: string;
    productUrl: string;
    category?: string;
    tags?: string[];
    status: 'active' | 'draft' | 'out_of_stock';
}

export abstract class EcommerceBaseService {
    abstract platform: string;

    constructor(
        protected workspaceId: string,
        protected config: {
            apiUrl?: string;
            apiKey?: string;
            apiSecret?: string;
            sellerId?: string;
        }
    ) {}

    /**
     * Test the connection to the e-commerce platform
     */
    abstract testConnection(): Promise<boolean>;

    /**
     * Fetch all products from the e-commerce platform
     */
    abstract fetchProducts(): Promise<EcommerceProduct[]>;

    /**
     * Get a single product by its external ID
     */
    abstract getProduct(externalId: string): Promise<EcommerceProduct | null>;
}
