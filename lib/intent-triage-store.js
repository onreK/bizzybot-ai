// lib/intent-triage-store.js
// DB side of email intent triage: the email_triage table, per-customer signal
// gathering, owner corrections (few-shot examples), and the runTriage()
// orchestrator the email monitors call before any reply is generated.

import { query } from './database.js';
import { classifyEmailIntent, decideAction } from './intent-triage.js';

export async function ensureTriageTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS email_triage (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      channel TEXT,
      message_id TEXT UNIQUE,
      thread_id TEXT,
      contact_email TEXT,
      contact_name TEXT,
      subject TEXT,
      body_snippet TEXT,
      class TEXT,
      confidence TEXT,
      reason TEXT,
      model TEXT,
      action TEXT,
      corrected_class TEXT,
      corrected_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}

async function getTriageRecord(channel, messageId) {
  const result = await query(
    `SELECT * FROM email_triage WHERE channel = $1 AND message_id = $2 LIMIT 1`,
    [channel, messageId]
  ).catch(() => ({ rows: [] }));
  return result.rows[0] || null;
}

async function isThreadFlagged(customerId, channel, threadId) {
  if (!threadId) return false;
  const result = await query(
    `SELECT id FROM email_triage
     WHERE customer_id = $1 AND channel = $2 AND thread_id = $3
       AND action IN ('flagged', 'conservative_reply')
       AND corrected_class IS NULL
     LIMIT 1`,
    [customerId, channel, threadId]
  ).catch(() => ({ rows: [] }));
  return result.rows.length > 0;
}

async function getCorrections(customerId, limit = 10) {
  const result = await query(
    `SELECT contact_email, subject, body_snippet, corrected_class
     FROM email_triage
     WHERE customer_id = $1 AND corrected_class IS NOT NULL
     ORDER BY corrected_at DESC
     LIMIT $2`,
    [customerId, limit]
  ).catch(() => ({ rows: [] }));
  return result.rows.map(r => ({
    fromEmail: r.contact_email,
    subject: r.subject,
    bodySnippet: r.body_snippet,
    correctedClass: r.corrected_class,
  }));
}

async function gatherTriageSignals({ customerId, fromEmail, fromName, subject, body, isReplyToOurThread }) {
  // Business profile: who is this business, so "lead" is defined per-business
  const bizResult = await query(
    `SELECT c.business_name, acs.industry, acs.business_description
     FROM customers c
     LEFT JOIN ai_channel_settings acs ON acs.customer_id = c.id AND acs.channel = 'email'
     WHERE c.id = $1
     LIMIT 1`,
    [customerId]
  ).catch(() => ({ rows: [] }));
  const biz = bizResult.rows[0] || {};

  // Is the sender a contact we already know?
  const contactResult = await query(
    `SELECT id, name, lead_score, temperature FROM contacts
     WHERE customer_id = $1 AND LOWER(email) = LOWER($2)
     LIMIT 1`,
    [customerId, fromEmail]
  ).catch(() => ({ rows: [] }));
  const contact = contactResult.rows[0] || null;

  const corrections = await getCorrections(customerId);

  return {
    subject,
    body,
    fromEmail,
    fromName,
    isReplyToOurThread: !!isReplyToOurThread,
    isExistingContact: !!contact,
    contactSummary: contact
      ? `Known contact${contact.name ? ` "${contact.name}"` : ''}, lead score ${contact.lead_score ?? 'unknown'} (${contact.temperature || 'unknown'}).`
      : '',
    businessName: biz.business_name || '',
    industry: biz.industry || '',
    businessDescription: biz.business_description || '',
    corrections,
  };
}

/**
 * The one entry point the email monitors call BEFORE generating any reply.
 * Idempotent per message: a message already triaged returns its stored result
 * (no duplicate OpenAI spend, stable decisions across cron re-runs).
 */
export async function runTriage(input) {
  const { customerId, channel, messageId, threadId, fromEmail, fromName, subject, body, isReplyToOurThread } = input;

  await ensureTriageTable();

  const existing = await getTriageRecord(channel, messageId);
  if (existing) {
    return {
      action: existing.action,
      classification: {
        class: existing.class,
        confidence: existing.confidence,
        reason: existing.reason,
        model: existing.model,
      },
      businessName: '', // callers only need this on first classification
      reused: true,
    };
  }

  const signals = await gatherTriageSignals({ customerId, fromEmail, fromName, subject, body, isReplyToOurThread });
  const classification = await classifyEmailIntent(signals);
  const threadAlreadyFlagged = await isThreadFlagged(customerId, channel, threadId);
  const { action } = decideAction(classification, { threadAlreadyFlagged });

  // Store 'replied' for the reply action so the row reads as an outcome log
  const storedAction =
    action === 'reply' ? 'replied'
    : action === 'skip' ? 'skipped'
    : action === 'flag' ? 'flagged'
    : action;

  await query(
    `INSERT INTO email_triage
       (customer_id, channel, message_id, thread_id, contact_email, contact_name,
        subject, body_snippet, class, confidence, reason, model, action)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (message_id) DO NOTHING`,
    [customerId, channel, messageId, threadId || null, fromEmail, fromName || null,
     (subject || '').slice(0, 500), (body || '').slice(0, 500),
     classification.class, classification.confidence, classification.reason,
     classification.model, storedAction]
  ).catch(err => console.error('⚠️ [TRIAGE] failed to record triage row:', err.message));

  console.log(`🧠 [TRIAGE] ${channel} ${fromEmail}: ${classification.class}/${classification.confidence} → ${action} (${classification.reason})`);

  return { action: storedAction, classification, businessName: signals.businessName, reused: false };
}

/** Owner one-click correction: "This was a lead" / "Not a lead". */
export async function recordCorrection({ customerId, channel, messageId, correctedClass }) {
  await ensureTriageTable();
  const result = await query(
    `UPDATE email_triage
     SET corrected_class = $1, corrected_at = NOW()
     WHERE customer_id = $2 AND channel = $3 AND message_id = $4
     RETURNING id`,
    [correctedClass, customerId, channel, messageId]
  ).catch(() => ({ rows: [] }));
  if (result.rows.length === 0) return { success: false, notFound: true };
  return { success: true };
}

/** All recent triage results for a customer (inbox overlay + flag list). */
export async function getTriageForCustomer(customerId, limit = 100) {
  await ensureTriageTable();
  const result = await query(
    `SELECT channel, message_id, thread_id, contact_email, subject,
            class, confidence, reason, action, corrected_class, created_at
     FROM email_triage
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [customerId, limit]
  ).catch(() => ({ rows: [] }));
  return result.rows;
}
