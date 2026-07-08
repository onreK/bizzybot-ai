import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAvailableSlots, createCalendarEvent, getWeekAgenda } from '@/lib/microsoft-calendar.js';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

// GET — available slots (default) or the week's real events (?view=agenda)
export async function GET(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const view = new URL(request.url).searchParams.get('view');

    if (view === 'agenda') {
      const result = await getWeekAgenda(userId);
      if (result.needsReconnect) {
        return NextResponse.json({ needsReconnect: true, events: [] });
      }
      return NextResponse.json({ events: result.events, timezone: result.timezone || null, error: result.error || null });
    }

    const result = await getAvailableSlots(userId);

    if (result.needsReconnect) {
      return NextResponse.json({ needsReconnect: true, slots: [] });
    }

    return NextResponse.json({ slots: result.slots, timezone: result.timezone || null, error: result.error || null });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — create a calendar event for a lead
export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { startISO, attendeeEmail, attendeeName } = await request.json();
    if (!startISO) return NextResponse.json({ error: 'startISO is required' }, { status: 400 });

    const customerResult = await query(
      `SELECT business_name FROM customers WHERE clerk_user_id = $1 LIMIT 1`, [userId]
    ).catch(() => ({ rows: [] }));

    const businessName = customerResult.rows[0]?.business_name || '';

    const result = await createCalendarEvent(userId, {
      startISO,
      attendeeEmail,
      attendeeName,
      businessName,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Calendar booking error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
