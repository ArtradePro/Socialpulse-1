import { pool } from './src/config/database';
import { AutomationEngineService } from './src/services/marketing/automationEngine.service';

async function runSimulation() {
  console.log('🔄 Starting SocialPulse Marketing Simulation...');

  // 1. Grab a workspace
  const workspaceRes = await pool.query('SELECT id FROM workspaces LIMIT 1');
  const workspace = workspaceRes.rows[0];
  if (!workspace) throw new Error('No workspace found in the database.');

  // 2. Create a temporary test contact
  const uniqueEmail = `vernon_${Date.now()}@example.com`;
  const contactRes = await pool.query(
    'INSERT INTO marketing_contacts (tenant_id, first_name, last_name, email, is_subscribed_email) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [workspace.id, 'Vernon', 'Tester', uniqueEmail, true]
  );
  const contactId = contactRes.rows[0].id;
  console.log(`✅ Created test contact: ${contactId}`);

  // 3. Seed an active automation rule
  const ruleQuery = `
    INSERT INTO marketing_automations (tenant_id, name, trigger_event, is_active, logic_payload)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT DO NOTHING;
  `;
  const logicPayload = JSON.stringify({
    action: 'send_email',
    template_subject: 'Welcome to SocialPulse!',
    template_body: 'Hi {{first_name}}, thanks for joining! Testing the automation engine.'
  });
  
  await pool.query(ruleQuery, [workspace.id, 'Test Lead Nurture', 'lead.captured', true, logicPayload]);
  console.log(`✅ Seeded 'lead.captured' automation rule.`);

  // 4. Fire the trigger!
  console.log('🚀 Firing lead.captured event...');
  await AutomationEngineService.triggerEvent('lead.captured', workspace.id, {
    contactId: contactId
  });

  console.log('✅ Event successfully queued! Switch to your Worker Terminal now.');
}

runSimulation().catch(console.error).finally(() => pool.end());