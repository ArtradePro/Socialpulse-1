import { Request, Response } from 'express';
import { pool } from '../config/database';
import { EcommerceService } from '../services/ecommerce.service';

export const getStores = async (req: any, res: Response) => {
    try {
        const workspaceId = req.workspaceId;
        const { rows } = await pool.query(
            'SELECT id, platform, name, status, last_sync_at, seller_id FROM ecommerce_stores WHERE workspace_id = $1',
            [workspaceId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching stores' });
    }
};

export const connectStore = async (req: any, res: Response) => {
    try {
        const workspaceId = req.workspaceId;
        const { platform, name, apiUrl, apiKey, apiSecret, sellerId } = req.body;

        const { rows } = await pool.query(
            `INSERT INTO ecommerce_stores (workspace_id, platform, name, api_url, api_key, api_secret, seller_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [workspaceId, platform, name, apiUrl, apiKey, apiSecret, sellerId]
        );

        const storeId = rows[0].id;
        
        // Initial sync
        try {
            await EcommerceService.syncProducts(storeId);
        } catch (syncErr) {
            console.error('Initial sync failed:', syncErr);
            // We still return success for connection, but status will be 'error'
        }

        res.status(201).json({ id: storeId, message: 'Store connected' });
    } catch (err) {
        res.status(500).json({ message: 'Error connecting store' });
    }
};

export const disconnectStore = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const workspaceId = req.workspaceId;

        await pool.query(
            'DELETE FROM ecommerce_stores WHERE id = $1 AND workspace_id = $2',
            [id, workspaceId]
        );
        res.json({ message: 'Store disconnected' });
    } catch (err) {
        res.status(500).json({ message: 'Error disconnecting store' });
    }
};

export const getProducts = async (req: any, res: Response) => {
    try {
        const workspaceId = req.workspaceId;
        const { page = 1, limit = 20, search = '' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const { rows } = await pool.query(
            `SELECT * FROM products 
             WHERE workspace_id = $1 AND (title ILIKE $2 OR description ILIKE $2)
             ORDER BY created_at DESC
             LIMIT $3 OFFSET $4`,
            [workspaceId, `%${search}%`, limit, offset]
        );

        const { rows: countRows } = await pool.query(
            'SELECT COUNT(*) FROM products WHERE workspace_id = $1 AND (title ILIKE $2 OR description ILIKE $2)',
            [workspaceId, `%${search}%`]
        );

        res.json({
            products: rows,
            total: parseInt(countRows[0].count),
            page: Number(page),
            limit: Number(limit)
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching products' });
    }
};

export const syncStore = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        await EcommerceService.syncProducts(id);
        res.json({ message: 'Sync completed' });
    } catch (err) {
        res.status(500).json({ message: 'Sync failed' });
    }
};
