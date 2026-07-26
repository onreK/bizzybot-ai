# Unanswered Questions Queue — Design

**Date:** 2026-07-26
**Status:** Approved direction (founder approved both design halves in-session); pending final spec review
**Roadmap:** AI Brain item #1 — "self-improving brain"

## Goal

When the AI can't answer a lead's question, that failure is currently invisible: the lead gets a soft non-answer, goes cold, and the exchange logs as a normal successful reply. The same gap then repeats for every future lead, because nothing ever prompted the owner to fill it.

This feature turns those moments into a short, grouped list on the dashboard — *"3 people asked about your service area this week"* — that the owner answers once. The answer is written into every channel's knowledge base, and the leads who never got an answer are surfaced for one-click recovery.

Two outcomes: **the brain grows from real conversations**, and **leads lost to a knowledge gap become recoverable instead of silently cold**.

## Design principle — never break the conversation

This is a reporting feature. It observes replies; it must never be able to degrade or block one. Every failure mode resolves in favor of the lead's message going out normally, even at the cost of losing a queue entry.

This is the opposite trade from intent triage, which deliberately blocks (it decides *whether* to reply at all). Both are correct for what they do.

## Founder decisions (settled in-session 2026-07-26)

| Decision | Choice | Reasoning |
|---|---|---|
| Channel scope | **Text channels first; voice as phase 2** | Every text entry point shares one code path (`generateAIResponse`), so they cost the same to cover. Voice runs on Vapi's servers and needs a different mechanism (post-call transcript scan) |
| Detection sensitivity | **Clear blanks only** | The AI raises its own hand when it knows a fact is missing. Free, near-zero queue noise. Accepts that confident-but-wrong answers stay invisible |
| Write-back target | **All six knowledge bases at once** | Business facts don't vary by channel — tone does. The owner answers each question exactly once, ever. Voice is included even though voice *detection* is phase 2, so the phone AI learns from text questions immediately |
| Lead recovery | **Show who's waiting, owner sends** | Nothing leaves on its own. An answer written for a knowledge base isn't necessarily worded for a customer |
| Placement | **Overview page, under Needs Attention** | Where the owner already lands. Collapses to a one-line all-clear when empty, matching the hot-leads grid |
| Grouping method | **Fixed topic list, AI-assigned** | Groups by what's actually being asked rather than the words used. Free, and a fixed vocabulary prevents the AI naming one thing three ways |

## Detection — the `[UNKNOWN:]` marker

`buildChannelSpecificPrompt` in `lib/ai-service.js` gains one instruction block, alongside the existing escalation and calendar-booking blocks:

> If the lead asks something you genuinely cannot answer from the business information above — a fact you were not given — do not invent an answer. Reply naturally, telling them you'll find out and follow up. Then append `[UNKNOWN:topic|the question in plain words]` at the very end of your message. Use it at most once per message, and never when you were able to answer.

**Topic vocabulary** (fixed, industry-neutral per the no-hardcoded-vertical rule):
`pricing`, `service_area`, `hours`, `scheduling`, `services`, `process`, `warranty`, `payment`, `other`

This reuses the in-band marker mechanism already proven in production by `[ESCALATE]` (`ai-service.js:146`) and `[BOOK:...]` (`ai-service.js:164`).

**Behavioral side effect, accepted deliberately:** today the AI improvises when it hits a blank. Under this rule it is told to promise a follow-up. Replies become slightly more honest and more consistent. This is an improvement, but it is a change to live customer-facing output and should be watched in the first week.

### Stripping — the highest-risk path

A marker reaching a lead's phone is the one failure that damages trust in the product. Three guards, in order:

1. **Strip before formatting.** Extraction and removal happen on the raw model output immediately after the `[ESCALATE]` check (`ai-service.js:145`), *before* `formatResponseForChannel` runs. This matters specifically because the SMS branch truncates at 640 characters (`ai-service.js:763`) — a marker at the end of a long reply could otherwise be chopped mid-token and leak `[UNKNO…`.
2. **Defensive final sweep.** After formatting, remove anything matching `\[UNKNOWN[^\]]*\]?` from the outgoing text. This catches malformed markers the structured pattern wouldn't recognize.
3. **Tests against hostile input** — see Testing below.

## Storage

One new table, following the shape of `email_triage` (`lib/intent-triage-store.js`), created via the same `CREATE TABLE IF NOT EXISTS` auto-migration pattern used elsewhere in the codebase:

```sql
CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER,
  topic TEXT,                          -- from the fixed vocabulary
  question TEXT,                       -- the lead's question, AI-paraphrased
  channel TEXT,                        -- runtime channel: sms | gmail | email | chat | facebook | instagram | voice
  contact_id INTEGER,                  -- nullable: anonymous chat visitors
  contact_email TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  status TEXT DEFAULT 'open',          -- open | answered | dismissed
  answer TEXT,
  answered_at TIMESTAMP,
  followup_sent_at TIMESTAMP,          -- when the owner sent the answer to this lead
  created_at TIMESTAMP DEFAULT NOW()
)
```

`channel` stores the **runtime** channel name passed to `generateAIResponse` (so Gmail and Outlook stay distinguishable in the queue, even though both read the same `email` settings row via `CHANNEL_MAP`). It accepts `voice` from day one so the phase-2 work needs no migration.

### Channel vocabulary — two different lists, don't conflate them

| | Values | Where |
|---|---|---|
| **Runtime channels** (what the queue records and displays) | `sms`, `gmail`, `email` (Outlook), `chat`, `facebook`, `instagram`, `voice` | argument to `generateAIResponse` |
| **Settings channels** (what the answer writes back to) | `text`, `email`, `chatbot`, `facebook`, `instagram`, `voice` | `ai_channel_settings.channel` |

`CHANNEL_MAP` (`ai-service.js:346`) translates the first into the second: `gmail`→`email`, `sms`→`text`, `chat`→`chatbot`. The write-back targets all six **settings** rows.

**Grouping happens at read time** — `GROUP BY topic` over open rows for one customer. No cluster table, no maintenance, no state to drift. At tens of thousands of rows per customer this would need revisiting; at current scale it is instant.

**Recording is non-blocking.** The write happens after the reply is dispatched and is wrapped so a database failure logs a warning and nothing more. The lead still gets their message.

**Same-conversation dedup.** If one contact hits the same topic twice inside a conversation, only the first is recorded — prevents a confused back-and-forth from producing five identical rows.

## Owner experience

New collapsible card on the Overview page, inside the existing Needs Attention region:

```
🧠 Your AI got stumped 3 times this week

  Service area · asked 3×                          [Answer]
    "Do you guys service Chesterfield?"      Mike · SMS · Tue
    "Are you out in Midlothian?"             (unknown) · chat · Wed
    "do you come to powhatan"                Dana · SMS · today

  Warranty · asked 1×                               [Answer]
    "how long is the labor warranty"         Mike · SMS · today
```

Empty state collapses to a single green all-clear line.

**Answer flow:** owner clicks Answer, types the answer, saves. Then:

1. The Q&A pair is appended to the `knowledge_base` field of **all six** `ai_channel_settings` rows for that customer, formatted as:
   ```
   Q: Do you service Chesterfield?
   A: Yes — we cover Chesterfield, Richmond and Henrico counties.
   ```
   Append only; existing knowledge base content is never rewritten or reordered.
2. **The Vapi assistant is re-synced** — see below. Without this the phone AI silently keeps the old brain.
3. All open rows in that topic group are marked `answered`.
4. The leads who asked are listed with a **Send this answer** button per lead. Nothing sends automatically.

### The Vapi re-sync (easy to miss, breaks the feature quietly)

The text channels read `ai_channel_settings` fresh on every message, so a knowledge base append takes effect on the next reply with no further work. **Voice does not.** The Vapi assistant holds its own copy of the system prompt, built by `buildVoiceSystemPrompt` (`lib/vapi.js:26`) and pushed to Vapi only by `/api/vapi/provision` or `/api/admin/sync-vapi`. Writing to the voice row alone changes nothing on live calls until someone manually hits Save & Sync.

So the answer-save must also call `updateAssistant(assistantId, { businessName, systemPrompt: buildVoiceSystemPrompt(settings) })`, exactly as `app/api/admin/sync-vapi/route.js:43` does.

This is **fire-and-forget**: a Vapi outage or a customer with no assistant provisioned must not fail the owner's save. Failure logs a warning; the knowledge base write has already succeeded and the next manual sync will pick it up.

**Dismiss** marks a group `dismissed` and it does not return.

## Scope

**In:**
- Marker instruction in `buildChannelSpecificPrompt` + extraction/stripping in `generateAIResponse`
- `knowledge_gaps` table + store module (`lib/knowledge-gaps.js`), mirroring the `intent-triage-store.js` pattern
- Overview card: grouped queue, answer form, dismiss, per-lead send
- API routes: list, answer (six-way knowledge-base append + Vapi re-sync), dismiss, send-to-lead
- Unit tests on stripping, grouping, and knowledge-base append

**Out (deliberate):**
- **Voice** — phase 2. Needs a post-call transcript scan hooked into the existing pipeline (`lib/voice-document-followup.js`), not the marker mechanism. Table is voice-ready.
- **Send-the-answer on Facebook/Instagram** — v1 covers SMS and email, the two channels verified end-to-end. Social questions still queue and still teach the AI; the owner replies from the page.
- **Anonymous web-chat follow-up** — no contact details exist. They show as *(unknown)* and count toward the tally.
- **Detecting confident-but-wrong answers** — the accepted cost of clear-blanks-only detection. The after-the-fact judge is the documented upgrade path if bluffing proves common.
- **Knowledge base size management** — every saved answer grows a blob that is sent on every message. Fine at current sizes; a known one-way ratchet to watch, not to solve now.
- **A settings toggle to disable the feature** — YAGNI.

## Known limitations

- **Bluffing is invisible.** Only self-declared gaps are caught.
- **Marker echo.** A lead who types `[UNKNOWN:pricing|x]` at the AI could get it echoed back and produce a junk row. Harm is limited to queue noise — the marker is only ever read from model output and can only create a row. Dismiss handles it.
- **Knowledge base grows one way.** No pruning, no size cap in v1.

## Success criteria

1. **Zero marker leaks.** No `[UNKNOWN` fragment reaches any outbound message across a week of live traffic — verified by tests pre-ship and by watching real SMS/email output after.
2. **The loop closes.** Founder texts the toll-free a question the knowledge base doesn't cover → reply reads clean → the question appears in the Overview queue → after answering, the same question asked again gets a real answer.
3. **The queue is trustworthy.** Over the first two weeks of real traffic, entries are overwhelmingly genuine gaps rather than noise. If the dismiss rate is high, the prompt needs tightening before the feature is worth keeping.

## Testing

Automated (`npm test`, node:test — 31 tests today):
- **Stripping against hostile input:** unclosed markers, doubled markers, markers mid-sentence, missing topic, marker-like text from the lead, a marker on a reply long enough to trigger SMS truncation. Asserts nothing resembling `[UNKNOWN` survives.
- **Extraction:** valid marker yields the right topic and question; unknown topic falls back to `other`.
- **Grouping:** open rows group by topic with correct counts; answered and dismissed rows are excluded.
- **Knowledge base append:** existing content preserved, Q&A appended, all six settings rows updated, one customer's rows never touch another's.
- **Vapi re-sync is fire-and-forget:** a failing `updateAssistant` still leaves the save successful and the knowledge base written.

Manual, by the founder, before it counts as done:
- Text the toll-free something the knowledge base doesn't cover ("do you guys work weekends?")
- Confirm the reply reads clean — no bracket junk
- Confirm the question appears in the Overview queue
- Answer it, confirm the Send button reaches the test phone
- Ask again, confirm a real answer comes back
