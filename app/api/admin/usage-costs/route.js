// app/api/admin/usage-costs/route.js
// Per-customer usage costs + estimated margins for the admin dashboard.
// Estimates use current unit rates; tune UNIT_RATES as vendor pricing moves.
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

const ADMIN_USER_IDS = [
  process.env.ADMIN_CLERK_ID_1,
  process.env.ADMIN_CLERK_ID_2,
].filter(Boolean);

async function checkIsAdmin(userId) {
  if (ADMIN_USER_IDS.includes(userId)) return true;
  try {
    const res = await query('SELECT email FROM customers WHERE clerk_user_id = $1 LIMIT 1', [userId]);
    const email = (res.rows[0]?.email || '').toLowerCase();
    // Anchored domain match — a substring check would grant admin to e.g.
    // "x@bizzybotai.com.evil.com"
    const domain = email.split('@')[1] || '';
    return email === (process.env.ADMIN_EMAIL || '').toLowerCase() || domain === 'bizzybotai.com';
  } catch (_) {
    return false;
  }
}

// Current plan prices ($/mo). 'basic' is a legacy value equivalent to starter.
const PLAN_PRICES = { starter: 29, basic: 29, professional: 69, business: 199 };

// Rough unit rates ($) — deliberately CONSERVATIVE (founder note 2026-07-10:
// real margins are likely HIGHER than shown; e.g. smsExchange assumes ~2
// segments avg, voiceMinute assumes every minute is an AI minute). Reconcile
// against actual Twilio + Vapi invoices once real customer traffic exists,
// then tune these numbers.
// FALLBACK rates — used only where an exact billed amount isn't available
// (e.g. voice calls logged before cost capture shipped 2026-07-20, or when
// the Twilio API is unreachable). Wherever possible the panel now reports
// ACTUALS: Vapi's per-call billed cost and Twilio's per-message billed price.
const UNIT_RATES = {
  numberRental: 2.15,      // toll-free number, flat per month (this IS the exact Twilio price)
  smsExchange: 0.025,      // fallback: lead text + AI reply (~3 segments at actual $0.0083/segment)
  voiceMinute: 0.115,      // fallback: worst observed actual Vapi rate (Twilio voice legs: $0 billed to date)
  aiReply: 0.0001,         // measured actual: July 2026 = $0.13 / 2,209 requests ≈ $0.00006; 0.0001 keeps margin
  stripePct: 0.029,        // exact by formula
  stripeFlat: 0.30,
};

// Exact SMS cost for one number this calendar month, straight from Twilio's
// per-message billed prices. Returns null on any failure → caller falls back
// to the estimate.
async function twilioSmsMonthCost(phoneNumber) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok || !phoneNumber) return null;
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const authHeader = 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64');
  let total = 0;
  try {
    for (const dir of ['To', 'From']) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?${dir}=${encodeURIComponent(phoneNumber)}&DateSent%3E=${monthStart}&PageSize=400`;
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      if (!res.ok) return null;
      const data = await res.json();
      for (const m of data.messages || []) {
        if (m.price != null) total += Math.abs(parseFloat(m.price)) || 0;
      }
    }
    return +total.toFixed(4);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await checkIsAdmin(userId))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // This calendar month, per customer:
    //  - SMS exchanges (inbound texts; each implies one AI reply)
    //  - all inbound interactions (drives OpenAI cost)
    //  - AI voice minutes (vapi_call_logs)
    //  - whether they rent a number
    // Ensure the cost column exists before selecting it (pre-2026-07-20 DBs)
    await query(`ALTER TABLE vapi_call_logs ADD COLUMN IF NOT EXISTS cost NUMERIC`).catch(() => {});

    const result = await query(`
      SELECT
        c.id, c.business_name, c.email, c.plan,
        (c.stripe_subscription_id IS NOT NULL) AS is_paying,
        COALESCE(sms.exchanges, 0)      AS sms_exchanges,
        COALESCE(inbound.total, 0)      AS inbound_total,
        COALESCE(voice.minutes, 0)      AS voice_minutes,
        COALESCE(voice.vapi_actual, 0)  AS vapi_actual,
        COALESCE(voice.unpriced_minutes, 0) AS unpriced_minutes,
        (pn.id IS NOT NULL)             AS has_number,
        pn.phone_number                 AS phone_number
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, COUNT(*) AS exchanges
        FROM ai_analytics_events
        WHERE event_type = 'message_received' AND channel = 'sms'
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY customer_id
      ) sms ON sms.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, COUNT(*) AS total
        FROM ai_analytics_events
        WHERE event_type IN ('message_received', 'email_received', 'call_received')
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY customer_id
      ) inbound ON inbound.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id,
               CEIL(SUM(duration_seconds) / 60.0) AS minutes,
               SUM(COALESCE(cost, 0)) AS vapi_actual,
               CEIL(SUM(CASE WHEN cost IS NULL THEN duration_seconds ELSE 0 END) / 60.0) AS unpriced_minutes
        FROM vapi_call_logs
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY customer_id
      ) voice ON voice.customer_id = c.id
      LEFT JOIN LATERAL (
        SELECT id, phone_number FROM customer_phone_numbers
        WHERE clerk_user_id = c.clerk_user_id AND status = 'active'
        LIMIT 1
      ) pn ON true
      ORDER BY c.created_at DESC
    `);

    const customers = [];
    for (const row of result.rows) {
      // Revenue only counts when there's a real Stripe subscription —
      // trial/test accounts cost money but earn nothing (the truth).
      const price = row.is_paying ? (PLAN_PRICES[row.plan] || 0) : 0;
      const smsExchanges = parseInt(row.sms_exchanges);
      const inboundTotal = parseInt(row.inbound_total);
      const voiceMinutes = parseInt(row.voice_minutes);

      const costNumber = row.has_number ? UNIT_RATES.numberRental : 0;

      // SMS: exact billed prices from Twilio when reachable, estimate otherwise
      let costSms = smsExchanges * UNIT_RATES.smsExchange;
      let smsBasis = 'estimate';
      if (row.has_number && row.phone_number) {
        const actual = await twilioSmsMonthCost(row.phone_number);
        if (actual !== null) { costSms = actual; smsBasis = 'actual'; }
      }

      // Voice: exact Vapi per-call charges; estimate only for calls logged
      // before cost capture existed (their cost column is NULL)
      const vapiActual = parseFloat(row.vapi_actual) || 0;
      const unpricedMinutes = parseInt(row.unpriced_minutes) || 0;
      const costVoice = vapiActual + unpricedMinutes * UNIT_RATES.voiceMinute;
      const voiceBasis = unpricedMinutes === 0 ? 'actual' : vapiActual > 0 ? 'actual+estimate' : 'estimate';

      const costAi = inboundTotal * UNIT_RATES.aiReply;
      const costStripe = price > 0 ? price * UNIT_RATES.stripePct + UNIT_RATES.stripeFlat : 0;
      const totalCost = costNumber + costSms + costVoice + costAi + costStripe;
      const margin = price - totalCost;

      customers.push({
        id: row.id,
        businessName: row.business_name || '(no name)',
        email: row.email,
        plan: row.is_paying ? (row.plan || 'none') : `${row.plan || 'none'} (unpaid)`,
        price,
        usage: { smsExchanges, voiceMinutes, inboundTotal },
        costs: {
          number: +costNumber.toFixed(2),
          sms: +costSms.toFixed(2),
          voice: +costVoice.toFixed(2),
          openai: +costAi.toFixed(2),
          stripe: +costStripe.toFixed(2),
          total: +totalCost.toFixed(2),
        },
        costBasis: { sms: smsBasis, voice: voiceBasis, number: 'actual', stripe: 'formula', openai: 'measured-rate' },
        margin: +margin.toFixed(2),
        marginPct: price > 0 ? +((margin / price) * 100).toFixed(1) : null,
      });
    }

    const totals = customers.reduce(
      (t, cu) => ({
        revenue: t.revenue + cu.price,
        cost: t.cost + cu.costs.total,
        margin: t.margin + cu.margin,
      }),
      { revenue: 0, cost: 0, margin: 0 }
    );

    return NextResponse.json({
      success: true,
      month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      unitRates: UNIT_RATES,
      customers,
      totals: {
        revenue: +totals.revenue.toFixed(2),
        cost: +totals.cost.toFixed(2),
        margin: +totals.margin.toFixed(2),
        marginPct: totals.revenue > 0 ? +((totals.margin / totals.revenue) * 100).toFixed(1) : null,
      },
    });
  } catch (error) {
    console.error('❌ Usage costs error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
