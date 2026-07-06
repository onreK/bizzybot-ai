import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs';
import { query } from '@/lib/database.js';
import { ensureVerificationInfoTable } from '@/lib/tollfree-verification.js';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['SOLE_PROPRIETOR', 'PRIVATE_PROFIT', 'PUBLIC_PROFIT', 'NON_PROFIT', 'GOVERNMENT'];

// GET: read the caller's saved verification info (business type + EIN)
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureVerificationInfoTable();
    const result = await query(
      `SELECT business_type, registration_number FROM sms_verification_info WHERE clerk_user_id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    const row = result.rows[0] || {};
    return NextResponse.json({
      success: true,
      businessType: row.business_type || '',
      ein: row.registration_number || '',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: save the caller's verification info
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { businessType, ein } = await request.json();

    if (!businessType || !VALID_TYPES.includes(businessType)) {
      return NextResponse.json({ success: false, error: 'Please select a valid business type' }, { status: 400 });
    }
    if (businessType !== 'SOLE_PROPRIETOR' && !(ein || '').trim()) {
      return NextResponse.json({ success: false, error: 'EIN is required for this business type' }, { status: 400 });
    }

    // Strip everything but digits from the EIN (Twilio wants the raw number).
    const cleanEin = businessType === 'SOLE_PROPRIETOR' ? null : (ein || '').replace(/\D/g, '');

    // Contact person for the verification — pulled from the account so the
    // customer doesn't have to type it.
    const user = await currentUser().catch(() => null);
    const firstName = user?.firstName || '';
    const lastName = user?.lastName || '';

    await ensureVerificationInfoTable();
    await query(
      `INSERT INTO sms_verification_info
         (clerk_user_id, business_type, registration_number, contact_first_name, contact_last_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (clerk_user_id) DO UPDATE SET
         business_type = EXCLUDED.business_type,
         registration_number = EXCLUDED.registration_number,
         contact_first_name = COALESCE(NULLIF(EXCLUDED.contact_first_name, ''), sms_verification_info.contact_first_name),
         contact_last_name = COALESCE(NULLIF(EXCLUDED.contact_last_name, ''), sms_verification_info.contact_last_name),
         updated_at = NOW()`,
      [userId, businessType, cleanEin, firstName, lastName]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Save verification info error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
