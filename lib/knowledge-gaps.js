// lib/knowledge-gaps.js
// Unanswered-questions queue CORE — pure logic only. No database imports
// (tests import this file standalone; DB work lives in lib/knowledge-gaps-store.js).
//
// Design principle — NEVER BREAK A CONVERSATION: this is a reporting feature.
// The one unacceptable failure is a marker reaching a lead, so stripping is
// deliberately broader than extraction: extraction wants a well-formed marker,
// stripping removes anything that even starts to look like one.
// Spec: docs/superpowers/specs/2026-07-26-unanswered-questions-queue-design.md

export const GAP_TOPICS = [
  'pricing', 'service_area', 'hours', 'scheduling',
  'services', 'process', 'warranty', 'payment', 'other',
];

/** Human labels for the dashboard. Keys must match GAP_TOPICS exactly. */
export const GAP_TOPIC_LABELS = {
  pricing: 'Pricing',
  service_area: 'Service area',
  hours: 'Hours',
  scheduling: 'Scheduling',
  services: 'Services offered',
  process: 'How it works',
  warranty: 'Warranty',
  payment: 'Payment',
  other: 'Other',
};

export function normalizeTopic(raw) {
  const t = String(raw || '').trim().toLowerCase();
  return GAP_TOPICS.includes(t) ? t : 'other';
}

// Well-formed marker only: [UNKNOWN:topic|question]
// The question may itself contain a bracketed phrase, so match either a
// non-bracket character or one complete nested pair — a bare [^\]]* would
// stop at the first inner ] and leak the remainder to the lead.
const GAP_PATTERN = /\[UNKNOWN:\s*([a-z_]+)\s*\|\s*((?:[^\[\]]|\[[^\]]*\])*)\]/i;

// Anything that opens like a marker, closed or not. Used for stripping.
const GAP_STRIP_PATTERN = /\[UNKNOWN(?:[^\[\]]|\[[^\]]*\])*\]?/gi;

export function extractKnowledgeGap(text) {
  if (!text) return null;
  const match = String(text).match(GAP_PATTERN);
  if (!match) return null;
  const question = (match[2] || '').trim();
  if (!question) return null;
  return { topic: normalizeTopic(match[1]), question: question.slice(0, 500) };
}

export function stripGapMarkers(text) {
  if (!text) return '';
  return String(text)
    .replace(GAP_STRIP_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +([.,!?])/g, '$1')
    .trim();
}

/** The prompt block appended to every text-channel system prompt. */
export function buildGapInstruction() {
  return `\n\nUNANSWERED QUESTIONS: If the person asks something you genuinely cannot answer from the business information above — a fact you were simply not given — do not invent an answer and do not guess. Reply naturally, telling them you'll find out and follow up. Then add this marker at the very END of your message: [UNKNOWN:topic|their question in plain words]. Choose topic from exactly this list: ${GAP_TOPICS.join(', ')}. Use the marker at most ONCE per message. Never use it if you were able to answer, and never use it for questions unrelated to this business.`;
}
