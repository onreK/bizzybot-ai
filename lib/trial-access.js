// lib/trial-access.js
// Shared trial/subscription access checks. A customer may use paid features if
// they have a real Stripe subscription (paid or trialing) or are still within
// their 14-day signup trial. Voice AI has its own additional per-plan minute
// cap on top of that, since voice is the most expensive channel to run —
// checked separately by canUseVoiceAI(), used by the voice call-routing code.

import { query } from './database.js';
import { PLAN_LIMITS } from './stripe.js';

const TRIAL_DAYS = 14;

export function hasActiveAccess(customer) {
  if (!customer) return false;
  if (customer.stripe_subscription_id) return true;
  if (customer.created_at) {
    const ageMs = Date.now() - new Date(customer.created_at).getTime();
    if (ageMs < TRIAL_DAYS * 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

export async function getVoiceMinutesThisMonth(customerId) {
  const result = await query(
    `SELECT CEIL(COALESCE(SUM(duration_seconds), 0) / 60.0) AS minutes
     FROM vapi_call_logs
     WHERE customer_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
    [customerId]
  ).catch(() => ({ rows: [{ minutes: 0 }] }));
  return parseInt(result.rows[0]?.minutes, 10) || 0;
}

/**
 * The single gate voice call routing checks before handing a caller to the AI.
 * Returns { allowed: true } or { allowed: false, reason: 'trial_expired' | 'voice_limit_exceeded' }.
 */
export async function canUseVoiceAI(customer) {
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
