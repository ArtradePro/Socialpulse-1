import api from './api';

export interface Customer {
    id: string;
    workspace_id: string;
    name: string;
    email: string;
    total_orders: number;
    total_spent: number;
    last_order_at: string;
    created_at: string;
}

export interface ChatMessage {
    id: string;
    customer_id: string;
    sender: 'CUSTOMER' | 'USER';
    message: string;
    created_at: string;
}

export interface CustomerDetail {
    customer: Customer;
    messages: ChatMessage[];
}

export const crmService = {
    getCustomers: async () => {
        const { data } = await api.get<Customer[]>('/crm/customers');
        return data;
    },

    getCustomerMessages: async (id: string) => {
        const { data } = await api.get<CustomerDetail>(`/crm/customers/${id}/messages`);
        return data;
    },

    sendCustomerMessage: async (id: string, message: string) => {
        const { data } = await api.post<ChatMessage>(`/crm/customers/${id}/messages`, { message });
        return data;
    },

    sendEmailReceipt: async (id: string) => {
        const { data } = await api.post<{ message: string; messageRecord: ChatMessage }>(`/crm/customers/${id}/email-receipt`);
        return data;
    }
};
