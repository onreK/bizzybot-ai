# Email Intent Triage — Design

**Date:** 2026-07-19
**Status:** Approved direction (founder: "as good as possible"); pending final spec review

## Goal

Every inbound email is classified **before** the AI is allowed to reply. The AI only ever auto-replies to genuine leads and existing-lead conversations; everything else is visibly flagged for the owner instead of guessed at. This unblocks reconnecting Outlook (disconnected since 2026-07-11) and ends the class of failure where the AI pitched services to Microsoft Support and scored the support engineer as an $18,000 hot lead.

## Design principle — asymmetric caution

The two error types are not equal: wrongly auto-replying to business correspondence is a reputation wound; wrongly flagging a real lead costs hours of delay and remains visible. **All uncertainty routes to flag-first.** An automatic reply requires a high-confidence lead classification; nothing else earns one.

## Classes and behavior

| Class | Behavior |
|---|---|
| `new_lead` (high confidence) | AI replies normally; lead pipeline as today |
| `existing_lead_reply` (high confidence) | AI replies with conversation context |
| `business_correspondence` (vendors, support threads, partners, legal, recruiting) | **Never auto-reply.** Inbox shows a "Left for you" flag |
| `automated` (newsletters, receipts, notifications) | Filtered; existing automated-sender detection stays as the pre-filter in front of the classifier |
| `ambiguous` | **One conservative, content-free reply** ("Thanks for reaching out — happy to help! Could you share a bit about what you're looking for?") **plus the "Left for you" flag** (founder decision 2026-07-19: keep speed-to-lead; the conservative reply is harmless even when misdirected). Never a second automatic reply on the same thread while flagged |

## The five quality layers ("as good as possible")

1. **Rich signals.** The classifier prompt includes: subject + body; sender address and domain traits (freemail vs corporate, role addresses like support@/billing@/noreply@); whether the message replies to a thread the AI started (In-Reply-To/conversation state); whether the sender is an existing contact and their history; and the customer's business profile so "lead" is defined per-business (a homeowner asking a solar installer for quotes = lead; a panel manufacturer offering wholesale = business correspondence).
2. **Confidence gating.** Classifier returns strict JSON: `{ class, confidence: high|medium|low, reason }`. Only high-confidence lead classes auto-reply; medium/low → ambiguous handling.
3. **Two-tier models.** gpt-4o-mini classifies everything; medium/low-confidence results get one second opinion from gpt-4o before final routing. Cost is negligible at current volume.
4. **Correction feedback loop.** The inbox "Left for you" flag offers one-click re-classification ("This was a lead" / "Not a lead"). Corrections are stored per customer and injected into that customer's future classification prompts as few-shot examples. Month-three accuracy beats day-one accuracy.
5. **Labeled eval set before go-live.** 20–30 real emails (the Microsoft Support email, genuine inquiries, vendor mail, newsletters, terse ambiguous notes) labeled by hand; an eval script reports per-class accuracy. The classifier does not gate real traffic until it clears the set, and every future prompt change reruns the same script. Quality is a number, not a feeling.

## Hot-lead scoring de-fang (same build)

`HOT_LEAD_KEYWORDS` in `lib/ai-service.js` currently gives 25 points each to everyday words ("help", "issue", "contact", "problem", "call") and `basicScore = max(keywords, GPT)` lets keywords alone clear the ≥60 hot threshold — how a support engineer became an $18k hot lead. Change: remove the everyday words from the list; the GPT scorer leads and keywords may only **nudge** (cap keyword contribution below the hot threshold on their own). Applies to all channels, not just email.

## Scope

- **In:** the classification step for Gmail + Outlook inbound processing (shared path where possible); inbox UI flag + one-click correction; conservative-reply template; corrections storage + prompt injection; eval script + labeled set; keyword de-fang.
- **Out (deliberate):** classifying SMS/chat/social inbound (consumer-initiated channels, different risk profile); vector search / RAG; auto-replying to business correspondence with "we'll pass this along" (silence + flag is safer); reconnecting Outlook itself (founder does that after the eval set passes).

## Success criteria

1. Eval set: ≥95% on business_correspondence (the dangerous class — misses here are the reputation risk), with zero business_correspondence emails classified as high-confidence leads; ≥90% overall.
2. The Microsoft Support email, replayed, lands as business_correspondence / never auto-replied.
3. Outlook reconnected with the triage live; one week of real traffic produces zero wrong-target auto-replies.
4. Hot-lead list no longer promotes anyone from keyword noise alone.
