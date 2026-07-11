import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

async function ensureAlertColumns() {
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS hot_lead_alerts_enabled BOOLEAN DEFAULT FALSE`).catch(() => {});
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alert_email TEXT`).catch(() => {});
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alert_last_sent_at TIMESTAMP`).catch(() => {});
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alert_business_hours BOOLEAN DEFAULT FALSE`).catch(() => {});
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureAlertColumns();

    const result = await query(
      `SELECT hot_lead_alerts_enabled, alert_email, alert_business_hours FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    const row = result.rows[0] || {};
    return NextResponse.json({
      preferences: {
        hotLeadAlerts: row.hot_lead_alerts_enabled ?? false,
        alertEmail: row.alert_email ?? '',
        alertBusinessHours: row.alert_business_hours ?? false,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { hotLeadAlerts, alertEmail, alertBusinessHours } = await request.json();

    await ensureAlertColumns();

    // Partial update: only fields present in the request change, so the SMS
    // page's schedule buttons can't wipe the alert email set in Settings
    // (and vice versa).
    await query(
      `UPDATE customers
       SET hot_lead_alerts_enabled = CASE WHEN $1::boolean THEN $2 ELSE hot_lead_alerts_enabled END,
           alert_email             = CASE WHEN $3::boolean THEN $4 ELSE alert_email END,
           alert_business_hours    = CASE WHEN $5::boolean THEN $6 ELSE alert_business_hours END,
           updated_at = NOW()
       WHERE clerk_user_id = $7`,
      [
        hotLeadAlerts !== undefined, !!hotLeadAlerts,
        alertEmail !== undefined, alertEmail?.trim() || null,
        alertBusinessHours !== undefined, !!alertBusinessHours,
        userId,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
