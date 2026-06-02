import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';
import { createOrUpdateContact, trackLeadEvent, updateLeadScoring } from '@/lib/leads-service.js';
import crypto from 'crypto';

export async function POST(request) {
  try {
    // Verify Vapi sent this — reject anything without the shared secret
    const incomingSecret = request.headers.get('x-vapi-secret');
    const expectedSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (!expectedSecret || !incomingSecret ||
        !crypto.timingSafeEqual(Buffer.from(incomingSecret), Buffer.from(expectedSecret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

      const callerPhone = call.customer?.number || null;
      const transcript = call.transcript || null;
      const summary = call.summary || null;
      const endedReason = call.endedReason || 'completed';

      // 1. Save call log
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
        callerPhone,
        durationSeconds,
        endedReason,
        transcript,
        summary,
        call.startedAt ? new Date(call.startedAt) : null,
        call.endedAt ? new Date(call.endedAt) : null,
      ]).catch(err => console.error('⚠️ vapi_call_logs insert failed:', err.message));

      // 2. Create/update contact + track lead event
      if (callerPhone) {
        const hotScore = scoreTranscript(transcript);
        const isHot = hotScore >= 70;

        const contactResult = await createOrUpdateContact(owner.customer_id, {
          phone: callerPhone,
          source_channel: 'voice',
        }).catch(() => null);

        // 3. Track lead event in analytics
        await trackLeadEvent(owner.customer_id, {
          type: 'call_received',
          channel: 'voice',
          phone: callerPhone,
          message: summary || transcript?.slice(0, 500) || 'Inbound voice call',
        }).catch(() => {});

        // 4. Re-score lead if transcript has buying signals
        if (isHot && contactResult?.contact?.id) {
          await updateLeadScoring(owner.customer_id, contactResult.contact.id).catch(() => {});
          console.log(`🔥 Hot voice lead detected for ${callerPhone} (score: ${hotScore})`);
        }
      }

      console.log(`✅ Vapi call processed: ${call.id}, duration=${durationSeconds}s, caller=${callerPhone}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Vapi webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Score a call transcript for hot lead signals (0-100)
function scoreTranscript(transcript) {
  if (!transcript) return 0;

  const text = transcript.toLowerCase();
  const HOT_KEYWORDS = [
    'ready to start', 'ready to buy', 'how much', 'what does it cost', 'price',
    'pricing', 'budget', 'can we schedule', 'schedule a', 'when can you',
    'asap', 'urgent', 'immediately', 'this week', 'today', 'tomorrow',
    'move forward', 'next steps', 'sign up', 'get started', 'book',
    'appointment', 'available', 'buy', 'purchase', 'hire', 'interested',
    'serious', 'definitely', 'absolutely', 'yes', 'sounds good',
  ];

  const matches = HOT_KEYWORDS.filter(kw => text.includes(kw)).length;

  // Base score: 30 points for any call (calling = intent signal)
  // +5 per hot keyword match, capped at 100
  return Math.min(100, 30 + matches * 5);
}
