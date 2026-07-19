import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Send an email via Resend and report failures honestly. The Resend SDK does
// NOT throw on API errors — it returns { data, error } — so callers that
// ignore the return value log false successes. (Bit us 2026-07-19: the domain
// lost verification and every send 403'd silently while logs said "sent".)
export async function sendEmail(payload, context = 'email') {
  if (!resend) {
    console.error(`❌ ${context}: RESEND_API_KEY not configured — email NOT sent`);
    return { sent: false, error: 'not_configured' };
  }
  try {
    const { data, error } = await resend.emails.send(payload);
    if (error) {
      console.error(`❌ ${context}: Resend rejected the send — email NOT delivered:`, JSON.stringify(error));
      return { sent: false, error };
    }
    return { sent: true, id: data?.id };
  } catch (err) {
    console.error(`❌ ${context}: Resend send threw — email NOT delivered:`, err.message);
    return { sent: false, error: err.message };
  }
}
