import { db } from '../config/database';
import { GoogleGenAI } from '@google/genai';
import { scrapeGoogleMaps } from './outscraperService';
import crypto from 'crypto';

let _ai: any = null;
const getAI = () => {
    if (!_ai) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("⚠️ GEMINI_API_KEY is not set. AI copy generation will use mock text.");
            return null;
        }
        _ai = new GoogleGenAI({ apiKey });
    }
    return _ai;
};

/**
 * Trigger active campaigns for a given scraped lead
 */
export async function enrollInCampaign(scrapedLeadId: string, triggerType: "LEAD_SCRAPED", workspaceId: string) {
    console.log(`🚀 Automations: Enrolling lead ${scrapedLeadId} in workspace ${workspaceId} for trigger ${triggerType}`);
    
    try {
        // 1. Fetch lead details
        const leadRes = await db.query(
            'SELECT * FROM scraped_leads WHERE id = $1 AND workspace_id = $2',
            [scrapedLeadId, workspaceId]
        );
        const lead = leadRes.rows[0];

        if (!lead) {
            console.error(`❌ Lead ${scrapedLeadId} not found in workspace ${workspaceId} for enrollment.`);
            return;
        }

        // 2. Fetch or create default workflow
        let workflowsRes = await db.query(
            'SELECT * FROM automation_workflows WHERE trigger_type = $1 AND is_active = true AND workspace_id = $2',
            [triggerType, workspaceId]
        );
        let workflows = workflowsRes.rows;

        if (workflows.length === 0) {
            console.log(`🌱 Automations: No active workflows found in workspace ${workspaceId}. Auto-creating default...`);
            
            // Default steps sequence: tag_change -> stage_change -> ai_outreach -> wait (5m) -> email -> sms -> whatsapp
            const defaultSteps = [
                { id: 'step_1', type: 'tag_change', label: 'Apply Tag', tag: 'B2B-Prospect' },
                { id: 'step_2', type: 'stage_change', label: 'Move to Ingested', stage: 'INGESTED' },
                { id: 'step_3', type: 'ai_outreach', label: 'Generate AI B2B Intro Copy', aiPrompt: 'Draft a short friendly B2B intro email introducing SocialPulse platform to this local business' },
                { id: 'step_4', type: 'wait', label: 'Wait 5 minutes', delayValue: 5, delayUnit: 'm' },
                { id: 'step_5', type: 'email', label: 'Dispatch Welcome Email', emailSubject: 'Improve your Social Media Presence!', emailBody: 'Hi {name},\n\nWe noticed your business on Google Maps and would love to help you grow your audience. Let us know if you are open to a brief chat!' },
                { id: 'step_6', type: 'sms', label: 'Send Follow-up SMS', smsBody: 'Hi {name}! Check out our platforms to automate your socials.' },
                { id: 'step_7', type: 'whatsapp', label: 'Send WhatsApp Alert', whatsappBody: 'Hello {name}! Let us connect on WhatsApp to showcase our tools.' }
            ];

            const newWorkflowRes = await db.query(
                `INSERT INTO automation_workflows (workspace_id, name, trigger_type, is_active, steps)
                 VALUES ($1, $2, $3, true, $4) RETURNING *`,
                [workspaceId, 'Default Scraper Campaign', triggerType, JSON.stringify(defaultSteps)]
            );
            workflows = [newWorkflowRes.rows[0]];
        }

        // 3. Enroll lead in all matching workflows
        for (const workflow of workflows) {
            // Check if already enrolled in this workflow
            const existingRes = await db.query(
                `SELECT * FROM automation_queue 
                 WHERE workflow_id = $1 AND scraped_lead_id = $2 AND status = 'PENDING' AND workspace_id = $3`,
                [workflow.id, lead.id, workspaceId]
            );

            if (existingRes.rows.length > 0) {
                console.log(`⚠️ Lead ${lead.id} already enrolled in workflow ${workflow.name}`);
                continue;
            }

            const initialLogs = [{
                timestamp: new Date().toISOString(),
                message: `Enrolled in workflow: "${workflow.name}"`
            }];

            await db.query(
                `INSERT INTO automation_queue 
                 (workspace_id, workflow_id, scraped_lead_id, current_step, execute_at, status, logs)
                 VALUES ($1, $2, $3, 0, NOW(), 'PENDING', $4)`,
                [workspaceId, workflow.id, lead.id, JSON.stringify(initialLogs)]
            );

            await logActivity(
                workspaceId,
                "ENROLLMENT",
                `Enrolled lead "${lead.business_name}" in "${workflow.name}"`,
                { leadId: lead.id, workflowId: workflow.id }
            );
        }

        // 4. Run queue tick immediately
        processQueue().catch(err => console.error("Error processing queue immediately:", err));

    } catch (error) {
        console.error("❌ Error enrolling lead in campaign:", error);
    }
}

/**
 * Process all pending actions in the queue whose execute_at date has arrived
 */
export async function processQueue() {
    const now = new Date();
    
    try {
        const pendingRes = await db.query(
            `SELECT * FROM automation_queue 
             WHERE status = 'PENDING' AND execute_at <= $1`,
            [now]
        );
        const pendingItems = pendingRes.rows;

        if (pendingItems.length === 0) return;

        console.log(`⚙️ Automations Queue: Processing ${pendingItems.length} active tasks...`);

        for (const item of pendingItems) {
            // Optimistic lock check: update status from PENDING to PROCESSING.
            const lockRes = await db.query(
                `UPDATE automation_queue 
                 SET status = 'PROCESSING', updated_at = NOW() 
                 WHERE id = $1 AND status = 'PENDING'`,
                [item.id]
            );

            if (lockRes.rowCount && lockRes.rowCount > 0) {
                await executeQueueStep({ ...item, status: "PROCESSING" });
            }
        }
    } catch (error) {
        console.error("❌ Error processing automation queue:", error);
    }
}

/**
 * Execute a single workflow step for a queue item
 */
async function executeQueueStep(queueItem: any) {
    const leadId = queueItem.scraped_lead_id;
    const workflowId = queueItem.workflow_id;
    const workspaceId = queueItem.workspace_id;
    let logsList = typeof queueItem.logs === 'string' ? JSON.parse(queueItem.logs) : queueItem.logs || [];

    const logStep = (msg: string) => {
        logsList.push({ timestamp: new Date().toISOString(), message: msg });
    };

    try {
        // 1. Fetch entities
        const leadRes = await db.query('SELECT * FROM scraped_leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId]);
        const lead = leadRes.rows[0];

        const workflowRes = await db.query('SELECT * FROM automation_workflows WHERE id = $1 AND workspace_id = $2', [workflowId, workspaceId]);
        const workflow = workflowRes.rows[0];

        if (!lead || !workflow) {
            await db.query(`UPDATE automation_queue SET status = 'FAILED' WHERE id = $1`, [queueItem.id]);
            return;
        }

        const steps = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps || [];
        const stepIndex = queueItem.current_step;

        if (stepIndex >= steps.length) {
            // Completed all steps
            await db.query(
                `UPDATE automation_queue SET status = 'COMPLETED', logs = $1, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify(logsList), queueItem.id]
            );
            return;
        }

        const step = steps[stepIndex];
        console.log(`▶️ Executing Step ${stepIndex + 1}/${steps.length} [${step.type}] for lead "${lead.business_name}"`);
        logStep(`Executing step: "${step.label}" [${step.type}]`);

        let isDelayStep = false;
        let nextExecutionDate = new Date();

        // 2. Perform Action based on step type
        switch (step.type) {
            case "tag_change":
                if (step.tag) {
                    await db.query(
                        'UPDATE scraped_leads SET tag_applied = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3',
                        [step.tag, lead.id, workspaceId]
                    );
                    logStep(`Applied tag: "${step.tag}"`);
                }
                break;

            case "stage_change":
                const mockCrmLeadId = lead.crm_lead_id || crypto.randomUUID() || 'mock-uuid-1234';
                const stageStr = step.stage || 'INGESTED';
                await db.query(
                    `UPDATE scraped_leads 
                     SET crm_lead_id = $1, status = $2, updated_at = NOW() 
                     WHERE id = $3 AND workspace_id = $4`,
                    [mockCrmLeadId, stageStr, lead.id, workspaceId]
                );
                logStep(`Ingested lead and updated stage to: "${stageStr}"`);
                break;

            case "ai_outreach":
                const prompt = step.aiPrompt || "Draft a short friendly B2B intro email introducing SocialPulse platform to this local business";
                
                // Agent Personalization: Search for active buyer personas in this workspace
                const personasRes = await db.query(
                    'SELECT * FROM buyer_personas WHERE workspace_id = $1 AND is_active = true',
                    [workspaceId]
                );
                const personas = personasRes.rows;
                let matchedPersona = null;
                if (personas.length > 0) {
                    const cat = (lead.category || '').toLowerCase();
                    matchedPersona = personas.find((p: any) => {
                        const nameMatch = (p.name || '').toLowerCase().includes(cat) || cat.includes((p.name || '').toLowerCase());
                        const indMatch = (p.industry || '').toLowerCase().includes(cat) || cat.includes((p.industry || '').toLowerCase());
                        const roleMatch = (p.role || '').toLowerCase().includes(cat) || cat.includes((p.role || '').toLowerCase());
                        return nameMatch || indMatch || roleMatch;
                    });
                    if (!matchedPersona) matchedPersona = personas[0]; // Fallback to first active
                }

                // Fetch brand voice
                const voiceRes = await db.query('SELECT * FROM brand_voices WHERE workspace_id = $1', [workspaceId]);
                const voice = voiceRes.rows[0];

                const outreachCopy = await generateOutreachMessage(
                    lead.business_name,
                    lead.category || "Service Business",
                    lead.city || "Local",
                    lead.rating || 5.0,
                    lead.competitor_rating || 4.2,
                    prompt,
                    matchedPersona,
                    voice
                );
                
                logStep(`AI copy generated successfully.`);
                await logActivity(
                    workspaceId,
                    "AI_OUTREACH_GENERATED",
                    `Generated outreach draft for "${lead.business_name}"`,
                    { leadId: lead.id, copy: outreachCopy }
                );
                break;

            case "wait":
                isDelayStep = true;
                const delayMs = calculateDelayMs(step.delayValue || 0, step.delayUnit || "m");
                nextExecutionDate = new Date(Date.now() + delayMs);
                logStep(`Delaying sequence execution until ${nextExecutionDate.toISOString()}`);
                break;

            case "sms":
                const smsBody = replaceTokens(step.smsBody || "", lead);
                if (lead.phone) {
                    await logActivity(
                        workspaceId,
                        "SMS_DISPATCHED",
                        `Simulated SMS sent to ${lead.phone}`,
                        { body: smsBody }
                    );
                    logStep(`SMS alert successfully dispatched.`);
                } else {
                    logStep(`Failed to send SMS: No phone number available.`);
                }
                break;

            case "email":
                const emailBody = replaceTokens(step.emailBody || "", lead);
                const subject = replaceTokens(step.emailSubject || "Inquiry", lead);
                if (lead.email) {
                    await logActivity(
                        workspaceId,
                        "EMAIL_DISPATCHED",
                        `Simulated Email sent to ${lead.email}`,
                        { subject, body: emailBody }
                    );
                    logStep(`Email alert successfully dispatched.`);
                } else {
                    logStep(`Failed to send Email: No email available.`);
                }
                break;

            case "whatsapp":
                const waBody = replaceTokens(step.whatsappBody || "", lead);
                if (lead.phone) {
                    await logActivity(
                        workspaceId,
                        "WHATSAPP_DISPATCHED",
                        `Simulated WhatsApp sent to ${lead.phone}`,
                        { body: waBody }
                    );
                    logStep(`WhatsApp message successfully dispatched.`);
                } else {
                    logStep(`Failed to send WhatsApp: No phone available.`);
                }
                break;
        }

        // 3. Update queue item status
        const nextStep = stepIndex + 1;
        const isCompleted = nextStep >= steps.length && !isDelayStep;

        await db.query(
            `UPDATE automation_queue
             SET current_step = $1,
                 execute_at = $2,
                 status = $3,
                 logs = $4,
                 updated_at = NOW()
             WHERE id = $5`,
            [
                isDelayStep ? stepIndex + 1 : nextStep, // If delay step, advance on tick expiration
                nextExecutionDate,
                isCompleted ? "COMPLETED" : "PENDING",
                JSON.stringify(logsList),
                queueItem.id
            ]
        );

    } catch (error: any) {
        console.error(`❌ Error executing workflow step for queue ${queueItem.id}:`, error);
        logStep(`Error: ${error.message || error}`);
        await db.query(
            `UPDATE automation_queue SET status = 'FAILED', logs = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(logsList), queueItem.id]
        );
    }
}

/**
 * Execute a manual scraping task and enroll all found leads
 */
export async function executeScrapingJob(taskId: string, workspaceId: string) {
    try {
        const taskRes = await db.query('SELECT * FROM scrape_tasks WHERE id = $1 AND workspace_id = $2', [taskId, workspaceId]);
        const task = taskRes.rows[0];
        if (!task) return;

        await db.query(
            `UPDATE scrape_tasks SET status = 'RUNNING', updated_at = NOW() WHERE id = $1`,
            [taskId]
        );

        await logActivity(workspaceId, "SCRAPE_STARTED", `Started scraping maps: "${task.query}" in "${task.location}"`);

        // Scrape maps
        const leads = await scrapeGoogleMaps(task.query, task.location, task.limit_count || 20);
        
        let ingestedCount = 0;
        for (const leadData of leads) {
            // Check if lead already exists in this workspace to deduplicate
            const dupRes = await db.query(
                `SELECT id FROM scraped_leads 
                 WHERE workspace_id = $1 AND (email = $2 OR phone = $3)`,
                [workspaceId, leadData.email || null, leadData.phone || null]
            );

            if (dupRes.rows.length === 0) {
                // Create lead record
                const newLeadRes = await db.query(
                    `INSERT INTO scraped_leads 
                     (workspace_id, business_name, email, phone, address, city, category, rating, reviews_count, website, competitor_rating, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SCRAPED') RETURNING id`,
                    [
                        workspaceId,
                        leadData.businessName,
                        leadData.email || null,
                        leadData.phone || null,
                        leadData.address || null,
                        leadData.city || null,
                        leadData.category || null,
                        leadData.rating || null,
                        leadData.reviewsCount || 0,
                        leadData.website || null,
                        leadData.competitorRating || null
                    ]
                );
                
                const newLeadId = newLeadRes.rows[0].id;
                ingestedCount++;

                // Enroll lead in campaign workflow
                await enrollInCampaign(newLeadId, "LEAD_SCRAPED", workspaceId);
            } else {
                // Duplicate lead in this workspace - update its status or ignore
                const existingLeadId = dupRes.rows[0].id;
                await db.query(
                    `UPDATE scraped_leads SET status = 'IGNORED', updated_at = NOW() WHERE id = $1`,
                    [existingLeadId]
                );
            }
        }

        await db.query(
            `UPDATE scrape_tasks 
             SET status = 'COMPLETED', leads_found = $1, leads_ingested = $2, updated_at = NOW() 
             WHERE id = $3`,
            [leads.length, ingestedCount, taskId]
        );

        await logActivity(
            workspaceId,
            "SCRAPE_COMPLETED",
            `Finished scraping job. Found ${leads.length} leads. Ingested ${ingestedCount} new records.`
        );

    } catch (error: any) {
        console.error("❌ Scraping Job Failed:", error);
        await db.query(
            `UPDATE scrape_tasks SET status = 'FAILED', error_message = $1, updated_at = NOW() WHERE id = $2`,
            [error.message || "Unknown error", taskId]
        );
        await logActivity(workspaceId, "SCRAPE_FAILED", `Scraping job failed: ${error.message || error}`);
    }
}

/**
 * Process all manually triggered pending scraping jobs (B2B queue consumer)
 */
export async function processPendingScrapeTasks() {
    try {
        const pendingRes = await db.query(
            `SELECT * FROM scrape_tasks WHERE status = 'PENDING' AND schedule IS NULL`
        );
        const pendingTasks = pendingRes.rows;

        for (const task of pendingTasks) {
            const affected = await db.query(
                `UPDATE scrape_tasks SET status = 'RUNNING', updated_at = NOW() 
                 WHERE id = $1 AND status = 'PENDING'`,
                [task.id]
            );

            if (affected.rowCount && affected.rowCount > 0) {
                console.log(`⚙️ Scraping Queue: Running manual scraping task ${task.id} ("${task.query}") in workspace ${task.workspace_id}`);
                await executeScrapingJob(task.id, task.workspace_id);
            }
        }
    } catch (error) {
        console.error("❌ Error processing pending scrape tasks:", error);
    }
}

/**
 * Periodically check for scheduled scraping tasks (simulating cron runs)
 */
export async function checkScheduledTasks() {
    const now = new Date();
    
    try {
        const scheduledRes = await db.query(
            `SELECT * FROM scrape_tasks WHERE schedule IS NOT NULL AND status != 'RUNNING'`
        );
        const scheduledTasks = scheduledRes.rows;

        for (const task of scheduledTasks) {
            // Parse simple mock schedule settings (hourly, daily, or demo 2m)
            const lastRun = task.updated_at || task.created_at || now;
            const elapsedMs = now.getTime() - new Date(lastRun).getTime();
            let shouldRun = false;

            if (task.schedule === "daily" && elapsedMs >= 24 * 60 * 60 * 1000) {
                shouldRun = true;
            } else if (task.schedule === "hourly" && elapsedMs >= 60 * 60 * 1000) {
                shouldRun = true;
            } else if (task.schedule === "demo" && elapsedMs >= 2 * 60 * 1000) { // every 2 mins for demo
                shouldRun = true;
            }

            if (shouldRun) {
                console.log(`⏰ Schedule Triggered: Running scheduled job "${task.query}" in workspace ${task.workspace_id}`);
                // Run job asynchronously
                executeScrapingJob(task.id, task.workspace_id).catch(err => console.error("Error executing scheduled task:", err));
            }
        }
    } catch (error) {
        console.error("❌ Error checking scheduled tasks:", error);
    }
}

// Helpers
function calculateDelayMs(value: number, unit: "m" | "h" | "d"): number {
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    if (unit === "h") return value * hour;
    if (unit === "d") return value * day;
    return value * minute;
}

function replaceTokens(text: string, lead: any): string {
    return text
        .replace(/{name}/g, lead.business_name)
        .replace(/{businessName}/g, lead.business_name)
        .replace(/{city}/g, lead.city || "your area")
        .replace(/{category}/g, lead.category || "service business");
}

async function logActivity(workspaceId: string, taskName: string, message: string, details?: any) {
    try {
        await db.query(
            `INSERT INTO automation_activity_logs (workspace_id, task_name, level, message, details)
             VALUES ($1, $2, 'INFO', $3, $4)`,
            [workspaceId, taskName, message, details ? JSON.stringify(details) : null]
        );
    } catch (err) {
        console.error("Failed to write activity log:", err);
    }
}

async function generateOutreachMessage(
    businessName: string,
    category: string,
    city: string,
    rating: number,
    competitorRating: number,
    promptInstruction: string,
    matchedPersona?: any,
    brandVoice?: any
): Promise<string> {
    const ai = getAI();
    if (!ai) {
        return `Mock B2B Outreach Message for ${businessName}:\n` +
               `Hello! We saw ${businessName} offering ${category} services in ${city}. ` +
               `We noticed you have a Google Maps rating of ${rating} while competitors average ${competitorRating}. ` +
               `We would love to help you grow. Best regards!`;
    }

    try {
        let systemInstruction = 'You are a master digital outreach and sales copywriting strategist.';
        if (brandVoice?.tone_of_voice) {
            systemInstruction += ` Your tone of voice is strictly: ${brandVoice.tone_of_voice}.`;
        }
        if (brandVoice?.value_proposition) {
            systemInstruction += ` Incorporate this value proposition naturally: ${brandVoice.value_proposition}.`;
        }

        let personaContext = '';
        if (matchedPersona) {
            personaContext = `
            Target Buyer Persona details:
            - Name/Role: ${matchedPersona.name} (${matchedPersona.role} in ${matchedPersona.industry})
            - Target Pain Points to solve: ${JSON.stringify(matchedPersona.pain_points)}
            - Core Goals: ${JSON.stringify(matchedPersona.goals)}
            - Handling Objections: ${JSON.stringify(matchedPersona.objections)}
            - Strategy: ${matchedPersona.copy_prompt}
            `;
        }

        const prompt = `
            Draft a high-converting B2B intro outreach copy (like an email or message) for:
            Business: "${businessName}"
            Category/Industry: "${category}"
            Location: "${city}"
            Current Rating: ${rating}
            Nearby Competitor Rating average: ${competitorRating}
            
            ${personaContext}

            Follow these instructions: ${promptInstruction}
            Keep it professional, engaging, short and directly addressing their performance.
            ${brandVoice?.forbidden_words?.length ? `DO NOT use any of these forbidden words: ${JSON.stringify(brandVoice.forbidden_words)}` : ''}
            ${brandVoice?.target_keywords?.length ? `Try to naturally include these keywords: ${JSON.stringify(brandVoice.target_keywords)}` : ''}
        `;

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { 
                systemInstruction
            }
        });

        return result.text?.trim() || "No text generated.";
    } catch (err) {
        console.error("Error generating outreach AI copy:", err);
        return `Outreach message generation error: ${err}`;
    }
}
