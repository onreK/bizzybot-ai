import OpenAI from 'openai';
import { query } from './database.js';
import { sendEmail } from './resend-send.js';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// After a voice call: if the caller asked for documents, email them the links
// (voice can't deliver links live). Never throws — the webhook's call logging
// must survive any failure here.
export async function processVoiceDocumentFollowup({ customerId, clerkUserId, vapiCallId, callerPhone, transcript, existingContact }) {
  try {
    if (!openai || !transcript) return { handled: false };

    const settingsResult = await query(
      `SELECT business_name, documents FROM ai_channel_settings
       WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    const s = settingsResult.rows[0];
    const docs = Array.isArray(s?.documents)
      ? s.documents.filter(d => d?.link?.trim() && d?.description?.trim())
      : [];
    if (docs.length === 0) return { handled: false };

    const businessName = s.business_name || 'the business';

    // Extract intent + email from the transcript (strict JSON)
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You extract facts from a phone call transcript between a caller and ${businessName}'s AI assistant. ` +
            `Available documents: ${docs.map(d => d.description).join('; ')}. ` +
            `Return JSON: {"wants_documents": boolean, "email": string|null, "requested": string[]}. ` +
            `wants_documents = the caller asked to receive a document/form or agreed to have one emailed. ` +
            `email = the caller's email address if they stated one (convert spoken form: "john dot smith at gmail dot com" -> "john.smith@gmail.com"); null if none or unclear. ` +
            `Email rules: transcripts often contain WRONG variants the assistant misheard and the caller then corrected — use ONLY the FINAL version the caller explicitly confirmed as correct. ` +
            `Honor explicit corrections literally (e.g. "there's no dot between kerno and junk" means kernojunk, not kerno.junk). ` +
            `Letter-by-letter spellings are authoritative: join the letters exactly as spoken with no punctuation added. ` +
            `If the transcript ends without a clearly confirmed address, or you are not confident which variant is right, return null — a missed email is recoverable, a wrong one is not. ` +
            `requested = which of the available document names the caller wanted (empty array if unclear).`,
        },
        { role: 'user', content: transcript.slice(0, 12000) },
      ],
    });
    let parsed;
    try { parsed = JSON.parse(extraction.choices[0].message.content); } catch { return { handled: false }; }
    if (!parsed.wants_documents) return { handled: false };

    const email = (parsed.email || '').trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      // Caller wanted documents but we couldn't capture a usable email — leave
      // a follow-up note on the call record instead of sending blindly.
      await query(
        `UPDATE vapi_call_logs
         SET summary = COALESCE(summary, '') || $1
         WHERE vapi_call_id = $2`,
        [`\n\n⚠️ Caller requested documents — no valid email captured. Follow up: ${callerPhone || 'unknown number'}.`, vapiCallId]
      ).catch(() => {});
      console.log(`⚠️ Voice doc request without valid email on call ${vapiCallId}`);
      return { handled: true, noted: true };
    }

    // Which documents to include: the requested ones, or all if unclear
    const requested = Array.isArray(parsed.requested) ? parsed.requested.map(r => String(r).toLowerCase()) : [];
    const matched = docs.filter(d =>
      requested.some(r => d.description.toLowerCase().includes(r) || r.includes(d.description.toLowerCase()))
    );
    const toSend = matched.length > 0 ? matched : docs;

    // Replies should reach the business, not BizzyBot, when they have an email on file
    const bizEmailResult = await query(
      `SELECT business_email FROM sms_verification_info WHERE clerk_user_id = $1 LIMIT 1`,
      [clerkUserId]
    ).catch(() => ({ rows: [] }));
    const replyTo = (bizEmailResult.rows[0]?.business_email || '').trim();

    const sendResult = await sendEmail({
      from: `${businessName} via BizzyBot <alerts@bizzybotai.com>`,
      to: email,
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `Documents from ${businessName}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#0D1117;border-radius:12px;overflow:hidden;border:1px solid #30363D;">
          <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 28px;">
            <h1 style="margin:0 0 4px;font-size:20px;color:#fff;font-weight:700;">Documents from ${businessName}</h1>
            <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">As promised on your call</p>
          </div>
          <div style="padding:24px 28px;background:#161B22;">
            <p style="color:#C9D1D9;font-size:14px;line-height:1.6;margin:0 0 16px;">
              Thanks for calling ${businessName}! Here ${toSend.length === 1 ? 'is the document' : 'are the documents'} you asked about:
            </p>
            ${toSend.map(d => `<p style="margin:0 0 12px;"><a href="${d.link}" style="color:#a78bfa;font-size:14px;font-weight:600;">${d.description} →</a></p>`).join('')}
            <p style="color:#8B949E;font-size:12px;line-height:1.6;margin:16px 0 0;">
              Questions? Just reply to this email or give us a call back.
            </p>
          </div>
        </div>
      `,
    }, `voice documents (call ${vapiCallId})`);

    if (!sendResult.sent) {
      // No fake success: record the failure on the call so the owner can
      // follow up — and don't log an event or touch the contact.
      await query(
        `UPDATE vapi_call_logs
         SET summary = COALESCE(summary, '') || $1
         WHERE vapi_call_id = $2`,
        [`\n\n⚠️ Caller requested documents and gave ${email}, but the email FAILED to send. Follow up: ${callerPhone || 'unknown number'}.`, vapiCallId]
      ).catch(() => {});
      return { handled: true, sendFailed: true };
    }

    // Analytics: same event shape as text-channel document sends
    await query(
      `INSERT INTO ai_analytics_events
       (customer_id, event_type, metadata, channel, confidence_score, created_at)
       VALUES ($1, 'document_sent', $2, 'voice', 1.0, CURRENT_TIMESTAMP)`,
      [customerId, JSON.stringify({ documents: toSend.map(d => d.description), email, vapi_call_id: vapiCallId })]
    ).catch(err => console.error('⚠️ voice document_sent event insert failed:', err.message));

    // Capture the email onto THIS caller's contact — targeted update, fill
    // only if blank. (createOrUpdateContact matches by email first, which can
    // collide with a different contact that already has this email.)
    if (callerPhone && !existingContact?.email) {
      await query(
        `UPDATE contacts SET email = $1, updated_at = CURRENT_TIMESTAMP
         WHERE customer_id = $2 AND phone = $3 AND (email IS NULL OR email = '')`,
        [email, customerId, callerPhone]
      ).catch(err => {
        // unique_customer_email = this email already lives on another contact
        // of this customer — expected occasionally, nothing to fix.
        const expected = /unique_customer_email/.test(err.message);
        console[expected ? 'log' : 'error'](
          `${expected ? 'ℹ️' : '⚠️'} voice contact email fill skipped: ${err.message}`
        );
      });
    }

    console.log(`📧 Voice documents emailed to ${email} (call ${vapiCallId}): ${toSend.map(d => d.description).join(', ')}`);
    return { handled: true, emailedTo: email };
  } catch (err) {
    console.error('⚠️ Voice document follow-up failed (non-fatal):', err.message);
    return { handled: false };
  }
}
