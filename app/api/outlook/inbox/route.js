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
        oc.conversation_id
      FROM outlook_messages om
      JOIN outlook_conversations oc ON oc.id = om.conversation_id
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
    }));

    return NextResponse.json({ success: true, emails });
  } catch (error) {
    console.error('❌ Outlook inbox error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
