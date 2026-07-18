import { Worker, UnrecoverableError } from 'bullmq';
import { getRedisConnection } from '../../config/marketingRedis';
import { CampaignService } from '../../services/marketing/campaign.service';
import { EmailProviderService } from '../../services/marketing/emailProvider.service';
import { SmsProviderService } from '../../services/marketing/smsProvider.service';
import { AutomationEngineService } from '../../services/marketing/automationEngine.service';
import { db } from '../../config/database';

let campaignWorker: Worker;
let deliveryWorker: Worker;
let automationWorker: Worker;

export const initMarketingWorkers = () => {
    const connection = getRedisConnection();

    // 1. Campaign Dispatch Worker
    campaignWorker = new Worker(
        'campaign-dispatch-queue',
        async (job) => {
            const { campaignId } = job.data;
            console.log(`[Queue Worker] Processing campaign dispatch for ID: ${campaignId}`);
            try {
                await CampaignService.dispatchCampaign(campaignId);
            } catch (err: any) {
                console.error(`[Queue Worker] Campaign dispatch failed for ID ${campaignId}:`, err);
                throw err;
            }
        },
        { connection }
    );

    // 2. Message Delivery Worker (includes rate-limiting / throttling)
    deliveryWorker = new Worker(
        'message-delivery-queue',
        async (job) => {
            const { campaignId, contactId, deliveryLogId, type, to, subject, body } = job.data;
            console.log(`[Queue Worker] Delivering ${type} message to: ${to} (log ID: ${deliveryLogId})`);
            
            try {
                let messageId = '';
                if (type === 'email') {
                    messageId = await EmailProviderService.send(to, subject || 'No Subject', body);
                } else if (type === 'sms') {
                    messageId = await SmsProviderService.send(to, body);
                } else {
                    throw new Error(`Unsupported message delivery type: ${type}`);
                }

                // Update log status to delivered (webhooks can transition to opened/clicked/etc.)
                await db.query(
                    `UPDATE marketing_delivery_logs 
                     SET status = 'delivered', updated_at = NOW() 
                     WHERE id = $1`,
                    [deliveryLogId]
                );

                console.log(`[Queue Worker] Successful delivery to ${to}. Log ID: ${deliveryLogId}`);
                return { success: true, messageId };
            } catch (err: any) {
                console.error(`[Queue Worker] Delivery failed to ${to}:`, err);
                
                // Update log status to failed with error message
                await db.query(
                    `UPDATE marketing_delivery_logs 
                     SET status = 'failed', error_message = $1, updated_at = NOW() 
                     WHERE id = $2`,
                    [err.message || 'Unknown delivery failure', deliveryLogId]
                );

                throw err;
            }
        },
        { 
            connection,
            // Rate limit: process max 5 delivery messages per second
            limiter: {
                max: 5,
                duration: 1000
            },
            // Task 3: Keep failed delivery jobs in Redis for inspection / manual retry.
            removeOnFail: { count: 100 },
        }
    );

    // 3. Automation Trigger Worker
    automationWorker = new Worker(
        'automation-trigger-queue',
        async (job) => {
            const { automationId, tenantId, payload } = job.data;
            console.log(`[Queue Worker] Evaluating automation rules for ID: ${automationId}`);
            try {
                await AutomationEngineService.evaluateAutomation(automationId, tenantId, payload);
            } catch (err: any) {
                console.error(`[Queue Worker] Automation evaluation failed for ID ${automationId}:`, err);

                // Task 1: Error Isolation — distinguish permanent config errors (don't retry)
                // from transient errors (e.g. DB down) which BullMQ should retry.
                const isConfigError =
                    err.message?.includes('logic_payload') ||
                    err.message?.includes('not found') ||
                    err.message?.includes('Automation rule not found');

                if (isConfigError) {
                    // UnrecoverableError tells BullMQ: move to failed immediately, no retries.
                    throw new UnrecoverableError(err.message);
                }
                throw err;
            }
        },
        {
            connection,
            // Task 3: Keep up to 100 failed jobs in Redis for inspection / manual retry.
            removeOnFail: { count: 100 },
        }
    );

    // Register log listeners
    campaignWorker.on('failed', (job, err) => {
        console.error(`[Queue Worker] Job failed in campaign-dispatch-queue:`, err);
    });

    // Task 3: Graceful Failure — on permanent delivery failure, ensure the DB log
    // record is marked 'failed'. The job processor already does this in its catch
    // block, but this handler catches cases where the DB update itself threw.
    deliveryWorker.on('failed', async (job, err) => {
        console.error(`[Queue Worker] Job failed in message-delivery-queue:`, err);
        const deliveryLogId = job?.data?.deliveryLogId;
        if (deliveryLogId) {
            try {
                await db.query(
                    `UPDATE marketing_delivery_logs
                     SET status = 'failed', error_message = $1, updated_at = NOW()
                     WHERE id = $2 AND status != 'failed'`,
                    [err.message || 'Unknown failure', deliveryLogId]
                );
            } catch (dbErr) {
                console.error(`[Queue Worker] Could not write failure status to DB for log ${deliveryLogId}:`, dbErr);
            }
        }
    });

    // Task 3: Graceful Failure — write an automation-level failure record so failed
    // automation jobs are visible in the database, not only in the BullMQ failed set.
    automationWorker.on('failed', async (job, err) => {
        console.error(`[Queue Worker] Job failed in automation-trigger-queue:`, err);
        const { automationId, tenantId, payload } = job?.data ?? {};
        if (!automationId) return;
        try {
            await db.query(
                `INSERT INTO marketing_delivery_logs (campaign_id, contact_id, status, error_message)
                 VALUES (null, $1, 'failed', $2)`,
                [
                    payload?.contactId ?? null,
                    `Automation ${automationId} failed: ${err.message || 'Unknown error'}`,
                ]
            );
        } catch (dbErr) {
            console.error(`[Queue Worker] Could not write automation failure record to DB:`, dbErr);
        }
    });

    console.log('✓ Omnichannel Marketing Queue Workers successfully initialized.');
};
