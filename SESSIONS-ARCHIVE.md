# BizzyBot AI — Session Archive

> This file contains all session logs older than the last 2 sessions.
> It is NOT auto-loaded into Claude Code context — read it by saying "check the session archive".
> Never delete this file — it is the full history of everything built on BizzyBot.

---

### Session — 2026-05-29 (continued x7)
**Twilio A2P registration guide + privacy policy CTIA fix**

- Added Section 4.0 "SMS / Mobile Data" to `app/privacy/page.js` with CTIA-required statement
- Documented full Twilio A2P Brand + Campaign registration fields for owner to submit manually
- After brand + campaign approved: run `POST /api/admin/sms/buy-numbers` with `{ quantity: 20 }`
- Key files: `app/privacy/page.js`

---

### Session — 2026-05-29 (continued x6)
**Facebook & Instagram OAuth — one-click connect**

- Built `app/api/auth/facebook/route.js` — initiates OAuth for Facebook + Instagram
- Built `app/api/auth/facebook/callback/route.js` — handles redirect, HMAC state verification, saves tokens
- Updated `facebook-setup` + `instagram-setup` pages with OAuth buttons
- Security: state is HMAC-signed with `FACEBOOK_APP_SECRET`, Clerk session verified in callback
- Key files: `app/api/auth/facebook/route.js`, `app/api/auth/facebook/callback/route.js`, `app/(dashboard)/facebook-setup/page.js`, `app/(dashboard)/instagram-setup/page.js`, `middleware.js`

---

### Session — 2026-05-29 (continued x5)
**Email setup page rebuild**

- Full rewrite of `app/(dashboard)/email/setup/page.js` — dark theme, Gmail-only, 437 → 132 lines
- Removed redundant Business Name field, alert() popups, Custom Domain option
- Design rule: setup pages only handle the connection, never AI config
- Key files: `app/(dashboard)/email/setup/page.js`

---

### Session — 2026-05-29 (continued x4)
**Facebook, Instagram setup pages rebuilt + AI Settings placeholder**

- Facebook setup: 4-step wizard → clean 2-step flow (450 → 160 lines)
- Instagram setup: 3 steps → clean 2-step flow (340 → 170 lines)
- AI Settings custom instructions placeholder updated with real business examples
- Key files: `app/(dashboard)/facebook-setup/page.js`, `app/(dashboard)/instagram-setup/page.js`, `app/(dashboard)/ai-settings/page.js`

---

### Session — 2026-05-29 (continued x3)
**End-to-end signup flow testing + fixes**

- Fixed Clerk app name showing "Multi-Tenant Chatbot Platform" → renamed to "BizzyBot AI"
- Fixed onboarding skip — `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` changed to `/onboarding`
- Added `onboarding_completed` column to `customers` table
- Fixed "AI Disconnected" badge → now shows "AI Ready" for new users
- Added 14-day free trial to Stripe checkout (`trial_period_days: 14`)
- Full end-to-end flow tested and verified ✅
- Key files: `app/api/stripe/create-checkout-session/route.js`, `app/api/onboarding/complete/route.js`, `app/api/onboarding/status/route.js`, `app/(dashboard)/dashboard/page.js`

---

### Session — 2026-05-29 (continued x2)
**SMS number pool provisioning — GoHighLevel-style instant number assignment**

- Built `app/api/sms/provision/route.js` — assigns number from pool to customer instantly
- Built `app/api/admin/sms/buy-numbers/route.js` — admin endpoint to bulk-buy numbers
- Updated `app/api/sms/webhook/route.js` — DB routing + SMS sending enabled
- Added `customer_phone_numbers` DB table
- Architecture: BizzyBot owns one A2P campaign, pre-buys pool, customers get number on signup
- Key files: `app/api/sms/provision/route.js`, `app/api/admin/sms/buy-numbers/route.js`, `app/api/sms/webhook/route.js`

---

### Session — 2026-05-29 (continued)
**Stripe setup + platform rename to BizzyBot AI**

- Created Stripe products + prices: $29/$69/$199/mo via Stripe MCP
- Created `BIZZYFOUNDER` (50% off 12mo) + `BIZZYFRIEND` (20% off 3mo) coupons
- Updated `lib/stripe.js` with real price IDs
- GitHub repo renamed to `bizzybot-ai`, remote URL updated
- Key files: `lib/stripe.js`

---

### Session — 2026-05-29
**Railway cron job — Gmail automation runs without dashboard open**

- Built `app/api/cron/run/route.js` — runs every hour, polls Gmail for all connected customers
- Protected by `CRON_SECRET` env var
- Added `CRON_SECRET=bizzybot-cron-all-channels` to Railway
- Created `bizzybot-cron` service on Railway with schedule `0 * * * *`
- Key files: `app/api/cron/run/route.js`

---

### Session — 2026-05-24 (continued x2)
**Admin command center — trial tracking, churn, CSV export**

- Stripe webhook now writes all billing events to `customers` DB table
- Admin customers API returns: trial_days_left, MRR, churn status, channel connections
- Admin dashboard rebuilt: 7-stat KPI row, 5 tabs, search, trial countdown, CSV export
- Key files: `app/api/stripe/webhook/route.js`, `app/api/admin/customers/route.js`, `app/admin/dashboard/page.js`

---

### Session — 2026-05-24 (continued)
**Landing page full rebuild**

- Complete rewrite of `app/page.js` — Linear/Vercel/Stripe inspired design
- Background: `#070B14` with dot-grid + violet glow
- Headline: "Every lead answered. While you sleep."
- Added DashboardPreview component, social proof strip, How it works, testimonials, pricing
- Key files: `app/page.js`

---

### Session — 2026-05-24
**Document link sending**

- Added Document/Form section to AI Settings (all channels)
- AI includes link naturally when lead is qualified — not in every message
- New DB columns: `document_link`, `document_description` on `ai_channel_settings`
- Key files: `app/(dashboard)/ai-settings/page.js`, `app/api/ai-settings/route.js`, `lib/ai-service.js`

---

### Session — 2026-05-23 (continued)
**AI Brain — conversation history, follow-ups, escalation**

- Gmail AI now loads full thread history before replying (capped at 20 messages)
- Automated follow-ups: re-engages silent leads after configurable delay (2/3/5/7 days)
- Escalation handling: keyword + AI-detected [ESCALATE] marker, sends owner's custom handoff message
- New DB columns on `ai_channel_settings`: followup_enabled/delay/max, escalation_enabled/triggers/message
- Key files: `app/api/gmail/monitor/route.js`, `lib/ai-service.js`, `app/api/ai-settings/route.js`, `app/(dashboard)/ai-settings/page.js`

---

### Session — 2026-05-23
**Lead scoring, email filtering, leads page UX**

- Automated sender zero-scoring in `lib/leads-service.js`
- Email filtering: added `AUTOMATED_SUBDOMAINS` check
- Leads page: date filter, sort direction toggle, channel filter, "Date Added" column
- Key files: `lib/leads-service.js`, `lib/email-filtering.js`, `app/api/gmail/monitor/route.js`, `app/(dashboard)/leads/page.js`

---

### Session — 2026-05-21 (continued)
**Web Chat dashboard + embed instructions**

- Created `/web-chat` page — embed code snippet, 5-step install guide, platform quick guides
- Fixed `/demo` page — pulls real business name, removed hardcoded real estate content
- Key files: `app/(dashboard)/web-chat/page.js`, `app/(dashboard)/demo/page.js`

---

### Session — 2026-05-21
**Dashboard overhaul & AI Settings**

- Created `/ai-settings` page — 5-tab UI extracted from dashboard
- Fixed input focus-loss bug in AI Settings (SharedFields moved to module scope)
- Dashboard: 5-channel performance cards, Setup Checklist, Today at a Glance, AI Automation Rate, pipeline funnel, Hot Leads Trend chart, Recent Activity feed
- Notification bell with unread count, hot lead feed, mark-all-read
- Built `app/api/notifications/route.js`
- Key files: `app/(dashboard)/ai-settings/page.js`, `app/(dashboard)/dashboard/page.js`, `app/api/notifications/route.js`, `app/(dashboard)/layout.js`

---

### Session — 2026-05-17
**Initial setup**

- Set up Claude Code on Windows, installed Node.js + GitHub CLI
- Connected GitHub repo locally
- Configured GitHub MCP server
- Created CLAUDE.md
