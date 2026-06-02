import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';
import { createAssistant, updateAssistant, registerTwilioNumber, buildVoiceSystemPrompt } from '@/lib/vapi.js';

export const dynamic = 'force-dynamic';

async function ensureVapiSchema() {
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT`).catch(() => {});
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT`).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS vapi_call_logs (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      clerk_user_id TEXT,
      vapi_call_id TEXT UNIQUE,
      caller_phone TEXT,
      duration_seconds INTEGER DEFAULT 0,
      status TEXT,
      transcript TEXT,
      summary TEXT,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
}

async function getVoiceSettings(customerId) {
  const result = await query(
    `SELECT business_name, business_description, knowledge_base, custom_instructions, response_tone
     FROM ai_channel_settings WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
    [customerId]
  ).catch(() => ({ rows: [] }));
  // Fall back to 'text' settings if voice not yet seeded
  if (result.rows.length === 0) {
    const fallback = await query(
      `SELECT business_name, business_description, knowledge_base, custom_instructions, response_tone
       FROM ai_channel_settings WHERE customer_id = $1 AND channel = 'text' LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    return fallback.rows[0] || {};
  }
  return result.rows[0];
}

// POST: initial provision (called automatically after SMS number is assigned)
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureVapiSchema();

    const numberResult = await query(
      `SELECT cpn.id, cpn.phone_number, cpn.vapi_assistant_id, cpn.vapi_phone_number_id, c.id as customer_id
       FROM customer_phone_numbers cpn
       JOIN customers c ON c.clerk_user_id = $1
       WHERE cpn.clerk_user_id = $1 AND cpn.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (numberResult.rows.length === 0) {
      return NextResponse.json({ error: 'No active phone number. Provision SMS number first.' }, { status: 400 });
    }

    const row = numberResult.rows[0];

    if (row.vapi_assistant_id && row.vapi_phone_number_id) {
      return NextResponse.json({ success: true, assistantId: row.vapi_assistant_id, alreadyProvisioned: true });
    }

    const s = await getVoiceSettings(row.customer_id);
    const businessName = s.business_name || 'this business';
    const systemPrompt = buildVoiceSystemPrompt(s);

    const assistant = await createAssistant({ businessName, systemPrompt });
    const vapiNumber = await registerTwilioNumber(row.phone_number, assistant.id);

    await query(
      `UPDATE customer_phone_numbers
       SET vapi_assistant_id = $1, vapi_phone_number_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [assistant.id, vapiNumber.id, row.id]
    );

    console.log(`✅ Vapi provisioned for ${userId}: assistant=${assistant.id}`);
    return NextResponse.json({ success: true, assistantId: assistant.id });

  } catch (error) {
    console.error('❌ Vapi provision error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: sync updated AI settings to existing Vapi assistant
export async function PATCH(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const numberResult = await query(
      `SELECT cpn.vapi_assistant_id, c.id as customer_id
       FROM customer_phone_numbers cpn
       JOIN customers c ON c.clerk_user_id = $1
       WHERE cpn.clerk_user_id = $1 AND cpn.status = 'active' AND cpn.vapi_assistant_id IS NOT NULL
       LIMIT 1`,
      [userId]
    );

    if (numberResult.rows.length === 0) {
      return NextResponse.json({ error: 'No Vapi assistant found. Provision voice AI first.' }, { status: 400 });
    }

    const row = numberResult.rows[0];
    const s = await getVoiceSettings(row.customer_id);
    const businessName = s.business_name || 'this business';
    const systemPrompt = buildVoiceSystemPrompt(s);

    await updateAssistant(row.vapi_assistant_id, { businessName, systemPrompt });

    console.log(`✅ Vapi assistant updated for ${userId}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Vapi sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: return provisioning status
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureVapiSchema();

    const result = await query(
      `SELECT phone_number, vapi_assistant_id, vapi_phone_number_id
       FROM customer_phone_numbers
       WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length === 0) return NextResponse.json({ provisioned: false, hasNumber: false });

    const row = result.rows[0];
    return NextResponse.json({
      provisioned: !!(row.vapi_assistant_id && row.vapi_phone_number_id),
      hasNumber: true,
      phoneNumber: row.phone_number,
      assistantId: row.vapi_assistant_id || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
