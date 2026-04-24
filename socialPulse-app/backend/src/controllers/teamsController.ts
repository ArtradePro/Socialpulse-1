// backend/src/controllers/teamsController.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import { db, pool } from '../config/database';
import { EmailService } from '../services/email.service';
import { NotificationService } from '../services/notification.service';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ─── Teams CRUD ───────────────────────────────────────────────────────────────

export const listTeams = async (req: Request, res: Response): Promise<void> => {
    const { rows } = await db.query(
        `SELECT t.id, t.name, t.owner_id, t.created_at,
                tm.role AS my_role,
                (SELECT COUNT(*) FROM team_members tm2 WHERE tm2.team_id = t.id AND tm2.accepted = true)
                    AS member_count
         FROM teams t
         JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1 AND tm.accepted = true
         ORDER BY t.created_at DESC`,
        [req.user!.userId]
    );
    res.json(rows);
};

export const createTeam = async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body;
    if (!name) { res.status(400).json({ message: 'name is required' }); return; }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: team } = await client.query(
            'INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING *',
            [name, req.user!.userId]
        );
        // Add creator as owner member
        await client.query(
            `INSERT INTO team_members (team_id, user_id, role, accepted)
             VALUES ($1, $2, 'owner', true)`,
            [team[0].id, req.user!.userId]
        );
        await client.query('COMMIT');
        res.status(201).json({ ...team[0], my_role: 'owner', member_count: 1 });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const getTeam = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { rows: team } = await db.query('SELECT * FROM teams WHERE id = $1', [id]);
    if (!team[0]) { res.status(404).json({ message: 'Not found' }); return; }

    const { rows: members } = await db.query(
        `SELECT tm.id, tm.role, tm.accepted, tm.created_at,
                u.id AS user_id, u.email, u.full_name, u.avatar_url
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = $1
         ORDER BY CASE tm.role
             WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END, u.full_name`,
        [id]
    );

    const { rows: invites } = await db.query(
        `SELECT id, email, role, accepted, created_at, expires_at
         FROM team_invites WHERE team_id = $1 AND accepted = false AND expires_at > NOW()`,
        [id]
    );

    res.json({ ...team[0], my_role: req.teamRole, members, pending_invites: invites });
};

export const updateTeam = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name } = req.body;
    const { rows } = await db.query(
        'UPDATE teams SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [name, id]
    );
    res.json(rows[0]);
};

export const deleteTeam = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await db.query('DELETE FROM teams WHERE id = $1', [id]);
    res.status(204).send();
};

// ─── Invite ──────────────────────────────────────────────────────────────────

export const inviteMember = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { email, role = 'member' } = req.body;
    if (!email) { res.status(400).json({ message: 'email is required' }); return; }

    // If user already exists and is a member, skip
    const existing = await db.query(
        `SELECT tm.id FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = $1 AND u.email = $2`,
        [id, email]
    );
    if (existing.rows[0]) {
        res.status(400).json({ message: 'User is already a team member' });
        return;
    }

    const rawToken  = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Invalidate previous invite for same email+team
    await db.query(
        'UPDATE team_invites SET accepted = true WHERE team_id = $1 AND email = $2',
        [id, email]
    );

    const { rows: invite } = await db.query(
        `INSERT INTO team_invites (team_id, email, role, token_hash, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role, created_at`,
        [id, email, role, tokenHash, req.user!.userId, expiresAt]
    );

    const { rows: team } = await db.query('SELECT name FROM teams WHERE id = $1', [id]);
    const link = `${FRONTEND_URL}/team-invite/${rawToken}`;
    const inviterEmail = req.user!.email;

    // Send invite email
    await EmailService.sendTeamInvite(
        email, inviterEmail, team[0]?.name ?? 'the team', role, link
    ).catch(console.error);

    // In-app notification if the invited user already has an account
    const { rows: invitedUser } = await db.query(
        'SELECT id FROM users WHERE email = $1', [email]
    );
    if (invitedUser[0]) {
        NotificationService.create({
            userId:  invitedUser[0].id,
            type:    'team_invite',
            title:   'Team invitation',
            message: `${inviterEmail} invited you to join ${team[0]?.name ?? 'a team'} as ${role}`,
            link:    `/team-invite/${rawToken}`,
        }).catch(console.error);
    }

    res.status(201).json(invite[0]);
};

export const acceptInvite = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await db.query(
        `SELECT ti.*, t.name AS team_name
         FROM team_invites ti JOIN teams t ON t.id = ti.team_id
         WHERE ti.token_hash = $1 AND ti.accepted = false AND ti.expires_at > NOW()`,
        [tokenHash]
    );
    if (!rows[0]) {
        res.status(400).json({ message: 'Invalid or expired invite link' });
        return;
    }
    const invite = rows[0];

    // Find or create user
    const { rows: users } = await db.query(
        'SELECT id FROM users WHERE email = $1', [invite.email]
    );
    if (!users[0]) {
        // User doesn't have an account yet — redirect to register
        res.json({
            requiresRegistration: true,
            email: invite.email,
            teamName: invite.team_name,
        });
        return;
    }
    const userId = users[0].id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO team_members (team_id, user_id, role, invited_by, accepted)
             VALUES ($1, $2, $3, $4, true)
             ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role, accepted = true`,
            [invite.team_id, userId, invite.role, invite.invited_by]
        );
        await client.query('UPDATE team_invites SET accepted = true WHERE id = $1', [invite.id]);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    res.json({ teamId: invite.team_id, teamName: invite.team_name, role: invite.role });
};

export const cancelInvite = async (req: Request, res: Response): Promise<void> => {
    const { id, inviteId } = req.params;
    const { rowCount } = await db.query(
        'DELETE FROM team_invites WHERE id = $1 AND team_id = $2 AND accepted = false',
        [inviteId, id]
    );
    if (!rowCount) { res.status(404).json({ message: 'Invite not found' }); return; }
    res.status(204).send();
};

// ─── Manage members ──────────────────────────────────────────────────────────

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
    const { id, userId } = req.params;
    const { role } = req.body;
    const validRoles = ['viewer', 'member', 'admin'];
    if (!validRoles.includes(role)) {
        res.status(400).json({ message: `role must be one of: ${validRoles.join(', ')}` });
        return;
    }

    // Cannot demote the owner
    const { rows: target } = await db.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [id, userId]
    );
    if (target[0]?.role === 'owner') {
        res.status(400).json({ message: 'Cannot change the owner role' });
        return;
    }

    await db.query(
        'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
        [role, id, userId]
    );
    res.json({ role });
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
    const { id, userId } = req.params;
    const { rows: target } = await db.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [id, userId]
    );
    if (target[0]?.role === 'owner') {
        res.status(400).json({ message: 'Cannot remove the team owner' });
        return;
    }

    await db.query(
        'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [id, userId]
    );
    res.status(204).send();
};
