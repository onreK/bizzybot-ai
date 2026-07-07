import { query } from '@/lib/database.js';
import { sendHotLeadAlert } from '@/lib/owner-alerts.js';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function twiml(body) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}
function prettyPhone(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return n || 'Unknown';
}

// Called after the owner's cell is dialed. If they answered, the call is done.
// If not, notify the owner (text + email) and hand the caller to the AI.
export async function POST(request) {
  try {
    const form = await request.formData();
    const dialStatus = form.get('DialCallStatus') || '';
    const to = form.get('To') || '';       // the toll-free number
    const from = form.get('From') || '';   // the caller (lead)

    // Owner picked up — nothing more to do.
    if (dialStatus === 'completed') {
      return twiml('<Hangup/>');
    }

    // No answer / busy / failed → notify the owner and hand to the AI.
    const res = await query(
      `SELECT clerk_user_id, forward_cell, vapi_voice_url FROM customer_phone_numbers
       WHERE phone_number = $1 LIMIT 1`,
      [to]
    ).catch(() => ({ rows: [] }));
    const cfg = res.rows[0] || {};

    // Email alert (works immediately).
    if (cfg.clerk_user_id) {
      sendHotLeadAlert(cfg.clerk_user_id, {
        contactPhone: prettyPhone(from),
        channel: 'voice',
        message: `Missed call from ${prettyPhone(from)} — your AI is answering it now.`,
        score: 80,
      }).catch(() => {});
    }

    // Text alert to the owner's cell (delivers once the toll-free is SMS-verified).
    if (twilioClient && cfg.forward_cell) {
      twilioClient.messages.create({
        from: to,
        to: cfg.forward_cell,
        body: `📞 Missed call from ${prettyPhone(from)}. Your BizzyBot AI is handling it — check the dashboard for the transcript.`,
      }).catch((e) => console.error('⚠️ Missed-call SMS failed:', e.message));
    }

    // Hand the live caller to the AI (Vapi's own inbound handler).
    if (cfg.vapi_voice_url) {
      return twiml(`<Redirect method="POST">${esc(cfg.vapi_voice_url)}</Redirect>`);
    }
    return twiml(`<Say>Sorry we missed you. We'll get back to you shortly.</Say><Hangup/>`);
  } catch (error) {
    console.error('❌ voice/fallback error:', error.message);
    return twiml(`<Say>Sorry, we're having trouble connecting your call.</Say><Hangup/>`);
  }
}
