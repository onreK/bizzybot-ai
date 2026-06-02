import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

async function ensureAlertColumns() {
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS hot_lead_alerts_enabled BOOLEAN DEFAULT FALSE`).catch(() => {});
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alert_email TEXT`).catch(() => {});
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alert_last_sent_at TIMESTAMP`).catch(() => {});
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureAlertColumns();

    const result = await query(
      `SELECT hot_lead_alerts_enabled, alert_email FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    const row = result.rows[0] || {};
    return NextResponse.json({
      preferences: {
        hotLeadAlerts: row.hot_lead_alerts_enabled ?? false,
        alertEmail: row.alert_email ?? '',
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

    const { hotLeadAlerts, alertEmail } = await request.json();

    await ensureAlertColumns();

    await query(
      `UPDATE customers
       SET hot_lead_alerts_enabled = $1,
           alert_email = $2,
           updated_at = NOW()
       WHERE clerk_user_id = $3`,
      [!!hotLeadAlerts, alertEmail?.trim() || null, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
