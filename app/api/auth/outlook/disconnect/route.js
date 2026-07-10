import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

// POST: disconnect the caller's Outlook connection(s).
// Rows are marked 'disconnected' rather than deleted so conversation
// history keeps its context; reconnecting the same mailbox re-activates
// it via the callback's upsert.
export async function POST() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await query(
      `UPDATE outlook_connections
       SET status = 'disconnected', updated_at = NOW()
       WHERE user_id = $1 AND status = 'connected'
       RETURNING outlook_email`,
      [userId]
    ).catch(() => ({ rows: [] }));

    console.log(`🔌 Outlook disconnected for ${userId}:`, result.rows.map(r => r.outlook_email).join(', ') || 'no active connection');

    return NextResponse.json({ success: true, disconnected: result.rows.length });
  } catch (error) {
    console.error('❌ Outlook disconnect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
