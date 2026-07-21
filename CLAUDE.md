# BizzyBot AI — Project Bible

> BizzyBot is a **multi-industry AI-powered business automation platform** for any client-facing business.
> Full session history: see `SESSIONS-ARCHIVE.md`

---

## Project Instructions

> These are standing instructions Claude must follow in every session without exception.

### 🧠 Who I Am
- I am the founder of BizzyBot — I am **not a developer**
- Explain everything in plain English, like talking to a smart business owner who has never coded
- Never assume I understand technical jargon — always define it if you use it
- If something is complex, break it into simple numbered steps

### ✅ Before Making ANY Change
- **Always tell me exactly what you're going to do and why before doing it**
- List every file you plan to create or edit
- Wait for me to say "go ahead" or "yes" before touching anything
- If a change feels risky, flag it clearly and suggest a safer alternative

### 🛠️ How to Make Changes
- Edit files directly — never give me code to copy and paste
- Make one logical change at a time, not everything at once
- After each change, explain in plain English what was done and what it affects
- Always tell me how to test that it worked

### 💾 Git & Deployment
- After completing a feature or fix, **automatically commit and push to GitHub**
- Use clear, descriptive commit messages
- Never force push to main
- Railway auto-deploys when GitHub is pushed — no need to mention it
- Always ask before running database migrations — these can break production

### 🎨 Code Style
- Follow existing patterns — don't introduce new ones without asking
- Tailwind CSS for all styling
- Keep components small and focused
- Never hardcode real-estate-specific language — BizzyBot is multi-industry

### 🤖 AI Behavior (Critical)
- The AI tone, personality, and knowledge is **fully controlled by each customer from their dashboard**
- Customers input their own: business info, pricing, scheduling, next steps, tone
- Never hardcode AI personality or responses into the codebase
- All AI behavior flows from customer's stored settings in the database

### 📋 Before Every Session
- Read this CLAUDE.md fully
- Run `git status` to check for uncommitted changes
- Ask: "What do you want to work on today?"

### ❌ Never Do These
- Never make changes without explaining them first and getting approval
- Never give me partial code to merge manually
- Never assume something works — always provide test steps
- Never push breaking changes to main without warning me
- Never use real-estate-only language in new features

---

## What This Platform Does

BizzyBot gives businesses an AI agent that:
- Responds to leads automatically across SMS, Email, Facebook, Instagram, and web chat
- Scores and classifies leads (hot/warm/cold) using AI
- Manages multi-channel conversations from a unified dashboard
- Handles billing/subscriptions and onboarding automatically

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + React 18 |
| Styling | Tailwind CSS + Lucide Icons |
| Auth | Clerk (multi-tenant) |
| Database | PostgreSQL (Railway) via `pg` |
| Payments | Stripe (webhooks + subscriptions) |
| AI | OpenAI GPT-4o-mini |
| SMS | Twilio |
| Email | Gmail OAuth + Outlook OAuth (Microsoft Graph) + Resend |
| Voice AI | Vapi (BYON — Bring Your Own Number via Twilio) |
| Calendar | Outlook Calendar (Microsoft Graph) — Google Calendar pending OAuth approval |
| Social | Facebook Messenger + Instagram DM APIs |

---

## Pricing Tiers

| Plan | Price | Target |
|------|-------|--------|
| Starter | $29/mo | Solo/small businesses |
| Professional | $69/mo | Businesses wanting social media channels |
| Business | $199/mo | High-volume + voice calls |

**NO FEATURE GATING** (founder decision, reaffirmed 2026-07-20): every plan includes the entire platform. Tiers differ ONLY by volume + seats + support. Two usage meters exist: AI responses (pooled across all channels) and Voice AI minutes (separate — voice costs ~400× an email reply). Shared display copy lives in `lib/plan-features.js` (PLATFORM_FEATURES + PLAN_VOLUME) — keep all pricing surfaces (lib/stripe.js PRICING_PLANS, /pricing, landing, Settings→Subscription) in sync with it.

| | Starter | Professional | Business |
|---|---|---|---|
| AI responses/mo | 300 | 1,500 | 5,000 |
| Voice AI minutes/mo | 15 | 100 | 400 |
| User seats | 1 | 2 | 5 |
| Priority support | — | — | ✅ |

### Stripe Price IDs
| Plan | Price ID |
|---|---|
| Starter $29/mo | `price_1TcLVq01O3SsJO6lr6j8MbWK` |
| Professional $69/mo | `price_1TcLVr01O3SsJO6lyOqWsyhT` |
| Business $199/mo | `price_1TcLVs01O3SsJO6lUmCp5Ojl` |

### Stripe Coupons
| Code | Discount | Duration |
|---|---|---|
| `BIZZYFOUNDER` | 50% off | 12 months |
| `BIZZYFRIEND` | 20% off | 3 months |

### Profit margins at FULL usage (exact rates, computed 2026-07-20)

Both meters (AI responses + voice minutes) maxed out. Margin swings hugely by channel mix — SMS carries real per-message carrier fees, email/chat is nearly free:

| | Starter $29 | Professional $69 | Business $199 |
|---|---|---|---|
| Worst case (all responses as SMS) | cost $12.52 → **57% margin** | cost $53.45 → **22% margin** | cost $179.22 → **10% margin** |
| Best case (all responses as email/chat) | cost $5.05 → **83% margin** | cost $16.10 → **77% margin** | cost $54.72 → **73% margin** |
| Realistic (mixed channels) | ~60-70% | ~45-65% | ~45-65% |

All plans profitable even fully maxed. Business is the one to watch — swings from 73% down to 10% purely on channel mix, because 5,000 SMS messages ≈ $125 in real carrier fees alone.

**Future — scaling partner (parked, not urgent, noted 2026-07-20):** founder wants to eventually bring on a partner with connections + operating know-how + capital to scale 100x (framed as "50% of $10-50M beats 100% of $1M"). Category that fits: vertical-SaaS growth equity / operator-led investors (e.g. Five Elms Capital, Serent Capital, Mainsail Partners, Sunstone Partners, PSG, Craft Ventures) — NOT typical seed VC; these firms bring hands-on scaling playbooks (sales, pricing, GTM) for a large stake, sometimes majority. Gate: they generally want real revenue traction first (often $500K+ ARR) — not a fit until well past the first 10 founding customers. Prep path: build relationships early via SaaStr/MicroConf communities (warm beats cold); when ready, the pitch packet = unit economics (already built, exact margins) + competitive gap vs Podium/Beside/GHL (already documented) + customer traction.

**⚠️ Discount risk flagged — the solar customer (Professional at 50% off = $34.50/mo):** re-running the SMS-heavy worst case at the discounted price gives cost $53.45 vs revenue $34.50 = **a ~$19/month LOSS if they ever max out and lean SMS-heavy simultaneously.** Unlikely (needs both meters maxed AND channel concentration), and the coupon is time-bounded (12 months), so decision is to WATCH via the Unit Economics panel rather than pre-emptively restrict — revisit if their margin row trends negative.

---

## Infrastructure

- **GitHub:** `https://github.com/onreK/bizzybot-ai`
- **Local path:** `C:\Users\Kerno\New-Real-estate-Agent`
- **Live site:** `https://bizzybotai.com`
- **Railway project:** `patient-miracle` (rename to bizzybot-ai in Railway dashboard)
- **Cron service:** `bizzybot-cron` — runs `0 * * * *`, calls `/api/cron/run`
- **Twilio Messaging Service SID:** `MG7d1d710aa54c4ebab29ae4127f233a0b`
- **Twilio Trust Hub (verified 2026-07-18 — ⚠️ all profiles load-bearing, DELETE NONE):** ISV tree = primary account-holder profile `BU399c9d46cfc0cb57098c645ee1812ad6` ("Bizzy Bot Ai LLC", 2025-06-25 — parent referenced by all end-business profiles) → end-business profiles `BU5c6d7da709c2e711ef99c39a0291010d` ("Bizzy Bot Ai LLC" as end business, tied to the approved (866) 944-5685 TFV) and `BU7fa683a973ce9dcbdb5b0edbbb8df8fd` ("JPH, LLC" — profile approved; their TFV separately rejected; update identity when their new LLC exists). `BUec9068e9…` "My Starter Profile" = Twilio auto-created, harmless. The two same-named BizzyBot profiles are different roles, NOT duplicates.
- **Facebook App ID:** `1018657873452513`
- **Microsoft Azure App:** `BizzyBot Ai` — Client ID: `e1f4b73a-dacf-4e67-b0d2-173120d0a7ba`, Tenant ID: `d0accbe0-735e-4a51-ac15-4c4725e3d858` (secret in Railway as `MICROSOFT_CLIENT_SECRET`, expires ~2028)
- **Vapi:** `VAPI_PUBLIC_KEY` + `VAPI_PRIVATE_KEY` + `VAPI_WEBHOOK_SECRET` in Railway

---

## Database Tables

`customers`, `conversations`, `messages`, `hot_leads`, `gmail_connections`, `gmail_conversations`, `gmail_messages`, `email_conversations`, `email_messages`, `ai_analytics_events`, `contacts`, `customer_phone_numbers`, `ai_channel_settings`, `facebook_connections`, `instagram_connections`, `outlook_connections`, `outlook_conversations`, `outlook_messages`, `vapi_call_logs`, `business_profiles`

---

## Core Features Status

### ✅ Completed
- Multi-tenant auth (Clerk) + onboarding flow (5 steps)
- Stripe billing — 3 tiers ($29/$69/$199), 14-day trial, webhooks, plan-gating
- Stripe coupons: BIZZYFOUNDER + BIZZYFRIEND
- Plan gating — switched from channel-blocking to shared response pool; all channels available on all plans, limits are response count (300/1500/5000) + voice minutes (15/100/400)
- Privacy policy — Section 13 SMS Messaging Terms added with anchor `#sms-terms`, CTIA-compliant language including "affiliates"
- `/sms-optin-example` — public page showing consumer opt-in flow for Twilio CTA verification
- Gmail OAuth — immediate sync triggered after connection (no longer waits for hourly cron)
- Admin dashboard — fixed `business_profiles` missing columns error
- PostgreSQL schema + admin migration tools
- AI lead scoring (hot/warm/cold + urgency detection)
- Email filtering (automated sender detection, subdomain checks)
- Gmail OAuth — thread tracking, AI replies, conversation history, automated follow-ups, escalation handling
- Outlook OAuth (Microsoft Graph) — email AI replies, cron polling, inbox view with Outlook tag
- Twilio SMS — number pool provisioning, A2P architecture, AI responses, webhook routing
- Facebook Messenger + Instagram DM — one-click OAuth connect, webhook handling
- Embeddable web chat widget + `/web-chat` embed instructions page
- Unified analytics dashboard — email/SMS/chat/social + Voice AI stats (calls, minutes, avg duration)
- AI Settings page — 6-channel tabs (incl. Voice AI), escalation, follow-ups, document link sending
- Document/form link sending — AI shares link naturally when lead is qualified
- Scheduling — customers paste any booking URL (Calendly, Acuity, etc.), AI shares it automatically
- Outlook Calendar booking — AI checks availability, books directly on owner's calendar, sends invite to lead
- Lead management — channel filter (Gmail/Outlook/SMS/Voice/Facebook/Instagram/Chat), hot/warm/cold, date filter
- Owner hot lead alerts — email via Resend, DB-backed toggle per customer, 30-min dedup, covers all channels
- Admin dashboard — MRR, ARR, trial tracking, churn, CSV export, customer search
- Landing page — industry-leading design, social proof, pricing, testimonials
- Railway cron job — Gmail + Outlook automation runs hourly for all customers
- Notification bell — live hot lead feed, unread count, mark-all-read
- Dashboard — Setup Checklist, Today at a Glance, pipeline funnel, Hot Leads Trend chart
- Logo — real BizzyBot logo in navbar, footer, sidebar
- Privacy policy — CTIA SMS disclosure added
- Terms of Service — SMS messaging section added
- Voice AI (Vapi) — per-plan minute limits (Starter 15, Pro 100, Biz 400), upgrade prompt, voice tab in AI Settings
- Email intent triage — every inbound email classified (5 classes, two-tier gpt-4o-mini→gpt-4o, asymmetric caution) before any AI reply; "Left for you" inbox flags + one-click corrections feed few-shot learning; eval-gated (scripts/triage-eval.mjs); HOT_LEAD_KEYWORDS de-fanged (shared lib/hot-lead-keywords.js, capped below hot threshold)
- Unit Economics panel on ACTUALS (2026-07-20) — exact Vapi per-call costs (webhook capture + backfill), exact Twilio per-message prices, measured OpenAI rate, per-cost basis labels; estimates remain only as fallbacks
- Documents Phase A (voice) — LIVE-VERIFIED 2026-07-20: caller asks for a doc → AI collects + letter-by-letter confirms email → doc link emailed immediately post-call, link works; doc targeting w/ 'when' field, phantom-dot extraction hardening, post-call pipeline (plan: docs/superpowers/plans/2026-07-18-documents-phase-a.md). Phase B (storage/attachments) + Phase C (receiving) deferred; "text you the link" for mobile callers = recommended next

### ⏳ Waiting on External Approvals
- **Twilio SMS — PIVOTED TO TOLL-FREE (2026-07-05)** — the A2P 10DLC campaign path is abandoned
  - Old A2P campaign had 6 rejections; root cause: ISVs need per-customer brand+campaign registration (10-15 day waits, fees, high rejection risk for sole props) — not viable for BizzyBot's onboarding
  - NEW ARCHITECTURE: toll-free numbers bought on demand at signup (no pool), toll-free verification auto-submitted per customer via API (~3-5 business day approval, no TCR/brand/campaign needed)
  - Built: `lib/tollfree-verification.js` (submit + hourly status check + emails), on-demand purchase in `/api/sms/provision`, TFV polling in cron
  - Still to build: SMS onboarding page rework (replace fake demo flow, collect business address for verification) — see Session Log 2026-07-05
  - Hosted SMS (customer keeps existing landline/800 number) planned as core path v1.1 — Hosted Numbers API access must be requested from Twilio (support ticket; API is in Developer Preview)
  - Messaging Service SID: `MG7d1d710aa54c4ebab29ae4127f233a0b`
- **Meta App Review** — submitted 2026-05-31, Business verified as Tech Provider 2026-06-05
  - Still needs a real Facebook test user — add real FB account as Tester in Meta App dashboard
  - Permissions: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`
- **Google OAuth brand verification** — blocked on "App functionality" — reviewer can't test Gmail sync
  - Replied to Google Trust & Safety email 2026-06-08 with testing instructions + test account credentials
  - Gmail now syncs immediately after OAuth connection (no longer waits for hourly cron)
  - Homepage ✅ + Branding ✅ passed; App functionality ❌ pending re-review
  - After approval: submit Gmail + Calendar scopes; CASA audit may be required (~$150-$500)

### 🔄 Not Started / Planned
- [ ] Referral tracking — credit referrer when `BIZZYFRIEND` coupon is used
- [ ] Dashboard Analytics redesign (paused — waiting for Scheduling feature)
- [ ] "Last Active" toggle on Leads page date filter
- [ ] Clerk app name fix: "Bizzybot Ai" → "BizzyBot AI" (manual in Clerk dashboard)
- [ ] Railway project rename to "bizzybot-ai" (manual in Railway dashboard)

### 🧪 Built but Untested — Test After Twilio A2P Approval
- [ ] **Outlook email integration — full end-to-end test required**
  - Connect Outlook account from Email → Setup page
  - Send a test email to the connected Outlook address
  - Wait for cron (top of hour) → confirm AI replied
  - Check Email inbox → Outlook email appears with Outlook tag
  - Click email → body + AI reply shown in detail panel
  - Check Leads page → contact created from Outlook sender
  - Verify `outlook_connections`, `outlook_conversations`, `outlook_messages` tables created in DB

- [ ] **Vapi Voice AI — full end-to-end test required**
  - Assign SMS number → confirm Vapi assistant auto-provisions
  - Call the Twilio number → confirm AI answers with correct greeting
  - Check `/voice` dashboard → call log + transcript + duration appear
  - Update Voice AI settings → click "Save & Sync" → confirm Vapi assistant updates
  - Verify `vapi_call_logs` table is created in DB on first provision
  - Check Vapi dashboard to confirm one assistant per customer is created
  - Verify Twilio A2P approval did not break SMS — both SMS and voice should work on same number

---

## 🚀 Launch Plan (added 2026-07-06)

**Positioning decision (REVISED 2026-07-07):** Broad "local/client-facing businesses" hero — founder explicitly does NOT want to pigeonhole into trades (works for real estate agents, salons, therapists, etc.). Follow the Podium/Rosie pattern: multi-industry headline + an **industries section** with one pain-line per vertical (trades: "never miss a call from a job site" · real estate: "first agent to respond wins the listing" · salons: "bookings answered while your hands are busy" · therapists: "full waiting room, zero phone tag"). Launch channels: **SMS AI + Voice AI + Web Chat + Outlook email**. Facebook/Instagram/Gmail = "coming soon" (pending external approvals — not launch blockers).

**Market context:** Gap between reputation giants (Podium $399+, Birdeye $299+, GHL $97+$97 AI add-on) and voice-only bots (Rosie $49, Goodcall $79, Jobber AI $99, **Beside $29.99/line — $32M raised 2026, iOS-first, voice-ONLY (no email/SMS/chat), same trades/real-estate/solo target as BizzyBot** — best-funded threat in the voice-only tier, but the multi-channel gap is BizzyBot's answer to it). BizzyBot = multi-channel AI at solo-shop prices ($29/$69/$199, no feature gating — full platform on every tier, see Pricing Tiers section). Window is ~12-18 months before voice bots add channels — Beside's funding could shrink that window if they move fast. Unit economics: ~70% gross margin on Pro tier at typical usage (exact max-usage margins: see "Profit margins at FULL usage" below).

### Launch Checklist (critical path — in order)

- [x] **1. SMS onboarding page rework** — DONE. Real provision flow, business info + business type + EIN collection, verification-pending states, needs-info/retry handling
- [~] **2. End-to-end SMS test with a real number** — SUBMISSION VERIFIED 2026-07-06: (866) 944-5685 provisioned + toll-free verification submitted to Twilio (confirmed by Twilio email + blue "being activated" screen). Full text-reply test pending carrier approval (3-5 biz days). Fixed en route: profile-save (legacy user_id/clerk_user_id type mismatch, business_profiles NOT-NULL user_id, ON CONFLICT, error-masking), TFV needs SDK-bypass direct API call (SDK 4.23 drops BusinessType), business type + EIN + contact name + state-code normalization
- [x] **3. Vapi voice end-to-end test** — DONE + LIVE-VERIFIED 2026-07-06: called (866) 944-5685, AI answered + held real conversation, call logged with transcript + AI summary + duration + minutes (2/15) on /voice. Fixed en route: fragile customer JOIN in vapi/provision, invalid 11labs voice "rachel" → Vapi-native "Elliot" (VAPI_VOICE_* env), webhook parsing (Vapi nests fields under `message`; was reading top-level → no logs), stats match by customer_id OR clerk_user_id.
  - NOTE: voice AI used placeholder content ("Test Business", test.com) because this test account's ai_channel_settings has stale demo data. Real customers configure their own; update AI Settings → Voice → Save & Sync to refresh the assistant.
- [~] **4. Email end-to-end (Gmail + Outlook)** — Outlook WORKING (2026-07-07): connect → AI reply → unified inbox → lead, verified live. Gmail bugs fixed (duplicate loop + placeholders + secure OAuth) 2026-07-07 — needs re-verify next session (reconnect Gmail, fresh test). See NEXT SESSION TODO.
- [x] **5. Production cleanup + security pass** — DONE 2026-07-06: deleted 20 dev/debug/migration routes+pages (incl. fully-public setup-database and all DB-mutation tools), removed stale public routes, fixed contact-email demo link. DB audit run (admin-gated `/api/admin/db-audit`): NO duplicate customer rows, 0 null clerk_ids, healthy data. Healed 8 legacy rows where user_id != clerk_user_id → 0 mismatched. Customers table fully consistent.
- [x] **5b. Gate number provisioning behind active subscription/trial** — DONE 2026-07-06: `/api/sms/provision` now checks `hasActiveAccess` (Stripe subscription present OR within 14-day trial from created_at) before buying a number; returns 402 needsSubscription otherwise. NOTE: gate treats presence of stripe_subscription_id as active (doesn't verify canceled status via Stripe — tighten later if needed).
- [x] **Subscription route fixed** — DONE 2026-07-06: `/api/customer/subscription` had old price IDs + $99/$299/$799 + "enterprise" (missing "business"), which broke real checkout (upgrade to Business = "Invalid plan"; Starter/Pro checkout used dead price IDs). Now uses correct current price IDs + $29/$69/$199 + starter/professional/business, guarded against legacy plan values.
- [x] ~~6. Landing page pass~~ **VERIFIED MOSTLY DONE 2026-07-20** (checkbox was stale): industries section live (`app/page.js` `industries` array w/ pain-lines), Founding Customers strip live w/ BIZZYFOUNDER code, no fake "500+ businesses"/testimonials found, Voice AI listed in pricing cards. Not re-verified: hero copy's exact wording. Marketing push starting now — see NEXT SESSION TODO.
- [ ] **7. Launch prep** — pick ~10 founding customers (local trades), BIZZYFOUNDER coupon ready, one case study plan

### External (parallel, not blocking)
- [ ] Request Twilio Hosted Numbers API preview access (Console ticket or hostedsms@twilio.com + Account SID) — needed for "keep your existing number" v1.1 feature
- [ ] Meta App Review (in progress) · Google OAuth verification (in progress)

### Post-launch backlog
Calendly webhook (~3-4 hrs) → Dashboard analytics redesign → **Document receiving** (leads send filled forms/photos back — needs file storage e.g. Railway bucket + attachment extraction from Gmail/Outlook/MMS; founder flagged 2026-07-07 as valuable for inspectors/repair trades) → Hosted SMS onboarding path → click-to-call bridge (owner calls leads from business number) → referral tracking → 10DLC local numbers (only if customers demand local or outbound marketing ships) → near-real-time email replies (Gmail/Outlook push notifications instead of hourly cron) → Intent-triage follow-ups: mocked-client unit test for the two-tier classifier flow · triage UI polish (correction failure feedback, double-click guard, move TriageFlagCard out of render body when it gains state) · decide "This was a lead" semantics (currently teaches future emails only — does NOT hand that email back to the AI) · Gmail triage rows record intent-not-outcome during check (row can read conservative_reply though nothing sent until respond runs)

### Security cleanup backlog
- [ ] Add Twilio signature verification to `/api/sms/webhook` (reuse `lib/twilio-verify.js`, validate against `${BASE_URL}/api/sms/webhook`). Lower risk than the voice routes (no outbound alerts fired), so deferred from the 2026-07-07 voice security pass.

---

## ☀️ NEXT SESSION TODO (start here — updated 2026-07-19 morning)

**📧 INTENT TRIAGE SHIPPED — founder: reconnect Outlook** (Email → Setup), then send one vendor-style email + one lead-style email to verify live: vendor gets NO reply + amber "Left for you" flag; lead gets an AI reply. Success criterion: one week of real traffic, zero wrong-target auto-replies.

**📧 07-19: RESEND OUTAGE FOUND & FIXED** — bizzybotai.com had NO domain on the Resend account (lost during the 07-09 M365 DNS rework): ALL platform emails silently 403'd for ~a week while logs claimed success. Fixed: domain re-registered + 3 DNS records at Namecheap (send subdomain + resend._domainkey, coexists with M365), VERIFIED; new `lib/resend-send.js` — all live senders now check Resend's response (never bypass it for new email features). New aliases on the Drayke mailbox: **alerts@** + **support@** bizzybotai.com — both VERIFIED receiving 07-19 (gotcha: had to be added in the EXCHANGE admin center, not just M365 admin — admin-center-only aliases bounce 5.1.10). support@ = official support address — still needs adding to landing footer / privacy / SMS-terms pages.

**✅ Documents Phase A — DONE, LIVE-VERIFIED 2026-07-20** (moved to Completed): founder's real call → AI understood voice noticeably better, took the email, sent the doc email straight away, pricing link worked perfectly. All 4 tasks closed (plan: `docs/superpowers/plans/2026-07-18-documents-phase-a.md`; phantom-dot extraction bug was fixed en route 07-18). Doc decision RESOLVED 07-20: "BizzyBot Pricing Guide" STAYS on 863's voice channel — 863 is BizzyBot's own demo account (founder-stated purpose) and the doc is part of the demo. Recommended next voice feature: "text you the link" for mobile callers. Phase B storage/attachments + Phase C receiving deferred.

**✅ "VOICE OUTAGE" RESOLVED 07-20: FALSE ALARM — founder had two numbers mixed up and was dialing the wrong number all along.** Both toll-frees verified healthy with Twilio records (founder's cell → 866 completed 04:19 UTC 07-20; → 888 completed 01:57 UTC; internal calls connect + AI answers). NO Twilio ticket needed. Likely retro-explains the 07-18/19 "overnight carrier routing" incident AND possibly 07-12 (same zero-records signature). Lesson: zero-Twilio-records + healthy-internal-call = ALWAYS confirm the exact digits dialed before blaming carriers. Also same-day 07-18: TFV self-service shipped (branded /sms-optin+/sms-terms, legal-vs-brand DBA, /api/admin/resubmit-tfv + /api/admin/sync-vapi ops routes, status card); JPH resubmission parked on their NEW LLC (old one in bad standing).

### Carried TODO from 2026-07-13 (still valid below)

**🎉 FIRST REAL CUSTOMER: the solar company (Jesse Hester / JPH, LLC) SIGNED UP 2026-07-13** — founder doing manual white-glove onboarding. ⚠️ Their account is SEPARATE from customer 863 (863 = founder's test account with the FAKE "Sunrise Solar" demo persona — do NOT edit 863 for the real customer). **RESOLVED 2026-07-20: real working account is customer 875 ("JPH, LLC," mdcleanenergy@outlook.com)** — matches the TFV requirement noted below (official-domain email, not Gmail). Customer 874 (jessephester@gmail.com, "Jesse hester") is the SAME PERSON's earlier personal-email trial account, made to explore before committing — dormant/redundant now, harmless to leave as-is, safe to delete if founder wants cleanup later. Rushing to get their toll-free number online for marketing. TFV must pass first try: legal business name matches records, official-domain business email (NOT Gmail — that rejected 863), EIN if LLC/corp, real-person authorized contact. Number instant, SMS ~3-5 day approval, voice immediate. HOLD email onboarding for them until intent-triage ships (✅ intent triage now shipped 2026-07-19 — email onboarding for JPH is unblocked).

**0. [ ] FRESH-SIGNUP WALKTHROUGH (top priority, still not done):** founder creates a junk-email account and walks the exact trial path — sign up → dashboard → SMS onboarding (buys a real number, ~$2) → text it → AI replies. Watch Railway logs during. Final onboarding confidence check; all code-side blockers cleared (Stripe webhook was broken 3 ways — fixed 07-10; scoring/memory rebuilt 07-11). Watch the scoring arc while testing: first text (warm-ish) → pricing question (score climbs) → booking (flips hot + $ value). NOTE: SMS memory only reaches back to 07-10 (persistence start); voice memory now flows into text/email/chat.

**1. [x] ~~Build INTENT TRIAGE (roadmap item #0) BEFORE reconnecting Outlook~~ — SHIPPED 2026-07-19 (see Completed). Outlook reconnect unblocked.

**Post-demo cleanup:**
2. [x] ~~Revert demo persona~~ **ALREADY DONE — verified via prod DB audit 2026-07-20**: customer 863 (drayke@bizzybotai.com) = business_name 'Bizzy Bot Ai LLC', avg_job_value 800, all 6 ai_channel_settings channels carry BizzyBot content, zero Sunrise/Solar remnants. **Founder-stated purpose (2026-07-20): 863 is BizzyBot's OWN DEMO ACCOUNT — the platform demoing itself to prospects on every channel. The "BizzyBot Pricing Guide" doc on its voice channel STAYS (it's the demo).** (Account 872 reviewer@bizzybotai.com "Sunshine Home Services" = separate Google-reviewer test account, unrelated.)

**Verification still owed (fast):**
3. [ ] **Voice test from a NON-forwarded phone** (not 858-900-4220): cell rings ~18s → AI answers as Sunrise Solar → missed-call text alert (TFV approved) + email alert. (Carrier network had a degraded window 07-12, recovered 07-13 — retest on a clear day.)
4. [ ] **Fresh hot-lead SMS**: high-intent text → bell shows lead, SMS Hot Lead Alerts card fills, Leads shows hot. Flip **Hot Lead Alerts toggle ON** (SMS page) + set alert email in Settings→Notifications to test owner text+email alert (business-hours schedule now actually enforced).
5. [ ] **Add Lead** live test: manual lead appears at top; adding an existing texter's number merges (no duplicate).
6. [x] ~~First-SMS-reply genericness~~ SOLVED 07-11: the code replaced the AI's reply to a lead's FIRST message with a canned welcome line — removed.

**Founder email switch (email now fully working — outbound block LIFTED 07-13):**
7. [ ] kernojunk login → Drayke@bizzybotai.com via Settings → Account → "Change it securely here" (Clerk modal). Confirm customers.email syncs (if not: Clerk Dashboard → Webhooks → enable user.updated). ADMIN_CLERK_ID_1 pinned as fallback.

**Gmail (pre-launch "coming soon", lower priority):**
8. [ ] Reconnect test Gmail on secure OAuth → fresh test → one reply, real info, no placeholders. Gmail hot-lead path still uses 'email_received' (never promotes hot) — mirror the hot_lead fix when touching it.

**Carried forward:**
9. [ ] Mobile real-phone check (hamburger/bell/Email split inbox).
10. [ ] Web-chat widget embed on a real external HTML page (persistence schema fixed 07-10/11 — retest end-to-end).
11. [ ] Analytics page sanity on prod ("Booked by your AI" + Appointments should tick now).
12. [ ] Launch prep (founding customers, BIZZYFOUNDER coupon).
13. [ ] Voice-to-voice memory: inject prior call summaries into Vapi at call-start ([[ai-brain-roadmap]] #7).

**Product gaps / decisions parked:**
- **"This was a lead" button semantics (triage corrections) — founder sleeping on it 2026-07-20.** Today: clicking teaches future classifications only; the flagged email still needs a hand-written reply. Option B: also have the AI reply immediately (faster speed-to-lead, but a misclick/wrong-row/misjudged click SENDS an email to a possible vendor — unrecallable). Recommended middle ground: click saves the lesson, then a small confirm — "Want the AI to reply to this one now? [Send AI reply] / [I'll reply myself]" — one deliberate second step before anything leaves. Cheap to build (~30 min). Decide before real customers use the correction buttons.
- ~~Unit Economics panel uses conservative estimated rates~~ **UPGRADED TO ACTUALS 2026-07-20**: voice = exact Vapi per-call billed cost (captured from webhook + 19 historical calls backfilled; lifetime voice total $0.99); SMS = exact Twilio per-message billed prices via API; OpenAI rate corrected to measured actual ($0.13/2,209 requests July); response carries per-cost `costBasis` (actual/estimate/formula). UNIT_RATES remain only as labeled fallbacks. STILL VERIFY on first real Twilio invoice: Twilio's ledger shows $0 billed for ALL voice legs to date (expected ~2-4¢/min list) — confirm whether voice truly rides free under the Vapi arrangement or bills later.
- **SMS-heavy whale guard (noted 2026-07-20 from exact max-out math)**: a Business customer maxing all 5,000 responses AS SMS ≈ break-even ($0.40 margin); all-email max-out = 70% margin. If a text-heavy whale appears on Business, add an SMS-count limit. Starter/Pro profitable even at absolute worst case.
- Settings page lacks Authorized Contact name fields (pre-07-06 customers can't save Business Email — server rejects partial verification info).
- Bell scope decision: add AI-booked appointments + missed calls to notifications? (Recommended; ~15 min; founder undecided.)
- Retroactively adding a late-collected email to an already-created calendar event (deferred from book-first-then-ask-email).
- Nice-to-haves: sidebar plan/usage card · mobile padding polish · "Apply to all channels" for Documents.
- **Landing page animation (parked 2026-07-20, founder loves current page, wants to "spice it up"):** recommended direction = animated mock chat conversation in the hero (typing lead message → AI reply, looping) — most on-brand since it *shows* the product working, matches what Podium/GHL-style competitors do. Lighter/cheaper alternatives if preferred: scroll-triggered fade-ins on existing sections, or animated stat counters. Load frontend-design skill when this gets picked up.

---

## Session Log

### Session — 2026-07-20 (Clerk migrated Development→Production — fixed the real cause of 7 weeks of zero Google indexing)

- **ROOT CAUSE FOUND AND FIXED: the entire live site had been running on Clerk's DEVELOPMENT instance in production since launch.** No Production Clerk instance had ever been created. Discovered while chasing why Google Search Console showed 0 indexed pages for 7+ weeks — systematic-debugging ruled out app code (middleware, next.config.js, robots.txt, sitemap.xml all correct), Clerk's Attack Protection dashboard settings, and Railway's Edge/Under Attack Mode before URL Inspection's "Test Live URL" nailed it: `Page fetch: Failed: Blocked due to unauthorized request (401)`, specifically only for requests identified as Google's crawler (a generic fetch succeeded fine) — the signature of a Development-only restriction, since dev instances aren't built for public/bot traffic.
- **Migrated to a real Production Clerk instance**: cloned dev config → added 5 DNS CNAME records at Namecheap (clerk./accounts./clkmail./clk._domainkey./clk2._domainkey.bizzybotai.com, all verified, SSL issued) → new `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_WEBHOOK_SECRET` set in Railway → `ADMIN_CLERK_ID_1` updated to founder's new user ID.
- **Account audit before migrating (customers table, 18 rows):** only 3 accounts had any real substance — 863 (founder/demo), 875 "JPH, LLC" (real founding customer, TFV-verified), 872 (Google OAuth reviewer test account). Zero paying Stripe subscriptions existed anywhere, which massively de-risked the cutover. The rest were dev-era test junk (`test1@lol.com` etc.) or bare signups with zero engagement (873, 874) — safe to ignore.
- **Founder re-signed up fresh under Production** (new user id `user_3Gle...`) → re-linked to existing account 863 via one `customers.clerk_user_id` UPDATE. Discovered the re-link wasn't complete on the first pass: 4 more tables independently store the Clerk id outside `customers` and needed the same update — `customer_phone_numbers`, `gmail_connections.user_id`, `outlook_connections.user_id` (2 rows), `vapi_call_logs` (18 rows) — all fixed; SMS/Voice AI/Gmail/Outlook confirmed working post-fix. Everything keyed by `customer_id` instead (contacts, conversations, analytics, ai_channel_settings, business_profiles) was never at risk.
- **VERIFIED FIXED**: URL Inspection "Test Live URL" on the homepage now returns "URL is available to Google" / "Page can be indexed" (was 401 minutes earlier under the same test). Requested indexing.
- **Marketing plan — foundation phase 100% done 2026-07-20**: Google Business Profile (name/category/address/24-7 hours/description/USA service area) ✅, Google Search Console (domain verified, sitemap processing successfully, 401 indexing bug found+fixed, homepage indexing requested) ✅, Bing Webmaster Tools (imported from GSC) ✅. **Next step in the plan: build a 20-30 business target list and start direct outreach** — nothing built/started on that yet. See NEXT SESSION TODO for the full remaining step list (target list → outreach cadence → JPH testimonial → local group posts → first blog post).

**Also shipped same session: signup attribution tracking** — `lib/attribution-client.js` (first-touch UTM/`?ref=`/referrer capture via cookie, `components/AttributionTracker.js` mounted site-wide in `app/layout.js`) + an optional "How did you hear about us?" dropdown on the last onboarding step. Both save to new `customers` columns (`signup_source`, `utm_source`, `utm_medium`, `utm_campaign`, `referrer_url`) on onboarding completion. No admin UI built yet to view this data (deliberate, YAGNI) — query the `customers` table directly, or ask a future session to build a simple report once there's enough signups to make one useful.

**Still open, not urgent**: JPH LLC (875) needs the same one-time fresh-signup + re-link once the founder gives them a heads-up (their data is untouched and safe in the meantime — just their login won't work until they do it). **Same heads-up should mention**: if their browser has an old (pre-migration) BizzyBot login cookie, they may see the page rapidly auto-refresh on bizzybotai.com — harmless, fixable by clearing cookies for the site (Chrome: new tab → chrome://settings/content/all → search "bizzybotai" → delete). Confirmed 2026-07-21: founder's own normal browser hit this (old Dev-Clerk cookie vs new Production instance); incognito was unaffected, confirming it's cookie-specific, not a real app bug — new visitors/prospects with no prior account are NOT exposed to this at all. Railway's Settings page shows a stray "GitHub Repo not found" banner on the Source card — repo itself confirmed healthy via `gh repo view`; deploys are unaffected; deferred as a separate low-priority cleanup (don't touch source/reconnect settings same-session as auth migrations). Repo `onreK/bizzybot-ai` is still PUBLIC — founder wants to flip it private (real competitive/security exposure now that real customer data flows through it) but agreed to sequence it AFTER the Railway↔GitHub connection is confirmed healthy, to avoid stacking two unresolved infra changes.

### Session — 2026-07-19 (evening: INTENT TRIAGE SHIPPED — the AI brain's first layer)

- **Email intent triage built end-to-end** (plan `docs/superpowers/plans/2026-07-19-email-intent-triage.md`, 17 commits 4ebcbb3→2549ca9, subagent-driven with per-task independent reviews): every inbound Gmail/Outlook email is classified (new_lead / existing_lead_reply / business_correspondence / automated / ambiguous, two-tier gpt-4o-mini→gpt-4o, strict-JSON confidence) BEFORE the AI may reply. Only high-confidence leads auto-reply; business correspondence gets NO reply + amber "Left for you" inbox flag; ambiguous gets ONE conservative template reply + flag; flag corrections ("This was a lead"/"Not a lead") stored per customer in new `email_triage` table and injected as few-shot examples into future classification prompts.
- **Eval gate**: 24 labeled emails (`scripts/triage-eval-set.json`) + `scripts/triage-eval.mjs` — passed 24/24 twice (build + final HEAD); the replayed Microsoft-Support email classifies business_correspondence/high every run. Re-run the eval after ANY change to `buildTriagePrompt`. Needs OPENAI_API_KEY — a gitignored `.env.local` now exists on the founder's machine (pulled from Railway; never commit).
- **HOT_LEAD_KEYWORDS de-fanged**: everyday words (help/issue/problem/contact/call me/phone/broken/money) removed; shared `lib/hot-lead-keywords.js`; keyword score capped at 45 < hot threshold 60 — keyword noise alone can never promote hot; GPT scorer leads. First test suite added to the repo (`npm test`, node:test, 19 tests).
- **Review loops caught 7 pre-ship bugs** incl. 3 in the plan's own code (null-subject classifier crash, flag/flagged string mismatch defeating the flagged-thread guard, triage variable scoping that emptied Gmail check results) + final-review fixes (Gmail gate now fails CLOSED without customer context; unified action strings; auto-poll no longer starved by flagged emails). Also killed: a Gmail sendHotLeadAlert call referencing nonexistent vars (threw a swallowed ReferenceError on EVERY email since it was added).
- **Founder decisions open (also in memory + backlog)**: (1) re-add 'competitor'/'other company' keywords? (2) should "This was a lead" hand the email back to the AI (currently teaches-future-only)?
- **Next**: founder reconnects Outlook (Email → Setup) + live vendor-vs-lead test; one week zero wrong-target auto-replies = success criterion #3.
- **Voice "regression" investigated → FALSE ALARM (resolved same night)**: founder was dialing a mixed-up wrong number; both account toll-frees verified healthy via Twilio records (founder's cell reached the 866 at 04:19 UTC 07-20). Full systematic-debugging run documented the isolation chain before the dialing error surfaced — useful template: zero call records + healthy internal call + working sibling number ⇒ check the dialed digits first. Prior "carrier routing" incidents (07-18/19, maybe 07-12) probably share this cause.

### Session — 2026-07-11→13 (memory · alerts · email inbox UX · saga resolutions)

- **SMS conversation memory made real** (was in-memory Map, wiped every deploy → AI had amnesia when a lead replied later): history now loaded from persisted conversations/messages (last 10, keyed customer+phone). Also removed the welcome-message override that replaced the AI's reply to a lead's FIRST message with a canned greeting (THE "generic first reply" mystery — solved).
- **Cross-channel voice memory**: getLeadContextForResponse pulls the lead's last 2 AI phone-call summaries from vapi_call_logs (matched last-10-digits) into every text/email/chat prompt, with guardrails (never quote imperfect transcripts verbatim, confirm don't assert). Voice-to-voice (Vapi at call-start) deferred.
- **Alert schedule fixed**: SMS-page Hot Lead Alerts toggle + 24/7-vs-Business-hours buttons were wired to a legacy in-memory configure-ai route (dead after every deploy) and nothing read the values. Now → /api/customer/notifications (partial-update, can't wipe alert email); new customers.alert_business_hours col; sendHotLeadAlert actually suppresses outside Mon–Fri 9–5 business-local.
- **Email inbox UX**: unreplied emails get a blue outline ring (removed once aiReply exists); Sent tab now derives from every inbox email carrying an AI reply (survives refresh — old list was session-only, hence Sent 0).
- **Account settings truth-pass + email-change flow**: phone now actually saves (customers.phone); sign-in email field opens Clerk's openUserProfile modal (add→verify→set-primary) instead of a fake editable box; customers.email syncs only from verified Clerk primary (user.updated webhook). Founder identity migrating to Drayke@bizzybotai.com; ADMIN_CLERK_ID_1 pinned.
- **🔒 admin-escalation hole closed** (update-account wrote user-typed email into the admin-check column) + anchored the domain match in all 3 admin routes.
- **EMAIL SAGA RESOLVED**: 550 5.7.708 outbound block was NOT tenant-wide (hand-written mail delivered; only Graph-sent AI replies bounced → outbound-spam verdict on automated sends). New-tenant reputation, worsened by pre-MFA token revocation (AADSTS50076, fixed by one reconnect). **Block LIFTED 2026-07-13 on a MANDATORY anti-abuse verification phone call** (Case 2607110040000834). Outlook still disconnected from BizzyBot pending intent-triage.
- **Intent-triage identified as roadmap #0** (AI pitched site assessments to Microsoft Support + scored the engineer a $18k hot lead — HOT_LEAD_KEYWORDS too loose). Full AI-brain roadmap saved in memory.
- **Non-issues diagnosed** (observability win — none were our code): Twilio carrier-network degradation 07-12 (calls rang-out, recovered 07-13); Microsoft Entra "designate 2nd global admin" email (routine best-practice nag).

### Session — 2026-07-11 (lead scoring rebuilt · account settings truth-pass · 2 security holes closed)

- **Lead scoring fully vetted + rebuilt (founder: "feels inaccurate" — he was right, it was disconnected, not mistuned):**
  - Bookings never scored: real bookings emit `appointment_booked`, counter map only listened for never-emitted `appointment_scheduled`. Booking flow now creates/links the contact + tracks through trackLeadEventWithContact → appointment_count++ → instant hot (anonymous leads fall back to bare analytics event; metadata {start, attendee} preserved for scheduling page).
  - Phone requests never scored: analyzer emits `phone_requested`, map had `phone_request`. Both mapped; new `recordEngagementSignal()` in leads-service bumps counters + rescores WITHOUT inserting analytics events (no double counting).
  - `pricing_discussion_count` column never existed (classifier checked a phantom). Column added; pricing keyword regex in ai-service increments it per message.
  - SMS page displayed 0-100 scores as "N/10" with 0-10 flame thresholds (any score ≥9/100 got a flame). Now 70/55/40 tiers, flame at 70+.
  - **potential_value was BizzyBot's legacy $97–$497 subscription prices masquerading as lead worth.** Now `customers.avg_job_value × temperature` (hot 1.0 / warm 0.5 / cold 0.15), NULL→"—" when unset. New **"Average Job Value ($)"** field in Settings → Business Profile. Founder set 18000 (solar persona) → 4 hot × $18k + 2 warm + 45 cold = $211.5k demo pipeline.
  - All 75 prod contacts rescored; test lead went 35/cold → **80/hot** (the booked+pricing lead — correct). Scoring math verified by hand against the formula.
- **Settings → Account tab truth-pass** (founder: "saves don't stick"): names were saving (UI didn't refresh — now user.reload() after save); **phone was never saved anywhere** (endpoint ignored it — now stored on customers.phone, loaded back via GET); **email edits were logged + discarded** (needs a verification flow) — field now disabled with a "Change it securely here" link that opens **Clerk's openUserProfile() modal** (add address → code verify → set primary; no custom flow to maintain).
- **🔒 SECURITY: self-serve admin escalation closed.** update-account wrote the user-typed email straight into customers.email — the column admin access checks by domain. Any customer could type x@bizzybotai.com → instant admin. customers.email now only syncs from the VERIFIED Clerk primary (update-account + new user.updated webhook handler). (Yesterday's related fix: substring domain match `includes('@bizzybotai.com')` → anchored, all 3 admin routes.)
- **Founder identity migration path:** ADMIN_CLERK_ID_1 pinned in Railway (admin survives any email change); founder switching login to Drayke@bizzybotai.com via the Clerk modal. ⚠️ Verify the Clerk webhook endpoint has **user.updated** subscribed (only user.created confirmed).
- Leads: "—" instead of misleading $0 when avg job value unset.

### Session — 2026-07-10 (late night: demo won · Stripe pipeline repaired · marketing Phase 0)

- **Solar demo succeeded** — prospect starting a free trial. Their ask (manual lead creation) shipped same-day.
- **🔴→✅ Stripe payment pipeline was broken THREE ways** (a paying customer would have stayed on trial and been locked out at day 14): (1) webhook plan detection used never-set env vars + an includes() fallback that can't match real price IDs → every purchase mapped to 'starter' (now resolves from PRICING_PLANS in lib/stripe.js); (2) webhook read session.metadata.userId but checkout writes clerkUserId → payment never matched a customer (now accepts both); (3) **no webhook endpoint existed in Stripe at all + STRIPE_WEBHOOK_SECRET unset in Railway** → founder registered "BizzyBot Payment" destination (4 events) in Stripe Workbench, secret set in Railway, redeployed. **Pipe verified live with synthetic signed events: valid signature → 200, tampered → 400.**
- **Onboarding audit (rest was healthy):** Clerk user.created webhook → customers row (16/16 real signups clean); 14-day trial gate on /api/sms/provision correct; monthly response pool enforced in ai-service (fails open); checkout adds another 14-day Stripe trial after card entry. ⚠️ Voice minutes are displayed but NOT hard-enforced (deliberate for now — trial-friendly, small cost exposure; enforce post-launch).
- **Marketing Phase 0 shipped + verified live:** metadata rewrite claiming "AI receptionist" category (+capture/score/nurture/book scope), sitemap.xml, robots.txt (AI crawlers welcomed), SoftwareApplication + FAQPage JSON-LD, hero badge/subheadline reworded, **brand 'BizzyBot AI' → 'BizzyBot'** on high-visibility surfaces (legal name unchanged; long-tail sweep parked), lifecycle strip section ("Most AI receptionists stop at answering — BizzyBot runs your whole front office": Answered→Captured→Scored→Booked→Followed up→Alerted), dashboard mockup URL fixed (showed unowned bizzybot.ai). Full marketing game plan (SEO/GEO/founder-led/paid) delivered in-session; founder to create Google Search Console + Bing Webmaster + Google Business Profile accounts.
- **Admin Unit Economics panel** (+/api/admin/usage-costs): per-customer month-to-date usage costs (SMS/voice/number/OpenAI/Stripe est. rates — deliberately conservative, reconcile vs real invoices later) vs revenue; revenue counts only customers with a real Stripe subscription ('(unpaid)' tag otherwise). Fixed stale admin analytics MRR ($97/$197/$497+'enterprise' → $29/$69/$199+business). **Security fix all 3 admin routes: email admin check was substring (`includes('@bizzybotai.com')` — x@bizzybotai.com.evil.com would pass); now anchored domain match.**
- **Email deliverability:** DKIM enabled + Valid (SPF+DKIM+DMARC complete). Outbound blocked by Microsoft new-tenant probation (550 5.7.708; Restricted entities empty — tenant-level, self-clears ~24-48h; support ticket if persists past 07-12). NDRs correctly filtered from BizzyBot inbox (automated-sender filter).
- Scheduling: per-customer Meeting Length setting shipped earlier tonight; hot-lead bell fixes live.

### Session — 2026-07-09/10 (TFV approved · business email · SMS channel fully live)

- **TFV REJECTED → RESUBMITTED → ✅ APPROVED same day.** Rejection reason: business email must be official domain (was Gmail). Fixed via edit-in-place resubmit (same HH sid keeps priority queue spot — approval came ~1hr after edit). (866) 944-5685 now sends/receives SMS. Code: Settings Business Email field wired (was dead input), rejected-TFV edit path in lib/tollfree-verification.js (`editSid` → POST to instance URL, TollfreePhoneNumberSid is create-only), retry route accepts TWILIO_REJECTED, hourly duplicate admin rejection emails stopped.
- **"Number rings busy" mystery:** founder called toll-free from the same cell "ring my phone first" forwards to → own phone busy. Not an outage. Voice + TFV are independent; rejection never affected calls.
- **Business email created: Drayke@bizzybotai.com** on Microsoft 365 Business Basic (trial → $8.40/mo; tenant BizzyBotAI.onmicrosoft.com; signup created a duplicate user — deleted, original admin renamed). DNS at Namecheap: MX → Microsoft (MAIL SETTINGS Private Email → Custom MX; old unused privateemail routing auto-removed), SPF, autodiscover, DKIM selector1/2 CNAMEs, DMARC `_dmarc` p=none. ⏳ **DKIM enable toggle still pending Microsoft-side sync** — retry at security.microsoft.com/authentication?viewid=DKIM. Contact name on file w/ Twilio: legal "Drayke Adams" / "Kern".
- **Vapi had hijacked SMS:** number's SmsUrl pointed at api.vapi.ai/twilio/sms (set during Vapi number import) → inbound texts silently swallowed. Repointed to /api/sms/webhook + ensureVoiceRouting now reclaims SmsUrl on every provision/call-settings save.
- **SMS persistence was 100% broken** (schema-mismatch, silently caught): conversations insert omitted NOT NULL conversation_key+source; messages insert used nonexistent `metadata` col + missing required user_id; reader selected `metadata` too (the old sms/conversations 500). All fixed against real prod schema (verified via rolled-back dry-runs). **SMS page: conversation rows now expand (chevron) into full chat threads.**
- **Phantom `event_data`/`event_value` columns purged** (migration renamed event_data→metadata long ago; 6 code paths still wrote/read the old name, all silently failing): ai-service appointment_booked + document_sent, scheduling GET aiBookings (why "Booked by your AI" was always empty), leads-service captureInboundMessage, widget chat events, behavior-analyzer, database.js logAIEvent + CREATE TABLE. Lost 2pm booking event backfilled by hand.
- **Live-verified end-to-end:** SMS → AI reply (pricing + clickable site link) → conversation persisted → lead captured+scored (80/10 hot) → **AI booked a real appointment via SMS** ("book me 7/10 at 2pm" → real Outlook event, founder saw it on his calendar).
- **Outlook: Disconnect button added** (+ POST /api/auth/outlook/disconnect, marks rows 'disconnected') and OAuth prompt consent→select_account (browser session was silently reconnecting the old account). Founder connected Drayke@bizzybotai.com.
- **Scheduling upgrades:** per-customer **Meeting Length** setting (15/30/45/60, customers.meeting_duration_minutes, used in slots + event creation); event titles/body identify lead by name→phone→email; **book-first-then-ask-email** (founder decision: never gate booking on email; worst case we have the phone).
- **Product gap noted:** Settings page has no Authorized Contact name fields (pre-07-06 customers have NULL contact names in sms_verification_info → their Business Email save is blocked server-side; founder's row fixed by direct DB update).
- **Email dashboard fixed for demo (0171968):** Outlook emails were only rendered in the SENT tab (Inbox merge never included them — Inbox 0 / Sent 6). Inbox now merges Gmail+Outlook by time; Sent = sent responses only. **Refresh + "Check for emails" now run `checkAllEmails`** — triggers the Outlook monitor (session-auth) + Gmail check on demand, so email replies are demoable live instead of waiting for the hourly cron. Outlook email AI reply live-verified (cron `processed: 1` for Drayke@bizzybotai.com).
- **Hot leads now actually promote contacts (dd2bc5d):** detection only ever sent the owner alert; nothing recorded the `hot_lead` event that bumps hot_lead_count → rescore → temperature 'hot' → notification bell (bell reads hot contacts, last 14 days). SMS + Outlook + web chat now track hot_lead on detection (Outlook's old updateLeadScoring call passed wrong args, silently failed). Web-chat widget persistence had the same phantom-schema inserts as SMS — fixed. 80/10 SMS lead promoted by hand in prod.
- **Leads page (164d0eb, 614851f):** sort direction was inverted (default showed OLDEST activity first while displaying a desc arrow) — fixed, newest activity first. **New "Add Lead" button + modal** → POST /api/customer/leads/create runs manual leads through the same contact pipeline (dedupes by phone/email, channel 'manual', activity event) — feature requested by the demo prospect.
- **Demo persona (DB-only, no commit):** all 6 ai_channel_settings rows for customer 863 re-skinned to **"Sunrise Solar"** (solar pricing/process/FAQs knowledge base, book-free-site-assessment instructions) + **hot_lead_detection flipped TRUE on all channels (was false everywhere)** + customers.business_name → 'Sunrise Solar' (**REVERT to 'Bizzy Bot Ai LLC' after demo phase**). Vapi voice needs AI Settings → Voice → Save & Sync to pick it up.
- **NEXT: solar-company demo (2026-07-10 evening)** — dry-run script: high-intent text → hot lead + bell; "book me tomorrow 10am" → Sunrise Solar calendar event at configured meeting length; call from non-forwarded phone; email + dashboard Refresh for live reply. Still open: first-SMS-reply genericness, DKIM toggle, Gmail re-verify.

### Session — 2026-07-07 (evening #2)
**FINAL DEEP DIVE (Launch Checklist item 10) — all 4 subsystems audited against prod DB + fixed**

- **(a) Analytics** (`f2f94e1`): prod audit found 26,203 of 26,284 events were duplicate gmail `email_received` rows (271 real emails — monitor re-logged unread mail every cron run), AND the page counted event names the tracker stopped writing in Aug 2025 (`hot_lead` vs `hot_lead_detected` etc.) so Hot Leads/Phone/Appointments froze at 0. Fixed: interactions = distinct real inbound; both name generations counted; gmail write-side dedup completed; trend chart was rendering backwards (fixed); `[BOOK:]` bookings now log `appointment_booked`. **Duplicate rows deleted from prod (user-approved): 26,203 → 271; whole events table now 352 rows.** Verified against prod: customer 863 all-time = 251 interactions, 9 hot, 5 phone, 2 appts.
- **(b) Lead Management** (`e9cec16`): only Gmail/Outlook/Voice created contacts. SMS "lead captured" was a console.log (now real contact + event per texter). **Web-chat embed was fully broken for customer sites** (auth read empty in-memory `global.businesses`, chat POSTed to Clerk-authed endpoint = 401 for visitors, read wrong response field) — rebuilt: DB-backed widget auth w/ subscription gate, new public `/api/widget/[id]/chat` (CORS, per-session persistence, email/phone extraction → contact, hot-lead alerts). FB/IG DMs wired via new `captureInboundMessage` in leads-service. Outlook was NOT broken — contacts dedup by email, first-touch source wins.
- **(c) Calendar** (`a885187`): Outlook AI booking loop (slots → AI offers → `[BOOK:]` → real event + invite) already existed BUT was all-UTC: ET businesses were offered 5am-local slots and leads were told UTC times. Fixed: business-local hours/display (`business_timezone` col, default America/New_York; `[SLOT:]` markers stay UTC). `[BOOK:]` now validated against offered slots; failed/invalid bookings correct the reply instead of leaving a false "you're booked!". Old `/api/calendly` route = dead single-tenant demo code (founder's token, hardcoded real-estate event names), nothing calls it.
- **(d) Documents** (`29792fa`): per-channel config + AI link-sending works; sends now logged as `document_sent`. **Receiving is not built** (no uploads/attachment extraction) — feature decision deferred.
- Known quirk (pre-existing, not fixed): "today" metrics use the DB's UTC day, so late-evening ET activity can count as tomorrow.

### Session — 2026-07-08 (late night addendum)
**Landing page pass · Time Saved fix · cron incident + hardening**

- **Landing page pass shipped** (`79137a8`) — see Launch Checklist item 9 for details (voice-first hero, Industries section, honest founding-customer claims, FB/IG "coming soon").
- **Time Saved metric fixed** (`46d3509`): only Gmail replies were counted (behavior tracker never logged `ai_response` events for SMS/chat/Outlook/FB/IG; only Gmail's monitor did via the lead system). Now every AI reply logs one baseline `ai_response` event (Gmail excluded — would double-count), and **voice minutes count minute-for-minute** into Time Saved. Counting effectively starts 2026-07-08.
- **Cron "failure" diagnosed via Railway logs** (Railway CLI now authenticated as kernopay; use `railway logs --project 185b140f-a85a-44a4-97c3-86fb29d4d9ec --environment 29306b46-92bd-4abd-982e-bb1783829431 --service 30d2ca05-823a-4e4d-98ad-53e26cd1e6ba`): the 20:03 UTC run got a 502 because the app was mid-deploy (12 deploys that night). One-off, self-heals.
- **Cron hardening** (`21e3346`): new public `/api/health` endpoint + founder set **Healthcheck Path = /api/health** on the BizzyBotAi service in the Railway dashboard → zero-downtime deploys (proof: next deploy's logs show a healthcheck step). Cron gmail/outlook queries now `SELECT DISTINCT` (logs showed 9 checks for ~4 unique emails — duplicate connection rows). Expired Gmail connections (ameliaknoa2026@, laquisha.pudz009@ were erroring hourly forever) are now auto-marked `status='expired'` and drop out of the loop until reconnected.
- **NEXT SESSION = the final deep dive** (Launch Checklist item 10): analytics, lead management, calendar booking, documents/forms.

### Session — 2026-07-07 (evening)
**Design system unification · Overview overhaul (3 phases) · mobile support · SMS persistence**

- **Design audit + unification.** Full audit of every channel page vs competitors (Podium/GHL/Rosie). Verdict: 3 design generations coexisting; **Voice AI page frozen as the design standard** (icon-box header → status cards → attention banner → settings card → activity lists; violet for interactive elements, channel identity color only in header icon/tags). Applied standard headers + flat stat cards to Email (cyan), Facebook (blue), Instagram (pink), Web Chat (emerald), Scheduling (violet). SMS page fully rebuilt earlier today to match Voice (blue, no tabs). Email kept its tabbed split-inbox layout deliberately (founder finds it intuitive — restyle only, commit `084f51e` if revert ever wanted).
- **Fabricated metrics purged** (important for "built to sell"): hardcoded +23%/+15% Overview trends, FB/IG "< 1 sec" response speed (API + UI, now dash until real activity), TWO hardcoated "2 min avg response time" fallbacks. Landing page's fake "500+ businesses"/testimonials still pending (launch item 6).
- **Landing page demo links were 404ing** — all 4 pointed to /amanda (deleted 07-06); now /demo.
- **Web Chat page: live test chat embedded** — two-column layout: setup left, working chat right (talks to real /api/chat + customer AI settings, suggested prompts, hot-lead callout). No more bouncing to /demo.
- **Dashboard is now mobile-friendly** — sidebar was a fixed 240px column (broken on phones); now an off-canvas drawer below md with a mobile top bar (hamburger + logo + bell), backdrop, auto-close on nav. Notification panel full-width on phones. Sidebar nav rows enlarged (15px/py-2.5/18px icons).
- **🔑 SMS conversations now persist.** Discovered the SMS webhook stored conversations in an **in-memory Map** — wiped every deploy, nothing ever reached the DB. Webhook now writes each exchange to the shared `conversations`(type='sms', new `contact_phone` col)/`messages` tables; `/api/sms/conversations` rewritten to read them (was 500ing importing nonexistent lib functions). Only NEW conversations persist (old ones were never saved).
- **Overview page overhaul, 3 phases (each own commit):**
  - **P1 truth (`a67ad30`):** FB/IG cards called nonexistent /api/social/* (404 → always "Not connected"); now real status+stats endpoints. /api/chat GET added (was 405 → Web Chat always "Not set up"). **Voice AI added as 6th channel card** (calls + minutes; was completely absent) + counted in AI Active dot. SMS connected via /api/sms/provision; email connected now counts **Outlook** (was Gmail-only). Conversations/Messages cards no longer show the same aliased number. Polling cut from 12 requests/30s to notifications-only/60s + manual Refresh.
  - **P2 clarity (`73bc7a4`):** 3 overlapping stat sections → two labeled rows: **Today** (conversations/leads/hot leads/phone requests) + **This Month** (conversations/leads/appointments/avg response/…); AI Performance card removed; every fact appears exactly once.
  - **P3 priority (`490cf35`):** **"Needs Attention"** hot-leads grid now sits at the top (before all stats; collapses to a one-line all-clear when empty). **AI Automation Rate swapped for "Time Saved"** (AI replies × ~3 min, hrs past 60m; analytics service now exposes `ai_responses_month`). Pipeline + Trend pair at the bottom.
- **Positioning REVISED:** founder does not want trades-only pigeonholing — broad multi-industry hero + industries section (see Launch Plan).
- **Security:** Twilio signature verification added to /api/voice/* (fails closed, 403). `lib/twilio-verify.js` reusable — /api/sms/webhook still pending (Security cleanup backlog).

### Session — 2026-07-07 (continued)
**Call forwarding (ring owner first → AI backup) + voice webhook security**

- **Call forwarding built** — inbound calls to the toll-free number now ring the owner's cell first (~18s, configurable), then hand the live caller to the AI on no-answer so no lead is lost. On no-answer the owner also gets a **text + email** missed-lead alert. A toggle switches the order: **"Ring my phone first"** (default) vs **"AI answers first."**
  - New endpoints: `app/api/voice/incoming/route.js` (TwiML entry — reads customer's mode/cell/ring, `<Dial>` cell then `<Redirect>` to Vapi, or straight to AI), `app/api/voice/fallback/route.js` (no-answer handler — email via `sendHotLeadAlert` + Twilio SMS from toll-free + `<Redirect>` to Vapi), `app/api/vapi/call-settings/route.js` (GET/POST the forward_cell/call_mode/ring_seconds).
  - New Call Handling card on `/voice` dashboard (mode buttons + cell input + ring seconds + Save).
  - **Voice routing take-over:** `lib/voice-routing.js` `ensureVoiceRouting()` captures Vapi's inbound URL (stored as `vapi_voice_url`) then points the Twilio number's Voice URL at `/api/voice/incoming`. Safe/idempotent — only takes over if it knows where the AI lives, so it never breaks AI answering. Runs on vapi/provision (both paths) AND on call-settings Save (so the already-provisioned number activates without a re-provision).
  - DB: `customer_phone_numbers` gains `vapi_voice_url`, `forward_cell`, `call_mode` (DEFAULT 'human_first'), `ring_seconds` (DEFAULT 18) — auto-created.
  - `/api/voice/(.*)` added to middleware publicRoutes (Twilio calls TwiML with no Clerk session).
  - Test cell for now: **858-900-4220**. Missed-call SMS won't deliver until the toll-free is SMS-verified; email alert works immediately.
- **Voice webhook security (flagged by automated review):** both public voice routes now require a valid `X-Twilio-Signature` before doing any work (`lib/twilio-verify.js` → `isValidTwilioRequest`, validates against `${BASE_URL}/api/voice/{incoming,fallback}`). Fails closed → 403 on missing/invalid sig. Prevents strangers from triggering the missed-call SMS/email (spam/toll-fraud) or leaking the owner's forwarding number.
- **CLEANUP FOR LATER:** apply the same Twilio signature verification to `/api/sms/webhook` (also public). Lower risk (no outbound alerts fired), so deferred — reuse `lib/twilio-verify.js`, validate against `${BASE_URL}/api/sms/webhook`.

### Session — 2026-07-07
**Email channel deep hardening — Gmail + Outlook**

- **Outlook email — got it fully working end-to-end (connect → receive → AI reply → log → lead → unified inbox):**
  - Fixed OAuth: added `openid`/`profile` scopes (Microsoft AADSTS70011 was blocking connection *entirely* — Outlook was never actually connected before)
  - Unified email inbox now shows Gmail (red tag) + Outlook (blue tag); empty-check/counters were Gmail-only and hid Outlook emails
  - New user-triggered check: `/api/outlook/monitor` POST now accepts a logged-in session (not just cron) so customers/tests can check on demand
  - Claim-then-send dedup (record message in `outlook_messages` before sending; skip if already claimed → impossible to double-reply)
  - Diagnostics added to explain `totalProcessed: 0` (fetched/customerFound/skip counters/senders/aiInfo/errors)
- **Gmail email — fixed two serious bugs:**
  - **Duplicate-reply loop** (was sending 8+ replies to one email). ROOT CAUSE: `gmail.modify` scope was removed in commit 347810c ("not needed" — but it WAS the dedup: marking read stopped re-fetch). Without modify we can't mark read, so added DB dedup: new `gmail_responded` table, claim-before-send in `respondToEmail`, and filter answered ids out of the `is:unread` check. Do NOT re-add gmail.modify (triggers Google's $15k CASA audit).
  - **Placeholder replies** (`[Your Name]`, "My Business"). Two causes fixed: (a) prompt — gmail channel said "sign off appropriately" → AI invented signatures; changed to "sign off as business name only" + added hard no-placeholders rule to `buildChannelSpecificPrompt`; (b) config not loading — `getCustomerAIConfiguration` only tried the (often broken) user id; added email fallback.
  - **Secure Gmail OAuth** (like Outlook): initiation now reads the verified Clerk session + sets an httpOnly state cookie; callback verifies the cookie and stores the server-verified user id. Was defaulting to `'anonymous'` from a missing URL param → broken connections + account-linking security gap. Middleware runs Clerk on `/api/auth/google` (callback stays ignored).
- **Key facts:** Gmail + Outlook share the `email` channel AI settings (CHANNEL_MAP maps `gmail`→`email`). New table: `gmail_responded`. Email replies currently run on the hourly cron OR manual trigger (no gmail.modify / no push yet).


### Session — 2026-07-05
**Toll-free SMS pivot — on-demand numbers + auto-verification**

- **Decision:** abandoned A2P 10DLC (per-customer TCR registration not viable); pivoted to toll-free numbers — instant purchase, per-number verification (~3-5 business days), no brand/campaign/EIN needed. Sole-prop friendly (Facebook page accepted as website).
- **No number pool** — numbers bought on demand when a customer provisions SMS (founder decision: reduce carrying cost)
- **New:** `lib/tollfree-verification.js` — submits TFV via Twilio API using customer's business profile + standardized CTIA template (reuses `/sms-optin-example` + `/privacy#sms-terms`); hourly cron polls status; approval → customer "You're live" email (Resend); rejection → admin email (7-day resubmit window)
- **Rewritten:** `/api/sms/provision` — buys toll-free on demand, enrolls in Messaging Service, submits TFV (or records `needs_info` if profile missing address/website), provisions Vapi
- **DB:** `customer_phone_numbers` gains `tfv_sid`, `tfv_status`, `tfv_submitted_at`, `tfv_approved_at`, `tfv_rejection_reason` (auto-created columns)
- **Deleted demo code:** `api/customer-sms/{available-numbers,purchase-number,activate,test}`, `api/admin/sms/buy-numbers` (pool), `app/sms-setup` (template relic). Kept `customer-sms/configure-ai` (live SMS dashboard still calls it).
- **Switched remaining number searches** local → toll-free ($2.15/mo)
- **Discovered:** `app/sms-onboarding/page.js` is a FAKE flow (simulated success, no API calls) — linked from live dashboard; rework is the next step
- **Hosted SMS (existing numbers):** decided as core near-term feature ("AI answers the number on your van"); request Hosted Numbers API preview access from Twilio (Console support ticket or hostedsms@twilio.com — include Account SID)

**Next priorities:** Rework sms-onboarding page (real provision call + address collection for TFV) · Request Hosted Numbers API access · Meta App Review · Google re-review

### Session — 2026-06-04 to 2026-06-08
**Plan gating · Twilio A2P · Google OAuth · Vapi audit · Admin fixes**

- **Plan gating audit** — switched from channel-blocking model to shared response pool; all channels (FB, Instagram, Voice, SMS, Email, Chat) now available on all plans; limits are response count + voice minutes only; updated `lib/stripe.js`, `lib/usage.js`, landing page, pricing page
- **Vapi audit** — confirmed using GPT 4o Mini Cluster (gpt-4o-mini, ~390ms model latency, ~900ms total); correct choice, no code changes needed
- **Twilio A2P** — 6th rejection (CTA verification); built `/sms-optin-example` public page; added Section 13 to privacy page with `#sms-terms` anchor and CTIA "affiliates" language; submitted Twilio support ticket 2026-06-08; do NOT resubmit until Twilio responds
- **Google OAuth** — reviewer blocked on "Email Conversations do not sync"; fixed by triggering immediate Gmail sync after OAuth callback (`fetch` to monitor route fire-and-forget); replied to Google Trust & Safety with step-by-step testing instructions + test account credentials
- **Email filter** — softened `Feedback-ID` header check from hard-block to pass-through to AI classifier; prevents false positives on Google Workspace emails
- **Meta** — Bizzy Bot Ai LLC verified as Tech Provider 2026-06-05; App Review still pending test user
- **Admin dashboard** — fixed "column bp.customer_id does not exist" error; `ensureColumns()` now auto-creates/patches `business_profiles` table
- **Commit workflow** — confirmed: commit directly to main, no branches/PRs
- Key new files: `app/sms-optin-example/page.js`

**Next priorities:** Wait for Twilio support response · Wait for Google re-review · Add real FB test user for Meta · Referral tracking

### Session — 2026-06-03
**Vapi Voice AI + Outlook email + Calendar booking + Analytics + Owner Alerts**

- **Vapi Voice AI** — full build: `lib/vapi.js`, provision/webhook/stats APIs, `/voice` dashboard, Voice tab in AI Settings, per-plan minute limits (Starter 15/Pro 100/Biz 400), upgrade prompt, sidebar for all plans
- **Outlook email** — full build: OAuth (Microsoft Graph), monitor (hourly cron), inbox merged with Gmail (Outlook tag), lead tracking with `channel='outlook'`, `outlook_connections`/`outlook_conversations`/`outlook_messages` tables
- **Outlook Calendar booking** — AI checks owner's calendar availability, presents slots, detects `[BOOK:datetime]` marker, creates event + sends invite to lead; `Calendars.ReadWrite` added to Azure app
- **Google Calendar scopes** — added to Gmail OAuth for upcoming brand verification submission
- **Owner hot lead alerts** — `lib/owner-alerts.js` with Resend email, DB-backed toggle per customer (`hot_lead_alerts_enabled` + `alert_email` on customers), 30-min dedup, wired into Gmail/Outlook/SMS/Voice; replaced broken in-memory system
- **Voice analytics** — `getVoiceStats()` in analytics service queries `vapi_call_logs` directly; Voice AI Performance card on analytics page (calls, minutes, avg duration, answer rate)
- **Lead management** — added Outlook + Voice filters and color badges to leads page
- **Twilio A2P** — resubmitted 3rd time with fixed opt-in description + CTA URL pointing to privacy page
- **Microsoft Azure** — app registered (`BizzyBot Ai`), 6 permissions: Mail.Read/ReadWrite/Send, offline_access, User.Read, Calendars.ReadWrite
- Key new files: `lib/vapi.js`, `lib/microsoft-calendar.js`, `lib/owner-alerts.js`, `app/api/vapi/*`, `app/api/outlook/*`, `app/api/auth/outlook/*`, `app/(dashboard)/voice/page.js`, `app/api/customer/notifications/route.js`

**Next priorities:** Test Outlook + Voice once Twilio A2P approved · Referral tracking · Lead detail page · Plan gating audit

---

### Session — 2026-05-31
**Logo + Instagram OAuth fully working + App Review in progress**

- Logo: replaced placeholder icons with real `Bizzybot Logo 2.png` in navbar, footer, sidebar
- Instagram OAuth: full end-to-end working — `bizzybotai.com/instagram-setup → Connect → @bizzybotai connected`
- Fixed 11 issues to get OAuth working (middleware conflicts, scope changes, Business Manager API fallback, schema patch)
- Facebook Developer app fully configured (App ID, domains, redirect URIs, deauth/deletion URLs)
- Meta App Review submitted — Business verification approved 2026-05-31
- Still needed: screen recording (Loom), data handling + reviewer instructions sections, submit
- Key files: `app/api/auth/facebook/route.js`, `app/api/auth/facebook/callback/route.js`, `middleware.js`, `app/api/facebook/deauthorize/route.js`, `app/api/facebook/data-deletion/route.js`, `app/(dashboard)/layout.js`, `app/page.js`

**Next:** Complete Meta App Review submission (screen recording + fill in remaining sections)

---

### Session — 2026-05-30 (continued)
**Meta App Review + Business Verification submitted**

- Facebook App ID `1018657873452513` added to Railway
- Instagram OAuth scopes updated to `instagram_business_basic/manage_messages/manage_comments`
- Webhook configured: `https://bizzybotai.com/api/instagram/webhook`, verify token: `verify_bizzy_bot_ai`
- Meta Business Verification submitted — EIN `39-3108116`, "Bizzy Bot Ai LLC", Chester VA
- App Review permissions: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`
- Privacy/Terms links added to dashboard sidebar footer
- Key files: `app/api/auth/facebook/route.js`, `app/(dashboard)/layout.js`

---

### Session — 2026-05-30
**Twilio A2P resubmission + cron 401 fix + Terms SMS section**

- Cron 401 fix: added `CRON_SECRET` to Railway + added `/api/cron/run` to `publicRoutes` in `middleware.js`
- Twilio A2P campaign resubmitted — rewrote all fields, sample messages, consent/CTA
- Terms of Service: Section 5 "SMS Messaging Terms" added with all CTIA disclosures
- Buy-numbers fix: numbers now enrolled in Messaging Service after purchase (A2P compliance)
- Key files: `middleware.js`, `app/terms/page.js`, `app/api/admin/sms/buy-numbers/route.js`
