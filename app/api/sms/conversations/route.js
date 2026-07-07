import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '../../../../lib/database.js';

export const dynamic = 'force-dynamic';

function parseMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try { return JSON.parse(meta); } catch { return {}; }
  }
  return meta;
}

// SMS conversations for the signed-in customer, read from the shared
// conversations/messages tables (persisted by the SMS webhook).
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_phone TEXT`).catch(() => {});

    const result = await query(
      `SELECT c.id, c.contact_phone, c.created_at, c.status,
              COALESCE(json_agg(
                json_build_object(
                  'body', m.content,
                  'senderType', m.sender_type,
                  'createdAt', m.created_at,
                  'metadata', m.metadata
                ) ORDER BY m.created_at
              ) FILTER (WHERE m.id IS NOT NULL), '[]') AS msgs,
              MAX(m.created_at) AS last_message_at
       FROM conversations c
       LEFT JOIN messages m ON m.conversation_id = c.id
       WHERE c.type = 'sms' AND c.user_id = $1
       GROUP BY c.id
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT 50`,
      [userId]
    );

    let totalMessages = 0;
    const conversations = result.rows.map(row => {
      const msgs = (Array.isArray(row.msgs) ? row.msgs : []).map(m => {
        const meta = parseMeta(m.metadata);
        return {
          body: m.body,
          direction: m.senderType === 'user' ? 'inbound' : 'outbound',
          hotLeadScore: meta.hotLeadScore || 0,
          timestamp: m.createdAt,
        };
      });
      totalMessages += msgs.length;
      return {
        id: row.id,
        fromNumber: row.contact_phone,
        createdAt: row.created_at,
        status: row.status,
        // Every SMS conversation carries the caller's number = a captured lead
        leadCaptured: msgs.some(m => m.direction === 'inbound'),
        messages: msgs,
      };
    });

    return NextResponse.json({
      success: true,
      conversations,
      totalConversations: conversations.length,
      totalMessages,
      leadsGenerated: conversations.filter(c => c.leadCaptured).length,
    });
  } catch (error) {
    console.error('❌ SMS conversations error:', error);
    return NextResponse.json({ error: 'Failed to load SMS data' }, { status: 500 });
  }
}
