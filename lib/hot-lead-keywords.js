// lib/hot-lead-keywords.js
// Shared hot-lead keyword scoring. Keywords may NUDGE a lead score but can
// never alone clear the hot threshold (60) — the GPT scorer leads.
// De-fanged 2026-07-19: everyday support words (help/issue/problem/contact/
// call/phone/broken/money) used to score 25 points each with no cap, which is
// how a Microsoft Support engineer became an $18k hot lead.

export const HOT_LEAD_KEYWORDS = [
  'urgent', 'asap', 'immediately', 'emergency', 'deadline',
  'budget', 'price', 'cost', 'payment', 'buy', 'purchase',
  'interested', 'ready to start', 'when can we', 'schedule',
  'meeting', 'quote', 'comparing',
  // Shopping-around signals, re-added 2026-07-20 (founder decision): a lead
  // mentioning rivals is actively deciding. Safe post-de-fang — keywords only
  // nudge and are capped below the hot threshold.
  'competitor', 'other company'
];

export const KEYWORD_POINT_VALUE = 15;
export const KEYWORD_SCORE_CAP = 45; // must stay below the hot threshold (60)

export function scoreKeywordMatches(message, customKeywords = []) {
  const content = (message || '').toLowerCase();
  const matches = [
    ...HOT_LEAD_KEYWORDS.filter(k => content.includes(k.toLowerCase())),
    ...(Array.isArray(customKeywords) ? customKeywords : [])
      .filter(k => k && content.includes(String(k).toLowerCase())),
  ];
  return {
    matches,
    score: Math.min(matches.length * KEYWORD_POINT_VALUE, KEYWORD_SCORE_CAP),
  };
}
