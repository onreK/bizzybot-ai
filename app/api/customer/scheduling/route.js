import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '../../../../lib/database.js';

export const dynamic = 'force-dynamic';

// Safely add booking_url column if it doesn't exist yet
async function ensureColumn() {
  await query(`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS booking_url TEXT,
    ADD COLUMN IF NOT EXISTS booking_auto_send BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS business_timezone TEXT
  `);
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureColumn();

    const result = await query(
      'SELECT booking_url, booking_auto_send FROM customers WHERE clerk_user_id = $1',
      [userId]
    );

    const row = result.rows[0] || {};
    return NextResponse.json({
      booking_url: row.booking_url || '',
      booking_auto_send: row.booking_auto_send !== false, // default true
    });
  } catch (error) {
    console.error('❌ GET /api/customer/scheduling:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { booking_url, booking_auto_send } = await req.json();

    await ensureColumn();

    await query(
      `UPDATE customers
       SET booking_url = $1, booking_auto_send = $2, updated_at = NOW()
       WHERE clerk_user_id = $3`,
      [booking_url || null, booking_auto_send !== false, userId]
    );

    console.log(`✅ Scheduling settings saved for user ${userId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/customer/scheduling:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
