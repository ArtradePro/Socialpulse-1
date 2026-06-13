import { Request, Response } from 'express';
import { db } from '../config/database';

const MOCK_REPLIES = [
    "Thanks for the info! Can I change the shipping address?",
    "Great, thank you! I'm really looking forward to receiving this.",
    "Quick question, does this come with a warranty?",
    "Perfect, that makes sense. Thanks for the quick response!",
    "Okay, I'll check my email for the receipt.",
    "Awesome service! Highly recommended."
];

// List customers for workspace
export const listCustomers = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }

        const { rows } = await db.query(
            `SELECT * FROM storefront_customers
             WHERE workspace_id = $1
             ORDER BY last_order_at DESC`,
            [req.workspaceId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[CRM] listCustomers error:', err);
        res.status(500).json({ message: 'Failed to retrieve customer profiles' });
    }
};

// Get single customer and their chat history
export const getCustomerMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }

        const { rows: customer } = await db.query(
            `SELECT * FROM storefront_customers WHERE id = $1 AND workspace_id = $2`,
            [id, req.workspaceId]
        );

        if (!customer[0]) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        const { rows: messages } = await db.query(
            `SELECT * FROM customer_messages 
             WHERE customer_id = $1 
             ORDER BY created_at ASC`,
            [id]
        );

        res.json({
            customer: customer[0],
            messages
        });
    } catch (err) {
        console.error('[CRM] getCustomerMessages error:', err);
        res.status(500).json({ message: 'Failed to retrieve messages' });
    }
};

// Send message to customer (triggers auto-response from customer)
export const sendCustomerMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }
        if (!message) {
            res.status(400).json({ message: 'Message content is required' });
            return;
        }

        const { rows: customer } = await db.query(
            `SELECT * FROM storefront_customers WHERE id = $1 AND workspace_id = $2`,
            [id, req.workspaceId]
        );

        if (!customer[0]) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        // Insert user message
        const { rows: userMsg } = await db.query(
            `INSERT INTO customer_messages (customer_id, sender, message)
             VALUES ($1, 'USER', $2)
             RETURNING *`,
            [id, message]
        );

        // Simulate customer reply after 3 seconds
        setTimeout(async () => {
            try {
                const randomReply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
                await db.query(
                    `INSERT INTO customer_messages (customer_id, sender, message)
                     VALUES ($1, 'CUSTOMER', $2)`,
                    [id, randomReply]
                );
            } catch (err) {
                console.error('[CRM] Simulated response insertion failed:', err);
            }
        }, 3000);

        res.status(201).json(userMsg[0]);
    } catch (err) {
        console.error('[CRM] sendCustomerMessage error:', err);
        res.status(500).json({ message: 'Failed to send message' });
    }
};

// Send email receipt update (Simulated)
export const sendEmailReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!req.workspaceId) {
            res.status(400).json({ message: 'Workspace context is required' });
            return;
        }

        const { rows: customer } = await db.query(
            `SELECT * FROM storefront_customers WHERE id = $1 AND workspace_id = $2`,
            [id, req.workspaceId]
        );

        if (!customer[0]) {
            res.status(404).json({ message: 'Customer not found' });
            return;
        }

        const emailText = `📦 Order receipt & status update sent successfully to ${customer[0].email}!`;
        
        // Write status message in chat history indicating email receipt sent
        const { rows: emailMsg } = await db.query(
            `INSERT INTO customer_messages (customer_id, sender, message)
             VALUES ($1, 'USER', $2)
             RETURNING *`,
            [id, `📧 [Automated System Update]: Email receipt and tracking info sent to ${customer[0].email}`]
        );

        res.json({ message: emailText, messageRecord: emailMsg[0] });
    } catch (err) {
        console.error('[CRM] sendEmailReceipt error:', err);
        res.status(500).json({ message: 'Failed to send receipt email' });
    }
};
