// lib/knowledge-gaps-store.js
// DB side of the unanswered-questions queue: the knowledge_gaps table,
// recording, grouped reads, answering (six-way KB write-back + Vapi re-sync),
// dismissing, and follow-up recording.
//
// Recording NEVER throws — a reporting feature must not be able to break a
// live conversation. Every write is wrapped; failures log and return.
// Spec: docs/superpowers/specs/2026-07-26-unanswered-questions-queue-design.md

import { query } from './database.js';
import { normalizeTopic, GAP_TOPIC_LABELS } from './knowledge-gaps.js';

export async function ensureKnowledgeGapsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS knowledge_gaps (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      topic TEXT,
      question TEXT,
      channel TEXT,
      contact_id INTEGER,
      contact_email TEXT,
      contact_phone TEXT,
      contact_name TEXT,
      status TEXT DEFAULT 'open',
      answer TEXT,
      answered_at TIMESTAMP,
      followup_at TIMESTAMP,
      followup_method TEXT,
      vapi_call_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await query(
    `CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_customer_status
     ON knowledge_gaps (customer_id, status, created_at DESC)`
  ).catch(() => {});
  await query(
    `CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_vapi_call
     ON knowledge_gaps (vapi_call_id)`
  ).catch(() => {});
}

/**
 * Pure grouping — topics ordered by most recent activity, questions newest
 * first inside each group. Exported separately so it is testable without a DB.
 */
export function groupGapRows(rows) {
  const byTopic = new Map();

  for (const r of rows) {
    const topic = normalizeTopic(r.topic);
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push({
      id: r.id,
      question: r.question,
      channel: r.channel,
      contactName: r.contact_name || null,
      contactEmail: r.contact_email || null,
      contactPhone: r.contact_phone || null,
      createdAt: r.created_at,
      followupAt: r.followup_at || null,
      followupMethod: r.followup_method || null,
    });
  }

  const groups = [];
  for (const [topic, questions] of byTopic) {
    questions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    groups.push({
      topic,
      label: GAP_TOPIC_LABELS[topic] || 'Other',
      count: questions.length,
      questions,
    });
  }

  groups.sort((a, b) =>
    new Date(b.questions[0].createdAt) - new Date(a.questions[0].createdAt)
  );
  return groups;
}

/**
 * Record one gap. Deliberately swallows every error: the reply has already
 * been sent to the lead by the time this runs, and losing a queue entry is
 * always preferable to throwing inside a live message path.
 */
export async function recordGap(args) {
  try {
    // Destructured INSIDE the try, not in the signature: a default parameter
    // only substitutes for undefined, so `recordGap(null)` would otherwise
    // reject during parameter binding — before this try block is ever entered.
    // This function runs with a real lead waiting on a reply; it must not
    // reject for any input, ever.
    const {
      customerId, topic, question, channel,
      contactId = null, contactEmail = null, contactPhone = null,
      contactName = null, vapiCallId = null,
    } = args || {};

    if (!customerId || !question) return;
    await ensureKnowledgeGapsTable();

    // Same-conversation dedup: one row per topic per identified contact per
    // 24h, so a confused back-and-forth cannot produce five identical entries.
    // With NO identity at all (anonymous web chat) there is nothing to dedup
    // against — two different visitors are not the same person, and the spec
    // requires anonymous asks to count toward the tally, so we always record.
    const hasIdentity = !!(contactPhone || contactEmail || contactId);
    if (hasIdentity) {
      const dupe = await query(
        `SELECT id FROM knowledge_gaps
         WHERE customer_id = $1 AND topic = $2 AND status = 'open'
           AND COALESCE(contact_phone, '') = COALESCE($3, '')
           AND COALESCE(contact_email, '') = COALESCE($4, '')
           AND contact_id IS NOT DISTINCT FROM $5
           AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [customerId, normalizeTopic(topic), contactPhone, contactEmail, contactId]
      ).catch(() => ({ rows: [] }));
      if (dupe.rows.length > 0) return;
    }

    await query(
      `INSERT INTO knowledge_gaps
         (customer_id, topic, question, channel, contact_id,
          contact_email, contact_phone, contact_name, vapi_call_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [customerId, normalizeTopic(topic), String(question).slice(0, 500), channel,
       contactId, contactEmail, contactPhone, contactName, vapiCallId]
    );

    console.log(`🧠 [GAPS] recorded ${normalizeTopic(topic)} from ${channel}: "${String(question).slice(0, 80)}"`);
  } catch (err) {
    console.error('⚠️ [GAPS] failed to record gap (reply already sent, continuing):', err.message);
  }
}

/** Has this call already been scanned? Vapi can re-deliver a webhook. */
export async function hasScannedCall({ customerId, vapiCallId } = {}) {
  if (!vapiCallId) return false;
  const result = await query(
    `SELECT id FROM knowledge_gaps WHERE vapi_call_id = $1 AND customer_id = $2 LIMIT 1`,
    [vapiCallId, customerId]
  ).catch(() => ({ rows: [] }));
  return result.rows.length > 0;
}

export async function getOpenGapsGrouped(customerId) {
  await ensureKnowledgeGapsTable();
  // Bounded read: with more than 200 open rows the oldest topics fall off the
  // dashboard entirely. That state means the queue has gone unattended for a
  // long time; revisit with a per-topic cap if it ever happens in practice.
  const result = await query(
    `SELECT id, topic, question, channel, contact_name, contact_email,
            contact_phone, created_at, followup_at, followup_method
     FROM knowledge_gaps
     WHERE customer_id = $1 AND status = 'open'
     ORDER BY created_at DESC
     LIMIT 200`,
    [customerId]
  ).catch(() => ({ rows: [] }));
  return groupGapRows(result.rows);
}

/** Format one Q&A pair for appending to a knowledge base. Pure. */
export function buildKnowledgeEntry(question, answer) {
  const q = String(question || '').trim();
  const a = String(answer || '').trim();
  const punctuated = /[.?!]$/.test(q) ? q : `${q}?`;
  return `Q: ${punctuated}\nA: ${a}`;
}

/**
 * Push the customer's voice knowledge base to Vapi.
 *
 * WHY THIS EXISTS: the five text channels read ai_channel_settings fresh on
 * every message, so a knowledge-base append takes effect immediately. Voice
 * does NOT — the Vapi assistant holds its own copy of the system prompt,
 * pushed only by /api/vapi/provision or /api/admin/sync-vapi. Without this
 * call the phone AI silently keeps the old brain until someone manually hits
 * Save & Sync, and the feature looks broken with no error anywhere.
 *
 * Fire-and-forget: a Vapi outage or an unprovisioned customer must never fail
 * the owner's save. The knowledge base is already written; the next manual
 * sync will pick it up.
 */
async function resyncVapiAssistant(customerId) {
  try {
    const settingsResult = await query(
      `SELECT * FROM ai_channel_settings WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    const settings = settingsResult.rows[0];
    if (!settings) return;

    const numberResult = await query(
      `SELECT vapi_assistant_id FROM customer_phone_numbers
       WHERE customer_id = $1 AND vapi_assistant_id IS NOT NULL LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    const assistantId = numberResult.rows[0]?.vapi_assistant_id;
    if (!assistantId) return;

    const { updateAssistant, buildVoiceSystemPrompt } = await import('./vapi.js');
    await updateAssistant(assistantId, {
      businessName: settings.business_name || '',
      systemPrompt: buildVoiceSystemPrompt(settings),
    });
    console.log(`🔄 [GAPS] Vapi assistant ${assistantId} re-synced with the new answer`);
  } catch (err) {
    console.error('⚠️ [GAPS] Vapi re-sync failed (knowledge base still saved):', err.message);
  }
}

/**
 * Save an answer for a whole topic group: append to all six channel knowledge
 * bases, re-sync Vapi, mark the rows answered, and return the leads who are
 * still waiting so the UI can offer follow-up.
 */
export async function answerGapTopic({ customerId, topic, answer }) {
  await ensureKnowledgeGapsTable();
  const normalizedTopic = normalizeTopic(topic);
  const trimmedAnswer = String(answer || '').trim();
  if (!trimmedAnswer) return { success: false, error: 'empty_answer', updatedChannels: 0, leads: [] };

  const openResult = await query(
    `SELECT id, question, channel, contact_name, contact_email, contact_phone
     FROM knowledge_gaps
     WHERE customer_id = $1 AND topic = $2 AND status = 'open'
     ORDER BY created_at DESC`,
    [customerId, normalizedTopic]
  ).catch(() => ({ rows: [] }));

  if (openResult.rows.length === 0) return { success: false, error: 'no_open_gaps', updatedChannels: 0, leads: [] };

  // The newest question phrasing represents the group in the knowledge base.
  const entry = buildKnowledgeEntry(openResult.rows[0].question, trimmedAnswer);

  // Append to EVERY channel row for this customer — business facts do not vary
  // by channel, only tone does. Append only; existing content is never rewritten.
  // Note: only rows that already exist are updated. A channel the customer has
  // never configured has no settings row and is picked up when one is created.
  const updateResult = await query(
    `UPDATE ai_channel_settings
     SET knowledge_base =
       CASE WHEN COALESCE(knowledge_base, '') = ''
            THEN $2
            ELSE knowledge_base || E'\\n\\n' || $2 END
     WHERE customer_id = $1
     RETURNING channel`,
    [customerId, entry]
  ).catch((err) => {
    console.error('❌ [GAPS] knowledge base append failed:', err.message);
    return { rows: [] };
  });

  if (updateResult.rows.length === 0) {
    return { success: false, error: 'no_channel_settings', updatedChannels: 0, leads: [] };
  }

  await query(
    `UPDATE knowledge_gaps
     SET status = 'answered', answer = $1, answered_at = NOW()
     WHERE customer_id = $2 AND topic = $3 AND status = 'open'`,
    [trimmedAnswer, customerId, normalizedTopic]
  ).catch((err) => console.error('⚠️ [GAPS] failed to mark rows answered:', err.message));

  await resyncVapiAssistant(customerId);

  const leads = openResult.rows.map(r => ({
    gapId: r.id,
    question: r.question,
    channel: r.channel,
    contactName: r.contact_name || null,
    contactEmail: r.contact_email || null,
    contactPhone: r.contact_phone || null,
  }));

  console.log(`✅ [GAPS] answered "${normalizedTopic}" for customer ${customerId} — ${updateResult.rows.length} channels updated, ${leads.length} leads waiting`);
  return { success: true, updatedChannels: updateResult.rows.length, leads };
}

export async function dismissGapTopic({ customerId, topic }) {
  await ensureKnowledgeGapsTable();
  await query(
    `UPDATE knowledge_gaps SET status = 'dismissed'
     WHERE customer_id = $1 AND topic = $2 AND status = 'open'`,
    [customerId, normalizeTopic(topic)]
  ).catch((err) => console.error('⚠️ [GAPS] dismiss failed:', err.message));
  return { success: true };
}

/** Record that one lead was followed up: 'sms' | 'email' | 'manual'. */
export async function recordFollowup({ customerId, gapId, method }) {
  await ensureKnowledgeGapsTable();
  const result = await query(
    `UPDATE knowledge_gaps SET followup_at = NOW(), followup_method = $1
     WHERE id = $2 AND customer_id = $3
     RETURNING id`,
    [method, gapId, customerId]
  ).catch(() => ({ rows: [] }));
  return { success: result.rows.length > 0 };
}

/** One gap row, scoped to its owner — used by the follow-up route. */
export async function getGapById({ customerId, gapId }) {
  await ensureKnowledgeGapsTable();
  const result = await query(
    `SELECT * FROM knowledge_gaps WHERE id = $1 AND customer_id = $2 LIMIT 1`,
    [gapId, customerId]
  ).catch(() => ({ rows: [] }));
  return result.rows[0] || null;
}
