// lib/attribution-client.js
// First-touch marketing attribution: remembers how someone first arrived
// (a UTM-tagged link, a plain ?ref= tag, or an external referrer like Google
// search) so it can be saved to their account once they finish onboarding.
// Client-side only — see components/AttributionTracker.js for where this runs.

const COOKIE_NAME = 'bb_attribution';
const COOKIE_DAYS = 90;

/**
 * Pure parsing logic — no browser globals, so this is unit-testable directly.
 * Returns an attribution object, or null if there's nothing worth recording
 * (a direct visit with no query params and no external referrer).
 */
export function parseAttribution(search, referrer, currentHostname) {
  const params = new URLSearchParams(search || '');
  const utmSource = params.get('utm_source') || params.get('ref') || '';
  const utmMedium = params.get('utm_medium') || '';
  const utmCampaign = params.get('utm_campaign') || '';

  let referrerUrl = '';
  if (referrer) {
    try {
      const referrerHost = new URL(referrer).hostname;
      if (referrerHost !== currentHostname) referrerUrl = referrer;
    } catch {
      // malformed referrer — ignore rather than throw
    }
  }

  if (!utmSource && !referrerUrl) return null;
  return { utmSource, utmMedium, utmCampaign, referrerUrl };
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Call once per page load. First-touch only — never overwrites attribution
 * that was already captured on an earlier visit.
 */
export function captureAttributionOnLoad() {
  if (typeof window === 'undefined') return;
  if (getCookie(COOKIE_NAME)) return; // already captured on a prior visit

  const attribution = parseAttribution(window.location.search, document.referrer, window.location.hostname);
  if (attribution) setCookie(COOKIE_NAME, JSON.stringify(attribution), COOKIE_DAYS);
}

/** Call at signup/onboarding completion to retrieve what was captured earlier. */
export function getStoredAttribution() {
  if (typeof window === 'undefined') return null;
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
