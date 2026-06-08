import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

const ADMIN_USER_IDS = [
  process.env.ADMIN_CLERK_ID_1,
  process.env.ADMIN_CLERK_ID_2,
].filter(Boolean);

async function isAdmin(userId) {
  if (ADMIN_USER_IDS.includes(userId)) return true;
  try {
    const res = await query('SELECT email FROM customers WHERE clerk_user_id = $1 LIMIT 1', [userId]);
    const email = res.rows[0]?.email || '';
    return email === process.env.ADMIN_EMAIL || email === 'kernopay@gmail.com' || email.includes('@bizzybotai.com');
  } catch (_) {
    return false;
  }
}

async function ensureColumns() {
  const cols = [
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50)`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS churned_at TIMESTAMP`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`,
    `CREATE TABLE IF NOT EXISTS business_profiles (id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE, industry VARCHAR(100), website VARCHAR(255), phone VARCHAR(50), address VARCHAR(255), city VARCHAR(100), state VARCHAR(50), zip_code VARCHAR(20), country VARCHAR(100), employee_count VARCHAR(20), description TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(customer_id))`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS industry VARCHAR(100)`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS website VARCHAR(255)`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS address VARCHAR(255)`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS state VARCHAR(50)`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20)`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS country VARCHAR(100)`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS employee_count VARCHAR(20)`,
    `ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS description TEXT`,
  ];
  for (const sql of cols) {
    try { await query(sql); } catch (_) {}
  }
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await isAdmin(userId))) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    await ensureColumns();

    const result = await query(`
      SELECT
        c.id, c.clerk_user_id, c.business_name, c.email, c.phone, c.plan,
        c.subscription_status, c.stripe_customer_id, c.stripe_subscription_id,
        c.trial_ends_at, c.churned_at, c.last_active_at, c.created_at, c.updated_at,
        bp.industry, bp.website, bp.address, bp.city, bp.state,
        bp.zip_code, bp.country, bp.employee_count, bp.description,
        COALESCE(bp.phone, c.phone) AS contact_phone
      FROM customers c
      LEFT JOIN business_profiles bp ON c.id = bp.customer_id
      ORDER BY c.created_at DESC
    `);

    const customers = result.rows;
    const ids = customers.map(c => c.id).filter(Boolean);
    const clerkIds = customers.map(c => c.clerk_user_id).filter(Boolean);

    // AI interaction counts
    let interactionMap = {};
    try {
      const r = await query(`
        SELECT customer_id, COUNT(*) AS count
        FROM ai_analytics_events
        WHERE customer_id = ANY($1::int[])
        GROUP BY customer_id
      `, [ids]);
      r.rows.forEach(row => { interactionMap[row.customer_id] = parseInt(row.count); });
    } catch (_) {}

    // Channel connections
    let gmailSet = new Set(), twilioSet = new Set(), facebookSet = new Set(), instagramSet = new Set();
    try {
      const r = await query(`SELECT DISTINCT user_id FROM gmail_connections WHERE status = 'connected' AND user_id = ANY($1::text[])`, [clerkIds]);
      r.rows.forEach(row => gmailSet.add(row.user_id));
    } catch (_) {}
    try {
      const r = await query(`SELECT DISTINCT clerk_user_id FROM twilio_numbers WHERE clerk_user_id = ANY($1::text[])`, [clerkIds]);
      r.rows.forEach(row => twilioSet.add(row.clerk_user_id));
    } catch (_) {}
    try {
      const r = await query(`SELECT DISTINCT user_id FROM facebook_connections WHERE status = 'connected' AND user_id = ANY($1::text[])`, [clerkIds]);
      r.rows.forEach(row => facebookSet.add(row.user_id));
    } catch (_) {}
    try {
      const r = await query(`SELECT DISTINCT user_id FROM instagram_connections WHERE status = 'connected' AND user_id = ANY($1::text[])`, [clerkIds]);
      r.rows.forEach(row => instagramSet.add(row.user_id));
    } catch (_) {}

    // Last activity: latest message across gmail + sms per customer
    let lastActivityMap = {};
    try {
      const r = await query(`
        SELECT gc.user_id, MAX(gm.sent_at) AS last_at
        FROM gmail_messages gm
        JOIN gmail_conversations gc ON gm.conversation_id = gc.id
        WHERE gc.user_id = ANY($1::text[])
        GROUP BY gc.user_id
      `, [clerkIds]);
      r.rows.forEach(row => { lastActivityMap[row.user_id] = row.last_at; });
    } catch (_) {}
    try {
      const r = await query(`
        SELECT user_id, MAX(created_at) AS last_at
        FROM messages
        WHERE user_id = ANY($1::text[])
        GROUP BY user_id
      `, [clerkIds]);
      r.rows.forEach(row => {
        const existing = lastActivityMap[row.user_id];
        if (!existing || new Date(row.last_at) > new Date(existing)) lastActivityMap[row.user_id] = row.last_at;
      });
    } catch (_) {}

    const now = new Date();
    const PLAN_MRR = { starter: 29, professional: 69, business: 199 };

    const enriched = customers.map(c => {
      const trialEnds = c.trial_ends_at
        ? new Date(c.trial_ends_at)
        : new Date(new Date(c.created_at).getTime() + 14 * 24 * 60 * 60 * 1000);

      const trialDaysLeft = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24));
      const isOnTrial = !c.subscription_status || c.subscription_status === 'trialing';
      const isPaid = c.subscription_status === 'active';
      const isChurned = c.subscription_status === 'canceled' || !!c.churned_at;
      const isPastDue = c.subscription_status === 'past_due';

      return {
        ...c,
        trial_ends_at: trialEnds.toISOString(),
        trial_days_left: trialDaysLeft,
        is_on_trial: isOnTrial && !isChurned,
        is_paid: isPaid,
        is_churned: isChurned,
        is_past_due: isPastDue,
        last_active_at: lastActivityMap[c.clerk_user_id] || c.last_active_at || c.updated_at,
        ai_interactions: interactionMap[c.id] || 0,
        has_gmail: gmailSet.has(c.clerk_user_id),
        has_sms: twilioSet.has(c.clerk_user_id),
        has_facebook: facebookSet.has(c.clerk_user_id),
        has_instagram: instagramSet.has(c.clerk_user_id),
        mrr_contribution: isPaid ? (PLAN_MRR[c.plan] || 0) : 0,
      };
    });

    const paid = enriched.filter(c => c.is_paid);
    const trials = enriched.filter(c => c.is_on_trial);
    const churned = enriched.filter(c => c.is_churned);
    const mrr = paid.reduce((sum, c) => sum + c.mrr_contribution, 0);

    return NextResponse.json({
      success: true,
      customers: enriched,
      summary: {
        total: enriched.length,
        paid: paid.length,
        trial: trials.length,
        churned: churned.length,
        past_due: enriched.filter(c => c.is_past_due).length,
        mrr,
        arr: mrr * 12,
        expiring_soon: trials.filter(c => c.trial_days_left >= 0 && c.trial_days_left <= 3).length,
        trial_conversion_rate: (paid.length + churned.length) > 0
          ? Math.round((paid.length / (paid.length + churned.length)) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error('❌ Admin customers error:', error);
    return NextResponse.json({ error: 'Failed to load customers', details: error.message }, { status: 500 });
  }
}
