import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const VOICE_LIMITS = { starter: 15, professional: 100, business: 400 };

    const customerResult = await query(
      `SELECT id, plan FROM customers WHERE clerk_user_id = $1 LIMIT 1`, [userId]
    ).catch(() => ({ rows: [] }));

    const customer = customerResult.rows[0];
    const customerId = customer?.id;
    const minutesLimit = VOICE_LIMITS[customer?.plan] ?? 15;

    if (!customerId) return NextResponse.json({ calls: [], minutesUsed: 0, minutesLimit: 15, plan: 'starter' });

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const [logsResult, monthlyResult] = await Promise.all([
      query(
        `SELECT vapi_call_id, caller_phone, duration_seconds, status, transcript, summary, started_at, ended_at
         FROM vapi_call_logs
         WHERE customer_id = $1 OR clerk_user_id = $2
         ORDER BY started_at DESC NULLS LAST
         LIMIT 100`,
        [customerId, userId]
      ).catch(() => ({ rows: [] })),

      query(
        `SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds
         FROM vapi_call_logs
         WHERE (customer_id = $1 OR clerk_user_id = $2) AND started_at >= $3`,
        [customerId, userId, firstOfMonth.toISOString()]
      ).catch(() => ({ rows: [{ total_seconds: 0 }] })),
    ]);

    const totalSeconds = parseInt(monthlyResult.rows[0]?.total_seconds || 0);
    const minutesUsed = Math.ceil(totalSeconds / 60);

    return NextResponse.json({
      calls: logsResult.rows,
      minutesUsed,
      minutesLimit,
      plan: customer?.plan || 'starter',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
