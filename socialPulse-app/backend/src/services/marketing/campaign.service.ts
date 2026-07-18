import { db } from '../../config/database';
import { campaignDispatchQueue, messageDeliveryQueue } from '../../jobs/marketing/queues';

export class CampaignService {
    /**
     * Create a new marketing campaign
     */
    static async createCampaign(data: {
        tenantId: string;
        name: string;
        type: 'email' | 'sms';
        subjectLine?: string;
        bodyContent: string;
        scheduledAt?: Date;
    }) {
        const { tenantId, name, type, subjectLine, bodyContent, scheduledAt } = data;
        const result = await db.query(
            `INSERT INTO marketing_campaigns (tenant_id, name, type, subject_line, body_content, status, scheduled_at)
             VALUES ($1, $2, $3, $4, $5, 'draft', $6)
             RETURNING *`,
            [tenantId, name, type, subjectLine || null, bodyContent, scheduledAt || null]
        );
        
        const campaign = result.rows[0];

        // If scheduled_at is provided, schedule it immediately
        if (scheduledAt) {
            await this.scheduleCampaign(campaign.id);
        }

        return campaign;
    }

    /**
     * Get a campaign by ID
     */
    static async getCampaign(campaignId: string, tenantId: string) {
        const result = await db.query(
            `SELECT * FROM marketing_campaigns WHERE id = $1 AND tenant_id = $2`,
            [campaignId, tenantId]
        );
        return result.rows[0] || null;
    }

    /**
     * List all campaigns for a tenant
     */
    static async listCampaigns(tenantId: string) {
        const result = await db.query(
            `SELECT c.*, 
                COUNT(l.id) as total_sent,
                COUNT(CASE WHEN l.status = 'delivered' THEN 1 END) as total_delivered,
                COUNT(CASE WHEN l.status = 'opened' THEN 1 END) as total_opened,
                COUNT(CASE WHEN l.status = 'bounced' THEN 1 END) as total_bounced,
                COUNT(CASE WHEN l.status = 'failed' THEN 1 END) as total_failed
             FROM marketing_campaigns c
             LEFT JOIN marketing_delivery_logs l ON c.id = l.campaign_id
             WHERE c.tenant_id = $1
             GROUP BY c.id
             ORDER BY c.created_at DESC`,
            [tenantId]
        );
        return result.rows;
    }

    /**
     * Schedule a campaign using BullMQ delayed jobs
     */
    static async scheduleCampaign(campaignId: string) {
        const campaignResult = await db.query(
            `SELECT * FROM marketing_campaigns WHERE id = $1`,
            [campaignId]
        );
        
        const campaign = campaignResult.rows[0];
        if (!campaign) throw new Error('Campaign not found');
        if (!campaign.scheduled_at) throw new Error('Campaign does not have a scheduled send time');

        const scheduledTime = new Date(campaign.scheduled_at).getTime();
        const delay = scheduledTime - Date.now();

        // Update campaign status to scheduled
        await db.query(
            `UPDATE marketing_campaigns SET status = 'scheduled' WHERE id = $1`,
            [campaignId]
        );

        // Add to BullMQ campaign dispatch queue with calculated delay
        await campaignDispatchQueue.add(
            'dispatch-campaign',
            { campaignId },
            {
                delay: delay > 0 ? delay : 0,
                jobId: `campaign-${campaignId}`, // Deduplicate if rescheduled
            }
        );

        console.log(`[CampaignService] Scheduled campaign ${campaignId} with delay ${delay > 0 ? delay : 0}ms`);
    }

    /**
     * Dispatch a campaign to all matching contacts
     */
    static async dispatchCampaign(campaignId: string) {
        console.log(`[CampaignService] Starting dispatch for campaign: ${campaignId}`);
        
        const campaignResult = await db.query(
            `SELECT * FROM marketing_campaigns WHERE id = $1`,
            [campaignId]
        );
        const campaign = campaignResult.rows[0];
        if (!campaign) throw new Error('Campaign not found');

        // Update campaign status to sending
        await db.query(
            `UPDATE marketing_campaigns SET status = 'sending' WHERE id = $1`,
            [campaignId]
        );

        // Query subscribers based on campaign type
        let contactsResult;
        if (campaign.type === 'email') {
            contactsResult = await db.query(
                `SELECT * FROM marketing_contacts 
                 WHERE tenant_id = $1 AND is_subscribed_email = true AND email IS NOT NULL AND email != ''`,
                [campaign.tenant_id]
            );
        } else {
            contactsResult = await db.query(
                `SELECT * FROM marketing_contacts 
                 WHERE tenant_id = $1 AND is_subscribed_sms = true AND phone IS NOT NULL AND phone != ''`,
                [campaign.tenant_id]
            );
        }

        const contacts = contactsResult.rows;
        console.log(`[CampaignService] Fan-out: Found ${contacts.length} contacts for campaign type: ${campaign.type}`);

        for (const contact of contacts) {
            // Create delivery log record in status 'sent'
            const logResult = await db.query(
                `INSERT INTO marketing_delivery_logs (campaign_id, contact_id, status)
                 VALUES ($1, $2, 'sent')
                 RETURNING id`,
                [campaign.id, contact.id]
            );
            const deliveryLogId = logResult.rows[0].id;

            // Push to message-delivery-queue
            await messageDeliveryQueue.add('deliver-message', {
                campaignId: campaign.id,
                contactId: contact.id,
                deliveryLogId,
                type: campaign.type,
                to: campaign.type === 'email' ? contact.email : contact.phone,
                subject: campaign.subject_line,
                body: campaign.body_content,
            });
        }

        // Update campaign status to completed
        await db.query(
            `UPDATE marketing_campaigns SET status = 'completed' WHERE id = $1`,
            [campaignId]
        );

        console.log(`[CampaignService] Completed queuing dispatch jobs for campaign: ${campaignId}`);
    }
}
