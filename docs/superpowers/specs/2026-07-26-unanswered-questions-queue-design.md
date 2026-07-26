# Unanswered Questions Queue — Design

**Date:** 2026-07-26
**Status:** Approved direction (founder approved both design halves in-session; voice folded into v1 on second pass); pending final spec review
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
| Channel scope | **All seven, voice included** | Text entry points share one code path (`generateAIResponse`) and cost the same to cover. Voice needs its own mechanism but was folded in rather than deferred — the queue, UI, write-back and tests are shared, so it is far cheaper inside this build than as a later session |
| Detection sensitivity | **Text: clear blanks only. Voice: transcript scan** | On text, a self-declared marker is free; an after-the-fact judge would double per-message cost across thousands of messages. On voice the volumes are capped (15/100/400 min per plan) so one scan per call is negligible — and it catches confident bluffing that the marker cannot |
| Write-back target | **All six knowledge bases at once** | Business facts don't vary by channel — tone does. The owner answers each question exactly once, ever — a gap found on SMS is closed on the phone too |
| Lead recovery | **Show who's waiting; owner chooses text, email, or handled-it-myself** | Nothing leaves on its own. An answer written for a knowledge base isn't necessarily worded for a customer. "Handled it myself" matters as much as the send buttons — without it, leads the owner phoned personally sit in the queue forever and the queue stops being trustworthy |
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

## Detection — voice (transcript scan)

Voice cannot use the marker. The conversation runs entirely on Vapi's servers; BizzyBot's code first sees it in the `end-of-call-report` webhook (`app/api/vapi/webhook/route.js:38`), which delivers the full transcript and an AI summary. So voice gets an after-the-fact scan instead — and, because it sees the whole conversation, it catches the AI answering confidently *and wrongly*, which the text-side marker structurally cannot.

**Mid-call behavior.** `buildVoiceSystemPrompt` (`lib/vapi.js:26`) gains a knowledge-gap instruction alongside the existing document rules:

> If the caller asks something you cannot answer from the business knowledge above, never guess. Tell them honestly you want to get them the right answer rather than guess, then ask for their name and confirm the number they're on is the best one to text back. Keep it to one short question.

Caller ID is already captured (`webhook/route.js:46`) and stored as `vapi_call_logs.caller_phone`, so the call only confirms the number — it never asks the caller to recite it. **Email is deliberately not collected over voice**: Documents Phase A established that email-over-phone needs letter-by-letter readback, phantom-dot handling and a give-up rule, and SMS to a number already in hand is both more reliable and more natural for someone who just phoned.

**Post-call scan.** A new step in the existing post-call pipeline, beside `processVoiceDocumentFollowup` (`lib/voice-document-followup.js:11`, same input shape). One `gpt-4o-mini` call reads the transcript and returns strict JSON — zero or more gaps, each with a topic from the shared vocabulary and the caller's question in plain words — plus the caller's name if they gave one.

**The scan runs on every completed call, unconditionally.** It is *not* gated on the AI having collected a name. A caller who gets a fumbled answer and hangs up is exactly the invisible failure this feature exists to catch; collecting a name makes an entry better, never determines whether it exists.

**Cost.** One small call per phone call, against plan caps of 15/100/400 voice minutes a month. Negligible — and the reason the thorough detector is affordable here when it was not on text.

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
  followup_at TIMESTAMP,               -- when this lead was followed up
  followup_method TEXT,                -- sms | email | manual (owner handled it)
  vapi_call_id TEXT,                   -- voice rows: links back to the call log
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

**Same-conversation dedup.** If one contact hits the same topic twice inside a conversation, only the first is recorded — prevents a confused back-and-forth from producing five identical rows. On voice the same guard applies per call: one row per topic per call, however many times it came up.

**Voice re-delivery guard.** The Vapi webhook can fire more than once for a call. Rows carry `vapi_call_id` and the scan skips any call already scanned, so a repeated webhook cannot duplicate entries or re-spend on the scan — the same idempotency approach `runTriage` uses for email.

## Owner experience

New collapsible card on the Overview page, inside the existing Needs Attention region:

```
🧠 Your AI got stumped 3 times this week

  Service area · asked 3×                          [Answer]
    "Do you guys service Chesterfield?"      Mike · SMS · Tue
    "Are you out in Midlothian?"             (unknown) · chat · Wed
    "do you come to powhatan"                Dana · call · today

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
4. The leads who asked are listed, each with three actions. **Nothing sends automatically.**

### Per-lead actions (identical on every channel)

| Action | Behavior | Shown when |
|---|---|---|
| **Text the answer** | SMS from the customer's toll-free to the contact's number | A phone number is on file |
| **Email the answer** | Sent via the customer's connected mailbox | An email address is on file |
| **I handled it myself** | Records `followup_method = 'manual'`, sends nothing | Always |

Deliberately uniform across channels rather than special-cased for voice: a lead who texted may equally well have been phoned back, and one behavior is one thing to build and one thing to learn. Most voice callers will have no email on file, so that button simply won't render for them.

"I handled it myself" is not cosmetic. Without it, every lead the owner phones personally stays in the queue looking unresolved, the queue accumulates already-done work, and it stops being believable — the failure mode that kills this kind of feature.

### The Vapi re-sync (easy to miss, breaks the feature quietly)

The text channels read `ai_channel_settings` fresh on every message, so a knowledge base append takes effect on the next reply with no further work. **Voice does not.** The Vapi assistant holds its own copy of the system prompt, built by `buildVoiceSystemPrompt` (`lib/vapi.js:26`) and pushed to Vapi only by `/api/vapi/provision` or `/api/admin/sync-vapi`. Writing to the voice row alone changes nothing on live calls until someone manually hits Save & Sync.

So the answer-save must also call `updateAssistant(assistantId, { businessName, systemPrompt: buildVoiceSystemPrompt(settings) })`, exactly as `app/api/admin/sync-vapi/route.js:43` does.

This is **fire-and-forget**: a Vapi outage or a customer with no assistant provisioned must not fail the owner's save. Failure logs a warning; the knowledge base write has already succeeded and the next manual sync will pick it up.

**Dismiss** marks a group `dismissed` and it does not return.

## Scope

**In:**
- Marker instruction in `buildChannelSpecificPrompt` + extraction/stripping in `generateAIResponse`
- Knowledge-gap instruction in `buildVoiceSystemPrompt` + post-call transcript scan in the Vapi pipeline
- `knowledge_gaps` table + store module (`lib/knowledge-gaps.js`), mirroring the `intent-triage-store.js` pattern
- Overview card: grouped queue, answer form, dismiss, three per-lead actions
- API routes: list, answer (six-way knowledge-base append + Vapi re-sync), dismiss, follow-up (sms | email | manual)
- Unit tests on stripping, transcript-scan parsing, grouping, and knowledge-base append

**Out (deliberate):**
- **Collecting email over voice** — SMS to a number already in hand is more reliable and more natural. Email follow-up still works for voice callers who have an address on file from a previous interaction.
- **Send-the-answer on Facebook/Instagram** — SMS and email are the verified send paths. Social questions still queue, still teach the AI, and can be marked handled; the owner replies from the page.
- **Anonymous web-chat follow-up** — no contact details exist. They show as *(unknown)* and count toward the tally.
- **Detecting confident-but-wrong answers on text** — the accepted cost of clear-blanks-only detection there. Voice gets this via the transcript scan; extending an after-the-fact judge to text is the documented upgrade path if bluffing proves common.
- **Knowledge base size management** — every saved answer grows a blob that is sent on every message. Fine at current sizes; a known one-way ratchet to watch, not to solve now.
- **A settings toggle to disable the feature** — YAGNI.

## Known limitations

- **Bluffing is invisible on text.** Only self-declared gaps are caught there. Voice sees the whole transcript and does catch it — an asymmetry worth remembering when reading the queue: voice entries will be more complete than text entries.
- **The voice AI asks one extra question when stumped.** Slightly longer calls in exactly the moments the AI is already underperforming. Judged worth it for a named, reachable lead; watch it in the first week of real calls.
- **Marker echo.** A lead who types `[UNKNOWN:pricing|x]` at the AI could get it echoed back and produce a junk row. Harm is limited to queue noise — the marker is only ever read from model output and can only create a row. Dismiss handles it.
- **Knowledge base grows one way.** No pruning, no size cap in v1.

## Success criteria

1. **Zero marker leaks.** No `[UNKNOWN` fragment reaches any outbound message across a week of live traffic — verified by tests pre-ship and by watching real SMS/email output after.
2. **The loop closes on text.** Founder texts the toll-free a question the knowledge base doesn't cover → reply reads clean → the question appears in the Overview queue → after answering, the same question asked again gets a real answer.
3. **The loop closes on voice.** Founder calls from a phone that is *not* the forwarding cell, asks something uncovered → the AI declines to guess and asks for a name → the question appears in the queue with that name attached → answering it and re-calling gets a real spoken answer (which also proves the Vapi re-sync fired).
4. **The queue is trustworthy.** Over the first two weeks of real traffic, entries are overwhelmingly genuine gaps rather than noise. If the dismiss rate is high, the prompt needs tightening before the feature is worth keeping.

## Testing

Automated (`npm test`, node:test — 31 tests today):
- **Stripping against hostile input:** unclosed markers, doubled markers, markers mid-sentence, missing topic, marker-like text from the lead, a marker on a reply long enough to trigger SMS truncation. Asserts nothing resembling `[UNKNOWN` survives.
- **Extraction:** valid marker yields the right topic and question; unknown topic falls back to `other`.
- **Grouping:** open rows group by topic with correct counts; answered and dismissed rows are excluded.
- **Knowledge base append:** existing content preserved, Q&A appended, all six settings rows updated, one customer's rows never touch another's.
- **Vapi re-sync is fire-and-forget:** a failing `updateAssistant` still leaves the save successful and the knowledge base written.
- **Transcript scan parsing:** a transcript with two distinct gaps yields two rows; a clean transcript yields none; malformed model JSON yields none rather than throwing; a repeated webhook for an already-scanned `vapi_call_id` is a no-op.

Manual, by the founder, before it counts as done:

*Text:*
- Text the toll-free something the knowledge base doesn't cover ("do you guys work weekends?")
- Confirm the reply reads clean — no bracket junk
- Confirm the question appears in the Overview queue
- Answer it, confirm **Text the answer** reaches the test phone
- Ask again, confirm a real answer comes back

*Voice:*
- Call from a phone that is **not** the forwarding cell (calling from the forwarded number reaches carrier voicemail and its PIN prompt — a recurring false alarm in this project, see CLAUDE.md)
- Ask something the knowledge base doesn't cover; confirm the AI declines to guess and asks for a name rather than inventing an answer
- Hang up; confirm the question appears in the queue with the name and caller number
- Answer it, then call again and ask the same thing — a real spoken answer proves the Vapi re-sync worked
- Separately: hang up mid-question on another call and confirm the gap is still recorded with no name
