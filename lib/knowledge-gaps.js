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

/**
 * Mid-call instruction for the Vapi assistant.
 *
 * Deliberately does NOT collect an email: Documents Phase A established that
 * email-over-phone needs letter-by-letter readback, phantom-dot handling and
 * a give-up rule. The caller's number is already known from caller ID, so a
 * text is both more reliable and more natural for someone who just phoned.
 */
export function buildVoiceGapInstruction() {
  return `\n\nWHEN YOU DON'T KNOW: If the caller asks something you cannot answer from the business knowledge above, never guess and never invent an answer. Tell them honestly that you want to get them the right answer rather than guess, then ask for their name and confirm the number they're calling from is the best one to text the answer back to. Keep this to one short question — do not ask for an email address. Then continue the conversation normally.`;
}

/** System prompt for the post-call transcript scan. */
export function buildTranscriptScanPrompt(businessName) {
  const name = (businessName || '').trim() || 'the business';
  return `You review a phone call transcript between a caller and ${name}'s AI assistant. ` +
    `Find every question the caller asked that the assistant could NOT properly answer — including questions it dodged, deflected, or answered vaguely without real information, and questions it answered confidently but clearly had no source for. ` +
    `Do NOT report questions the assistant answered with real, specific information. Do NOT report the assistant's own questions. ` +
    `Return JSON only: {"gaps": [{"topic": string, "question": string}], "caller_name": string|null}. ` +
    `topic must be exactly one of: ${GAP_TOPICS.join(', ')}. ` +
    `question = the caller's question in plain words, as they would have put it, under 200 characters. ` +
    `caller_name = the caller's first name if they gave one, otherwise null. ` +
    `If the assistant answered everything properly, return an empty gaps array.`;
}

/** Parse the scan response. Never throws — a bad response means no gaps. */
export function parseTranscriptScan(raw) {
  const empty = { gaps: [], callerName: null };
  if (!raw) return empty;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== 'object') return empty;

  const list = Array.isArray(parsed.gaps) ? parsed.gaps : [];
  const gaps = list
    .map(g => ({
      topic: normalizeTopic(g?.topic),
      question: String(g?.question || '').trim().slice(0, 500),
    }))
    .filter(g => g.question.length > 0);

  const callerName = typeof parsed.caller_name === 'string' && parsed.caller_name.trim()
    ? parsed.caller_name.trim().slice(0, 100)
    : null;

  return { gaps, callerName };
}
