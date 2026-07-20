import { db } from '../../config/database';
import { automationTriggerQueue, messageDeliveryQueue } from '../../jobs/marketing/queues';

export class AutomationEngineService {
    /**
     * Trigger an internal event in the marketing automation system
     * Fetches rules from marketing_automations and schedules them for evaluation.
     */
    static async triggerEvent(eventName: string, tenantId: string, payload: {
        contactId?: string;
        email?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        [key: string]: any;
    }) {
        console.log(`[AutomationEngineService] Triggering event "${eventName}" for tenant: ${tenantId}`);

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(tenantId)) {
            console.warn(`[AutomationEngineService] Skipping event "${eventName}" — invalid tenantId UUID: "${tenantId}"`);
            return;
        }

        // Find active automations matching this event
        const result = await db.query(
            `SELECT * FROM marketing_automations 
             WHERE tenant_id = $1 AND trigger_event = $2 AND is_active = true`,
            [tenantId, eventName]
        );

        const automations = result.rows;
        console.log(`[AutomationEngineService] Found ${automations.length} active automations matching event "${eventName}"`);

        for (const automation of automations) {
            // Task 1: Error isolation — a queueing failure for one automation must not
            // abort the loop for the remaining ones.
            try {
                await automationTriggerQueue.add('evaluate-automation', {
                    automationId: automation.id,
                    tenantId,
                    payload,
                });
            } catch (err) {
                console.error(
                    `[AutomationEngineService] Failed to queue automation ${automation.id} — skipping:`,
                    err
                );
            }
        }
    }

    /**
     * Evaluate a specific automation rule (called inside the BullMQ worker)
     */
    static async evaluateAutomation(automationId: string, tenantId: string, payload: any) {
        console.log(`[AutomationEngineService] Evaluating automation rule: ${automationId}`);
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(tenantId) || !uuidRegex.test(automationId)) {
            console.warn(`[AutomationEngineService] Skipping evaluation — invalid tenantId or automationId UUID`);
            return;
        }

        const automationResult = await db.query(
            `SELECT * FROM marketing_automations WHERE id = $1 AND tenant_id = $2`,
            [automationId, tenantId]
        );
        const automation = automationResult.rows[0];
        if (!automation) throw new Error('Automation rule not found');

        const { logic_payload } = automation;
        if (!logic_payload || typeof logic_payload !== 'object') {
            console.warn(`[AutomationEngineService] Automation ${automationId} has empty or invalid logic_payload`);
            return;
        }

        const action = logic_payload.action; // 'send_email' | 'send_sms'
        const templateBody = logic_payload.template_body;
        const templateSubject = logic_payload.template_subject || '';

        if (!action || !templateBody) {
            console.warn(`[AutomationEngineService] Automation ${automationId} logic_payload missing action or template_body`);
            return;
        }

        // Determine target recipient details
        let contactId = payload.contactId;
        let email = payload.email;
        let phone = payload.phone;
        let firstName = payload.firstName || '';
        let lastName = payload.lastName || '';

        // If contactId is provided, enrich from DB
        let contact: any = null;
        if (contactId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(contactId)) {
                console.warn(`[AutomationEngineService] Invalid contactId UUID: "${contactId}", ignoring database enrichment`);
                contactId = undefined;
            } else {
                const contactResult = await db.query(
                    `SELECT * FROM marketing_contacts WHERE id = $1 AND tenant_id = $2`,
                    [contactId, tenantId]
                );
                contact = contactResult.rows[0];
            }
        }

        if (!contact && email) {
            const contactResult = await db.query(
                `SELECT * FROM marketing_contacts WHERE email = $1 AND tenant_id = $2`,
                [email.toLowerCase().trim(), tenantId]
            );
            contact = contactResult.rows[0];
        }

        if (contact) {
            contactId = contact.id;
            email = email || contact.email;
            phone = phone || contact.phone;
            firstName = firstName || contact.first_name;
            lastName = lastName || contact.last_name;
        }

        // Compliance check: skip dispatch if contact has unsubscribed
        if (action === 'send_email' && contact && contact.is_subscribed_email === false) {
            console.warn(`[AutomationEngineService] Skipping email automation ${automationId} for ${email} — contact is unsubscribed (is_subscribed_email = false)`);
            return;
        }
        if (action === 'send_sms' && contact && contact.is_subscribed_sms === false) {
            console.warn(`[AutomationEngineService] Skipping SMS automation ${automationId} for ${phone} — contact is unsubscribed (is_subscribed_sms = false)`);
            return;
        }

        // Task 2: Dynamic template resolution — merge contact fields with every key
        // from the incoming payload so templates like {{contract_amount}} or
        // {{client_name}} resolve automatically without hardcoding them here.
        const templateVars: Record<string, string> = {
            // Spread arbitrary payload keys first (lower priority)
            ...Object.fromEntries(
                Object.entries(payload).map(([k, v]) => [k, String(v ?? '')])
            ),
            // Contact fields override payload keys of the same name
            first_name: firstName,
            last_name: lastName,
            email: email || '',
            phone: phone || '',
        };

        const renderTemplate = (text: string): string =>
            text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => templateVars[key] ?? '');

        const renderedBody = renderTemplate(templateBody);
        const renderedSubject = renderTemplate(templateSubject);

        // Queue direct delivery job
        if (action === 'send_email' && email) {
            console.log(`[AutomationEngineService] Automation ${automationId} triggering email delivery to ${email}`);
            
            // Log delivery log entry
            const logResult = await db.query(
                `INSERT INTO marketing_delivery_logs (campaign_id, contact_id, status)
                 VALUES (null, $1, 'sent')
                 RETURNING id`,
                [contactId || null]
            );
            const deliveryLogId = logResult.rows[0].id;

            await messageDeliveryQueue.add('deliver-message', {
                contactId: contactId || null,
                deliveryLogId,
                type: 'email',
                to: email,
                subject: renderedSubject,
                body: renderedBody,
            });
        } else if (action === 'send_sms' && phone) {
            console.log(`[AutomationEngineService] Automation ${automationId} triggering SMS delivery to ${phone}`);
            
            const logResult = await db.query(
                `INSERT INTO marketing_delivery_logs (campaign_id, contact_id, status)
                 VALUES (null, $1, 'sent')
                 RETURNING id`,
                [contactId || null]
            );
            const deliveryLogId = logResult.rows[0].id;

            await messageDeliveryQueue.add('deliver-message', {
                contactId: contactId || null,
                deliveryLogId,
                type: 'sms',
                to: phone,
                body: renderedBody,
            });
        } else {
            console.warn(`[AutomationEngineService] Automation ${automationId} could not send: missing email/phone coordinates`, { email, phone });
        }
    }
}
