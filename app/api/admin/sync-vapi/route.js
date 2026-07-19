import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';
import { updateAssistant, buildVoiceSystemPrompt } from '@/lib/vapi.js';

export const dynamic = 'force-dynamic';

// Admin ops tool: push a customer's current voice settings to their Vapi
// assistant without a browser session. Auth: Bearer CRON_SECRET (same
// pattern as /api/cron/run and /api/admin/resubmit-tfv).
export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clerkUserId } = await request.json();
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: 'clerkUserId is required' }, { status: 400 });
    }

    const numberResult = await query(
      `SELECT cpn.vapi_assistant_id, COALESCE(cpn.customer_id, c.id) AS customer_id
       FROM customer_phone_numbers cpn
       LEFT JOIN customers c ON (c.clerk_user_id::text = $1 OR c.user_id::text = $1)
       WHERE cpn.clerk_user_id = $1 AND cpn.status = 'active' AND cpn.vapi_assistant_id IS NOT NULL
       LIMIT 1`,
      [clerkUserId]
    );
    const row = numberResult.rows[0];
    if (!row) {
      return NextResponse.json({ success: false, error: 'No Vapi assistant found' }, { status: 404 });
    }

    const sResult = await query(
      `SELECT business_name, business_description, knowledge_base, custom_instructions, response_tone, documents
       FROM ai_channel_settings WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
      [row.customer_id]
    );
    const s = sResult.rows[0] || {};
    const businessName = s.business_name || 'this business';
    await updateAssistant(row.vapi_assistant_id, { businessName, systemPrompt: buildVoiceSystemPrompt(s) });

    console.log(`✅ Vapi assistant synced via admin route for ${clerkUserId}`);
    return NextResponse.json({ success: true, assistantId: row.vapi_assistant_id });
  } catch (error) {
    console.error('❌ sync-vapi error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
