// lib/trial-access.js
// Shared trial/subscription access checks. A customer may use paid features if
// they have a real Stripe subscription (paid or trialing) or are still within
// their 14-day signup trial. Voice AI has its own additional per-plan minute
// cap on top of that, since voice is the most expensive channel to run —
// checked separately by canUseVoiceAI(), used by the voice call-routing code.

import { query } from './database.js';
import { PLAN_LIMITS } from './stripe.js';

const TRIAL_DAYS = 14;

// Comp accounts — the founder's own demo/admin accounts — are NEVER subject to
// trial expiration or usage caps. The platform demos itself on these (prospects
// see the AI answer on every channel), so they must always stay live regardless
// of subscription or signup date. Customer 863 is the primary demo account; add
// more via the COMP_ACCOUNT_IDS env var (comma-separated customer ids), no code
// change needed. Matched by numeric customer id, which never changes (a Clerk id
// can change — the founder's did during the Dev→Prod migration).
const COMP_ACCOUNT_IDS = new Set(
  ['863', ...String(process.env.COMP_ACCOUNT_IDS || '').split(',')]
    .map((s) => s.trim())
    .filter(Boolean)
);

function isCompAccount(customer) {
  return customer?.id != null && COMP_ACCOUNT_IDS.has(String(customer.id));
}

export function hasActiveAccess(customer) {
  if (!customer) return false;
  if (isCompAccount(customer)) return true;
  if (customer.stripe_subscription_id) return true;
  if (customer.created_at) {
    const ageMs = Date.now() - new Date(customer.created_at).getTime();
    if (ageMs < TRIAL_DAYS * 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

/**
 * Entry-level silence check for channels that reply WITHOUT going through
 * generateAIResponse (e.g. the email monitors' triage "conservative_reply"
 * template, which never calls the AI). Returns true only when a customer
 * record exists AND has no active access. Fails OPEN (returns false) when the
 * owner can't be identified or on any DB error — we never want a lookup miss
 * to silence a paying customer.
 */
export async function isAiSilencedForClerkUser(clerkUserId) {
  if (!clerkUserId) return false;
  const result = await query(
    `SELECT id, stripe_subscription_id, created_at FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
    [clerkUserId]
  ).catch(() => ({ rows: [] }));
  const customer = result.rows[0];
  if (!customer) return false;
  return !hasActiveAccess(customer);
}

export async function getVoiceMinutesThisMonth(customerId) {
  // Count by started_at to match exactly how the /voice dashboard computes
  // "minutes used this month" (app/api/vapi/stats) — enforcement must agree
  // with the number the customer sees, or the cutoff looks arbitrary.
  const result = await query(
    `SELECT CEIL(COALESCE(SUM(duration_seconds), 0) / 60.0) AS minutes
     FROM vapi_call_logs
     WHERE customer_id = $1 AND started_at >= DATE_TRUNC('month', CURRENT_DATE)`,
    [customerId]
  ).catch(() => ({ rows: [{ minutes: 0 }] }));
  return parseInt(result.rows[0]?.minutes, 10) || 0;
}

/**
 * The single gate voice call routing checks before handing a caller to the AI.
 * Returns { allowed: true } or { allowed: false, reason: 'trial_expired' | 'voice_limit_exceeded' }.
 */
export async function canUseVoiceAI(customer) {
  // Comp/demo accounts bypass BOTH the trial check and the voice-minute cap —
  // hasActiveAccess already exempts them, but we also skip the minute cap so a
  // demo that runs long never goes dark mid-pitch.
  if (isCompAccount(customer)) {
    return { allowed: true };
  }
  if (!hasActiveAccess(customer)) {
    return { allowed: false, reason: 'trial_expired' };
  }
  const plan = customer.plan || 'starter';
  const allowance = PLAN_LIMITS[plan]?.voiceMinutes ?? PLAN_LIMITS.starter.voiceMinutes;
  const usedMinutes = await getVoiceMinutesThisMonth(customer.id);
  if (usedMinutes >= allowance) {
    return { allowed: false, reason: 'voice_limit_exceeded' };
  }
  return { allowed: true };
}
