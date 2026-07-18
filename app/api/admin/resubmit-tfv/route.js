import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';
import { submitTollfreeVerification } from '@/lib/tollfree-verification.js';

export const dynamic = 'force-dynamic';

// Admin ops tool: (re)submit a customer's toll-free verification.
// Server-to-server auth via CRON_SECRET (same pattern as /api/cron/run).
// Body: { clerkUserId, dryRun?: true } — dryRun logs and returns the exact
// payload without sending anything to Twilio.
export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clerkUserId, dryRun } = await request.json();
    if (!clerkUserId) {
      return NextResponse.json({ success: false, error: 'clerkUserId is required' }, { status: 400 });
    }

    const numberResult = await query(
      `SELECT twilio_sid, phone_number, tfv_status FROM customer_phone_numbers
       WHERE clerk_user_id = $1 ORDER BY assigned_at DESC NULLS LAST LIMIT 1`,
      [clerkUserId]
    );
    const number = numberResult.rows[0];
    if (!number) {
      return NextResponse.json({ success: false, error: 'No phone number found for that customer' }, { status: 404 });
    }

    const result = await submitTollfreeVerification({
      clerkUserId,
      phoneNumberSid: number.twilio_sid,
      dryRun: dryRun === true,
    });

    return NextResponse.json({
      success: true,
      phoneNumber: number.phone_number,
      previousStatus: number.tfv_status,
      ...result,
    });
  } catch (error) {
    console.error('❌ resubmit-tfv error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
