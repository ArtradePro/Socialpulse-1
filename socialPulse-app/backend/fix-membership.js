const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'socialpulse',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function fix() {
  console.log('Connecting to PostgreSQL...');
  const client = await pool.connect();

  try {
    const userId = '5a18033d-caa2-4f3f-92ae-cb6575286d15';
    const workspaceId = 'bf483306-c39c-494b-a3f2-6e36cd543de6';

    console.log('\n--- Checking User ---');
    const userRes = await client.query('SELECT id, email, full_name FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      console.log(`User ${userId} not found in database! Let's check all users:`);
      const allUsers = await client.query('SELECT id, email, full_name FROM users');
      console.table(allUsers.rows);
      if (allUsers.rows.length === 0) {
        console.log('No users found in database.');
        return;
      }
    } else {
      console.log('User found:', userRes.rows[0]);
    }

    console.log('\n--- Checking Workspaces ---');
    const wsRes = await client.query('SELECT id, name, owner_id FROM workspaces');
    console.table(wsRes.rows);

    let targetWorkspaceId = workspaceId;
    const wsExists = wsRes.rows.some(w => w.id === workspaceId);

    if (!wsExists) {
      console.log(`Workspace ${workspaceId} not found in database.`);
      if (wsRes.rows.length > 0) {
        targetWorkspaceId = wsRes.rows[0].id;
        console.log(`Will use first available workspace instead: ${targetWorkspaceId}`);
      } else {
        console.log('Creating a default workspace...');
        const actualUserId = userRes.rows[0]?.id || (await client.query('SELECT id FROM users LIMIT 1')).rows[0]?.id;
        if (!actualUserId) {
          console.error('Cannot create workspace because no users exist.');
          return;
        }
        const newWs = await client.query(
          `INSERT INTO workspaces (id, name, owner_id) VALUES ($1, $2, $3) RETURNING id, name`,
          [workspaceId, 'Default Workspace', actualUserId]
        );
        console.log('Created default workspace:', newWs.rows[0]);
        targetWorkspaceId = newWs.rows[0].id;
      }
    }

    const actualUserId = userRes.rows[0]?.id || (await client.query('SELECT id FROM users LIMIT 1')).rows[0]?.id;

    console.log(`\n--- Linking User ${actualUserId} to Workspace ${targetWorkspaceId} ---`);
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) 
       VALUES ($1, $2, 'owner') 
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'`,
      [targetWorkspaceId, actualUserId]
    );
    console.log('✓ Successfully linked and configured user as owner of the workspace!');

    console.log('\n--- Active Memberships ---');
    const membersRes = await client.query(
      `SELECT m.workspace_id, w.name as workspace_name, m.user_id, u.email, m.role 
       FROM workspace_members m 
       JOIN workspaces w ON m.workspace_id = w.id 
       JOIN users u ON m.user_id = u.id`
    );
    console.table(membersRes.rows);

  } catch (err) {
    console.error('Failed to fix membership:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fix();
