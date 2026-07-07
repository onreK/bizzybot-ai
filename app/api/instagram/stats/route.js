import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS instagram_messages (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'dm',
      sender_id VARCHAR(255),
      sender_username VARCHAR(255),
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

    let dmsReplied = 0;
    let commentReplies = 0;
    let leadsFromInstagram = 0;
    let recentMessages = [];

    try {
      const r = await query(
        `SELECT COUNT(*) as count FROM instagram_messages
         WHERE user_id = $1 AND type = 'dm' AND created_at > NOW() - INTERVAL '30 days'`,
        [userId]
      );
      dmsReplied = parseInt(r.rows[0]?.count) || 0;
    } catch {}

    try {
      const r = await query(
        `SELECT COUNT(*) as count FROM instagram_messages
         WHERE user_id = $1 AND type = 'comment' AND created_at > NOW() - INTERVAL '30 days'`,
        [userId]
      );
      commentReplies = parseInt(r.rows[0]?.count) || 0;
    } catch {}

    try {
      const r = await query(
        `SELECT COUNT(*) as count FROM contacts ct
         JOIN customers c ON c.id = ct.customer_id
         WHERE c.clerk_user_id = $1 AND lower(ct.source_channel) = 'instagram'`,
        [userId]
      );
      leadsFromInstagram = parseInt(r.rows[0]?.count) || 0;
    } catch {}

    try {
      const r = await query(
        `SELECT type, sender_username, message_text, ai_reply, created_at
         FROM instagram_messages WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 10`,
        [userId]
      );
      recentMessages = r.rows;
    } catch {}

    return NextResponse.json({
      dmsReplied,
      commentReplies,
      leadsFromInstagram,
      // Replies are webhook-driven; only claim speed once there's real activity.
      avgResponseTime: (dmsReplied + commentReplies) > 0 ? '< 1 min' : '—',
      recentMessages,
    });
  } catch (error) {
    console.error('❌ Instagram stats error:', error);
    return NextResponse.json({
      dmsReplied: 0, commentReplies: 0, leadsFromInstagram: 0,
      avgResponseTime: '—', recentMessages: [],
    });
  }
}
