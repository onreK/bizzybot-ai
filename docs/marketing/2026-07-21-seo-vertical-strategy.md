# SEO / Vertical Landing Strategy — Research & Decisions (2026-07-21)

Deep-research pass on market demand, positioning, and AI-search (GEO) ranking,
plus the first batch of SEO landing pages built off it.

## Market demand by vertical (researched, ranked)

**Priority order: Trades #1 → Salons #2 → Real Estate #3.**

### 🥇 Trades (HVAC / plumbing / contractors) — strongest demand
- Avg HVAC business loses ~**$45,600/yr** to missed calls; plumbers up to **$125,000** (SkipCalls).
- **74% of contractor calls go unanswered**; **85%** chance a missed caller rings a competitor next (LeadTruffle / SkipCalls).
- Techs physically can't answer (on job sites). High ticket value = obvious ROI (one job pays for a year).
- Already an established $49–199/mo buying category. Every competitor (Rosie, Goodcall, Jobber, Numa) targets this — confirms demand.

### 🥈 Salons & spas — strong but more friction
- **46–50%** of bookings happen after hours; **35–40%** of peak calls missed; ~**$126k/yr** lost to unanswered calls; single missed color appt = $150–300 (CloudTalk).
- "Fastest-growing AI category for salons." BUT lower ticket, price-sensitive, and many already run Vagaro/Boulevard/Fresha/Booksy (partial DIY). Expect booking-software integration demands.

### 🥉 Real estate — huge ROI story, hardest keyword space
- **78%** of buyers work with the first responder; 5-min response = **21×** conversion; 60 sec = **+391%**; avg agent takes **917 min (15 hrs)** to respond (AgentZap). **89%** prefer text.
- ~$12k avg commission = overwhelming ROI. BUT saturated martech (Follow Up Boss, kvCORE, Ylopo), fickle individual buyers, brutal keyword competition.

## Positioning decision (founder-approved 2026-07-21)

**Frame: multi-channel + price.** One line: *"Every channel Podium answers, one-tenth the price — built for the solo operator, not a franchise."*

Three pillars:
1. **Multi-channel** — phone + text + email + web chat + social from one place (beats voice-only bots: Rosie, Goodcall, Dialzara, AIRA, Trillet, which are mostly phone-only).
2. **Price + no feature gating** — $29–199/mo, full platform on every tier (beats Podium $399+/$99 AI add-on ≈ $500–800 all-in; Birdeye $299+; GHL $97–497).
3. **Simple for a one-person shop** (beats enterprise/multi-location tools).

**"Alternative to" targeting:** build **Podium-alternative** (right audience, price pitch lands) and voice-bot-alternative angles. **Do NOT lead with "GoHighLevel alternative"** — high volume but attracts agencies/marketers wanting white-label CRM (wrong buyer); BizzyBot isn't a GHL replacement (no funnels/white-label/full CRM). Unqualified bounce traffic hurts more than it helps.

## Competitor pricing snapshot (July 2026, public sources)

| Tool | Start | Notes |
|---|---|---|
| AIRA / Upfirst | $24.95/mo | voice, entry-level |
| Dialzara | $29/mo | voice ~60 min |
| **BizzyBot** | **$29–199/mo** | **all channels, AI included** |
| Rosie | $49/mo | voice ~250 min, home-services |
| Trillet | $49/mo | voice + SMS + WhatsApp |
| Goodcall | $59–208/mo | voice, per-customer billing |
| Smith.ai | $95–300/mo | hybrid AI + human |
| Jobber AI / My AI Front Desk | $99/mo | voice |
| Birdeye | $299+/mo | multi-channel + reviews, AI included |
| Podium | $399/mo + $99 AI add-on | multi-channel, multi-location |

## Ranking WITH AI (GEO / AEO) — the big lever

**Key mechanic:** AI assistants recommend brands that appear in **third-party sources they trust** — G2, Capterra, Trustpilot, Reddit, and especially "Best AI receptionist for X 2026" listicles (which ARE the training/retrieval data). Your own site alone isn't enough.

**On-page GEO (what we built into every page):**
- 40–60 word direct answer at the very top (+115% citation likelihood).
- Stats WITH cited sources (+30–40% AI visibility).
- FAQ mirrored into FAQPage schema; Article/SoftwareApplication/BreadcrumbList schema.
- Answer-ready format + semantic URLs (`/ai-receptionist-for-contractors`).
- AI crawlers (GPTBot, ClaudeBot, PerplexityBot) allowed in robots.

**Off-page GEO (founder to-do — the other ~50%, highest leverage non-code task):**
- List on G2, Capterra, Trustpilot, Product Hunt, GetApp.
- Get 2–3 Reddit / community mentions.
- Email authors of "best AI receptionist" listicles to be added.
- Get JPH (customer) to link to bizzybotai.com + leave a Google review.

Sources: SkipCalls, LeadTruffle, CloudTalk, AgentZap, Replifast, NextPhone, Vellum, Enrich Labs (GEO), Foglift/UltraScout (how AI picks brands).

## What was built (2026-07-21)

- `components/marketing/MarketingChrome.js` — shared nav/footer/CTA/JsonLd (server components).
- `components/marketing/VerticalLanding.js` — data-driven GEO-structured template.
- `app/ai-receptionist-for-contractors/page.js` (flagship), `/ai-receptionist-for-salons`, `/ai-receptionist-for-real-estate` — industry pages, each own metadata + FAQ schema.
- `app/podium-alternative/page.js` — comparison page + table + FAQ schema.
- `app/blog/ai-receptionist-cost/page.js` — buyer-intent pricing guide + Article/FAQ schema.
- `app/sitemap.js` + `middleware.js` publicRoutes updated for all new pages.

## Next (not done)
- Off-page GEO list above (founder).
- Re-check `site:bizzybotai.com` indexing weekly (site was only unblocked 2026-07-20).
- More verticals (med spas, clinics, auto) + more comparison pages (Rosie/Goodcall alternative) as batch 2.
- Optional: turn homepage industries into links to these pages.
