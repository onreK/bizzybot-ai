// lib/intent-triage.js
// Email intent triage CORE — pure logic + OpenAI classification. No database
// imports (the eval script and tests import this file standalone; DB work
// lives in lib/intent-triage-store.js).
//
// Design principle — ASYMMETRIC CAUTION: wrongly auto-replying to business
// correspondence is a reputation wound; wrongly flagging a real lead costs
// hours and stays visible. All uncertainty routes to flag-first. An automatic
// reply requires a high-confidence lead classification; nothing else earns one.
// Spec: docs/superpowers/specs/2026-07-19-intent-triage-design.md

import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const TRIAGE_CLASSES = [
  'new_lead',
  'existing_lead_reply',
  'business_correspondence',
  'automated',
  'ambiguous',
];

const CONFIDENCE_LEVELS = ['high', 'medium', 'low'];

export function conservativeReply(businessName) {
  const name = (businessName || '').trim() || 'us';
  return `Thanks for reaching out to ${name} — happy to help! Could you share a bit more about what you're looking for?`;
}

/**
 * The single routing rule. Only high-confidence lead classes auto-reply;
 * high-confidence business correspondence is flagged; high-confidence
 * automated is skipped; EVERYTHING else (ambiguous class, medium/low
 * confidence, malformed input) gets one conservative reply + flag — unless
 * the thread is already flagged, in which case flag only (never a second
 * automatic reply on a flagged thread).
 */
export function decideAction(classification = {}, { threadAlreadyFlagged = false } = {}) {
  classification = classification || {};
  const cls = classification.class;
  const confidence = classification.confidence;

  if (confidence === 'high' && (cls === 'new_lead' || cls === 'existing_lead_reply')) {
    return { action: 'reply' };
  }
  if (confidence === 'high' && cls === 'business_correspondence') {
    return { action: 'flag' };
  }
  if (confidence === 'high' && cls === 'automated') {
    return { action: 'skip' };
  }
  // Ambiguous handling (includes garbage/malformed classifications — fail safe)
  if (threadAlreadyFlagged) return { action: 'flag' };
  return { action: 'conservative_reply' };
}

const FREEMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
  'icloud.com', 'me.com', 'msn.com', 'live.com', 'proton.me', 'protonmail.com',
];

const ROLE_ADDRESSES = [
  'support', 'billing', 'sales', 'info', 'admin', 'accounts', 'accounting',
  'hr', 'careers', 'jobs', 'legal', 'invoices', 'help', 'service',
  'noreply', 'no-reply', 'team', 'office', 'contact',
];

function describeSender(fromEmail = '') {
  const email = fromEmail.toLowerCase();
  const [localPart, domain = ''] = email.split('@');
  const traits = [];
  traits.push(
    FREEMAIL_DOMAINS.includes(domain)
      ? 'personal/freemail domain (individual person — consumers writing from these are often genuine leads)'
      : `corporate domain (${domain || 'unknown'})`
  );
  if (ROLE_ADDRESSES.includes(localPart)) {
    traits.push(`role address ("${localPart}@" — typically a company function like support/billing/sales, not a consumer inquiry)`);
  }
  return traits.join('; ');
}

/**
 * Builds the classification prompt from the gathered signals.
 * signals: { subject, body, fromEmail, fromName, isReplyToOurThread,
 *            isExistingContact, contactSummary, businessName, industry,
 *            businessDescription, corrections }
 */
export function buildTriagePrompt(signals) {
  const {
    subject = '', body = '', fromEmail = '', fromName = '',
    isReplyToOurThread = false, isExistingContact = false, contactSummary = '',
    businessName = '', industry = '', businessDescription = '',
    corrections = [],
  } = signals || {};

  // Normalize string fields to handle null/non-string values
  const normalizedSubject = String(subject || '');
  const normalizedBody = String(body || '');
  const normalizedFromEmail = String(fromEmail || '');
  const normalizedFromName = String(fromName || '');
  const normalizedBusinessName = String(businessName || '');
  const normalizedIndustry = String(industry || '');
  const normalizedBusinessDescription = String(businessDescription || '');
  const normalizedContactSummary = String(contactSummary || '');

  const system = `You classify inbound email for a small business's AI assistant. The assistant may ONLY auto-reply to genuine sales leads — misclassifying company correspondence as a lead (and pitching services to, say, a support engineer) damages the business's reputation.

Classify the email into exactly one class:
- "new_lead": a prospective CUSTOMER of this business asking about its services — a genuine inquiry this business would want to win (what counts as a lead depends on the business profile below: someone BUYING what this business sells, not someone SELLING to it).
- "existing_lead_reply": a reply from a known lead continuing an existing sales conversation.
- "business_correspondence": vendors, suppliers, wholesale offers, customer-support agents of OTHER companies replying to this business, partners, recruiting, legal, invoices owed BY the business, platform/account notices written by a human. Never something to auto-reply to.
- "automated": newsletters, receipts, automated notifications, marketing blasts, no-reply machinery.
- "ambiguous": too little content to tell (terse notes, bare "call me", unclear intent).

Confidence rules (asymmetric caution): use "high" only when the evidence is strong and consistent. If a reasonable person could read the email either way, use "medium" or "low". It is far worse to call business correspondence a lead than to be unsure.

Reply with STRICT JSON only: {"class": "<one class>", "confidence": "high"|"medium"|"low", "reason": "<one short sentence>"}`;

  let user = `THE BUSINESS RECEIVING THIS EMAIL:
- Name: ${normalizedBusinessName || 'unknown'}`;
  if (normalizedIndustry) user += `\n- Industry: ${normalizedIndustry}`;
  if (normalizedBusinessDescription) user += `\n- What they do: ${normalizedBusinessDescription.slice(0, 400)}`;

  user += `\n\nSENDER:
- From: ${normalizedFromName ? `${normalizedFromName} <${normalizedFromEmail}>` : normalizedFromEmail}
- Sender traits: ${describeSender(normalizedFromEmail)}
- ${isReplyToOurThread ? 'This IS a REPLY to a thread our assistant already participated in.' : 'This is NOT a reply to any thread of ours (fresh inbound).'}
- ${isExistingContact ? `Sender is a KNOWN contact. ${normalizedContactSummary}`.trim() : 'Sender is not a known contact.'}`;

  if (Array.isArray(corrections) && corrections.length > 0) {
    user += `\n\nOWNER CORRECTIONS (ground truth this business owner gave on past classifications — weigh these heavily for similar emails):`;
    for (const c of corrections.slice(0, 10)) {
      user += `\n- From ${c.fromEmail} | Subject: "${(c.subject || '').slice(0, 80)}" | "${(c.bodySnippet || '').slice(0, 120)}" → correct class: ${c.correctedClass}`;
    }
  }

  user += `\n\nTHE EMAIL:
Subject: ${normalizedSubject.slice(0, 300)}
Body:
${normalizedBody.slice(0, 2500)}`;

  return { system, user };
}

async function runClassifierModel(model, system, user) {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 150,
    temperature: 0.1,
  });
  const raw = JSON.parse(completion.choices[0].message.content);
  const cls = TRIAGE_CLASSES.includes(raw.class) ? raw.class : 'ambiguous';
  const confidence = CONFIDENCE_LEVELS.includes(raw.confidence) ? raw.confidence : 'low';
  return { class: cls, confidence, reason: String(raw.reason || '').slice(0, 300), model };
}

/**
 * Two-tier classification: gpt-4o-mini first; anything short of high
 * confidence gets one second opinion from gpt-4o, which is final.
 * Fails safe: any error returns ambiguous/low (→ conservative reply + flag).
 */
export async function classifyEmailIntent(signals) {
  if (!openai) {
    return { class: 'ambiguous', confidence: 'low', reason: 'OpenAI not configured', model: 'none' };
  }
  try {
    const { system, user } = buildTriagePrompt(signals);
    const first = await runClassifierModel('gpt-4o-mini', system, user);
    if (first.confidence === 'high') return first;
    try {
      const second = await runClassifierModel('gpt-4o', system, user);
      return second;
    } catch (secondErr) {
      console.error('⚠️ [TRIAGE] gpt-4o second opinion failed, using first-tier result:', secondErr.message);
      return first; // non-high confidence → still routes to conservative handling
    }
  } catch (err) {
    console.error('❌ [TRIAGE] classification failed — failing safe to ambiguous:', err.message);
    return { class: 'ambiguous', confidence: 'low', reason: `classifier error: ${err.message}`.slice(0, 300), model: 'error' };
  }
}
