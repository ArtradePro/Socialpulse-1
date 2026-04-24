import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let attempt = 0;
    while (true) {
        const { rows } = await db.query('SELECT id FROM workspaces WHERE slug = $1', [slug]);
        if (rows.length === 0) return slug;
        slug = `${base}-${++attempt}`;
    }
}

function assertMembership(req: Request, res: Response): string | null {
    const workspaceId = (req as any).workspaceId as string | undefined;
    if (!workspaceId) { res.status(400).json({ message: 'No active workspace — send X-Workspace-Id header' }); return null; }
    return workspaceId;
}

// ─── List user's workspaces ───────────────────────────────────────────────────

export const listWorkspaces = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const { rows } = await db.query(
            `SELECT w.*, wm.role
             FROM workspaces w
             JOIN workspace_members wm ON wm.workspace_id = w.id
             WHERE wm.user_id = $1
             ORDER BY w.created_at ASC`,
            [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error('[Workspaces] listWorkspaces:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Create workspace ─────────────────────────────────────────────────────────

export const createWorkspace = async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: 'Workspace name is required' }); return; }

    try {
        const userId = req.user!.userId;
        const slug   = await uniqueSlug(slugify(name.trim()));

        const { rows } = await db.query(
            `INSERT INTO workspaces (name, slug, owner_id)
             VALUES ($1, $2, $3) RETURNING *`,
            [name.trim(), slug, userId]
        );
        const workspace = rows[0];

        // Add creator as owner member
        await db.query(
            `INSERT INTO workspace_members (workspace_id, user_id, role)
             VALUES ($1, $2, 'owner')`,
            [workspace.id, userId]
        );

        res.status(201).json({ ...workspace, role: 'owner' });
    } catch (err) {
        console.error('[Workspaces] createWorkspace:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Get workspace detail + members ──────────────────────────────────────────

export const getWorkspace = async (req: Request, res: Response): Promise<void> => {
    const wid = assertMembership(req, res); if (!wid) return;
    try {
        const { rows: [workspace] } = await db.query('SELECT * FROM workspaces WHERE id = $1', [wid]);
        if (!workspace) { res.status(404).json({ message: 'Workspace not found' }); return; }

        const { rows: members } = await db.query(
            `SELECT wm.role, wm.created_at AS joined_at,
                    u.id, u.email, u.full_name, u.avatar_url
             FROM workspace_members wm
             JOIN users u ON u.id = wm.user_id
             WHERE wm.workspace_id = $1
             ORDER BY wm.created_at ASC`,
            [wid]
        );

        const { rows: invites } = await db.query(
            `SELECT id, email, role, created_at, expires_at
             FROM workspace_invites
             WHERE workspace_id = $1 AND accepted = false AND expires_at > NOW()
             ORDER BY created_at DESC`,
            [wid]
        );

        res.json({ ...workspace, role: (req as any).workspaceRole, members, pendingInvites: invites });
    } catch (err) {
        console.error('[Workspaces] getWorkspace:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Update workspace ─────────────────────────────────────────────────────────

export const updateWorkspace = async (req: Request, res: Response): Promise<void> => {
    const wid  = assertMembership(req, res); if (!wid) return;
    const role = (req as any).workspaceRole as string;
    if (!['owner', 'admin'].includes(role)) { res.status(403).json({ message: 'Admin or owner required' }); return; }

    const { name, logoUrl } = req.body;
    try {
        const { rows } = await db.query(
            `UPDATE workspaces
             SET name       = COALESCE($1, name),
                 logo_url   = COALESCE($2, logo_url),
                 updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [name ?? null, logoUrl ?? null, wid]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('[Workspaces] updateWorkspace:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Delete workspace ─────────────────────────────────────────────────────────

export const deleteWorkspace = async (req: Request, res: Response): Promise<void> => {
    const wid  = assertMembership(req, res); if (!wid) return;
    const role = (req as any).workspaceRole as string;
    if (role !== 'owner') { res.status(403).json({ message: 'Owner only' }); return; }

    try {
        await db.query('DELETE FROM workspaces WHERE id = $1', [wid]);
        res.status(204).send();
    } catch (err) {
        console.error('[Workspaces] deleteWorkspace:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Invite member ────────────────────────────────────────────────────────────

export const inviteMember = async (req: Request, res: Response): Promise<void> => {
    const wid  = assertMembership(req, res); if (!wid) return;
    const role = (req as any).workspaceRole as string;
    if (!['owner', 'admin'].includes(role)) { res.status(403).json({ message: 'Admin or owner required' }); return; }

    const { email, role: inviteRole = 'member' } = req.body;
    if (!email) { res.status(400).json({ message: 'Email is required' }); return; }

    try {
        // Check if already a member
        const { rows: existing } = await db.query(
            `SELECT wm.id FROM workspace_members wm
             JOIN users u ON u.id = wm.user_id
             WHERE wm.workspace_id = $1 AND u.email = $2`,
            [wid, email]
        );
        if (existing.length > 0) { res.status(409).json({ message: 'User is already a member' }); return; }

        const rawToken  = crypto.randomBytes(24).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await db.query(
            `INSERT INTO workspace_invites (workspace_id, email, role, token_hash, invited_by, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (token_hash) DO NOTHING`,
            [wid, email, inviteRole, tokenHash, req.user!.userId, expiresAt]
        );

        // If user already exists, add them directly
        const { rows: users } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (users.length > 0) {
            await db.query(
                `INSERT INTO workspace_members (workspace_id, user_id, role)
                 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [wid, users[0].id, inviteRole]
            );
            await db.query(
                'UPDATE workspace_invites SET accepted = true WHERE token_hash = $1',
                [tokenHash]
            );
            res.status(201).json({ message: 'Member added directly (user already has an account)' });
            return;
        }

        res.status(201).json({ message: 'Invite sent', token: rawToken });
    } catch (err) {
        console.error('[Workspaces] inviteMember:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Accept invite (public — no auth required) ────────────────────────────────

export const acceptWorkspaceInvite = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;
    const userId    = req.user?.userId;

    if (!userId) { res.status(401).json({ message: 'Login required to accept invite' }); return; }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const { rows } = await db.query(
            `SELECT * FROM workspace_invites
             WHERE token_hash = $1 AND accepted = false AND expires_at > NOW()`,
            [tokenHash]
        );
        if (rows.length === 0) { res.status(400).json({ message: 'Invalid or expired invite' }); return; }

        const invite = rows[0];
        await db.query(
            `INSERT INTO workspace_members (workspace_id, user_id, role)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [invite.workspace_id, userId, invite.role]
        );
        await db.query(
            'UPDATE workspace_invites SET accepted = true WHERE id = $1',
            [invite.id]
        );

        res.json({ message: 'Joined workspace', workspaceId: invite.workspace_id });
    } catch (err) {
        console.error('[Workspaces] acceptInvite:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Remove member ────────────────────────────────────────────────────────────

export const removeMember = async (req: Request, res: Response): Promise<void> => {
    const wid       = assertMembership(req, res); if (!wid) return;
    const callerRole = (req as any).workspaceRole as string;
    const { userId } = req.params;

    if (!['owner', 'admin'].includes(callerRole)) { res.status(403).json({ message: 'Admin or owner required' }); return; }
    if (userId === req.user!.userId) { res.status(400).json({ message: 'Cannot remove yourself' }); return; }

    try {
        await db.query(
            'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
            [wid, userId]
        );
        res.status(204).send();
    } catch (err) {
        console.error('[Workspaces] removeMember:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Update member role ───────────────────────────────────────────────────────

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
    const wid       = assertMembership(req, res); if (!wid) return;
    const callerRole = (req as any).workspaceRole as string;
    const { userId } = req.params;
    const { role }   = req.body;

    if (!['owner', 'admin'].includes(callerRole)) { res.status(403).json({ message: 'Admin or owner required' }); return; }
    if (!['admin', 'member', 'viewer'].includes(role)) { res.status(400).json({ message: 'Invalid role' }); return; }

    try {
        await db.query(
            'UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3',
            [role, wid, userId]
        );
        res.json({ message: 'Role updated' });
    } catch (err) {
        console.error('[Workspaces] updateMemberRole:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Update branding ─────────────────────────────────────────────────────────

export const updateBranding = async (req: Request, res: Response): Promise<void> => {
    const wid  = assertMembership(req, res); if (!wid) return;
    const role = (req as any).workspaceRole as string;
    if (!['owner', 'admin'].includes(role)) { res.status(403).json({ message: 'Admin or owner required' }); return; }

    const { brandName, brandColor, brandLogoUrl, customDomain } = req.body;
    try {
        const { rows } = await db.query(
            `UPDATE workspaces
             SET brand_name     = COALESCE($1, brand_name),
                 brand_color    = COALESCE($2, brand_color),
                 brand_logo_url = COALESCE($3, brand_logo_url),
                 custom_domain  = $4,
                 updated_at     = NOW()
             WHERE id = $5 RETURNING *`,
            [brandName ?? null, brandColor ?? null, brandLogoUrl ?? null, customDomain ?? null, wid]
        );
        res.json(rows[0]);
    } catch (err: any) {
        if (err.code === '23505') {
            res.status(409).json({ message: 'Custom domain is already in use' });
        } else {
            console.error('[Workspaces] updateBranding:', err);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

// ─── Get branding by domain (public) ─────────────────────────────────────────

export const getBrandingByDomain = async (req: Request, res: Response): Promise<void> => {
    const { domain } = req.params;
    try {
        const { rows } = await db.query(
            `SELECT id, name, brand_name, brand_color, brand_logo_url, slug
             FROM workspaces WHERE custom_domain = $1`,
            [domain]
        );
        if (rows.length === 0) { res.status(404).json({ message: 'Not found' }); return; }
        res.json(rows[0]);
    } catch (err) {
        console.error('[Workspaces] getBrandingByDomain:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─── Cancel pending invite ────────────────────────────────────────────────────

export const cancelInvite = async (req: Request, res: Response): Promise<void> => {
    const wid       = assertMembership(req, res); if (!wid) return;
    const callerRole = (req as any).workspaceRole as string;
    if (!['owner', 'admin'].includes(callerRole)) { res.status(403).json({ message: 'Admin or owner required' }); return; }

    try {
        await db.query(
            'DELETE FROM workspace_invites WHERE id = $1 AND workspace_id = $2',
            [req.params.inviteId, wid]
        );
        res.status(204).send();
    } catch (err) {
        console.error('[Workspaces] cancelInvite:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
