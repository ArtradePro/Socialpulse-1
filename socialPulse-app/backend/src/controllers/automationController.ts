import { Request, Response } from 'express';
import { db } from '../config/database';
import { 
    processPendingScrapeTasks, 
    processQueue, 
    checkScheduledTasks 
} from '../services/automationService';

// Trigger Google Maps scraping task
export const triggerScraping = async (req: Request, res: Response): Promise<void> => {
    try {
        const { query, location, limit } = req.body;
        const workspaceId = req.workspaceId;

        if (!query || !location) {
            res.status(400).json({ message: 'Query and location are required' });
            return;
        }

        const limitVal = parseInt(limit as string) || 20;

        const result = await db.query(
            `INSERT INTO scrape_tasks (workspace_id, query, location, limit_count, status)
             VALUES ($1, $2, $3, $4, 'PENDING') RETURNING *`,
            [workspaceId, query, location, limitVal]
        );

        const task = result.rows[0];

        // Process pending scrape tasks in background immediately
        processPendingScrapeTasks().catch(err => console.error('Error running pending scrape tasks:', err));

        res.status(201).json(task);
    } catch (error) {
        console.error('[AutomationController] triggerScraping error:', error);
        res.status(500).json({ message: 'Failed to trigger scraping task' });
    }
};

// Get all scraping tasks
export const getScrapeTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        const result = await db.query(
            'SELECT * FROM scrape_tasks WHERE workspace_id = $1 ORDER BY created_at DESC',
            [workspaceId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('[AutomationController] getScrapeTasks error:', error);
        res.status(500).json({ message: 'Failed to fetch scraping tasks' });
    }
};

// Get all scraped leads
export const getScrapedLeads = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        const result = await db.query(
            'SELECT * FROM scraped_leads WHERE workspace_id = $1 ORDER BY created_at DESC',
            [workspaceId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('[AutomationController] getScrapedLeads error:', error);
        res.status(500).json({ message: 'Failed to fetch scraped leads' });
    }
};

// Get all automation workflows
export const getWorkflows = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        const result = await db.query(
            'SELECT * FROM automation_workflows WHERE workspace_id = $1 ORDER BY created_at DESC',
            [workspaceId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('[AutomationController] getWorkflows error:', error);
        res.status(500).json({ message: 'Failed to fetch workflows' });
    }
};

// Create or update automation workflow
export const upsertWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, name, triggerType, isActive, steps } = req.body;
        const workspaceId = req.workspaceId;

        if (!name || !triggerType || !steps) {
            res.status(400).json({ message: 'Name, triggerType, and steps are required' });
            return;
        }

        const stepsStr = typeof steps === 'string' ? steps : JSON.stringify(steps);
        const activeVal = isActive !== undefined ? isActive : true;

        if (id) {
            // Update
            const result = await db.query(
                `UPDATE automation_workflows
                 SET name = $1, trigger_type = $2, is_active = $3, steps = $4, updated_at = NOW()
                 WHERE id = $5 AND workspace_id = $6 RETURNING *`,
                [name, triggerType, activeVal, stepsStr, id, workspaceId]
            );

            if (result.rows.length === 0) {
                res.status(404).json({ message: 'Workflow not found' });
                return;
            }
            res.json(result.rows[0]);
        } else {
            // Create
            const result = await db.query(
                `INSERT INTO automation_workflows (workspace_id, name, trigger_type, is_active, steps)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [workspaceId, name, triggerType, activeVal, stepsStr]
            );
            res.status(201).json(result.rows[0]);
        }
    } catch (error) {
        console.error('[AutomationController] upsertWorkflow error:', error);
        res.status(500).json({ message: 'Failed to save workflow' });
    }
};

// Toggle workflow active state
export const toggleWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const workspaceId = req.workspaceId;

        const result = await db.query(
            `UPDATE automation_workflows
             SET is_active = NOT is_active, updated_at = NOW()
             WHERE id = $1 AND workspace_id = $2 RETURNING *`,
            [id, workspaceId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Workflow not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[AutomationController] toggleWorkflow error:', error);
        res.status(500).json({ message: 'Failed to toggle workflow' });
    }
};

// Get activity logs
export const getActivityLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        const result = await db.query(
            'SELECT * FROM automation_activity_logs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100',
            [workspaceId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('[AutomationController] getActivityLogs error:', error);
        res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
};

// Get automation metrics
export const getMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;

        const totalLeadsRes = await db.query(
            'SELECT COUNT(*) FROM scraped_leads WHERE workspace_id = $1',
            [workspaceId]
        );
        const ingestedLeadsRes = await db.query(
            `SELECT COUNT(*) FROM scraped_leads WHERE workspace_id = $1 AND status = 'INGESTED'`,
            [workspaceId]
        );
        const activeWorkflowsRes = await db.query(
            'SELECT COUNT(*) FROM automation_workflows WHERE workspace_id = $1 AND is_active = true',
            [workspaceId]
        );
        const queueStatusRes = await db.query(
            'SELECT status, COUNT(*) FROM automation_queue WHERE workspace_id = $1 GROUP BY status',
            [workspaceId]
        );

        const queueMetrics: Record<string, number> = {
            PENDING: 0,
            PROCESSING: 0,
            COMPLETED: 0,
            FAILED: 0
        };

        queueStatusRes.rows.forEach((row: any) => {
            queueMetrics[row.status] = parseInt(row.count) || 0;
        });

        res.json({
            totalLeads: parseInt(totalLeadsRes.rows[0].count) || 0,
            ingestedLeads: parseInt(ingestedLeadsRes.rows[0].count) || 0,
            activeWorkflows: parseInt(activeWorkflowsRes.rows[0].count) || 0,
            queue: queueMetrics
        });
    } catch (error) {
        console.error('[AutomationController] getMetrics error:', error);
        res.status(500).json({ message: 'Failed to fetch metrics' });
    }
};

// Global cron / safety tick endpoint
export const runCronTick = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('⏰ Cron: Triggering global automation check...');
        
        // Process scheduled leads-gen tasks
        await checkScheduledTasks();
        
        // Process pending scraping queue tasks
        await processPendingScrapeTasks();

        // Process workflow messaging queues
        await processQueue();

        res.json({ message: 'Automation cron run completed successfully' });
    } catch (error: any) {
        console.error('❌ Cron execution error:', error);
        res.status(500).json({ message: 'Cron execution failed', error: error.message });
    }
};
