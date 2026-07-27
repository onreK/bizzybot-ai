// lib/sms-compliance.js
// Toll-free SMS compliance footer — DELIBERATELY HARD-CODED.
//
// WHY THIS IS NOT A CUSTOMER SETTING: BizzyBot owns the Twilio account and the
// toll-free verification. A customer who could edit or disable this would
// remove it (it makes their texts read less personally), and the consequence —
// carrier filtering or a revoked verification — lands on BizzyBot, not them.
// It is also NOT prompt-based: an instruction to the AI can be ignored by the
// model or overridden by a customer's custom instructions. It is appended in
// code, after the AI has finished, on the way out.
//
// WHAT TWILIO REQUIRES (Toll-Free Verification Onboarding Guide, "Campaign
// Samples & Alignment"): "All messages must include the Business Name and
// functional opt-out instructions (e.g. 'Reply STOP to unsubscribe') at
// regular intervals throughout the conversation." Not every message — at
// regular intervals. The same guide requires the opt-in method, use case and
// sample messages to "tell a consistent story", so the wording below matches
// the ProductionMessageSample submitted in lib/tollfree-verification.js.
//
// NOTE: opt-out itself already WORKS without this. For toll-free, STOP is
// handled by the carrier outside Twilio and cannot be removed or customized.
// This is purely the disclosure half.

/** Append after the first outbound message, then every Nth one. */
export const COMPLIANCE_INTERVAL = 10;

/**
 * Should this outbound message carry the footer?
 * @param priorOutboundCount how many outbound messages this contact already got
 */
export function shouldAppendCompliance(priorOutboundCount) {
  const n = Number(priorOutboundCount);
  if (!Number.isFinite(n) || n < 0) return true; // unknown history — disclose
  return n === 0 || n % COMPLIANCE_INTERVAL === 0;
}

/**
 * The footer itself. Wording mirrors the approved TFV message sample.
 *
 * Plain hyphen, NOT an em dash: SMS picks one encoding for the whole body, and
 * a single non-GSM-7 character switches it to UCS-2 — which cuts a segment from
 * 153 characters to 67 and roughly doubles the cost of every message carrying
 * the footer. The business name is capped for the same reason.
 */
export function complianceFooter(businessName) {
  const name = String(businessName || '').trim().slice(0, 60);
  return name
    ? `\n\n- ${name}. Reply STOP to opt out, HELP for help.`
    : `\n\nReply STOP to opt out, HELP for help.`;
}

/**
 * Append the footer to an outbound SMS when the interval calls for it.
 *
 * Idempotent against OUR OWN footer only — deliberately not against any text
 * that merely mentions STOP. A customer shapes the AI's wording through their
 * own custom instructions and knowledge base, so suppressing on a loose match
 * would let them strip the mandatory business-name disclosure permanently
 * using nothing but their own settings. That is the exact bypass this module
 * exists to prevent, so a customer whose AI already says "reply STOP" simply
 * gets the disclosure twice. Redundant beats missing.
 */
export function applyComplianceFooter(body, { businessName, priorOutboundCount } = {}) {
  const text = String(body ?? '');
  if (!text.trim()) return text;

  const footer = complianceFooter(businessName);
  if (text.includes(footer.trim())) return text; // already applied — don't double
  if (!shouldAppendCompliance(priorOutboundCount)) return text;
  return text + footer;
}
