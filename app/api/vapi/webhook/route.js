import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, call } = body;

    if (!call?.id || !call?.assistantId) return NextResponse.json({ received: true });

    // Find which customer owns this assistant
    const ownerResult = await query(
      `SELECT clerk_user_id, customer_id FROM customer_phone_numbers
       WHERE vapi_assistant_id = $1 LIMIT 1`,
      [call.assistantId]
    ).catch(() => ({ rows: [] }));

    const owner = ownerResult.rows[0];
    if (!owner) return NextResponse.json({ received: true });

    if (type === 'end-of-call-report') {
      const durationSeconds = call.endedAt && call.startedAt
        ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
        : 0;

      await query(`
        INSERT INTO vapi_call_logs
          (customer_id, clerk_user_id, vapi_call_id, caller_phone, duration_seconds,
           status, transcript, summary, started_at, ended_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (vapi_call_id) DO UPDATE SET
          duration_seconds = EXCLUDED.duration_seconds,
          status           = EXCLUDED.status,
          transcript       = EXCLUDED.transcript,
          summary          = EXCLUDED.summary,
          ended_at         = EXCLUDED.ended_at
      `, [
        owner.customer_id,
        owner.clerk_user_id,
        call.id,
        call.customer?.number || null,
        durationSeconds,
        call.endedReason || 'completed',
        call.transcript || null,
        call.summary || null,
        call.startedAt ? new Date(call.startedAt) : null,
        call.endedAt ? new Date(call.endedAt) : null,
      ]).catch(err => console.error('⚠️ vapi_call_logs insert failed:', err.message));
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Vapi webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
