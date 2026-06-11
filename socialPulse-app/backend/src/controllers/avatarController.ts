import { Request, Response } from 'express';
import { db } from '../config/database';
import { 
    getTemplates, 
    createFromTemplate, 
    generateAvatarProfile, 
    generateAvatarCopy, 
    syncClarityFile 
} from '../services/avatarService';

// Get templates
export const listTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
        const templates = getTemplates();
        res.json(templates);
    } catch (error) {
        console.error('[AvatarController] listTemplates error:', error);
        res.status(500).json({ message: 'Failed to fetch templates' });
    }
};

// Create from template
export const useTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { templateKey } = req.body;
        const workspaceId = req.workspaceId;

        if (!templateKey) {
            res.status(400).json({ message: 'templateKey is required' });
            return;
        }

        const persona = await createFromTemplate(workspaceId!, templateKey);
        res.status(201).json(persona);
    } catch (error: any) {
        console.error('[AvatarController] useTemplate error:', error);
        res.status(500).json({ message: error.message || 'Failed to create persona from template' });
    }
};

// Generate custom avatar
export const generateCustomAvatar = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, role, industry } = req.body;
        const workspaceId = req.workspaceId;

        if (!name || !role || !industry) {
            res.status(400).json({ message: 'name, role, and industry are required' });
            return;
        }

        const persona = await generateAvatarProfile(workspaceId!, name, role, industry);
        res.status(201).json(persona);
    } catch (error: any) {
        console.error('[AvatarController] generateCustomAvatar error:', error);
        res.status(500).json({ message: error.message || 'Failed to generate custom avatar' });
    }
};

// List buyer personas for workspace
export const listPersonas = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        const result = await db.query(
            'SELECT * FROM buyer_personas WHERE workspace_id = $1 ORDER BY created_at DESC',
            [workspaceId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('[AvatarController] listPersonas error:', error);
        res.status(500).json({ message: 'Failed to fetch personas' });
    }
};

// Delete persona
export const deletePersona = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const workspaceId = req.workspaceId;

        const result = await db.query(
            'DELETE FROM buyer_personas WHERE id = $1 AND workspace_id = $2 RETURNING id',
            [id, workspaceId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Persona not found' });
            return;
        }

        await syncClarityFile(workspaceId!);
        res.status(204).send();
    } catch (error) {
        console.error('[AvatarController] deletePersona error:', error);
        res.status(500).json({ message: 'Failed to delete persona' });
    }
};

// Toggle active state
export const togglePersonaActive = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const workspaceId = req.workspaceId;

        const result = await db.query(
            `UPDATE buyer_personas SET is_active = NOT is_active, updated_at = NOW()
             WHERE id = $1 AND workspace_id = $2 RETURNING *`,
            [id, workspaceId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ message: 'Persona not found' });
            return;
        }

        await syncClarityFile(workspaceId!);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[AvatarController] togglePersonaActive error:', error);
        res.status(500).json({ message: 'Failed to toggle persona active state' });
    }
};

// Get brand voice
export const getBrandVoice = async (req: Request, res: Response): Promise<void> => {
    try {
        const workspaceId = req.workspaceId;
        const result = await db.query(
            'SELECT * FROM brand_voices WHERE workspace_id = $1',
            [workspaceId]
        );

        if (result.rows.length === 0) {
            res.json({
                workspace_id: workspaceId,
                tone_of_voice: 'professional, friendly',
                value_proposition: '',
                target_keywords: [],
                forbidden_words: []
            });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('[AvatarController] getBrandVoice error:', error);
        res.status(500).json({ message: 'Failed to fetch brand voice' });
    }
};

// Upsert brand voice
export const upsertBrandVoice = async (req: Request, res: Response): Promise<void> => {
    try {
        const { toneOfVoice, valueProposition, targetKeywords, forbiddenWords } = req.body;
        const workspaceId = req.workspaceId;

        const keywords = Array.isArray(targetKeywords) ? targetKeywords : [];
        const forbidden = Array.isArray(forbiddenWords) ? forbiddenWords : [];

        const result = await db.query(
            `INSERT INTO brand_voices (workspace_id, tone_of_voice, value_proposition, target_keywords, forbidden_words, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (workspace_id) DO UPDATE
             SET tone_of_voice = EXCLUDED.tone_of_voice,
                 value_proposition = EXCLUDED.value_proposition,
                 target_keywords = EXCLUDED.target_keywords,
                 forbidden_words = EXCLUDED.forbidden_words,
                 updated_at = NOW()
             RETURNING *`,
            [workspaceId, toneOfVoice || 'professional, friendly', valueProposition || '', keywords, forbidden]
        );

        await syncClarityFile(workspaceId!);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[AvatarController] upsertBrandVoice error:', error);
        res.status(500).json({ message: 'Failed to save brand voice' });
    }
};

// Write targeted copy
export const writeTargetedCopy = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { topic, platform } = req.body;
        const workspaceId = req.workspaceId;

        if (!topic || !platform) {
            res.status(400).json({ message: 'topic and platform are required' });
            return;
        }

        const copy = await generateAvatarCopy(workspaceId!, id, topic, platform);
        res.json({ copy });
    } catch (error: any) {
        console.error('[AvatarController] writeTargetedCopy error:', error);
        res.status(500).json({ message: error.message || 'Failed to generate targeted copy' });
    }
};
