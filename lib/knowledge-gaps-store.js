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
export async function recordGap({
  customerId, topic, question, channel,
  contactId = null, contactEmail = null, contactPhone = null,
  contactName = null, vapiCallId = null,
} = {}) {
  try {
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
