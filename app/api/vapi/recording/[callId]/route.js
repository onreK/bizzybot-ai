import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query, getCustomerByClerkId } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

/**
 * Streams a call recording to the dashboard.
 *
 * WHY THIS EXISTS RATHER THAN A DIRECT LINK. Vapi stores recordings in a
 * PRIVATE Cloudflare R2 bucket; the recordingUrl on the call report returns
 * 400 InvalidArgument/Authorization to anyone, including an <audio> tag. The
 * playable form is artifact.presignedMonoUrl — which carries
 * X-Amz-Expires=1800, so it is dead thirty minutes after the call ends.
 * Storing that URL would work in testing and break for every recording older
 * than half an hour.
 *
 * So the raw URL stays in vapi_call_logs as the marker that a recording
 * exists, and this route mints a fresh signed URL on each play.
 *
 * It also puts these recordings behind auth, which matters more than the
 * playback fix: they are audio of real conversations between a customer's
 * leads and their AI. A signed URL pasted into a chat would otherwise be
 * playable by anyone who received it. Here, a caller must be signed in AND
 * the call must belong to their own customer record.
 *
 * Redirects rather than proxying the bytes — R2 serves the audio directly,
 * so Railway carries none of the bandwidth and Range requests (seeking within
 * the recording) keep working.
 */
export async function GET(request, { params }) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { callId } = params;
    if (!callId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Ownership check: this customer's own calls only. Without it, any signed-in
    // customer could play any other customer's calls by guessing a call id.
    const owned = await query(
      `SELECT vapi_call_id FROM vapi_call_logs
       WHERE vapi_call_id = $1 AND customer_id = $2 LIMIT 1`,
      [callId, customer.id]
    ).catch(() => ({ rows: [] }));

    if (owned.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const vapiResponse = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: { Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}` },
    });

    if (!vapiResponse.ok) {
      console.error(`⚠️ [RECORDING] Vapi returned ${vapiResponse.status} for call ${callId}`);
      return NextResponse.json({ error: 'Recording unavailable' }, { status: 502 });
    }

    const call = await vapiResponse.json();
    const signedUrl = call?.artifact?.presignedMonoUrl || call?.artifact?.presignedStereoUrl;

    if (!signedUrl) {
      // Vapi can take a moment to finish writing the recording after a call.
      return NextResponse.json({ error: 'Recording not ready' }, { status: 404 });
    }

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error('❌ [RECORDING] failed:', error.message);
    return NextResponse.json({ error: 'Recording unavailable' }, { status: 500 });
  }
}
