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
- **Twilio A2P campaign** — resubmitted 2026-06-03 (3rd attempt, updated opt-in/CTA fields), approval 10-15 business days
  - After approval: run `POST /api/admin/sms/buy-numbers` with `{ "quantity": 20 }`
- **Meta App Review** — submitted 2026-05-31, still needs test user (Meta removed test accounts)
  - Fix: add a real Facebook account as Tester in Meta App dashboard → use it to demo the app
  - Permissions: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`
- **Google OAuth brand verification** — brand approval pending; after approval, submit Gmail + Calendar scopes
  - Calendar scopes already added to code (`auth/calendar`, `auth/calendar.events`) — ready to submit
  - CASA audit may be required after brand approval (~$150-$500)
  - Once approved: Gmail customers will also get calendar booking (Outlook calendar booking is live now)

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

## Session Log

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
