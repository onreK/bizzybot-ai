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

| Feature | Starter | Professional | Business |
|---|---|---|---|
| Email AI | ✅ | ✅ | ✅ |
| SMS AI | ✅ | ✅ | ✅ |
| Web Chat | ✅ | ✅ | ✅ |
| Scheduling | ✅ | ✅ | ✅ |
| Lead tracking & export | ✅ | ✅ | ✅ |
| Facebook Messenger AI | ❌ | ✅ | ✅ |
| Instagram DM AI | ❌ | ✅ | ✅ |
| Full analytics | ❌ | ✅ | ✅ |
| AI Voice calls | ✅ (15 min/mo) | ✅ (100 min/mo) | ✅ (400 min/mo) |
| AI responses/mo | 300 | 1,500 | 5,000 |
| User seats | 1 | 2 | 5 |

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

---

## Infrastructure

- **GitHub:** `https://github.com/onreK/bizzybot-ai`
- **Local path:** `C:\Users\Kerno\New-Real-estate-Agent`
- **Live site:** `https://bizzybotai.com`
- **Railway project:** `patient-miracle` (rename to bizzybot-ai in Railway dashboard)
- **Cron service:** `bizzybot-cron` — runs `0 * * * *`, calls `/api/cron/run`
- **Twilio Messaging Service SID:** `MG7d1d710aa54c4ebab29ae4127f233a0b`
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

**Positioning decision:** Market trades/home-services-first ("never miss a call again"), multi-industry under the hood. Launch channels: **SMS AI + Voice AI + Web Chat + Outlook email**. Facebook/Instagram/Gmail = "coming soon" (pending external approvals — not launch blockers).

**Market context:** Gap between reputation giants (Podium $399+, Birdeye $299+, GHL $97+$97 AI add-on) and voice-only bots (Rosie $49, Goodcall $79, Jobber AI $99). BizzyBot = multi-channel AI at solo-shop prices ($29/$69/$199). Window is ~12-18 months before voice bots add channels. Unit economics: ~70% gross margin on Pro tier.

### Launch Checklist (critical path — in order)

- [ ] **1. SMS onboarding page rework** — replace fake demo flow with real `/api/sms/provision` call + collect business address (required for toll-free verification); show verification-pending state
- [ ] **2. End-to-end SMS test with a real number** — signup → toll-free purchase → TFV submission → approval (3-5 biz days) → text the number → AI replies → lead logged. TFV pipeline has never run live
- [ ] **3. Vapi voice end-to-end test** — same number: call it, AI answers, transcript + minutes logged (test list in "Built but Untested" section)
- [ ] **4. Outlook email end-to-end test** — or disable for launch if broken
- [ ] **5. Production cleanup + security pass** — remove/protect debug & test routes (`test-fixes`, `debug-issues`, `amanda`, `test-ai`, `test-db-update`, `inspect-database`, `inspect-messages`, `fix-*`, `cleanup-database-issues`, `setup-database` etc.); verify no unauthenticated admin/debug endpoints
- [ ] **6. Trades-first landing page pass** — lead with missed-call pain ($1,200/missed call, 85% of voicemail callers never call back), trades language, keep multi-industry capability
- [ ] **7. Launch prep** — pick ~10 founding customers (local trades), BIZZYFOUNDER coupon ready, one case study plan

### External (parallel, not blocking)
- [ ] Request Twilio Hosted Numbers API preview access (Console ticket or hostedsms@twilio.com + Account SID) — needed for "keep your existing number" v1.1 feature
- [ ] Meta App Review (in progress) · Google OAuth verification (in progress)

### Post-launch backlog
Calendly webhook (~3-4 hrs) → Dashboard analytics redesign → Hosted SMS onboarding path → click-to-call bridge (owner calls leads from business number) → referral tracking → 10DLC local numbers (only if customers demand local or outbound marketing ships)

---

## Session Log

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
