import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await query(`
      SELECT
        om.id,
        om.outlook_message_id,
        om.content,
        om.ai_response,
        om.created_at,
        oc.contact_email,
        oc.contact_name,
        oc.subject,
        oc.conversation_id,
        et.class      AS triage_class,
        et.confidence AS triage_confidence,
        et.reason     AS triage_reason,
        et.action     AS triage_action,
        et.corrected_class AS triage_corrected_class
      FROM outlook_messages om
      JOIN outlook_conversations oc ON oc.id = om.conversation_id
      LEFT JOIN email_triage et
        ON et.channel = 'outlook' AND et.message_id = om.outlook_message_id
      WHERE oc.clerk_user_id = $1 AND om.direction = 'inbound'
      ORDER BY om.created_at DESC
      LIMIT 50
    `, [userId]).catch(() => ({ rows: [] }));

    const emails = result.rows.map(row => ({
      id: `outlook_${row.id}`,
      outlookMessageId: row.outlook_message_id,
      fromName: row.contact_name || row.contact_email?.split('@')[0] || 'Unknown',
      fromEmail: row.contact_email || '',
      subject: row.subject || '(No subject)',
      snippet: (row.content || '').slice(0, 150),
      body: (row.content || '').slice(0, 150),
      fullBody: row.content || '',
      aiReply: row.ai_response || '',
      receivedTime: timeAgo(row.created_at),
      receivedAt: row.created_at,
      source: 'outlook',
      triage: row.triage_class ? {
        class: row.triage_class,
        confidence: row.triage_confidence,
        reason: row.triage_reason,
        action: row.triage_action,
        correctedClass: row.triage_corrected_class,
      } : null,
    }));

    return NextResponse.json({ success: true, emails });
  } catch (error) {
    console.error('❌ Outlook inbox error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
