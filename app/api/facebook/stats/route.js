import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS facebook_messages (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'dm',
      sender_id VARCHAR(255),
      sender_name VARCHAR(255),
      message_text TEXT,
      ai_reply TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureTable();

    let messagesReplied = 0;
    let commentReplies = 0;
    let leadsFromFacebook = 0;
    let recentMessages = [];

    try {
      const r = await query(
        `SELECT COUNT(*) as count FROM facebook_messages
         WHERE user_id = $1 AND type = 'dm' AND created_at > NOW() - INTERVAL '30 days'`,
        [userId]
      );
      messagesReplied = parseInt(r.rows[0]?.count) || 0;
    } catch {}

    try {
      const r = await query(
        `SELECT COUNT(*) as count FROM facebook_messages
         WHERE user_id = $1 AND type = 'comment' AND created_at > NOW() - INTERVAL '30 days'`,
        [userId]
      );
      commentReplies = parseInt(r.rows[0]?.count) || 0;
    } catch {}

    try {
      const r = await query(
        `SELECT COUNT(*) as count FROM hot_leads hl
         JOIN customers c ON c.id = hl.customer_id
         WHERE c.clerk_user_id = $1 AND lower(hl.channel) = 'facebook'`,
        [userId]
      );
      leadsFromFacebook = parseInt(r.rows[0]?.count) || 0;
    } catch {}

    try {
      const r = await query(
        `SELECT type, sender_name, message_text, ai_reply, created_at
         FROM facebook_messages WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [userId]
      );
      recentMessages = r.rows;
    } catch {}

    return NextResponse.json({
      messagesReplied,
      commentReplies,
      leadsFromFacebook,
      avgResponseTime: '< 1 sec',
      recentMessages,
    });
  } catch (error) {
    console.error('❌ Facebook stats error:', error);
    return NextResponse.json({
      messagesReplied: 0, commentReplies: 0, leadsFromFacebook: 0,
      avgResponseTime: '< 1 sec', recentMessages: [],
    });
  }
}
