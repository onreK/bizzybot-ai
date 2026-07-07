import { query } from '@/lib/database.js';
import { isValidTwilioRequest } from '@/lib/twilio-verify.js';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizzybotai.com';

function twiml(body) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Normalize a US number to E.164 for <Dial><Number>.
function toE164(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (String(raw).trim().startsWith('+')) return String(raw).trim();
  return `+${d}`;
}

// Inbound call to the toll-free number. Depending on the customer's setting we
// either ring their cell first (then fall back to the AI) or go straight to AI.
export async function POST(request) {
  try {
    const form = await request.formData();
    const params = Object.fromEntries(form.entries());

    // Reject anything not signed by Twilio (prevents unauthenticated callers
    // from probing routing or leaking the owner's forwarding number).
    const signature = request.headers.get('x-twilio-signature');
    if (!isValidTwilioRequest(signature, `${BASE_URL}/api/voice/incoming`, params)) {
      return new Response('Forbidden', { status: 403 });
    }

    const to = params.To || '';

    const res = await query(
      `SELECT forward_cell, call_mode, ring_seconds, vapi_voice_url
       FROM customer_phone_numbers WHERE phone_number = $1 LIMIT 1`,
      [to]
    ).catch(() => ({ rows: [] }));
    const cfg = res.rows[0] || {};

    const vapiUrl = cfg.vapi_voice_url;
    const cell = toE164(cfg.forward_cell);
    const mode = cfg.call_mode || 'human_first';
    const ring = Math.min(45, Math.max(5, parseInt(cfg.ring_seconds, 10) || 18));

    // AI-first, or no cell configured, or we don't know where the AI lives →
    // hand straight to the AI (Vapi's own inbound handler).
    if (mode !== 'human_first' || !cell || !vapiUrl) {
      if (vapiUrl) return twiml(`<Redirect method="POST">${esc(vapiUrl)}</Redirect>`);
      // Last-resort fallback if we somehow have no AI target.
      return twiml(`<Say>Thanks for calling. Please try again shortly.</Say><Hangup/>`);
    }

    // Human-first: ring the owner's cell, then fall back to the AI on no-answer.
    const action = `${BASE_URL}/api/voice/fallback`;
    return twiml(
      `<Dial timeout="${ring}" action="${esc(action)}" method="POST" answerOnBridge="true">` +
      `<Number>${esc(cell)}</Number></Dial>`
    );
  } catch (error) {
    console.error('❌ voice/incoming error:', error.message);
    return twiml(`<Say>Sorry, we're having trouble connecting your call.</Say><Hangup/>`);
  }
}
