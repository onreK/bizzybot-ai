import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import twilio from 'twilio';
import { query } from '@/lib/database.js';

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS customer_phone_numbers (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      clerk_user_id TEXT,
      phone_number TEXT UNIQUE NOT NULL,
      twilio_sid TEXT,
      friendly_name TEXT,
      status TEXT DEFAULT 'available',
      assigned_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
}

// POST: assign a number from the pool to the calling customer
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureTable();

    // Already has a number — return it
    const existing = await query(
      `SELECT phone_number FROM customer_phone_numbers WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: true, phoneNumber: existing.rows[0].phone_number, alreadyAssigned: true });
    }

    // Grab the oldest available number from the pool
    const available = await query(
      `SELECT id, phone_number, twilio_sid FROM customer_phone_numbers
       WHERE status = 'available' ORDER BY created_at ASC LIMIT 1`
    );

    if (available.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No phone numbers available right now. Please contact support@bizzybotai.com.'
      }, { status: 503 });
    }

    const number = available.rows[0];

    const customerResult = await query(
      `SELECT id FROM customers WHERE clerk_user_id = $1 LIMIT 1`, [userId]
    );
    const customerId = customerResult.rows[0]?.id;

    await query(
      `UPDATE customer_phone_numbers
       SET status = 'active', clerk_user_id = $1, customer_id = $2,
           assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [userId, customerId, number.id]
    );

    // Point the Twilio number's webhook at BizzyBot's SMS handler
    if (twilioClient && number.twilio_sid) {
      await twilioClient.incomingPhoneNumbers(number.twilio_sid).update({
        smsUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/sms/webhook`,
        smsMethod: 'POST'
      }).catch(err => console.error('⚠️ Twilio webhook update failed:', err.message));
    }

    console.log(`✅ Assigned ${number.phone_number} to customer ${userId}`);

    // Fire-and-forget: provision Vapi voice assistant for this number
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/vapi/provision`, {
      method: 'POST',
      headers: { Cookie: request.headers.get('cookie') || '' },
    }).catch(err => console.error('⚠️ Vapi auto-provision failed:', err.message));

    return NextResponse.json({ success: true, phoneNumber: number.phone_number });

  } catch (error) {
    console.error('❌ SMS provision error:', error);
    return NextResponse.json({ error: 'Failed to provision SMS number' }, { status: 500 });
  }
}

// GET: check if customer already has a number assigned
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureTable();

    const result = await query(
      `SELECT phone_number, assigned_at FROM customer_phone_numbers
       WHERE clerk_user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) return NextResponse.json({ assigned: false });

    return NextResponse.json({
      assigned: true,
      phoneNumber: result.rows[0].phone_number,
      assignedAt: result.rows[0].assigned_at
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
