import api from './api';

export interface SalesPage {
    id: string;
    workspace_id: string;
    title: string;
    slug: string;
    product_id: string | null;
    product_title?: string;
    theme: 'modern' | 'dark-neon' | 'glassmorphism';
    headline: string;
    description: string | null;
    features: string[]; // will be parsed/serialized automatically or handled in UI
    price: number;
    currency: string;
    image_url: string | null;
    cta_text: string;
    visits: number;
    sales_count: number;
    revenue: number;
    stripe_secret_key?: string;
    paypal_client_id?: string;
    use_live_payments?: boolean;
    meta_pixel_id?: string;
    gtm_id?: string;
    is_ab_test?: boolean;
    variant_theme?: 'modern' | 'dark-neon' | 'glassmorphism';
    variant_headline?: string;
    variant_description?: string;
    variant_price?: number | null;
    variant_visits?: number;
    variant_sales_count?: number;
    variant_revenue?: number;
    active_theme?: 'modern' | 'dark-neon' | 'glassmorphism';
    active_headline?: string;
    active_description?: string | null;
    active_price?: number;
    assigned_variant?: 'A' | 'B';
    created_at: string;
    updated_at: string;
}

export interface SalesOrder {
    id: string;
    sales_page_id: string;
    sales_page_title?: string;
    customer_name: string;
    customer_email: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
}

export const storefrontService = {
    getPages: async () => {
        const { data } = await api.get<SalesPage[]>('/storefront');
        return data.map(item => ({
            ...item,
            features: typeof item.features === 'string' ? JSON.parse(item.features) : (item.features || [])
        }));
    },
    
    getPage: async (id: string) => {
        const { data } = await api.get<SalesPage>(`/storefront/${id}`);
        return {
            ...data,
            features: typeof data.features === 'string' ? JSON.parse(data.features) : (data.features || [])
        };
    },
    
    createPage: async (pageData: Partial<SalesPage>) => {
        const { data } = await api.post<SalesPage>('/storefront', pageData);
        return data;
    },
    
    updatePage: async (id: string, pageData: Partial<SalesPage>) => {
        const { data } = await api.patch<SalesPage>(`/storefront/${id}`, pageData);
        return data;
    },
    
    deletePage: async (id: string) => {
        await api.delete(`/storefront/${id}`);
    },
    
    getOrders: async () => {
        const { data } = await api.get<SalesOrder[]>('/storefront/orders');
        return data;
    },
    
    getPublicPage: async (slug: string) => {
        const { data } = await api.get<SalesPage>(`/storefront/public/${slug}`);
        return {
            ...data,
            features: typeof data.features === 'string' ? JSON.parse(data.features) : (data.features || [])
        };
    },
    
    processCheckout: async (checkoutData: {
        sales_page_id: string;
        customer_name: string;
        customer_email: string;
        amount: number;
        currency: string;
        variant_used?: string;
        stripe_session_id?: string;
    }) => {
        const { data } = await api.post<SalesOrder>('/storefront/public/checkout', checkoutData);
        return data;
    }
};
