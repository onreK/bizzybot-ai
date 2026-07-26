# Unanswered Questions Queue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface every question the AI couldn't answer as a grouped dashboard queue the owner answers once, writing the answer into all six channel knowledge bases and offering one-click follow-up to the leads who never got an answer.

**Architecture:** Two detection paths feed one table. Text channels use an in-band `[UNKNOWN:topic|question]` marker the AI emits and the server strips before sending — free, same mechanism as the existing `[ESCALATE]`/`[BOOK:]` markers. Voice can't use a marker (the conversation runs on Vapi's servers) so it gets a post-call transcript scan in the existing Vapi webhook pipeline. Pure logic lives in `lib/knowledge-gaps.js` with no DB imports so tests import it standalone; all database work lives in `lib/knowledge-gaps-store.js`. This mirrors the `intent-triage.js` / `intent-triage-store.js` split already in the codebase.

**Tech Stack:** Next.js 14 App Router, PostgreSQL via `pg` (`lib/database.js` `query`), Clerk auth, OpenAI `gpt-4o-mini`, Twilio (SMS follow-up), Resend via `lib/resend-send.js` (email follow-up), Vapi (voice), Tailwind, `node:test` via `npm test`.

**Spec:** `docs/superpowers/specs/2026-07-26-unanswered-questions-queue-design.md`

## Global Constraints

- **Never break a conversation.** This is a reporting feature. Every recording path is wrapped so a failure logs and returns — the lead's message always goes out.
- **No marker may ever reach a lead.** Strip before `formatResponseForChannel` runs (SMS truncates at 640 chars and would chop a trailing marker), plus a defensive sweep on the final text.
- **Multi-industry only.** No vertical-specific language in prompts, topics, or copy (CLAUDE.md standing rule).
- **No hardcoded AI personality.** All AI behavior flows from the customer's stored settings.
- **Tailwind for all styling.** Match the existing dashboard palette: cards `bg-[#161B22]`, inner panels `bg-[#0D1117]`, borders `border-gray-800`.
- **Every DB query scoped by `customer_id`.** Multi-tenant; never a cross-customer read or write.
- **Tests are `tests/*.test.mjs`, `node:test` + `node:assert/strict`, run with `npm test`.** 31 tests pass today; all must still pass.
- **Topic vocabulary is fixed and shared:** `pricing`, `service_area`, `hours`, `scheduling`, `services`, `process`, `warranty`, `payment`, `other`. Anything unrecognized becomes `other`.
- **Commit after every task.** Direct to `main` (project convention — no branches/PRs).

## File Structure

| File | Responsibility |
|---|---|
| `lib/knowledge-gaps.js` (create) | Pure logic: topic vocabulary, marker extraction, marker stripping, transcript-scan prompt + response parsing. **No DB imports** — tests import this standalone |
| `lib/knowledge-gaps-store.js` (create) | All DB work: table creation, recording gaps, grouped reads, answering (six-way KB append + Vapi re-sync), dismissing, follow-up recording |
| `lib/ai-service.js` (modify) | Marker instruction in the system prompt; extract + strip + record in `generateAIResponse` |
| `lib/vapi.js` (modify) | Knowledge-gap instruction in `buildVoiceSystemPrompt` |
| `app/api/vapi/webhook/route.js` (modify) | Call the post-call transcript scan |
| `app/api/customer/knowledge-gaps/route.js` (create) | `GET` — grouped open queue for the signed-in customer |
| `app/api/customer/knowledge-gaps/answer/route.js` (create) | `POST` — save answer, append to 6 KBs, re-sync Vapi |
| `app/api/customer/knowledge-gaps/dismiss/route.js` (create) | `POST` — dismiss a topic group |
| `app/api/customer/knowledge-gaps/followup/route.js` (create) | `POST` — text / email / mark-handled for one lead |
| `components/dashboard/KnowledgeGapsCard.js` (create) | The Overview card: grouped list, answer form, dismiss, per-lead actions |
| `app/(dashboard)/dashboard/page.js` (modify) | Mount the card under Needs Attention |
| `tests/knowledge-gaps.test.mjs` (create) | Unit tests for all pure logic |

---

### Task 1: Core marker logic (pure, no DB)

**Files:**
- Create: `lib/knowledge-gaps.js`
- Test: `tests/knowledge-gaps.test.mjs`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `GAP_TOPICS: string[]` — the nine-topic vocabulary
  - `GAP_TOPIC_LABELS: Record<string, string>` — human labels for the dashboard, keyed by topic
  - `normalizeTopic(raw: string) => string` — returns a valid topic, `'other'` for anything unrecognized
  - `extractKnowledgeGap(text: string) => { topic: string, question: string } | null`
  - `stripGapMarkers(text: string) => string` — removes every marker form, including malformed
  - `buildGapInstruction() => string` — the prompt block appended by `ai-service.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/knowledge-gaps.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAP_TOPICS,
  normalizeTopic,
  extractKnowledgeGap,
  stripGapMarkers,
} from '../lib/knowledge-gaps.js';

test('the topic vocabulary is the nine agreed topics', () => {
  assert.deepEqual(GAP_TOPICS, [
    'pricing', 'service_area', 'hours', 'scheduling',
    'services', 'process', 'warranty', 'payment', 'other',
  ]);
});

test('normalizeTopic accepts a known topic and lowercases it', () => {
  assert.equal(normalizeTopic('Service_Area'), 'service_area');
});

test('normalizeTopic falls back to other for anything unrecognized', () => {
  assert.equal(normalizeTopic('roof_color'), 'other');
  assert.equal(normalizeTopic(''), 'other');
  assert.equal(normalizeTopic(null), 'other');
});

test('extractKnowledgeGap pulls topic and question from a well-formed marker', () => {
  const text = 'Let me check on that! [UNKNOWN:service_area|Do you service Chesterfield?]';
  assert.deepEqual(extractKnowledgeGap(text), {
    topic: 'service_area',
    question: 'Do you service Chesterfield?',
  });
});

test('extractKnowledgeGap maps an unknown topic to other but keeps the question', () => {
  const text = '[UNKNOWN:llamas|Do you groom llamas?]';
  assert.deepEqual(extractKnowledgeGap(text), {
    topic: 'other',
    question: 'Do you groom llamas?',
  });
});

test('extractKnowledgeGap returns null when there is no marker', () => {
  assert.equal(extractKnowledgeGap('We are open 9-5 Monday to Friday.'), null);
});

test('extractKnowledgeGap returns null for a marker with an empty question', () => {
  assert.equal(extractKnowledgeGap('Sure thing. [UNKNOWN:pricing|]'), null);
});

test('stripGapMarkers removes a well-formed marker and trailing whitespace', () => {
  const text = 'I want to get you the right answer on that. [UNKNOWN:pricing|What does a tune-up cost?]';
  assert.equal(stripGapMarkers(text), 'I want to get you the right answer on that.');
});

test('stripGapMarkers removes an UNCLOSED marker (SMS truncation can chop the bracket)', () => {
  const text = 'Let me find out for you. [UNKNOWN:pricing|What does a tune-u';
  assert.equal(stripGapMarkers(text), 'Let me find out for you.');
});

test('stripGapMarkers removes a marker that appears mid-sentence', () => {
  const text = 'Let me check [UNKNOWN:hours|are you open Sunday?] and get back to you.';
  assert.equal(stripGapMarkers(text), 'Let me check and get back to you.');
});

test('stripGapMarkers removes MULTIPLE markers', () => {
  const text = 'One [UNKNOWN:pricing|cost?] and two [UNKNOWN:hours|open?] done.';
  assert.equal(stripGapMarkers(text), 'One and two done.');
});

test('stripGapMarkers removes a marker missing its topic separator', () => {
  const text = 'Checking. [UNKNOWN whatever this is]';
  assert.equal(stripGapMarkers(text), 'Checking.');
});

test('stripGapMarkers leaves normal bracketed text alone', () => {
  const text = 'Our hours [Monday-Friday] are 9-5.';
  assert.equal(stripGapMarkers(text), 'Our hours [Monday-Friday] are 9-5.');
});

test('stripGapMarkers handles empty and null input without throwing', () => {
  assert.equal(stripGapMarkers(''), '');
  assert.equal(stripGapMarkers(null), '');
});

test('nothing resembling a marker survives stripping, whatever the shape', () => {
  const nasties = [
    '[UNKNOWN:pricing|q]', '[UNKNOWN:pricing|q', '[UNKNOWN', '[UNKNOWN]',
    '[UNKNOWN:|]', 'text [UNKNOWN:a|b] more [UNKNOWN:c|d]',
    '[UNKNOWN:pricing|a [Bronze] tier?]', '[UNKNOWN:a|b [c] d',
  ];
  for (const n of nasties) {
    assert.equal(stripGapMarkers(`Hello ${n}`).includes('UNKNOWN'), false, `leaked: ${n}`);
  }
});

test('stripGapMarkers removes a marker whose question text contains brackets', () => {
  const text = 'Let me check on that. [UNKNOWN:pricing|Do you offer a [Bronze] tier discount?] I will follow up.';
  const result = stripGapMarkers(text);
  assert.equal(result, 'Let me check on that. I will follow up.');
  assert.equal(result.includes(']'), false);
});

test('extractKnowledgeGap keeps the whole question when it contains brackets', () => {
  const text = '[UNKNOWN:pricing|Do you offer a [Bronze] tier discount?]';
  assert.deepEqual(extractKnowledgeGap(text), {
    topic: 'pricing',
    question: 'Do you offer a [Bronze] tier discount?',
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -A 3 "knowledge-gaps"`
Expected: FAIL — `Cannot find module '../lib/knowledge-gaps.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/knowledge-gaps.js`:

```javascript
// lib/knowledge-gaps.js
// Unanswered-questions queue CORE — pure logic only. No database imports
// (tests import this file standalone; DB work lives in lib/knowledge-gaps-store.js).
//
// Design principle — NEVER BREAK A CONVERSATION: this is a reporting feature.
// The one unacceptable failure is a marker reaching a lead, so stripping is
// deliberately broader than extraction: extraction wants a well-formed marker,
// stripping removes anything that even starts to look like one.
// Spec: docs/superpowers/specs/2026-07-26-unanswered-questions-queue-design.md

export const GAP_TOPICS = [
  'pricing', 'service_area', 'hours', 'scheduling',
  'services', 'process', 'warranty', 'payment', 'other',
];

/** Human labels for the dashboard. Keys must match GAP_TOPICS exactly. */
export const GAP_TOPIC_LABELS = {
  pricing: 'Pricing',
  service_area: 'Service area',
  hours: 'Hours',
  scheduling: 'Scheduling',
  services: 'Services offered',
  process: 'How it works',
  warranty: 'Warranty',
  payment: 'Payment',
  other: 'Other',
};

export function normalizeTopic(raw) {
  const t = String(raw || '').trim().toLowerCase();
  return GAP_TOPICS.includes(t) ? t : 'other';
}

// Well-formed marker only: [UNKNOWN:topic|question]
// The question may itself contain a bracketed phrase, so match either a
// non-bracket character or one complete nested pair — a bare [^\]]* stops at
// the first inner ] and leaks the remainder of the marker to the lead.
const GAP_PATTERN = /\[UNKNOWN:\s*([a-z_]+)\s*\|\s*((?:[^\[\]]|\[[^\]]*\])*)\]/i;

// Anything that opens like a marker, closed or not. Used for stripping.
const GAP_STRIP_PATTERN = /\[UNKNOWN(?:[^\[\]]|\[[^\]]*\])*\]?/gi;

export function extractKnowledgeGap(text) {
  if (!text) return null;
  const match = String(text).match(GAP_PATTERN);
  if (!match) return null;
  const question = (match[2] || '').trim();
  if (!question) return null;
  return { topic: normalizeTopic(match[1]), question: question.slice(0, 500) };
}

export function stripGapMarkers(text) {
  if (!text) return '';
  return String(text)
    .replace(GAP_STRIP_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +([.,!?])/g, '$1')
    .trim();
}

/** The prompt block appended to every text-channel system prompt. */
export function buildGapInstruction() {
  return `\n\nUNANSWERED QUESTIONS: If the person asks something you genuinely cannot answer from the business information above — a fact you were simply not given — do not invent an answer and do not guess. Reply naturally, telling them you'll find out and follow up. Then add this marker at the very END of your message: [UNKNOWN:topic|their question in plain words]. Choose topic from exactly this list: ${GAP_TOPICS.join(', ')}. Use the marker at most ONCE per message. Never use it if you were able to answer, and never use it for questions unrelated to this business.`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all previous tests plus 15 new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge-gaps.js tests/knowledge-gaps.test.mjs
git commit -m "Knowledge gaps: core marker extraction and stripping

Pure logic, no DB imports (mirrors the intent-triage.js split). Stripping
is deliberately broader than extraction — a malformed or SMS-truncated
marker must never reach a lead.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Store module — table, recording, grouped reads

**Files:**
- Create: `lib/knowledge-gaps-store.js`
- Test: `tests/knowledge-gaps.test.mjs` (append)

**Interfaces:**
- Consumes: `normalizeTopic` from `lib/knowledge-gaps.js`
- Produces:
  - `ensureKnowledgeGapsTable() => Promise<void>`
  - `recordGap({ customerId, topic, question, channel, contactId, contactEmail, contactPhone, contactName, vapiCallId }) => Promise<void>` — never throws
  - `getOpenGapsGrouped(customerId) => Promise<Array<{ topic, label, count, questions: Array<{id, question, channel, contactName, contactEmail, contactPhone, createdAt, followupAt, followupMethod}> }>>`
  - `groupGapRows(rows) => Array<...>` — pure grouping helper, exported for tests
  - `hasScannedCall({ customerId, vapiCallId }) => Promise<boolean>` — used by Task 8 to make the Vapi webhook idempotent

- [ ] **Step 1: Write the failing test for the pure grouping helper**

Append to `tests/knowledge-gaps.test.mjs`:

```javascript
import { groupGapRows } from '../lib/knowledge-gaps-store.js';

test('groupGapRows groups rows by topic with counts, newest topic group first', () => {
  const rows = [
    { id: 1, topic: 'service_area', question: 'Do you cover Chesterfield?', channel: 'sms',
      contact_name: 'Mike', contact_email: null, contact_phone: '+18045551212',
      created_at: '2026-07-24T10:00:00Z', followup_at: null, followup_method: null },
    { id: 2, topic: 'service_area', question: 'Are you out in Midlothian?', channel: 'chat',
      contact_name: null, contact_email: null, contact_phone: null,
      created_at: '2026-07-25T10:00:00Z', followup_at: null, followup_method: null },
    { id: 3, topic: 'warranty', question: 'How long is the labor warranty?', channel: 'sms',
      contact_name: 'Mike', contact_email: null, contact_phone: '+18045551212',
      created_at: '2026-07-26T10:00:00Z', followup_at: null, followup_method: null },
  ];
  const grouped = groupGapRows(rows);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].topic, 'warranty');        // most recent activity first
  assert.equal(grouped[0].count, 1);
  assert.equal(grouped[1].topic, 'service_area');
  assert.equal(grouped[1].count, 2);
  assert.equal(grouped[1].label, 'Service area');
  assert.equal(grouped[1].questions[0].question, 'Are you out in Midlothian?'); // newest first
});

test('groupGapRows returns an empty array for no rows', () => {
  assert.deepEqual(groupGapRows([]), []);
});

test('groupGapRows carries follow-up state through so the UI can show handled leads', () => {
  const rows = [
    { id: 9, topic: 'pricing', question: 'Cost?', channel: 'sms',
      contact_name: 'Dana', contact_email: null, contact_phone: '+18045551213',
      created_at: '2026-07-26T10:00:00Z', followup_at: '2026-07-26T12:00:00Z', followup_method: 'manual' },
  ];
  const grouped = groupGapRows(rows);
  assert.equal(grouped[0].questions[0].followupMethod, 'manual');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -i "groupGapRows"`
Expected: FAIL — `Cannot find module '../lib/knowledge-gaps-store.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/knowledge-gaps-store.js`:

```javascript
// lib/knowledge-gaps-store.js
// DB side of the unanswered-questions queue: the knowledge_gaps table,
// recording, grouped reads, answering (six-way KB write-back + Vapi re-sync),
// dismissing, and follow-up recording.
//
// Recording NEVER throws — a reporting feature must not be able to break a
// live conversation. Every write is wrapped; failures log and return.
// Spec: docs/superpowers/specs/2026-07-26-unanswered-questions-queue-design.md

import { query } from './database.js';
import { normalizeTopic, GAP_TOPIC_LABELS } from './knowledge-gaps.js';

export async function ensureKnowledgeGapsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS knowledge_gaps (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      topic TEXT,
      question TEXT,
      channel TEXT,
      contact_id INTEGER,
      contact_email TEXT,
      contact_phone TEXT,
      contact_name TEXT,
      status TEXT DEFAULT 'open',
      answer TEXT,
      answered_at TIMESTAMP,
      followup_at TIMESTAMP,
      followup_method TEXT,
      vapi_call_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await query(
    `CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_customer_status
     ON knowledge_gaps (customer_id, status)`
  ).catch(() => {});
}

/**
 * Pure grouping — topics ordered by most recent activity, questions newest
 * first inside each group. Exported separately so it is testable without a DB.
 */
export function groupGapRows(rows) {
  const byTopic = new Map();

  for (const r of rows) {
    const topic = normalizeTopic(r.topic);
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push({
      id: r.id,
      question: r.question,
      channel: r.channel,
      contactName: r.contact_name || null,
      contactEmail: r.contact_email || null,
      contactPhone: r.contact_phone || null,
      createdAt: r.created_at,
      followupAt: r.followup_at || null,
      followupMethod: r.followup_method || null,
    });
  }

  const groups = [];
  for (const [topic, questions] of byTopic) {
    questions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    groups.push({
      topic,
      label: GAP_TOPIC_LABELS[topic] || 'Other',
      count: questions.length,
      questions,
    });
  }

  groups.sort((a, b) =>
    new Date(b.questions[0].createdAt) - new Date(a.questions[0].createdAt)
  );
  return groups;
}

/**
 * Record one gap. Deliberately swallows every error: the reply has already
 * been sent to the lead by the time this runs, and losing a queue entry is
 * always preferable to throwing inside a live message path.
 */
export async function recordGap({
  customerId, topic, question, channel,
  contactId = null, contactEmail = null, contactPhone = null,
  contactName = null, vapiCallId = null,
}) {
  try {
    if (!customerId || !question) return;
    await ensureKnowledgeGapsTable();

    // Same-conversation dedup: one row per topic per contact per 24h, so a
    // confused back-and-forth cannot produce five identical entries.
    const dupe = await query(
      `SELECT id FROM knowledge_gaps
       WHERE customer_id = $1 AND topic = $2 AND status = 'open'
         AND COALESCE(contact_phone, '') = COALESCE($3, '')
         AND COALESCE(contact_email, '') = COALESCE($4, '')
         AND created_at > NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [customerId, normalizeTopic(topic), contactPhone, contactEmail]
    ).catch(() => ({ rows: [] }));
    if (dupe.rows.length > 0) return;

    await query(
      `INSERT INTO knowledge_gaps
         (customer_id, topic, question, channel, contact_id,
          contact_email, contact_phone, contact_name, vapi_call_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [customerId, normalizeTopic(topic), String(question).slice(0, 500), channel,
       contactId, contactEmail, contactPhone, contactName, vapiCallId]
    );

    console.log(`🧠 [GAPS] recorded ${normalizeTopic(topic)} from ${channel}: "${String(question).slice(0, 80)}"`);
  } catch (err) {
    console.error('⚠️ [GAPS] failed to record gap (reply already sent, continuing):', err.message);
  }
}

/** Has this call already been scanned? Vapi can re-deliver a webhook. */
export async function hasScannedCall(vapiCallId) {
  if (!vapiCallId) return false;
  const result = await query(
    `SELECT id FROM knowledge_gaps WHERE vapi_call_id = $1 LIMIT 1`,
    [vapiCallId]
  ).catch(() => ({ rows: [] }));
  return result.rows.length > 0;
}

export async function getOpenGapsGrouped(customerId) {
  await ensureKnowledgeGapsTable();
  const result = await query(
    `SELECT id, topic, question, channel, contact_name, contact_email,
            contact_phone, created_at, followup_at, followup_method
     FROM knowledge_gaps
     WHERE customer_id = $1 AND status = 'open'
     ORDER BY created_at DESC
     LIMIT 200`,
    [customerId]
  ).catch(() => ({ rows: [] }));
  return groupGapRows(result.rows);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — 3 new grouping tests.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge-gaps-store.js tests/knowledge-gaps.test.mjs
git commit -m "Knowledge gaps: store module with table, recording and grouped reads

recordGap swallows all errors by design — the reply is already sent when
it runs, so losing a queue entry beats throwing in a live message path.
24h per-contact-per-topic dedup stops a confused thread producing five
identical rows.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire text-channel detection into the AI service

**Files:**
- Modify: `lib/ai-service.js` (import block ~line 4-20; `generateAIResponse` ~line 142-161; `buildChannelSpecificPrompt` return ~line 698-700)

**Interfaces:**
- Consumes: `extractKnowledgeGap`, `stripGapMarkers`, `buildGapInstruction` from `lib/knowledge-gaps.js`; `recordGap` from `lib/knowledge-gaps-store.js`
- Produces: `generateAIResponse` result gains `knowledgeGap: { topic, question } | null` in its return object

- [ ] **Step 1: Add the imports**

In `lib/ai-service.js`, after the existing `import { hasActiveAccess } from './trial-access.js';` line:

```javascript
import { extractKnowledgeGap, stripGapMarkers, buildGapInstruction } from './knowledge-gaps.js';
import { recordGap } from './knowledge-gaps-store.js';
```

- [ ] **Step 2: Append the instruction to the system prompt**

In `buildChannelSpecificPrompt`, change the final return statement from:

```javascript
  return basePrompt + '\n\n' + channelInstruction + noPlaceholders + '\n\nAlways be helpful, accurate, and represent the business professionally.';
```

to:

```javascript
  return basePrompt + '\n\n' + channelInstruction + noPlaceholders + buildGapInstruction() + '\n\nAlways be helpful, accurate, and represent the business professionally.';
```

- [ ] **Step 3: Extract and strip the marker before formatting**

In `generateAIResponse`, immediately after the existing `[ESCALATE]` block (which ends with its `}` closing the `if (... rawAIText.includes('[ESCALATE]'))`), and BEFORE `// Step 5: Format response for specific channel`, insert:

```javascript
    // Step 4.7: Knowledge gap — the AI flagged a question it could not answer.
    // Extract it, then strip the marker from the model's own output BEFORE
    // formatting: the SMS branch truncates at 640 chars and would otherwise
    // chop a trailing marker in half, leaking "[UNKNO…" to the lead.
    const knowledgeGap = extractKnowledgeGap(rawAIText);
    if (knowledgeGap) {
      aiResponse.choices[0].message.content = stripGapMarkers(rawAIText);
    }
```

- [ ] **Step 4: Add the defensive sweep and record the gap**

Immediately after the existing `let formattedResponse = formatResponseForChannel(aiResponse, channel, customerConfig);` line, insert:

```javascript
    // Belt and braces: nothing marker-shaped may reach a lead, even a
    // malformed one the structured pattern above would not have matched.
    formattedResponse = stripGapMarkers(formattedResponse);
```

Then, immediately before the final `return` of the success path in `generateAIResponse` (the object carrying `success: true` and `response: formattedResponse`), insert:

```javascript
    // Record the gap once the reply text is final. This is awaited rather than
    // fire-and-forget: recordGap catches every error internally and cannot
    // throw, so awaiting it can never break the reply, and two quick local
    // queries (~20ms) are cheaper than losing entries to a dropped promise.
    if (knowledgeGap && customerConfig?.id) {
      await recordGap({
        customerId: customerConfig.id,
        topic: knowledgeGap.topic,
        question: knowledgeGap.question,
        channel,
        contactEmail,
        contactPhone,
        contactName: leadContext?.name || null,
      });
    }
```

And add `knowledgeGap: knowledgeGap || null,` as a field on that returned object.

- [ ] **Step 5: Verify the build compiles and tests still pass**

Run: `npx next build 2>&1 | tail -20 && npm test`
Expected: build completes (pre-existing unrelated import warnings are fine — same as before this change); all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/ai-service.js
git commit -m "Knowledge gaps: detect on all six text channels

One hook in generateAIResponse covers SMS, Gmail, Outlook, web chat,
widget chat, Facebook and Instagram. Marker is stripped from the model
output BEFORE formatResponseForChannel runs, because the SMS branch
truncates at 640 chars and would chop a trailing marker in half.
Defensive second sweep on the formatted text catches malformed ones.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Answering — six-way knowledge-base write-back plus Vapi re-sync

**Files:**
- Modify: `lib/knowledge-gaps-store.js` (append)
- Test: `tests/knowledge-gaps.test.mjs` (append)

**Interfaces:**
- Consumes: `groupGapRows` and the table from Task 2
- Produces:
  - `buildKnowledgeEntry(question, answer) => string` — pure, exported for tests
  - `answerGapTopic({ customerId, topic, answer }) => Promise<{ success: boolean, updatedChannels: number, leads: Array }>`
  - `dismissGapTopic({ customerId, topic }) => Promise<{ success: boolean }>`
  - `recordFollowup({ customerId, gapId, method: 'sms'|'email'|'manual' }) => Promise<{ success: boolean }>`
  - `getGapById({ customerId, gapId }) => Promise<object | null>` — one row, scoped to its owner; used by Task 5's follow-up route

**Note on test coverage:** the spec lists "Vapi re-sync is fire-and-forget" as a test. `resyncVapiAssistant` is module-internal and calls out to Vapi, and this codebase has no mocking framework (existing tests are all pure-logic). Rather than introduce one for a single case, the behavior is guaranteed structurally — the whole function body sits inside one `try/catch` that only logs — and proven by the manual voice verification at the end of this plan. If mocking is introduced later, this is the first thing to cover.

- [ ] **Step 1: Write the failing test for the pure entry builder**

Append to `tests/knowledge-gaps.test.mjs`:

```javascript
import { buildKnowledgeEntry } from '../lib/knowledge-gaps-store.js';

test('buildKnowledgeEntry formats a Q&A pair for the knowledge base', () => {
  const entry = buildKnowledgeEntry('Do you service Chesterfield?', 'Yes — Chesterfield, Richmond and Henrico.');
  assert.equal(entry, 'Q: Do you service Chesterfield?\nA: Yes — Chesterfield, Richmond and Henrico.');
});

test('buildKnowledgeEntry trims surrounding whitespace from both parts', () => {
  const entry = buildKnowledgeEntry('  Cost?  ', '  About $200.  ');
  assert.equal(entry, 'Q: Cost?\nA: About $200.');
});

test('buildKnowledgeEntry adds a question mark only when the question lacks end punctuation', () => {
  assert.equal(buildKnowledgeEntry('Do you cover Powhatan', 'Yes'), 'Q: Do you cover Powhatan?\nA: Yes');
  assert.equal(buildKnowledgeEntry('Do you cover Powhatan?', 'Yes'), 'Q: Do you cover Powhatan?\nA: Yes');
  assert.equal(buildKnowledgeEntry('Tell me your hours.', '9-5'), 'Q: Tell me your hours.\nA: 9-5');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -i "buildKnowledgeEntry"`
Expected: FAIL — `buildKnowledgeEntry is not a function`

- [ ] **Step 3: Write the implementation**

Append to `lib/knowledge-gaps-store.js`:

```javascript
/** Format one Q&A pair for appending to a knowledge base. Pure. */
export function buildKnowledgeEntry(question, answer) {
  const q = String(question || '').trim();
  const a = String(answer || '').trim();
  const punctuated = /[.?!]$/.test(q) ? q : `${q}?`;
  return `Q: ${punctuated}\nA: ${a}`;
}

/**
 * Push the customer's voice knowledge base to Vapi.
 *
 * WHY THIS EXISTS: the five text channels read ai_channel_settings fresh on
 * every message, so a knowledge-base append takes effect immediately. Voice
 * does NOT — the Vapi assistant holds its own copy of the system prompt,
 * pushed only by /api/vapi/provision or /api/admin/sync-vapi. Without this
 * call the phone AI silently keeps the old brain until someone manually hits
 * Save & Sync, and the feature looks broken with no error anywhere.
 *
 * Fire-and-forget: a Vapi outage or an unprovisioned customer must never fail
 * the owner's save. The knowledge base is already written; the next manual
 * sync will pick it up.
 */
async function resyncVapiAssistant(customerId) {
  try {
    const settingsResult = await query(
      `SELECT * FROM ai_channel_settings WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    const settings = settingsResult.rows[0];
    if (!settings) return;

    const numberResult = await query(
      `SELECT vapi_assistant_id FROM customer_phone_numbers
       WHERE customer_id = $1 AND vapi_assistant_id IS NOT NULL LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    const assistantId = numberResult.rows[0]?.vapi_assistant_id;
    if (!assistantId) return;

    const { updateAssistant, buildVoiceSystemPrompt } = await import('./vapi.js');
    await updateAssistant(assistantId, {
      businessName: settings.business_name || '',
      systemPrompt: buildVoiceSystemPrompt(settings),
    });
    console.log(`🔄 [GAPS] Vapi assistant ${assistantId} re-synced with the new answer`);
  } catch (err) {
    console.error('⚠️ [GAPS] Vapi re-sync failed (knowledge base still saved):', err.message);
  }
}

/**
 * Save an answer for a whole topic group: append to all six channel knowledge
 * bases, re-sync Vapi, mark the rows answered, and return the leads who are
 * still waiting so the UI can offer follow-up.
 */
export async function answerGapTopic({ customerId, topic, answer }) {
  await ensureKnowledgeGapsTable();
  const normalizedTopic = normalizeTopic(topic);
  const trimmedAnswer = String(answer || '').trim();
  if (!trimmedAnswer) return { success: false, error: 'empty_answer', updatedChannels: 0, leads: [] };

  const openResult = await query(
    `SELECT id, question, channel, contact_name, contact_email, contact_phone
     FROM knowledge_gaps
     WHERE customer_id = $1 AND topic = $2 AND status = 'open'
     ORDER BY created_at DESC`,
    [customerId, normalizedTopic]
  ).catch(() => ({ rows: [] }));

  if (openResult.rows.length === 0) return { success: false, error: 'no_open_gaps', updatedChannels: 0, leads: [] };

  // The newest question phrasing represents the group in the knowledge base.
  const entry = buildKnowledgeEntry(openResult.rows[0].question, trimmedAnswer);

  // Append to EVERY channel row for this customer — business facts do not vary
  // by channel, only tone does. Append only; existing content is never rewritten.
  // Note: only rows that already exist are updated. A channel the customer has
  // never configured has no settings row and is picked up when one is created.
  const updateResult = await query(
    `UPDATE ai_channel_settings
     SET knowledge_base =
       CASE WHEN COALESCE(knowledge_base, '') = ''
            THEN $2
            ELSE knowledge_base || E'\\n\\n' || $2 END
     WHERE customer_id = $1
     RETURNING channel`,
    [customerId, entry]
  ).catch((err) => {
    console.error('❌ [GAPS] knowledge base append failed:', err.message);
    return { rows: [] };
  });

  if (updateResult.rows.length === 0) {
    return { success: false, error: 'no_channel_settings', updatedChannels: 0, leads: [] };
  }

  await query(
    `UPDATE knowledge_gaps
     SET status = 'answered', answer = $1, answered_at = NOW()
     WHERE customer_id = $2 AND topic = $3 AND status = 'open'`,
    [trimmedAnswer, customerId, normalizedTopic]
  ).catch((err) => console.error('⚠️ [GAPS] failed to mark rows answered:', err.message));

  await resyncVapiAssistant(customerId);

  const leads = openResult.rows.map(r => ({
    gapId: r.id,
    question: r.question,
    channel: r.channel,
    contactName: r.contact_name || null,
    contactEmail: r.contact_email || null,
    contactPhone: r.contact_phone || null,
  }));

  console.log(`✅ [GAPS] answered "${normalizedTopic}" for customer ${customerId} — ${updateResult.rows.length} channels updated, ${leads.length} leads waiting`);
  return { success: true, updatedChannels: updateResult.rows.length, leads };
}

export async function dismissGapTopic({ customerId, topic }) {
  await ensureKnowledgeGapsTable();
  await query(
    `UPDATE knowledge_gaps SET status = 'dismissed'
     WHERE customer_id = $1 AND topic = $2 AND status = 'open'`,
    [customerId, normalizeTopic(topic)]
  ).catch((err) => console.error('⚠️ [GAPS] dismiss failed:', err.message));
  return { success: true };
}

/** Record that one lead was followed up: 'sms' | 'email' | 'manual'. */
export async function recordFollowup({ customerId, gapId, method }) {
  await ensureKnowledgeGapsTable();
  const result = await query(
    `UPDATE knowledge_gaps SET followup_at = NOW(), followup_method = $1
     WHERE id = $2 AND customer_id = $3
     RETURNING id`,
    [method, gapId, customerId]
  ).catch(() => ({ rows: [] }));
  return { success: result.rows.length > 0 };
}

/** One gap row, scoped to its owner — used by the follow-up route. */
export async function getGapById({ customerId, gapId }) {
  await ensureKnowledgeGapsTable();
  const result = await query(
    `SELECT * FROM knowledge_gaps WHERE id = $1 AND customer_id = $2 LIMIT 1`,
    [gapId, customerId]
  ).catch(() => ({ rows: [] }));
  return result.rows[0] || null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — 3 new `buildKnowledgeEntry` tests.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge-gaps-store.js tests/knowledge-gaps.test.mjs
git commit -m "Knowledge gaps: answer write-back to all six KBs plus Vapi re-sync

The Vapi re-sync is the non-obvious half: text channels read settings
fresh per message, but the Vapi assistant holds its own copy of the
prompt. Without pushing it, the phone AI silently keeps the old brain
with no error anywhere. Fire-and-forget so a Vapi outage can't fail a save.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: API routes

**Files:**
- Create: `app/api/customer/knowledge-gaps/route.js`
- Create: `app/api/customer/knowledge-gaps/answer/route.js`
- Create: `app/api/customer/knowledge-gaps/dismiss/route.js`
- Create: `app/api/customer/knowledge-gaps/followup/route.js`

**Interfaces:**
- Consumes: `getOpenGapsGrouped`, `answerGapTopic`, `dismissGapTopic`, `recordFollowup`, `getGapById` from `lib/knowledge-gaps-store.js`; `getCustomerByClerkId` from `lib/database.js`; `sendEmail` from `lib/resend-send.js`
- Produces: four HTTP endpoints consumed by `components/dashboard/KnowledgeGapsCard.js`
  - `GET /api/customer/knowledge-gaps` → `{ groups: [...] }`
  - `POST /api/customer/knowledge-gaps/answer` body `{ topic, answer }` → `{ success, updatedChannels, leads }`
  - `POST /api/customer/knowledge-gaps/dismiss` body `{ topic }` → `{ success }`
  - `POST /api/customer/knowledge-gaps/followup` body `{ gapId, method, answer }` → `{ success, sent }`

- [ ] **Step 1: Create the list route**

Create `app/api/customer/knowledge-gaps/route.js`:

```javascript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCustomerByClerkId } from '@/lib/database.js';
import { getOpenGapsGrouped } from '@/lib/knowledge-gaps-store.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ groups: [] });

    const groups = await getOpenGapsGrouped(customer.id);
    return NextResponse.json({ groups });
  } catch (error) {
    console.error('❌ [GAPS API] list failed:', error.message);
    return NextResponse.json({ groups: [] });
  }
}
```

- [ ] **Step 2: Create the answer route**

Create `app/api/customer/knowledge-gaps/answer/route.js`:

```javascript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCustomerByClerkId } from '@/lib/database.js';
import { answerGapTopic } from '@/lib/knowledge-gaps-store.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, answer } = await request.json();
    if (!topic || !answer?.trim()) {
      return NextResponse.json({ error: 'topic and answer are required' }, { status: 400 });
    }

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const result = await answerGapTopic({ customerId: customer.id, topic, answer });
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Could not save answer' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [GAPS API] answer failed:', error.message);
    return NextResponse.json({ error: 'Could not save answer' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create the dismiss route**

Create `app/api/customer/knowledge-gaps/dismiss/route.js`:

```javascript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCustomerByClerkId } from '@/lib/database.js';
import { dismissGapTopic } from '@/lib/knowledge-gaps-store.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic } = await request.json();
    if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 });

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const result = await dismissGapTopic({ customerId: customer.id, topic });
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [GAPS API] dismiss failed:', error.message);
    return NextResponse.json({ error: 'Could not dismiss' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create the follow-up route**

Create `app/api/customer/knowledge-gaps/followup/route.js`:

```javascript
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import twilio from 'twilio';
import { query } from '@/lib/database.js';
import { getCustomerByClerkId } from '@/lib/database.js';
import { getGapById, recordFollowup } from '@/lib/knowledge-gaps-store.js';
import { sendEmail } from '@/lib/resend-send.js';

export const dynamic = 'force-dynamic';

const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { gapId, method, answer } = await request.json();
    if (!gapId || !['sms', 'email', 'manual'].includes(method)) {
      return NextResponse.json({ error: 'gapId and a valid method are required' }, { status: 400 });
    }

    const customer = await getCustomerByClerkId(userId);
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const gap = await getGapById({ customerId: customer.id, gapId });
    if (!gap) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const businessName = customer.business_name || 'us';
    const body = String(answer || gap.answer || '').trim();

    // 'manual' records that the owner handled it themselves — nothing is sent.
    if (method === 'manual') {
      await recordFollowup({ customerId: customer.id, gapId, method: 'manual' });
      return NextResponse.json({ success: true, sent: false });
    }

    if (!body) return NextResponse.json({ error: 'No answer to send' }, { status: 400 });

    if (method === 'sms') {
      if (!twilioClient || !gap.contact_phone) {
        return NextResponse.json({ error: 'No phone number on file for this lead' }, { status: 400 });
      }
      const numberResult = await query(
        `SELECT phone_number FROM customer_phone_numbers WHERE customer_id = $1 LIMIT 1`,
        [customer.id]
      ).catch(() => ({ rows: [] }));
      const fromNumber = numberResult.rows[0]?.phone_number;
      if (!fromNumber) {
        return NextResponse.json({ error: 'No business number configured' }, { status: 400 });
      }

      await twilioClient.messages.create({
        from: fromNumber,
        to: gap.contact_phone,
        body: `Following up from ${businessName}: ${body}`,
      });
    }

    if (method === 'email') {
      if (!gap.contact_email) {
        return NextResponse.json({ error: 'No email address on file for this lead' }, { status: 400 });
      }
      const result = await sendEmail({
        from: `${businessName} <alerts@bizzybotai.com>`,
        to: gap.contact_email,
        subject: `Following up on your question`,
        text: `Hi${gap.contact_name ? ` ${gap.contact_name}` : ''},\n\nYou asked: ${gap.question}\n\n${body}\n\n— ${businessName}`,
      }, 'knowledge-gap follow-up');

      if (!result.sent) {
        return NextResponse.json({ error: 'Email could not be delivered' }, { status: 502 });
      }
    }

    await recordFollowup({ customerId: customer.id, gapId, method });
    return NextResponse.json({ success: true, sent: true });
  } catch (error) {
    console.error('❌ [GAPS API] follow-up failed:', error.message);
    return NextResponse.json({ error: 'Could not send follow-up' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Verify the build compiles**

Run: `npx next build 2>&1 | tail -20`
Expected: build completes with no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/customer/knowledge-gaps/
git commit -m "Knowledge gaps: list, answer, dismiss and follow-up API routes

Follow-up supports sms, email and manual. 'manual' sends nothing and
just records that the owner handled it — without it, personally-phoned
leads sit in the queue forever and it stops being trustworthy.
Email send checks the Resend response (lib/resend-send.js) rather than
assuming success.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Dashboard card

**Files:**
- Create: `components/dashboard/KnowledgeGapsCard.js`
- Modify: `app/(dashboard)/dashboard/page.js` (import block ~line 1-14; render, immediately after the Needs Attention block that ends around line 490)

**Interfaces:**
- Consumes: the four routes from Task 5
- Produces: `<KnowledgeGapsCard />` — self-fetching, renders nothing while empty except a one-line all-clear

- [ ] **Step 1: Create the component**

Create `components/dashboard/KnowledgeGapsCard.js`:

```javascript
'use client';

import { useState, useEffect } from 'react';
import { Brain, Check, X, MessageSquare, Mail, Phone, CheckCircle2 } from 'lucide-react';

const CHANNEL_LABELS = {
  sms: 'SMS', gmail: 'email', email: 'email', chat: 'chat',
  facebook: 'Facebook', instagram: 'Instagram', voice: 'call',
};

function relativeDay(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return then.toLocaleDateString('en-US', { weekday: 'short' });
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function KnowledgeGapsCard() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openTopic, setOpenTopic] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [waiting, setWaiting] = useState(null); // { topic, answer, leads }
  const [busyLead, setBusyLead] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/customer/knowledge-gaps');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      // Render nothing rather than a green all-clear: claiming "your AI
      // answered everything" when we simply could not load is worse than
      // showing no card at all.
      setLoadFailed(true);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveAnswer(topic) {
    if (!draft.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/customer/knowledge-gaps/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, answer: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save that answer.');
      } else {
        setWaiting({ topic, answer: draft, leads: data.leads || [] });
        setOpenTopic(null);
        setDraft('');
        load();
      }
    } catch {
      setError('Could not save that answer.');
    }
    setSaving(false);
  }

  async function dismiss(topic) {
    await fetch('/api/customer/knowledge-gaps/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    }).catch(() => {});
    load();
  }

  async function followUp(gapId, method) {
    setBusyLead(`${gapId}-${method}`);
    setError('');
    try {
      const res = await fetch('/api/customer/knowledge-gaps/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gapId, method, answer: waiting?.answer }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send that.');
      } else {
        setWaiting(w => w ? { ...w, leads: w.leads.filter(l => l.gapId !== gapId) } : w);
      }
    } catch {
      setError('Could not send that.');
    }
    setBusyLead(null);
  }

  if (loading || loadFailed) return null;

  // Post-answer: who is still waiting on this answer
  if (waiting && waiting.leads.length > 0) {
    return (
      <div className="bg-[#161B22] border border-violet-500/20 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold text-sm">Answer saved — these people never got one</h2>
          <button onClick={() => setWaiting(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-300">
            Done
          </button>
        </div>
        <div className="p-3 space-y-2">
          {error && <p className="text-xs text-red-400 px-1">{error}</p>}
          {waiting.leads.map(lead => (
            <div key={lead.gapId} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-[#0D1117] border border-gray-800">
              <span className="text-sm text-white">{lead.contactName || 'Unknown'}</span>
              <span className="text-xs text-gray-500">
                {CHANNEL_LABELS[lead.channel] || lead.channel} · &ldquo;{lead.question}&rdquo;
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {lead.contactPhone && (
                  <button
                    onClick={() => followUp(lead.gapId, 'sms')}
                    disabled={busyLead === `${lead.gapId}-sms`}
                    className="px-2.5 py-1 text-xs rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" /> Text
                  </button>
                )}
                {lead.contactEmail && (
                  <button
                    onClick={() => followUp(lead.gapId, 'email')}
                    disabled={busyLead === `${lead.gapId}-email`}
                    className="px-2.5 py-1 text-xs rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" /> Email
                  </button>
                )}
                <button
                  onClick={() => followUp(lead.gapId, 'manual')}
                  disabled={busyLead === `${lead.gapId}-manual`}
                  className="px-2.5 py-1 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> I handled it
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-[#161B22] border border-gray-800 rounded-xl px-5 py-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <p className="text-sm text-gray-400">
          Your AI answered everything it was asked. Nothing to teach it right now.
        </p>
      </div>
    );
  }

  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="bg-[#161B22] border border-violet-500/20 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
        <Brain className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">Your AI got stumped</h2>
        <span className="px-1.5 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full font-medium">
          {total}
        </span>
        <span className="ml-auto text-xs text-gray-500">Answer once — every channel learns it</span>
      </div>

      <div className="p-3 space-y-2">
        {error && <p className="text-xs text-red-400 px-1">{error}</p>}

        {groups.map(group => (
          <div key={group.topic} className="rounded-lg bg-[#0D1117] border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-sm text-white font-medium">{group.label}</span>
              <span className="text-xs text-gray-500">asked {group.count}×</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => { setOpenTopic(openTopic === group.topic ? null : group.topic); setDraft(''); }}
                  className="px-2.5 py-1 text-xs rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
                >
                  {openTopic === group.topic ? 'Cancel' : 'Answer'}
                </button>
                <button
                  onClick={() => dismiss(group.topic)}
                  title="Not worth answering"
                  className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="px-3 pb-2.5 space-y-1">
              {group.questions.map(q => (
                <div key={q.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="text-gray-300">&ldquo;{q.question}&rdquo;</span>
                  <span className="text-gray-600">
                    {q.contactName || 'unknown'} · {CHANNEL_LABELS[q.channel] || q.channel} · {relativeDay(q.createdAt)}
                  </span>
                </div>
              ))}
            </div>

            {openTopic === group.topic && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-800 pt-2.5">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Type the answer your AI should give from now on…"
                  className="w-full h-20 bg-[#161B22] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => saveAnswer(group.topic)}
                  disabled={saving || !draft.trim()}
                  className="px-3 py-1.5 text-xs rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save to all channels'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it on the Overview page**

In `app/(dashboard)/dashboard/page.js`, add to the imports at the top:

```javascript
import KnowledgeGapsCard from '@/components/dashboard/KnowledgeGapsCard';
```

Then, immediately AFTER the closing of the "Needs Attention" JSX block (the hot-leads block that begins with the `{/* Needs Attention — hot leads come before any stats */}` comment around line 445) and before the next section, insert:

```jsx
      {/* Unanswered questions — teach the AI what it did not know */}
      <KnowledgeGapsCard />
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx next build 2>&1 | tail -20`
Expected: build completes with no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/KnowledgeGapsCard.js "app/(dashboard)/dashboard/page.js"
git commit -m "Knowledge gaps: Overview card with answer, dismiss and follow-up

Sits under Needs Attention on the page owners already land on. Collapses
to a one-line all-clear when empty. Per-lead actions are text / email /
'I handled it' on every channel, with send buttons rendered only where
that contact detail exists.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Voice transcript scan (pure core)

**Files:**
- Modify: `lib/knowledge-gaps.js` (append)
- Test: `tests/knowledge-gaps.test.mjs` (append)

**Interfaces:**
- Consumes: `GAP_TOPICS`, `normalizeTopic` from Task 1
- Produces:
  - `buildTranscriptScanPrompt(businessName: string) => string`
  - `parseTranscriptScan(raw: string) => { gaps: Array<{topic, question}>, callerName: string | null }` — never throws
  - `buildVoiceGapInstruction() => string` — the mid-call prompt block for Vapi

- [ ] **Step 1: Write the failing tests**

Append to `tests/knowledge-gaps.test.mjs`:

```javascript
import { parseTranscriptScan, buildTranscriptScanPrompt, buildVoiceGapInstruction } from '../lib/knowledge-gaps.js';

test('parseTranscriptScan reads gaps and the caller name from valid JSON', () => {
  const raw = JSON.stringify({
    gaps: [
      { topic: 'hours', question: 'Do you work weekends?' },
      { topic: 'service_area', question: 'Do you come out to Powhatan?' },
    ],
    caller_name: 'Dana',
  });
  const result = parseTranscriptScan(raw);
  assert.equal(result.gaps.length, 2);
  assert.equal(result.gaps[0].topic, 'hours');
  assert.equal(result.gaps[1].question, 'Do you come out to Powhatan?');
  assert.equal(result.callerName, 'Dana');
});

test('parseTranscriptScan normalizes an unrecognized topic to other', () => {
  const raw = JSON.stringify({ gaps: [{ topic: 'spaceships', question: 'Do you do spaceships?' }], caller_name: null });
  assert.equal(parseTranscriptScan(raw).gaps[0].topic, 'other');
});

test('parseTranscriptScan returns no gaps for a clean call', () => {
  const raw = JSON.stringify({ gaps: [], caller_name: 'Mike' });
  const result = parseTranscriptScan(raw);
  assert.deepEqual(result.gaps, []);
  assert.equal(result.callerName, 'Mike');
});

test('parseTranscriptScan returns empty rather than throwing on malformed JSON', () => {
  const result = parseTranscriptScan('not json at all {{{');
  assert.deepEqual(result.gaps, []);
  assert.equal(result.callerName, null);
});

test('parseTranscriptScan tolerates a missing gaps array', () => {
  assert.deepEqual(parseTranscriptScan(JSON.stringify({ caller_name: 'X' })).gaps, []);
});

test('parseTranscriptScan drops entries with an empty question', () => {
  const raw = JSON.stringify({ gaps: [{ topic: 'pricing', question: '   ' }, { topic: 'hours', question: 'Open Sunday?' }] });
  const result = parseTranscriptScan(raw);
  assert.equal(result.gaps.length, 1);
  assert.equal(result.gaps[0].question, 'Open Sunday?');
});

test('parseTranscriptScan handles null and empty input', () => {
  assert.deepEqual(parseTranscriptScan(null).gaps, []);
  assert.deepEqual(parseTranscriptScan('').gaps, []);
});

test('buildTranscriptScanPrompt names the business and lists every valid topic', () => {
  const prompt = buildTranscriptScanPrompt('Acme Plumbing');
  assert.equal(prompt.includes('Acme Plumbing'), true);
  for (const topic of GAP_TOPICS) assert.equal(prompt.includes(topic), true);
});

test('the voice instruction tells the AI not to guess and to ask for a name', () => {
  const instruction = buildVoiceGapInstruction();
  assert.equal(/never guess|do not guess/i.test(instruction), true);
  assert.equal(/name/i.test(instruction), true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -i "parseTranscriptScan"`
Expected: FAIL — `parseTranscriptScan is not a function`

- [ ] **Step 3: Write the implementation**

Append to `lib/knowledge-gaps.js`:

```javascript
/**
 * Mid-call instruction for the Vapi assistant.
 *
 * Deliberately does NOT collect an email: Documents Phase A established that
 * email-over-phone needs letter-by-letter readback, phantom-dot handling and
 * a give-up rule. The caller's number is already known from caller ID, so a
 * text is both more reliable and more natural for someone who just phoned.
 */
export function buildVoiceGapInstruction() {
  return `\n\nWHEN YOU DON'T KNOW: If the caller asks something you cannot answer from the business knowledge above, never guess and never invent an answer. Tell them honestly that you want to get them the right answer rather than guess, then ask for their name and confirm the number they're calling from is the best one to text the answer back to. Keep this to one short question — do not ask for an email address. Then continue the conversation normally.`;
}

/** System prompt for the post-call transcript scan. */
export function buildTranscriptScanPrompt(businessName) {
  const name = (businessName || '').trim() || 'the business';
  return `You review a phone call transcript between a caller and ${name}'s AI assistant. ` +
    `Find every question the caller asked that the assistant could NOT properly answer — including questions it dodged, deflected, or answered vaguely without real information, and questions it answered confidently but clearly had no source for. ` +
    `Do NOT report questions the assistant answered with real, specific information. Do NOT report the assistant's own questions. ` +
    `Return JSON only: {"gaps": [{"topic": string, "question": string}], "caller_name": string|null}. ` +
    `topic must be exactly one of: ${GAP_TOPICS.join(', ')}. ` +
    `question = the caller's question in plain words, as they would have put it, under 200 characters. ` +
    `caller_name = the caller's first name if they gave one, otherwise null. ` +
    `If the assistant answered everything properly, return an empty gaps array.`;
}

/** Parse the scan response. Never throws — a bad response means no gaps. */
export function parseTranscriptScan(raw) {
  const empty = { gaps: [], callerName: null };
  if (!raw) return empty;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== 'object') return empty;

  const list = Array.isArray(parsed.gaps) ? parsed.gaps : [];
  const gaps = list
    .map(g => ({
      topic: normalizeTopic(g?.topic),
      question: String(g?.question || '').trim().slice(0, 500),
    }))
    .filter(g => g.question.length > 0);

  const callerName = typeof parsed.caller_name === 'string' && parsed.caller_name.trim()
    ? parsed.caller_name.trim().slice(0, 100)
    : null;

  return { gaps, callerName };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — 9 new tests.

- [ ] **Step 5: Commit**

```bash
git add lib/knowledge-gaps.js tests/knowledge-gaps.test.mjs
git commit -m "Knowledge gaps: voice transcript scan core

Voice cannot use the marker (the conversation runs on Vapi's servers),
so it reads the transcript afterward — which also catches the AI
answering confidently and wrongly, something the text marker
structurally cannot see. Parsing never throws; a bad response means
no gaps rather than a broken webhook.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire voice detection into Vapi

**Files:**
- Create: `lib/voice-gap-scan.js`
- Modify: `lib/vapi.js` (inside `buildVoiceSystemPrompt`, ~line 44-48 where the closing `parts.push` calls are)
- Modify: `app/api/vapi/webhook/route.js` (~line 118-127, beside the existing `processVoiceDocumentFollowup` call)

**Interfaces:**
- Consumes: `buildTranscriptScanPrompt`, `parseTranscriptScan`, `buildVoiceGapInstruction` from `lib/knowledge-gaps.js`; `recordGap`, `hasScannedCall` from `lib/knowledge-gaps-store.js`
- Produces: `processVoiceGapScan({ customerId, vapiCallId, callerPhone, transcript, existingContact }) => Promise<void>` — never throws

- [ ] **Step 1: Add the mid-call instruction to the Vapi prompt**

In `lib/vapi.js`, add the import at the top of the file:

```javascript
import { buildVoiceGapInstruction } from './knowledge-gaps.js';
```

Then inside `buildVoiceSystemPrompt`, immediately before the final `if (s.response_tone) parts.push(...)` line, insert:

```javascript
  parts.push(buildVoiceGapInstruction().trim());
```

- [ ] **Step 2: Create the scan module**

Create `lib/voice-gap-scan.js`:

```javascript
// lib/voice-gap-scan.js
// After a voice call: read the transcript and record any question the AI
// could not properly answer.
//
// Runs on EVERY completed call, unconditionally — NOT gated on the assistant
// having collected a name. A caller who gets a fumbled answer and hangs up is
// exactly the invisible failure this feature exists to catch; a name makes an
// entry better, it never decides whether one exists.
// Spec: docs/superpowers/specs/2026-07-26-unanswered-questions-queue-design.md

import OpenAI from 'openai';
import { query } from './database.js';
import { buildTranscriptScanPrompt, parseTranscriptScan } from './knowledge-gaps.js';
import { recordGap, hasScannedCall } from './knowledge-gaps-store.js';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function processVoiceGapScan({ customerId, vapiCallId, callerPhone, transcript, existingContact }) {
  try {
    if (!openai || !customerId || !transcript || transcript.trim().length < 40) return;

    // Vapi can re-deliver an end-of-call webhook. Never scan a call twice —
    // it would duplicate rows and re-spend on the model.
    if (await hasScannedCall({ customerId, vapiCallId })) {
      console.log(`🧠 [GAPS] call ${vapiCallId} already scanned — skipping`);
      return;
    }

    const settingsResult = await query(
      `SELECT business_name FROM ai_channel_settings
       WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    const businessName = settingsResult.rows[0]?.business_name || '';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildTranscriptScanPrompt(businessName) },
        { role: 'user', content: String(transcript).slice(0, 12000) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const { gaps, callerName } = parseTranscriptScan(completion.choices[0]?.message?.content || '');
    if (gaps.length === 0) {
      console.log(`🧠 [GAPS] call ${vapiCallId}: no gaps found`);
      return;
    }

    for (const gap of gaps) {
      await recordGap({
        customerId,
        topic: gap.topic,
        question: gap.question,
        channel: 'voice',
        contactId: existingContact?.id || null,
        contactPhone: callerPhone || null,
        contactName: callerName || existingContact?.name || null,
        vapiCallId,
      });
    }

    console.log(`🧠 [GAPS] call ${vapiCallId}: recorded ${gaps.length} gap(s)`);
  } catch (err) {
    console.error('⚠️ [GAPS] voice scan failed (call already handled, continuing):', err.message);
  }
}
```

- [ ] **Step 3: Call it from the Vapi webhook**

In `app/api/vapi/webhook/route.js`, add the import beside the existing `processVoiceDocumentFollowup` import:

```javascript
import { processVoiceGapScan } from '@/lib/voice-gap-scan.js';
```

Then immediately after the existing `await processVoiceDocumentFollowup({...}).catch(() => {});` call, insert:

```javascript
        // 6. Knowledge gaps: questions the AI could not answer on this call
        await processVoiceGapScan({
          customerId: owner.customer_id,
          vapiCallId: call.id,
          callerPhone,
          transcript,
          existingContact: contactResult?.contact || null,
        }).catch(() => {});
```

- [ ] **Step 4: Verify the build compiles and every test passes**

Run: `npx next build 2>&1 | tail -20 && npm test`
Expected: build completes; all tests pass (31 existing + 30 new).

- [ ] **Step 5: Commit**

```bash
git add lib/voice-gap-scan.js lib/vapi.js app/api/vapi/webhook/route.js
git commit -m "Knowledge gaps: voice detection via post-call transcript scan

Runs on every completed call, not only when the AI collected a name —
a caller who gets a fumbled answer and hangs up is exactly the invisible
failure this catches. Guarded against Vapi re-delivering a webhook by
checking vapi_call_id before scanning.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Manual verification (founder, after deploy)

Automated tests cover the logic; these prove the loop closes in the real world.

**Text:**
- [ ] Text the toll-free something the knowledge base does not cover ("do you guys work weekends?")
- [ ] The reply reads clean — no bracket junk, no `[UNKNOWN`
- [ ] The question appears on the Overview page under "Your AI got stumped"
- [ ] Answer it → **Text** button delivers the answer to the test phone
- [ ] Ask again → a real answer comes back

**Voice:**
- [ ] Call from a phone that is **NOT** the forwarding cell. Calling from the forwarded number reaches carrier voicemail and its PIN prompt — a recurring false alarm in this project (see CLAUDE.md).
- [ ] Ask something uncovered; the AI declines to guess and asks for a name
- [ ] Hang up → the question appears in the queue with the name and caller number
- [ ] Answer it, call again, ask the same thing → a real spoken answer proves the Vapi re-sync fired
- [ ] On a separate call, hang up mid-question → the gap is still recorded, with no name

**Trust:**
- [ ] After a few days of real traffic, entries are genuine gaps rather than noise. A high dismiss rate means the prompt needs tightening before the feature is worth keeping.
