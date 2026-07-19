import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';
import { getTriageForCustomer, recordCorrection } from '@/lib/intent-triage-store.js';

export const dynamic = 'force-dynamic';

async function getCustomerId(userId) {
  const result = await query(
    `SELECT id FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] }));
  return result.rows[0]?.id || null;
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const customerId = await getCustomerId(userId);
    if (!customerId) return NextResponse.json({ success: true, triage: [] });

    const rows = await getTriageForCustomer(customerId);
    return NextResponse.json({
      success: true,
      triage: rows.map(r => ({
        channel: r.channel,
        messageId: r.message_id,
        threadId: r.thread_id,
        contactEmail: r.contact_email,
        subject: r.subject,
        class: r.class,
        confidence: r.confidence,
        reason: r.reason,
        action: r.action,
        correctedClass: r.corrected_class,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('❌ Triage GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const customerId = await getCustomerId(userId);
    if (!customerId) return NextResponse.json({ error: 'No customer record' }, { status: 404 });

    const { channel, messageId, correction } = await request.json();
    if (!['gmail', 'outlook'].includes(channel) || !messageId || !['lead', 'not_lead'].includes(correction)) {
      return NextResponse.json({ error: 'channel, messageId and correction (lead|not_lead) are required' }, { status: 400 });
    }

    const correctedClass = correction === 'lead' ? 'new_lead' : 'business_correspondence';
    const result = await recordCorrection({ customerId, channel, messageId, correctedClass });
    if (!result.success) {
      return NextResponse.json({ error: 'Triage record not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, correctedClass });
  } catch (error) {
    console.error('❌ Triage POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
