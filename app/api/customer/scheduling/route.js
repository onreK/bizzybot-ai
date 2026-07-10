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
      'SELECT id, booking_url, booking_auto_send, business_timezone FROM customers WHERE clerk_user_id = $1',
      [userId]
    );

    const row = result.rows[0] || {};

    // Recent appointments the AI actually booked (appointment_booked events)
    let aiBookings = [];
    if (row.id) {
      try {
        const bookingsRes = await query(
          `SELECT metadata, channel, created_at
           FROM ai_analytics_events
           WHERE customer_id = $1 AND event_type = 'appointment_booked'
           ORDER BY created_at DESC LIMIT 10`,
          [row.id]
        );
        aiBookings = bookingsRes.rows.map(r => {
          let data = {};
          try { data = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}); } catch {}
          return {
            start: data.start || null,
            attendee: data.attendee || null,
            channel: r.channel,
            booked_at: r.created_at,
          };
        });
      } catch {}
    }

    return NextResponse.json({
      booking_url: row.booking_url || '',
      booking_auto_send: row.booking_auto_send !== false, // default true
      business_timezone: row.business_timezone || 'America/New_York',
      aiBookings,
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

    const { booking_url, booking_auto_send, business_timezone } = await req.json();

    await ensureColumn();

    // Only accept timezones we present in the UI
    const VALID_TIMEZONES = [
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
      'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
    ];
    const tz = VALID_TIMEZONES.includes(business_timezone) ? business_timezone : null;

    await query(
      `UPDATE customers
       SET booking_url = $1, booking_auto_send = $2,
           business_timezone = COALESCE($3, business_timezone), updated_at = NOW()
       WHERE clerk_user_id = $4`,
      [booking_url || null, booking_auto_send !== false, tz, userId]
    );

    console.log(`✅ Scheduling settings saved for user ${userId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/customer/scheduling:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
