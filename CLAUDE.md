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

**Positioning decision (REVISED 2026-07-07):** Broad "local/client-facing businesses" hero — founder explicitly does NOT want to pigeonhole into trades (works for real estate agents, salons, therapists, etc.). Follow the Podium/Rosie pattern: multi-industry headline + an **industries section** with one pain-line per vertical (trades: "never miss a call from a job site" · real estate: "first agent to respond wins the listing" · salons: "bookings answered while your hands are busy" · therapists: "full waiting room, zero phone tag"). Launch channels: **SMS AI + Voice AI + Web Chat + Outlook email**. Facebook/Instagram/Gmail = "coming soon" (pending external approvals — not launch blockers).

**Market context:** Gap between reputation giants (Podium $399+, Birdeye $299+, GHL $97+$97 AI add-on) and voice-only bots (Rosie $49, Goodcall $79, Jobber AI $99). BizzyBot = multi-channel AI at solo-shop prices ($29/$69/$199). Window is ~12-18 months before voice bots add channels. Unit economics: ~70% gross margin on Pro tier.

### Launch Checklist (critical path — in order)

- [x] **1. SMS onboarding page rework** — DONE. Real provision flow, business info + business type + EIN collection, verification-pending states, needs-info/retry handling
- [~] **2. End-to-end SMS test with a real number** — SUBMISSION VERIFIED 2026-07-06: (866) 944-5685 provisioned + toll-free verification submitted to Twilio (confirmed by Twilio email + blue "being activated" screen). Full text-reply test pending carrier approval (3-5 biz days). Fixed en route: profile-save (legacy user_id/clerk_user_id type mismatch, business_profiles NOT-NULL user_id, ON CONFLICT, error-masking), TFV needs SDK-bypass direct API call (SDK 4.23 drops BusinessType), business type + EIN + contact name + state-code normalization
- [x] **3. Vapi voice end-to-end test** — DONE + LIVE-VERIFIED 2026-07-06: called (866) 944-5685, AI answered + held real conversation, call logged with transcript + AI summary + duration + minutes (2/15) on /voice. Fixed en route: fragile customer JOIN in vapi/provision, invalid 11labs voice "rachel" → Vapi-native "Elliot" (VAPI_VOICE_* env), webhook parsing (Vapi nests fields under `message`; was reading top-level → no logs), stats match by customer_id OR clerk_user_id.
  - NOTE: voice AI used placeholder content ("Test Business", test.com) because this test account's ai_channel_settings has stale demo data. Real customers configure their own; update AI Settings → Voice → Save & Sync to refresh the assistant.
- [~] **4. Email end-to-end (Gmail + Outlook)** — Outlook WORKING (2026-07-07): connect → AI reply → unified inbox → lead, verified live. Gmail bugs fixed (duplicate loop + placeholders + secure OAuth) 2026-07-07 — needs re-verify next session (reconnect Gmail, fresh test). See NEXT SESSION TODO.
- [x] **5. Production cleanup + security pass** — DONE 2026-07-06: deleted 20 dev/debug/migration routes+pages (incl. fully-public setup-database and all DB-mutation tools), removed stale public routes, fixed contact-email demo link. DB audit run (admin-gated `/api/admin/db-audit`): NO duplicate customer rows, 0 null clerk_ids, healthy data. Healed 8 legacy rows where user_id != clerk_user_id → 0 mismatched. Customers table fully consistent.
- [x] **5b. Gate number provisioning behind active subscription/trial** — DONE 2026-07-06: `/api/sms/provision` now checks `hasActiveAccess` (Stripe subscription present OR within 14-day trial from created_at) before buying a number; returns 402 needsSubscription otherwise. NOTE: gate treats presence of stripe_subscription_id as active (doesn't verify canceled status via Stripe — tighten later if needed).
- [x] **Subscription route fixed** — DONE 2026-07-06: `/api/customer/subscription` had old price IDs + $99/$299/$799 + "enterprise" (missing "business"), which broke real checkout (upgrade to Business = "Invalid plan"; Starter/Pro checkout used dead price IDs). Now uses correct current price IDs + $29/$69/$199 + starter/professional/business, guarded against legacy plan values.
- [ ] **6. Landing page pass (multi-industry)** — keep broad hero, add industries section (trades/real estate/salons/therapists pain-lines), lead with missed-call/missed-lead pain, replace fabricated claims ("500+ businesses", fake testimonials) with honest founding-customer framing, mention Voice AI in hero (currently omitted)
- [ ] **7. Launch prep** — pick ~10 founding customers (local trades), BIZZYFOUNDER coupon ready, one case study plan

### External (parallel, not blocking)
- [ ] Request Twilio Hosted Numbers API preview access (Console ticket or hostedsms@twilio.com + Account SID) — needed for "keep your existing number" v1.1 feature
- [ ] Meta App Review (in progress) · Google OAuth verification (in progress)

### Post-launch backlog
Calendly webhook (~3-4 hrs) → Dashboard analytics redesign → **Document receiving** (leads send filled forms/photos back — needs file storage e.g. Railway bucket + attachment extraction from Gmail/Outlook/MMS; founder flagged 2026-07-07 as valuable for inspectors/repair trades) → Hosted SMS onboarding path → click-to-call bridge (owner calls leads from business number) → referral tracking → 10DLC local numbers (only if customers demand local or outbound marketing ships) → near-real-time email replies (Gmail/Outlook push notifications instead of hourly cron)

### Security cleanup backlog
- [ ] Add Twilio signature verification to `/api/sms/webhook` (reuse `lib/twilio-verify.js`, validate against `${BASE_URL}/api/sms/webhook`). Lower risk than the voice routes (no outbound alerts fired), so deferred from the 2026-07-07 voice security pass.

---

## ☀️ NEXT SESSION TODO (start here — updated 2026-07-10 late night)

**DEMO WENT WELL — solar company starting a free trial, likely converting.** Their feature ask (manual lead creation) shipped same-day (Add Lead button).

**0. [ ] FRESH-SIGNUP WALKTHROUGH (top priority before solar signs up):** founder creates a junk-email account and walks the exact trial path — sign up → dashboard → SMS onboarding (buys a real number, ~$2) → text it → AI replies. Watch Railway logs during. This is the final onboarding confidence check; everything code-side was audited + fixed 07-10 (see session log: Stripe webhook was broken 3 ways).

**Post-demo cleanup:**
1. [ ] **Revert demo persona when demo phase ends**: customers.business_name 'Sunrise Solar' → 'Bizzy Bot Ai LLC' + re-skin ai_channel_settings (see memory: demo-solar-persona). Keep hot_lead_detection=true.
2. [ ] **DKIM toggle** — security.microsoft.com/authentication?viewid=DKIM → bizzybotai.com → Enable (was blocked on Microsoft-side key sync 07-10; CNAMEs verified live). Until then first-contact emails may hit spam.

**Verification still owed (fast):**
3. [ ] **Voice test from a NON-forwarded phone** (not 858-900-4220): cell rings ~18s → AI answers as Sunrise Solar → missed-call **text** alert now deliverable (TFV approved) + email alert.
4. [ ] **Fresh hot-lead SMS** post-dd2bc5d deploy: high-intent text → bell shows the lead, SMS Hot Lead Alerts card fills, Leads shows hot. Also flip **Hot Lead Alerts toggle ON** (SMS page) to test owner text+email alert.
5. [ ] **Add Lead** live test: manual lead appears at top; adding an existing texter's number merges (no duplicate).
6. [ ] **First-SMS-reply genericness**: first reply to a brand-new texter was generic ("How can I help?") while the second was perfect — trace config load on first contact.

**Gmail (still pre-launch "coming soon", lower priority):**
7. [ ] Reconnect test Gmail (kernojunk) on the secure OAuth flow → fresh test → exactly one reply, real info, no placeholders. Gmail hot-lead path also still uses 'email_received' (never promotes to hot) — mirror the hot_lead fix when touching it.

**Carried forward (unchanged):**
8. [ ] Mobile real-phone check (hamburger/bell/Email split inbox).
9. [ ] Web-chat widget embed on a real external HTML page (persistence schema now fixed 07-10 — retest end-to-end).
10. [ ] Analytics page sanity on prod ("Booked by your AI" + Appointments should now tick — events fixed 07-10).
11. [ ] Launch prep (founding customers, BIZZYFOUNDER coupon) — the solar demo IS the first founding-customer conversation.

**Product gaps / decisions parked:**
- **Unit Economics panel uses conservative estimated rates** (founder-confirmed 2026-07-10: shown margins are likely LOWER than actual). Rates live in `UNIT_RATES` in app/api/admin/usage-costs/route.js — reconcile against real Twilio + Vapi invoices after first months of customer traffic, then tune.
- Settings page lacks Authorized Contact name fields (pre-07-06 customers can't save Business Email — server rejects partial verification info).
- Bell scope decision: add AI-booked appointments + missed calls to notifications? (Recommended; ~15 min; founder undecided.)
- Retroactively adding a late-collected email to an already-created calendar event (deferred from book-first-then-ask-email).
- Nice-to-haves: sidebar plan/usage card · mobile padding polish · "Apply to all channels" for Documents.

---

## Session Log

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
