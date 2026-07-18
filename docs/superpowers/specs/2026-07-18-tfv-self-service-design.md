# Self-Service Toll-Free Verification (TFV) — Design

**Date:** 2026-07-18
**Status:** Approved by founder (pending final spec review)

## Goal

A new customer sets up their AI business number **start to finish with zero founder involvement**: they fill one form, the platform buys the number, submits carrier verification with evidence that passes review, keeps the customer informed while it's pending, and flips texting live on approval. The founder only hears about it when something genuinely unusual happens.

## Background — why now

First real customer (JPH, LLC / brand "Maryland Clean Energy Initiative") had their TFV rejected 2026-07-15 with exactly the two failure modes this design eliminates:

- **30484 — Business Name Must Match Official Records.** The form has a single "Business name" field; customers naturally type either their brand or a legal name that doesn't match their public website. Nothing captures the legal-vs-brand distinction or warns about it.
- **30506 — Opt-Ins Must Clearly Reflect the End Business.** Every submission's opt-in evidence points at the generic `/sms-optin-example` page, which shows BizzyBot branding and a fictional "Sunshine Home Services." Reviewers verifying Customer X see a page about a different business.

Twilio's documentation confirms the fix direction: opt-in evidence may be hosted anywhere public (error docs 30476/30509 explicitly allow hosted images/documents "that tell the story of the opt-in"), but it must show **the end business's branding**. BizzyBot's own number passed with the current page precisely because the page's branding matched the business under review. This design recreates that match for every customer automatically.

## What already exists (unchanged foundation)

`lib/tollfree-verification.js` already: auto-submits TFV from profile data via direct REST call, blocks submission until required fields exist (`needs_info` + hourly auto-retry), edits rejected verifications in place (preserves 7-day priority queue), polls status hourly via cron, emails the customer on approval and the admin on rejection. The onboarding form already collects address, business type, EIN, contact name, business email with validation.

## Piece 1 — Per-customer branded opt-in page

**Route:** `app/sms-optin/[number]/page.js` → `bizzybotai.com/sms-optin/{digits}` where `{digits}` is the customer's toll-free number. Server-rendered; looks up `customer_phone_numbers` by number, joins customer/profile/verification info for brand name, legal name, website.

**Content** (same structure as the approved `/sms-optin-example`):
- Title: "How customers opt in to text messages from {brand}"
- Overview: consumer-initiated (mobile-originated) messaging; texting first constitutes consent; every reply includes STOP
- Step 1 mockup: {brand}'s website contact section with their real number and website domain
- Steps 2–4: example conversation with {brand} in AI replies and STOP confirmation
- Keyword reference (STOP/HELP/START) unchanged
- Legal note: "Messages are sent by {brand}." + no-third-party-sharing line + link to their SMS terms page (Piece 5)
- Footer: "Messaging service powered by BizzyBot AI"

**Rules:**
- Unknown/unassigned number → 404. Pages only expose business name, number, website — information the business advertises publicly.
- Public route (added to `middleware.js` publicRoutes) — Twilio reviewers must reach it without login (rejection code 30509 is "URL not accessible").
- `/sms-optin-example` stays untouched — BizzyBot's own approved verification references it.

## Piece 2 — Legal name vs. brand name

**Form** (`app/sms-onboarding/page.js`):
- "Legal business name" (required) — helper: exactly as on IRS EIN letter/state registration, including punctuation; carriers reject mismatches.
- "Brand name customers know you by" (optional) — only if different.
- Conditional warning when both filled: carriers will visit your website to confirm the names belong together; if the site only shows the brand, add "{brand} is operated by {legal}" to the footer.

**Data:** new column `legal_business_name` on `sms_verification_info` (added via the existing `ensureVerificationInfoTable` ALTER pattern). The optional "brand name" field maps to the existing `customers.business_name` (the name the AI already uses with leads) — no new brand column. If the brand field is left blank, brand = legal name everywhere (form pre-fills the brand field from `customers.business_name` when one exists). Paperwork identity and AI identity never fight.

**Submission** (`lib/tollfree-verification.js`):
- `BusinessName` = legal name, or `"{legal} DBA {brand}"` when brand differs.
- `legal_business_name` joins the required-fields list (`needsInfo`).
- Back-compat: existing rows without a legal name treat the saved business name as legal until edited.

**API:** `app/api/sms/verification-info/route.js` GET/POST gain `legalBusinessName` (required on POST).

## Piece 5 — Per-customer SMS terms page

**Route:** `app/sms-terms/[number]/page.js`, same lookup and 404 rules as Piece 1. Content mirrors the approved privacy-policy SMS section with {brand} as sender: message types and frequency, "message and data rates may apply," **STOP/HELP instructions in bold**, mobile info never shared with third parties for marketing, carrier liability disclaimer, business contact info. Footer: powered-by line.

**Submission changes:** `OptInImageUrls` → `[{BASE_URL}/sms-optin/{digits}]`; `AdditionalInformation` links both branded pages instead of `/sms-optin-example` and `/privacy#sms-terms`.

## Piece 3 — Customer-facing activation status card

On `app/(dashboard)/customer-sms-dashboard/page.js`, driven by `tfv_status` (exposed via the existing phone-numbers endpoint):

| Internal state | Customer sees |
|---|---|
| `needs_info` | Existing "finish setup" flow |
| submitted / in review | 📞 Calls: Live · 💬 Texting: Being activated — usually 3–5 business days |
| `TWILIO_REJECTED` | 📞 Calls: Live · 💬 Texting: Activation in progress — our team is handling a carrier requirement; no action needed |
| `TWILIO_APPROVED` | 📞 Calls: Live · 💬 Texting: Live |

Customer never sees "rejected" or carrier jargon. Admin rejection email (with real reason codes) unchanged.

## Self-service boundary

- **Happy path (target: ~all customers):** form → auto-purchase → auto-submit → status card → approval email. Zero founder touches.
- **Still founder-handled:** genuine rejections (rare once Pieces 1+2 ship — the two dominant causes are prevented by construction). Founder gets the detailed email; customer sees the calm "handling it" state. Deliberately NOT building customer-facing rejection remediation.
- **Explicitly out of scope:** web-chat widget consent language (widget never sends SMS; revisit only if outbound texting to widget-captured leads ever ships), per-customer privacy policies beyond SMS terms, 10DLC.

## Build order

1. Pieces 1 + 5 (branded pages + submission URL swap)
2. Piece 2 (legal/brand fields)
3. **JPH resubmission** — enter their legal + brand names, resubmit via existing edit-in-place path. Hard deadline: priority window ends ~2026-07-22.
4. Piece 3 (status card)

## Testing

- Branded pages render correctly for the founder's (866) number and JPH's (888) number; unknown number → 404; pages reachable logged-out.
- Submission payload (log inspection) shows DBA-format name and branded URLs.
- Legacy customer with no `legal_business_name` still submits (falls back to saved business name).
- BizzyBot's own approved verification untouched.
- End-to-end: JPH resubmission → approval is the real-world acceptance test.
