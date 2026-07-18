import { Request, Response } from 'express';
import { db } from '../config/database';
import { CampaignService } from '../services/marketing/campaign.service';
import { AutomationEngineService } from '../services/marketing/automationEngine.service';

// Contacts
export const createContact = async (req: Request, res: Response): Promise<void> => {
    const { email, phone, firstName, lastName, isSubscribedEmail, isSubscribedSms } = req.body;
    const tenantId = req.workspaceId;

    if (!email) {
        res.status(400).json({ message: 'Email is required' });
        return;
    }

    try {
        const result = await db.query(
            `INSERT INTO marketing_contacts (tenant_id, email, phone, first_name, last_name, is_subscribed_email, is_subscribed_sms)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (tenant_id, email) DO UPDATE SET
                phone = COALESCE(EXCLUDED.phone, marketing_contacts.phone),
                first_name = COALESCE(EXCLUDED.first_name, marketing_contacts.first_name),
                last_name = COALESCE(EXCLUDED.last_name, marketing_contacts.last_name),
                is_subscribed_email = EXCLUDED.is_subscribed_email,
                is_subscribed_sms = EXCLUDED.is_subscribed_sms
             RETURNING *`,
            [
                tenantId,
                email.toLowerCase().trim(),
                phone || null,
                firstName || null,
                lastName || null,
                isSubscribedEmail !== false,
                isSubscribedSms !== false
            ]
        );

        // Trigger internal automation trigger event 'contact_created'
        await AutomationEngineService.triggerEvent('contact_created', tenantId!, {
            contactId: result.rows[0].id,
            email: result.rows[0].email,
            phone: result.rows[0].phone,
            firstName: result.rows[0].first_name,
            lastName: result.rows[0].last_name,
        });

        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        console.error('[MarketingController] createContact error:', err);
        res.status(500).json({ message: 'Failed to create contact' });
    }
};

export const getContacts = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.workspaceId;
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
        let sql = `SELECT * FROM marketing_contacts WHERE tenant_id = $1`;
        const params: any[] = [tenantId];

        if (search) {
            sql += ` AND (email ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2)`;
            params.push(`%${search}%`);
        }

        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(Number(limit), offset);

        const { rows: contacts } = await db.query(sql, params);

        // Count total
        let countSql = `SELECT COUNT(*) FROM marketing_contacts WHERE tenant_id = $1`;
        const countParams = [tenantId];
        if (search) {
            countSql += ` AND (email ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2)`;
            countParams.push(`%${search}%`);
        }
        const { rows: countRows } = await db.query(countSql, countParams);
        const total = parseInt(countRows[0].count);

        res.json({ contacts, total, page: Number(page), limit: Number(limit) });
    } catch (err: any) {
        console.error('[MarketingController] getContacts error:', err);
        res.status(500).json({ message: 'Failed to retrieve contacts' });
    }
};

export const deleteContact = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const tenantId = req.workspaceId;

    try {
        await db.query('DELETE FROM marketing_contacts WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        res.json({ message: 'Contact deleted successfully' });
    } catch (err: any) {
        console.error('[MarketingController] deleteContact error:', err);
        res.status(500).json({ message: 'Failed to delete contact' });
    }
};

export const bulkImportContacts = async (req: Request, res: Response): Promise<void> => {
    const { contacts } = req.body; // Expects array of { email, phone, firstName, lastName, isSubscribedEmail, isSubscribedSms }
    const tenantId = req.workspaceId;

    if (!Array.isArray(contacts)) {
        res.status(400).json({ message: 'Invalid payload: contacts must be an array' });
        return;
    }

    try {
        let importedCount = 0;
        for (const c of contacts) {
            if (!c.email) continue;
            await db.query(
                `INSERT INTO marketing_contacts (tenant_id, email, phone, first_name, last_name, is_subscribed_email, is_subscribed_sms)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (tenant_id, email) DO UPDATE SET
                    phone = COALESCE(EXCLUDED.phone, marketing_contacts.phone),
                    first_name = COALESCE(EXCLUDED.first_name, marketing_contacts.first_name),
                    last_name = COALESCE(EXCLUDED.last_name, marketing_contacts.last_name),
                    is_subscribed_email = EXCLUDED.is_subscribed_email,
                    is_subscribed_sms = EXCLUDED.is_subscribed_sms`,
                [
                    tenantId,
                    c.email.toLowerCase().trim(),
                    c.phone || null,
                    c.firstName || c.first_name || null,
                    c.lastName || c.last_name || null,
                    c.isSubscribedEmail !== false && c.is_subscribed_email !== false,
                    c.isSubscribedSms !== false && c.is_subscribed_sms !== false
                ]
            );
            importedCount++;
        }

        res.json({ message: 'Bulk import complete', count: importedCount });
    } catch (err: any) {
        console.error('[MarketingController] bulkImportContacts error:', err);
        res.status(500).json({ message: 'Bulk import failed' });
    }
};

// Campaigns
export const createCampaign = async (req: Request, res: Response): Promise<void> => {
    const { name, type, subjectLine, bodyContent, scheduledAt } = req.body;
    const tenantId = req.workspaceId;

    if (!name || !type || !bodyContent) {
        res.status(400).json({ message: 'Name, type, and bodyContent are required' });
        return;
    }

    try {
        const campaign = await CampaignService.createCampaign({
            tenantId: tenantId!,
            name,
            type,
            subjectLine,
            bodyContent,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        });

        res.status(201).json(campaign);
    } catch (err: any) {
        console.error('[MarketingController] createCampaign error:', err);
        res.status(500).json({ message: 'Failed to create campaign' });
    }
};

export const getCampaigns = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.workspaceId;

    try {
        const campaigns = await CampaignService.listCampaigns(tenantId!);
        res.json({ campaigns });
    } catch (err: any) {
        console.error('[MarketingController] getCampaigns error:', err);
        res.status(500).json({ message: 'Failed to retrieve campaigns' });
    }
};

export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const tenantId = req.workspaceId;

    try {
        await db.query('DELETE FROM marketing_campaigns WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
        res.json({ message: 'Campaign deleted successfully' });
    } catch (err: any) {
        console.error('[MarketingController] deleteCampaign error:', err);
        res.status(500).json({ message: 'Failed to delete campaign' });
    }
};

// Automations
export const createAutomation = async (req: Request, res: Response): Promise<void> => {
    const { name, triggerEvent, logicPayload } = req.body;
    const tenantId = req.workspaceId;

    if (!name || !triggerEvent || !logicPayload) {
        res.status(400).json({ message: 'Name, triggerEvent, and logicPayload are required' });
        return;
    }

    try {
        const result = await db.query(
            `INSERT INTO marketing_automations (tenant_id, name, trigger_event, logic_payload, is_active)
             VALUES ($1, $2, $3, $4, true)
             RETURNING *`,
            [tenantId, name, triggerEvent, JSON.stringify(logicPayload)]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        console.error('[MarketingController] createAutomation error:', err);
        res.status(500).json({ message: 'Failed to create automation rule' });
    }
};

export const getAutomations = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.workspaceId;

    try {
        const result = await db.query(
            `SELECT * FROM marketing_automations WHERE tenant_id = $1 ORDER BY name ASC`,
            [tenantId]
        );
        res.json({ automations: result.rows });
    } catch (err: any) {
        console.error('[MarketingController] getAutomations error:', err);
        res.status(500).json({ message: 'Failed to retrieve automations' });
    }
};

// Analytics
export const getAnalyticsSummary = async (req: Request, res: Response): Promise<void> => {
    const tenantId = req.workspaceId;

    try {
        // Retrieve volume and statuses of delivery logs scoped to tenant campaigns
        const logsResult = await db.query(
            `SELECT l.status, COUNT(l.id) as count
             FROM marketing_delivery_logs l
             LEFT JOIN marketing_campaigns c ON l.campaign_id = c.id
             WHERE c.tenant_id = $1 OR (l.campaign_id IS NULL AND l.contact_id IN (SELECT id FROM marketing_contacts WHERE tenant_id = $1))
             GROUP BY l.status`,
            [tenantId]
        );

        const summary: Record<string, number> = {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            failed: 0,
        };

        logsResult.rows.forEach((row) => {
            summary[row.status] = parseInt(row.count);
        });

        // Compute aggregate metrics
        const totalDispatched = Object.values(summary).reduce((a, b) => a + b, 0);
        const delivered = summary.delivered + summary.opened + summary.clicked;
        
        const deliveryRate = totalDispatched > 0 ? (delivered / totalDispatched) * 100 : 0;
        const openRate = delivered > 0 ? ((summary.opened + summary.clicked) / delivered) * 100 : 0;
        const bounceRate = totalDispatched > 0 ? (summary.bounced / totalDispatched) * 100 : 0;

        res.json({
            sendVolume: totalDispatched,
            deliveryRate: Math.round(deliveryRate * 10) / 10,
            openRate: Math.round(openRate * 10) / 10,
            bounceRate: Math.round(bounceRate * 10) / 10,
            rawMetrics: summary,
        });
    } catch (err: any) {
        console.error('[MarketingController] getAnalyticsSummary error:', err);
        res.status(500).json({ message: 'Failed to retrieve analytics summary' });
    }
};

// Webhook Delivery Receipts
export const handleDeliveryWebhook = async (req: Request, res: Response): Promise<void> => {
    const { deliveryLogId, status, errorMessage } = req.body;

    if (!deliveryLogId || !status) {
        res.status(400).json({ message: 'deliveryLogId and status are required' });
        return;
    }

    try {
        const result = await db.query(
            `UPDATE marketing_delivery_logs
             SET status = $1, error_message = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status, errorMessage || null, deliveryLogId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Delivery log record not found' });
            return;
        }

        console.log(`[WebhookListener] Updated delivery log ID ${deliveryLogId} to status "${status}"`);
        res.json({ message: 'Delivery log updated successfully', log: result.rows[0] });
    } catch (err: any) {
        console.error('[MarketingController] handleDeliveryWebhook error:', err);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
};
