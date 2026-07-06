import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { query } from '@/lib/database.js';
import { submitTollfreeVerification } from '@/lib/tollfree-verification.js';

export const dynamic = 'force-dynamic';

// POST: re-attempt toll-free verification for the caller's assigned number.
// Used after a customer completes their business profile so activation can
// start immediately instead of waiting for the hourly retry job.
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await query(
      `SELECT twilio_sid, tfv_status FROM customer_phone_numbers
       WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    const number = result.rows[0];
    if (!number || !number.twilio_sid) {
      return NextResponse.json({ success: false, error: 'No active number found' }, { status: 404 });
    }

    // Already submitted or approved — nothing to retry.
    if (number.tfv_status && !['needs_info'].includes(number.tfv_status)) {
      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        verificationStatus: number.tfv_status,
      });
    }

    const submission = await submitTollfreeVerification({
      clerkUserId: userId,
      phoneNumberSid: number.twilio_sid,
    });

    return NextResponse.json({
      success: true,
      verificationSubmitted: submission.submitted,
      verificationNeedsInfo: submission.needsInfo || [],
      verificationStatus: submission.submitted ? 'PENDING_REVIEW' : 'needs_info',
    });
  } catch (error) {
    console.error('❌ TFV retry error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
