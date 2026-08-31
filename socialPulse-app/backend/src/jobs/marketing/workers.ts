import { Worker, UnrecoverableError } from 'bullmq';
import { getRedisConnection } from '../../config/marketingRedis';
import { CampaignService } from '../../services/marketing/campaign.service';
import { EmailProviderService } from '../../services/marketing/emailProvider.service';
import { SmsProviderService } from '../../services/marketing/smsProvider.service';
import { AutomationEngineService } from '../../services/marketing/automationEngine.service';
import { SuppressionService } from '../../services/marketing/suppression.service';
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
            const { campaignId, contactId, deliveryLogId, type, to, subject, body, workspaceId } = job.data;
            console.log(`[Queue Worker] Delivering ${type} message (log ID: ${deliveryLogId})`);
            
            try {
                // POPIA / Consent Check: verify suppression status before sending
                if (workspaceId && to) {
                    const channel = type === 'email' ? 'EMAIL' : type === 'sms' ? 'SMS' : 'WHATSAPP';
                    const isSuppressed = await SuppressionService.isSuppressed(workspaceId, channel as any, to);
                    if (isSuppressed) {
                        console.log(`[Queue Worker] Recipient suppressed for ${channel} (log ID: ${deliveryLogId})`);
                        await db.query(
                            `UPDATE marketing_delivery_logs
                             SET status = 'suppressed', error_message = 'RECIPIENT_SUPPRESSED', updated_at = NOW()
                             WHERE id = $1`,
                            [deliveryLogId]
                        );
                        return { success: false, status: 'SUPPRESSED', reason: 'RECIPIENT_SUPPRESSED' };
                    }
                }

                let deliveryResult: { provider: string; status: 'LIVE_PROVIDER' | 'SIMULATED'; messageId: string };
                if (type === 'email') {
                    deliveryResult = await EmailProviderService.send(to, subject || 'No Subject', body);
                } else if (type === 'sms') {
                    deliveryResult = await SmsProviderService.send(to, body);
                } else {
                    throw new Error(`Unsupported message delivery type: ${type}`);
                }

                // Delivery Status Truth:
                // Only mark 'delivered' when a real configured live provider accepted the dispatch.
                // For an explicitly permitted non-production simulation, retain database status 'sent' with marker 'SIMULATED_NON_PRODUCTION' — NEVER 'delivered'.
                const isLive = deliveryResult.status === 'LIVE_PROVIDER';
                const logStatus = isLive ? 'delivered' : 'sent';
                const errorMessage = isLive ? null : 'SIMULATED_NON_PRODUCTION';

                await db.query(
                    `UPDATE marketing_delivery_logs
                     SET status = $1, error_message = $2, updated_at = NOW()
                     WHERE id = $3`,
                    [
                        logStatus,
                        errorMessage,
                        deliveryLogId
                    ]
                );

                console.log(`[Queue Worker] Delivery processed for log ID: ${deliveryLogId} (status: ${logStatus})`);
                return { success: true, status: deliveryResult.status, messageId: deliveryResult.messageId };
            } catch (err: any) {
                // Provider and worker failures must store a generic code, never leaking PII or raw provider messages
                console.error(`[Queue Worker] Delivery failed for log ID ${deliveryLogId}`);
                
                await db.query(
                    `UPDATE marketing_delivery_logs
                     SET status = 'failed', error_message = $1, updated_at = NOW()
                     WHERE id = $2`,
                    ['PROVIDER_DELIVERY_FAILED', deliveryLogId]
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
    campaignWorker.on('failed', () => {
        console.error('[Queue Worker] Job failed in campaign-dispatch-queue');
    });

    // Task 3: Graceful Failure — on permanent delivery failure, ensure the DB log
    // record is marked 'failed'. The job processor already does this in its catch
    // block, but this handler catches cases where the DB update itself threw.
    deliveryWorker.on('failed', async (job) => {
        console.error('[Queue Worker] Job failed in message-delivery-queue');
        const deliveryLogId = job?.data?.deliveryLogId;
        if (deliveryLogId) {
            try {
                await db.query(
                    `UPDATE marketing_delivery_logs
                     SET status = 'failed', error_message = $1, updated_at = NOW()
                     WHERE id = $2 AND status != 'failed'`,
                    ['PROVIDER_DELIVERY_FAILED', deliveryLogId]
                );
            } catch {
                console.error('[Queue Worker] DB_STATUS_UPDATE_FAILED');
            }
        }
    });

    // Task 3: Graceful Failure — write an automation-level failure record so failed
    // automation jobs are visible in the database, not only in the BullMQ failed set.
    automationWorker.on('failed', async (job) => {
        console.error('[Queue Worker] Job failed in automation-trigger-queue');
        const { automationId, payload } = job?.data ?? {};
        if (!automationId) return;
        try {
            await db.query(
                `INSERT INTO marketing_delivery_logs (campaign_id, contact_id, status, error_message)
                 VALUES (null, $1, 'failed', $2)`,
                [
                    payload?.contactId ?? null,
                    'AUTOMATION_EXECUTION_FAILED',
                ]
            );
        } catch {
            console.error('[Queue Worker] DB_AUTOMATION_LOG_FAILED');
        }
    });

    console.log('✓ Omnichannel Marketing Queue Workers successfully initialized.');
};
