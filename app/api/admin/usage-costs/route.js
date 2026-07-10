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

// Rough unit rates ($)
const UNIT_RATES = {
  numberRental: 2.15,      // toll-free number, flat per month
  smsExchange: 0.025,      // lead text + AI reply incl. carrier fees (~2 segments avg)
  voiceMinute: 0.11,       // Vapi ~$0.09 + Twilio toll-free leg ~$0.022
  aiReply: 0.001,          // GPT-4o-mini tokens per response (any channel)
  stripePct: 0.029,
  stripeFlat: 0.30,
};

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
    const result = await query(`
      SELECT
        c.id, c.business_name, c.email, c.plan,
        COALESCE(sms.exchanges, 0)      AS sms_exchanges,
        COALESCE(inbound.total, 0)      AS inbound_total,
        COALESCE(voice.minutes, 0)      AS voice_minutes,
        (pn.id IS NOT NULL)             AS has_number
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
        SELECT customer_id, CEIL(SUM(duration_seconds) / 60.0) AS minutes
        FROM vapi_call_logs
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY customer_id
      ) voice ON voice.customer_id = c.id
      LEFT JOIN LATERAL (
        SELECT id FROM customer_phone_numbers
        WHERE clerk_user_id = c.clerk_user_id AND status = 'active'
        LIMIT 1
      ) pn ON true
      ORDER BY c.created_at DESC
    `);

    const customers = result.rows.map(row => {
      const price = PLAN_PRICES[row.plan] || 0;
      const smsExchanges = parseInt(row.sms_exchanges);
      const inboundTotal = parseInt(row.inbound_total);
      const voiceMinutes = parseInt(row.voice_minutes);

      const costNumber = row.has_number ? UNIT_RATES.numberRental : 0;
      const costSms = smsExchanges * UNIT_RATES.smsExchange;
      const costVoice = voiceMinutes * UNIT_RATES.voiceMinute;
      const costAi = inboundTotal * UNIT_RATES.aiReply;
      const costStripe = price > 0 ? price * UNIT_RATES.stripePct + UNIT_RATES.stripeFlat : 0;
      const totalCost = costNumber + costSms + costVoice + costAi + costStripe;
      const margin = price - totalCost;

      return {
        id: row.id,
        businessName: row.business_name || '(no name)',
        email: row.email,
        plan: row.plan || 'none',
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
        margin: +margin.toFixed(2),
        marginPct: price > 0 ? +((margin / price) * 100).toFixed(1) : null,
      };
    });

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
