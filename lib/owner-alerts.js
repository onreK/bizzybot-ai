import { query } from './database.js';
import { sendEmail } from './resend-send.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeSubject = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200);

async function ensureAlertColumns() {
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS hot_lead_alerts_enabled BOOLEAN DEFAULT FALSE`).catch(() => {});
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alert_email TEXT`).catch(() => {});
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alert_last_sent_at TIMESTAMP`).catch(() => {});
  await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS alert_business_hours BOOLEAN DEFAULT FALSE`).catch(() => {});
}

// Mon–Fri, 9am–5pm in the business's own timezone
function isBusinessHours(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'America/New_York',
      weekday: 'short', hour: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date());
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value, 10);
    return weekday !== 'Sat' && weekday !== 'Sun' && hour >= 9 && hour < 17;
  } catch {
    return true; // bad timezone data should never suppress an alert
  }
}

/**
 * Send a hot lead alert email to the business owner.
 * Silently skips if alerts are disabled, no email set, or sent within 30 min.
 */
export async function sendHotLeadAlert(clerkUserId, { contactName, contactEmail, contactPhone, channel, message, score }) {
  try {
    if (!clerkUserId) return;

    await ensureAlertColumns();

    const result = await query(
      `SELECT business_name, hot_lead_alerts_enabled, alert_email, alert_last_sent_at,
              alert_business_hours, business_timezone
       FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
      [clerkUserId]
    ).catch(() => ({ rows: [] }));

    const customer = result.rows[0];
    if (!customer?.hot_lead_alerts_enabled || !customer?.alert_email) return;

    // "Business hours" schedule: suppress the alert outside Mon–Fri 9–5
    // business-local time (the hot lead is still recorded on the dashboard)
    if (customer.alert_business_hours && !isBusinessHours(customer.business_timezone)) return;

    // Dedup: max 1 alert every 30 minutes per customer
    if (customer.alert_last_sent_at) {
      const minsSinceLast = (Date.now() - new Date(customer.alert_last_sent_at).getTime()) / 60000;
      if (minsSinceLast < 30) return;
    }

    const channelLabel = {
      email:     'Gmail',
      outlook:   'Outlook',
      sms:       'SMS',
      voice:     'Voice Call',
      chat:      'Web Chat',
      facebook:  'Facebook',
      instagram: 'Instagram',
    }[channel] || channel;

    const contactDisplay = contactName || contactEmail || contactPhone || 'Unknown caller';
    const scoreColor = score >= 80 ? '#ef4444' : '#f97316';

    const msgPreview = message ? esc(String(message).slice(0, 350)) + (message.length > 350 ? '…' : '') : '';

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#0D1117;border-radius:12px;overflow:hidden;border:1px solid #30363D;">
        <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 28px;">
          <p style="margin:0;font-size:32px;line-height:1;">🔥</p>
          <h1 style="margin:10px 0 4px;font-size:22px;color:#fff;font-weight:700;">Hot Lead Alert</h1>
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">${esc(customer.business_name || 'Your BizzyBot')} &nbsp;·&nbsp; via ${esc(channelLabel)}</p>
        </div>
        <div style="padding:24px 28px;background:#161B22;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="color:#8B949E;font-size:12px;padding:5px 0;width:72px;vertical-align:top;">From</td><td style="color:#E6EDF3;font-size:15px;font-weight:600;padding:5px 0;">${esc(contactDisplay)}</td></tr>
            ${contactEmail ? `<tr><td style="color:#8B949E;font-size:12px;padding:5px 0;">Email</td><td style="color:#E6EDF3;font-size:14px;padding:5px 0;">${esc(contactEmail)}</td></tr>` : ''}
            ${contactPhone ? `<tr><td style="color:#8B949E;font-size:12px;padding:5px 0;">Phone</td><td style="color:#E6EDF3;font-size:14px;padding:5px 0;">${esc(contactPhone)}</td></tr>` : ''}
            <tr><td style="color:#8B949E;font-size:12px;padding:5px 0;">Channel</td><td style="color:#E6EDF3;font-size:14px;padding:5px 0;">${esc(channelLabel)}</td></tr>
            <tr><td style="color:#8B949E;font-size:12px;padding:5px 0;">Score</td><td style="color:${scoreColor};font-size:15px;font-weight:700;padding:5px 0;">${score}/100</td></tr>
          </table>
          ${msgPreview ? `
          <div style="background:#0D1117;border:1px solid #30363D;border-radius:8px;padding:14px;margin-bottom:20px;">
            <p style="margin:0 0 6px;color:#8B949E;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;">Their message</p>
            <p style="margin:0;color:#C9D1D9;font-size:13px;line-height:1.6;">${msgPreview}</p>
          </div>` : ''}
          <a href="https://bizzybotai.com/leads" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">View Lead →</a>
        </div>
        <div style="padding:12px 28px;background:#0D1117;border-top:1px solid #21262D;">
          <p style="margin:0;color:#484F58;font-size:11px;">BizzyBot AI · <a href="https://bizzybotai.com/settings" style="color:#484F58;">Manage alerts</a></p>
        </div>
      </div>
    `;

    const sendResult = await sendEmail({
      from: 'BizzyBot AI <alerts@bizzybotai.com>',
      to: customer.alert_email,
      subject: safeSubject(`🔥 Hot Lead — ${contactDisplay} (${channelLabel})`),
      html,
    }, `hot lead alert (${clerkUserId})`);
    if (!sendResult.sent) return; // don't stamp dedup — allow the next hot lead to retry

    await query(
      `UPDATE customers SET alert_last_sent_at = NOW() WHERE clerk_user_id = $1`,
      [clerkUserId]
    ).catch(() => {});

    console.log(`✅ Hot lead alert sent to ${customer.alert_email}`);
  } catch (err) {
    // Never let alert failures break the main flow
    console.error('⚠️ Hot lead alert failed:', err.message);
  }
}
