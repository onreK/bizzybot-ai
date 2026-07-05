import twilio from 'twilio';
import { Resend } from 'resend';
import { query } from './database.js';

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'kernopay@gmail.com';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizzybotai.com';

async function ensureTfvColumns() {
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS tfv_sid TEXT`).catch(() => {});
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS tfv_status TEXT`).catch(() => {});
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS tfv_submitted_at TIMESTAMP`).catch(() => {});
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS tfv_approved_at TIMESTAMP`).catch(() => {});
  await query(`ALTER TABLE customer_phone_numbers ADD COLUMN IF NOT EXISTS tfv_rejection_reason TEXT`).catch(() => {});
}

/**
 * Submit a toll-free verification for a customer's assigned number.
 * Uses the customer's business profile for business details and BizzyBot's
 * standardized compliance template (opt-in page + privacy policy) for the rest.
 *
 * Returns { submitted: true } on success,
 * or { submitted: false, needsInfo: [...] } when profile fields are missing.
 */
export async function submitTollfreeVerification({ clerkUserId, phoneNumberSid }) {
  if (!twilioClient) throw new Error('Twilio not configured');

  await ensureTfvColumns();

  const customerResult = await query(
    `SELECT c.id, c.business_name, c.email,
            bp.website, bp.phone, bp.address, bp.city, bp.state, bp.zip_code
     FROM customers c
     LEFT JOIN business_profiles bp ON bp.customer_id = c.id
     WHERE c.clerk_user_id = $1 LIMIT 1`,
    [clerkUserId]
  );

  const customer = customerResult.rows[0];
  if (!customer) throw new Error('Customer not found');

  // Twilio requires these to review the verification
  const needsInfo = [];
  if (!customer.business_name?.trim()) needsInfo.push('businessName');
  if (!customer.website?.trim()) needsInfo.push('website');
  if (!customer.address?.trim()) needsInfo.push('address');
  if (!customer.city?.trim()) needsInfo.push('city');
  if (!customer.state?.trim()) needsInfo.push('state');
  if (!customer.zip_code?.trim()) needsInfo.push('zip_code');

  if (needsInfo.length > 0) {
    await query(
      `UPDATE customer_phone_numbers SET tfv_status = 'needs_info', updated_at = NOW()
       WHERE twilio_sid = $1`,
      [phoneNumberSid]
    ).catch(() => {});
    console.log(`⚠️ TFV needs more info for ${clerkUserId}:`, needsInfo.join(', '));
    return { submitted: false, needsInfo };
  }

  const businessName = customer.business_name.trim();

  // Standardized, CTIA-compliant template — reused for every customer.
  // Consumers opt in by texting the business's advertised number first.
  const verification = await twilioClient.messaging.v1.tollfreeVerifications.create({
    tollfreePhoneNumberSid: phoneNumberSid,
    businessName: businessName,
    businessWebsite: customer.website.trim(),
    businessStreetAddress: customer.address.trim(),
    businessCity: customer.city.trim(),
    businessStateProvinceRegion: customer.state.trim(),
    businessPostalCode: customer.zip_code.trim(),
    businessCountry: 'US',
    businessContactEmail: customer.email || ADMIN_EMAIL,
    businessContactPhone: customer.phone?.trim() || undefined,
    notificationEmail: ADMIN_EMAIL,
    useCaseCategories: ['CUSTOMER_CARE'],
    useCaseSummary:
      `${businessName} uses this number to reply to inbound SMS inquiries from its own customers and leads. ` +
      `Consumers initiate contact by texting the number, which ${businessName} advertises on its website and business listings. ` +
      `Replies answer questions about services, pricing, and appointment scheduling. ` +
      `Consumers can opt out at any time by replying STOP.`,
    productionMessageSample:
      `Hi! Thanks for reaching out to ${businessName}. Happy to help — what service are you looking for? ` +
      `Reply STOP to opt out, HELP for help.`,
    optInType: 'VIA_TEXT',
    optInImageUrls: [`${BASE_URL}/sms-optin-example`],
    messageVolume: '1,000',
    additionalInformation:
      `Messaging is consumer-initiated customer care. Opt-in details: ${BASE_URL}/sms-optin-example. ` +
      `SMS terms: ${BASE_URL}/privacy#sms-terms`,
  });

  await query(
    `UPDATE customer_phone_numbers
     SET tfv_sid = $1, tfv_status = $2, tfv_submitted_at = NOW(), updated_at = NOW()
     WHERE twilio_sid = $3`,
    [verification.sid, verification.status || 'PENDING_REVIEW', phoneNumberSid]
  ).catch(() => {});

  console.log(`✅ TFV submitted for ${businessName}: ${verification.sid} (${verification.status})`);
  return { submitted: true, verificationSid: verification.sid, status: verification.status };
}

/**
 * Check all pending toll-free verifications against Twilio.
 * Called hourly by the cron. On approval: mark verified + email the customer.
 * On rejection: email the admin so it can be fixed within the 7-day priority window.
 */
export async function checkPendingTollfreeVerifications() {
  if (!twilioClient) return { checked: 0 };

  await ensureTfvColumns();

  const pending = await query(
    `SELECT cpn.tfv_sid, cpn.phone_number, cpn.twilio_sid, cpn.clerk_user_id,
            c.business_name, c.email
     FROM customer_phone_numbers cpn
     LEFT JOIN customers c ON c.clerk_user_id = cpn.clerk_user_id
     WHERE cpn.tfv_sid IS NOT NULL
       AND cpn.tfv_status NOT IN ('TWILIO_APPROVED', 'TWILIO_REJECTED_FINAL')`
  ).catch(() => ({ rows: [] }));

  let approved = 0, rejected = 0;

  for (const row of pending.rows) {
    try {
      const verification = await twilioClient.messaging.v1
        .tollfreeVerifications(row.tfv_sid).fetch();

      if (verification.status === 'TWILIO_APPROVED') {
        await query(
          `UPDATE customer_phone_numbers
           SET tfv_status = 'TWILIO_APPROVED', tfv_approved_at = NOW(), updated_at = NOW()
           WHERE tfv_sid = $1`,
          [row.tfv_sid]
        ).catch(() => {});
        await sendVerificationApprovedEmail(row);
        approved++;
        console.log(`🎉 TFV approved: ${row.phone_number} (${row.business_name})`);

      } else if (verification.status === 'TWILIO_REJECTED') {
        const reason = verification.rejectionReason || 'See Twilio Console for details';
        await query(
          `UPDATE customer_phone_numbers
           SET tfv_status = 'TWILIO_REJECTED', tfv_rejection_reason = $1, updated_at = NOW()
           WHERE tfv_sid = $2`,
          [reason, row.tfv_sid]
        ).catch(() => {});
        await sendVerificationRejectedAdminEmail(row, reason);
        rejected++;
        console.log(`❌ TFV rejected: ${row.phone_number} — ${reason}`);

      } else if (verification.status !== row.tfv_status) {
        await query(
          `UPDATE customer_phone_numbers SET tfv_status = $1, updated_at = NOW() WHERE tfv_sid = $2`,
          [verification.status, row.tfv_sid]
        ).catch(() => {});
      }
    } catch (err) {
      console.error(`⚠️ TFV status check failed for ${row.tfv_sid}:`, err.message);
    }
  }

  return { checked: pending.rows.length, approved, rejected };
}

async function sendVerificationApprovedEmail(row) {
  try {
    if (!resend || !row.email) return;

    const prettyNumber = formatPhone(row.phone_number);

    await resend.emails.send({
      from: 'BizzyBot AI <alerts@bizzybotai.com>',
      to: row.email,
      subject: `🎉 Your BizzyBot number is live — ${prettyNumber}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#0D1117;border-radius:12px;overflow:hidden;border:1px solid #30363D;">
          <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 28px;">
            <p style="margin:0;font-size:32px;line-height:1;">🎉</p>
            <h1 style="margin:10px 0 4px;font-size:22px;color:#fff;font-weight:700;">Your AI number is live!</h1>
            <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">${row.business_name || 'Your BizzyBot'}</p>
          </div>
          <div style="padding:24px 28px;background:#161B22;">
            <p style="color:#C9D1D9;font-size:14px;line-height:1.6;margin:0 0 16px;">
              Great news — your business number <strong style="color:#E6EDF3;">${prettyNumber}</strong> is verified and ready to text.
              Your AI assistant is now answering SMS messages 24/7.
            </p>
            <p style="color:#C9D1D9;font-size:14px;line-height:1.6;margin:0 0 20px;">
              Next step: put this number on your website, Google Business listing, and anywhere customers find you.
            </p>
            <a href="https://bizzybotai.com/dashboard" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Open Dashboard →</a>
          </div>
        </div>
      `,
    });
    console.log(`✅ Verification-approved email sent to ${row.email}`);
  } catch (err) {
    console.error('⚠️ Approved email failed:', err.message);
  }
}

async function sendVerificationRejectedAdminEmail(row, reason) {
  try {
    if (!resend) return;
    await resend.emails.send({
      from: 'BizzyBot AI <alerts@bizzybotai.com>',
      to: ADMIN_EMAIL,
      subject: `⚠️ Toll-free verification REJECTED — ${row.phone_number} (${row.business_name || 'unknown'})`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;">
          <h2>Toll-free verification rejected</h2>
          <p><strong>Number:</strong> ${row.phone_number}</p>
          <p><strong>Customer:</strong> ${row.business_name || 'unknown'} (${row.email || 'no email'})</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>⏰ Edit &amp; resubmit within <strong>7 days</strong> to keep the priority review spot.
          Fix it in the Twilio Console → Trust Hub → Registrations.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('⚠️ Rejected admin email failed:', err.message);
  }
}

function formatPhone(number) {
  const cleaned = String(number || '').replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return number;
}
