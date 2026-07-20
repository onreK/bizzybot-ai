// lib/plan-features.js
// Single source of truth for plan display copy. BizzyBot does NOT gate
// features — every plan includes the full platform (founder decision,
// reaffirmed 2026-07-20); plans differ only by volume, seats, and support.
// Pure data, safe to import from client components.

export const PLATFORM_FEATURES = [
  '24/7 AI on email, SMS, web chat & phone',
  'Your own AI toll-free business number',
  'Voice AI receptionist that answers calls',
  'Lead dashboard with AI lead scoring (hot / warm / cold)',
  'Instant hot-lead alerts by text & email',
  'AI appointment booking straight onto your calendar',
  'Sends your documents & forms to ready-to-buy leads',
  'Automated follow-ups that revive quiet leads',
  "Missed-call rescue — AI picks up when you can't",
  'Unified inbox for every conversation',
  'Analytics dashboard + lead export',
  'Facebook & Instagram DM AI (coming soon)',
];

// The only real differences between plans
export const PLAN_VOLUME = {
  starter: {
    tagline: 'For getting started',
    bullets: ['300 AI responses/month', 'Voice AI — 15 minutes/month', '1 user seat'],
  },
  professional: {
    tagline: 'For steady lead flow',
    bullets: ['1,500 AI responses/month', 'Voice AI — 100 minutes/month', '2 user seats'],
  },
  business: {
    tagline: 'For high-volume operations',
    bullets: ['5,000 AI responses/month', 'Voice AI — 400 minutes/month', '5 user seats', 'Priority support'],
  },
};
