# Email Intent Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every inbound email is classified before the AI may reply; only high-confidence leads get automatic replies, everything else is flagged "Left for you" — plus de-fang the hot-lead keyword scoring that promoted a Microsoft Support engineer to an $18k hot lead.

**Architecture:** A new triage core (`lib/intent-triage.js`, pure — prompt building, two-tier OpenAI classification, action decision) and a store/orchestrator (`lib/intent-triage-store.js`, DB — `email_triage` table, signal gathering, corrections, `runTriage()`). Both email monitors (Outlook `processAccount`, Gmail `respondToEmail`/`checkForNewEmails`) call `runTriage()` before generating any reply. The inbox UI overlays flags from a new `/api/email/triage` route and offers one-click corrections that become few-shot examples in future prompts. A labeled eval set + script gates go-live.

**Tech Stack:** Next.js 14 App Router, PostgreSQL via `pg`, OpenAI `gpt-4o-mini` + `gpt-4o`, node:test (new — zero-dependency test runner), Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-19-intent-triage-design.md`

## Global Constraints

- **Asymmetric caution:** an automatic reply requires a high-confidence lead classification; ALL other outcomes route to flag-first. (Spec: "All uncertainty routes to flag-first.")
- Conservative reply template (spec verbatim, plus business name): `Thanks for reaching out to ${businessName} — happy to help! Could you share a bit more about what you're looking for?`
- Classifier returns strict JSON `{ class, confidence: high|medium|low, reason }`; classes are exactly `new_lead`, `existing_lead_reply`, `business_correspondence`, `automated`, `ambiguous`.
- Two-tier models: `gpt-4o-mini` first; non-high confidence gets ONE second opinion from `gpt-4o`, whose answer is final.
- Never a second automatic CONSERVATIVE reply on a thread that already carries an unresolved flag (a high-confidence lead classification on a flagged thread may still auto-reply — deliberate speed-to-lead tradeoff, per the spec's ambiguous-row scope).
- Eval gate: business_correspondence recall must be 100% on the eval set, ZERO business_correspondence emails may classify as high-confidence lead, ≥90% overall — before the monitors are wired (Tasks 5+ depend on Task 4 passing).
- No real-estate-only or industry-specific language anywhere (BizzyBot is multi-industry).
- Existing automated-sender detection (`checkEmailFilter`) stays as the pre-filter IN FRONT of the classifier — do not remove or reorder it.
- Commit directly to `main` and push after each task (project convention; Railway auto-deploys). Safe: Outlook is disconnected and test Gmail connections are expired, so no live email traffic hits the new code until the founder reconnects.
- Keyword de-fang: keyword matches may never alone reach the hot threshold (60). Cap keyword-only contribution at 45.
- Classifier OpenAI calls are infrastructure, NOT customer AI responses — do not count them against the monthly response pool.

---

### Task 1: De-fang hot-lead keywords (shared module + rewire)

The everyday words ("help", "issue", "contact", "problem", "call me", "phone", "money", "broken", "not working") leave the list, and keyword scoring is capped below the hot threshold so only the GPT scorer can promote a lead to hot. The list currently lives duplicated in `lib/ai-service.js` and `app/api/email/webhook/route.js` — extract one shared module.

**Files:**
- Create: `lib/hot-lead-keywords.js`
- Create: `tests/hot-lead-keywords.test.mjs`
- Modify: `lib/ai-service.js` (lines 25–33 keyword list; lines 474–543 `analyzeHotLead`)
- Modify: `app/api/email/webhook/route.js` (lines 18–25 keyword list; lines 159–167 scoring)
- Modify: `package.json` (add test script)

**Interfaces:**
- Produces: `HOT_LEAD_KEYWORDS` (array of strings), `KEYWORD_SCORE_CAP` (45), `scoreKeywordMatches(message, customKeywords = []) → { matches: string[], score: number }` from `lib/hot-lead-keywords.js`. No other task consumes these, but Task 4's eval sanity-checks depend on this behavior being live.

- [ ] **Step 1: Add the test script to package.json**

In `package.json`, change the `scripts` block to:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "node --test tests/",
    "postinstall": "echo 'Install complete'"
  },
```

- [ ] **Step 2: Write the failing test**

Create `tests/hot-lead-keywords.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOT_LEAD_KEYWORDS, KEYWORD_SCORE_CAP, scoreKeywordMatches } from '../lib/hot-lead-keywords.js';

test('everyday support words are no longer hot-lead keywords', () => {
  const banned = ['help', 'issue', 'problem', 'contact', 'call me', 'phone', 'broken', 'not working', 'money'];
  for (const word of banned) {
    assert.ok(!HOT_LEAD_KEYWORDS.includes(word), `"${word}" should not be a hot-lead keyword`);
  }
});

test('a support-style email scores zero from keywords', () => {
  const { score } = scoreKeywordMatches('I need help with a problem, please contact me about this issue');
  assert.equal(score, 0);
});

test('keyword score is capped below the hot threshold (60)', () => {
  // every keyword in the list at once still cannot clear 60
  const everything = HOT_LEAD_KEYWORDS.join(' ');
  const { score } = scoreKeywordMatches(everything);
  assert.equal(score, KEYWORD_SCORE_CAP);
  assert.ok(KEYWORD_SCORE_CAP < 60);
});

test('real buying signals still register', () => {
  const { matches, score } = scoreKeywordMatches('what is your price? my budget is ready');
  assert.ok(matches.includes('price'));
  assert.ok(matches.includes('budget'));
  assert.equal(score, 30);
});

test('custom customer keywords still count', () => {
  const { matches } = scoreKeywordMatches('interested in solar panels', ['solar panels']);
  assert.ok(matches.includes('solar panels'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../lib/hot-lead-keywords.js'`

- [ ] **Step 4: Write the module**

Create `lib/hot-lead-keywords.js`:

```js
// lib/hot-lead-keywords.js
// Shared hot-lead keyword scoring. Keywords may NUDGE a lead score but can
// never alone clear the hot threshold (60) — the GPT scorer leads.
// De-fanged 2026-07-19: everyday support words (help/issue/problem/contact/
// call/phone/broken/money) used to score 25 points each with no cap, which is
// how a Microsoft Support engineer became an $18k hot lead.

export const HOT_LEAD_KEYWORDS = [
  'urgent', 'asap', 'immediately', 'emergency', 'deadline',
  'budget', 'price', 'cost', 'payment', 'buy', 'purchase',
  'interested', 'ready to start', 'when can we', 'schedule',
  'meeting', 'quote', 'comparing'
];

export const KEYWORD_POINT_VALUE = 15;
export const KEYWORD_SCORE_CAP = 45; // must stay below the hot threshold (60)

export function scoreKeywordMatches(message, customKeywords = []) {
  const content = (message || '').toLowerCase();
  const matches = [
    ...HOT_LEAD_KEYWORDS.filter(k => content.includes(k.toLowerCase())),
    ...(Array.isArray(customKeywords) ? customKeywords : [])
      .filter(k => k && content.includes(String(k).toLowerCase())),
  ];
  return {
    matches,
    score: Math.min(matches.length * KEYWORD_POINT_VALUE, KEYWORD_SCORE_CAP),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (5 tests)

- [ ] **Step 6: Rewire `lib/ai-service.js`**

Delete the `HOT_LEAD_KEYWORDS` constant (lines 25–33, including its `// Keep your existing HOT_LEAD_KEYWORDS` comment) and add to the imports at the top of the file:

```js
import { scoreKeywordMatches } from './hot-lead-keywords.js';
```

In `analyzeHotLead` (starts line 474), replace the keyword-scoring block:

```js
    // Basic keyword detection
    const messageContent = message.toLowerCase();
    const keywordMatches = HOT_LEAD_KEYWORDS.filter(keyword => 
      messageContent.includes(keyword.toLowerCase())
    );
    
    // Use customer's custom hot lead keywords if available
    let customKeywordMatches = [];
    if (customerConfig?.hot_lead_keywords && Array.isArray(customerConfig.hot_lead_keywords)) {
      customKeywordMatches = customerConfig.hot_lead_keywords.filter(keyword => 
        messageContent.includes(keyword.toLowerCase())
      );
    }
    
    const totalKeywords = [...keywordMatches, ...customKeywordMatches];
    const basicScore = Math.min(totalKeywords.length * 25, 100);
```

with:

```js
    // Keywords may only nudge — capped below the hot threshold; GPT leads.
    const { matches: totalKeywords, score: basicScore } = scoreKeywordMatches(
      message,
      customerConfig?.hot_lead_keywords
    );
```

The rest of `analyzeHotLead` stays as-is: `finalScore = Math.max(basicScore, aiResult.score)` is now safe because `basicScore` ≤ 45, and the keyword-only fallback (`isHotLead: basicScore >= 60`) can no longer fire — keyword noise alone never makes hot.

- [ ] **Step 7: Rewire `app/api/email/webhook/route.js`**

Delete its local `HOT_LEAD_KEYWORDS` constant (lines 18–25) and add the import:

```js
import { scoreKeywordMatches } from '../../../../lib/hot-lead-keywords.js';
```

Replace the scoring block (lines 159–167):

```js
    // Handle hot lead detection using YOUR existing function
    const messageText = text.toLowerCase();
    const keywordMatches = HOT_LEAD_KEYWORDS.filter(keyword => 
      messageText.includes(keyword.toLowerCase())
    );

    // Use centralized AI hot lead detection (more advanced) OR fallback to keywords
    const isHotLead = aiResult.hotLead?.isHotLead || keywordMatches.length > 0;
    const hotLeadScore = aiResult.hotLead?.score || (keywordMatches.length * 25);
```

with:

```js
    // Keywords may only nudge (capped at 45 < hot threshold 60) — only the
    // AI scorer can mark a lead hot.
    const { matches: keywordMatches, score: keywordScore } = scoreKeywordMatches(text);
    const isHotLead = aiResult.hotLead?.isHotLead || false;
    const hotLeadScore = aiResult.hotLead?.score || keywordScore;
```

(If later lines reference `keywordMatches`, they still work — same name, same shape.)

- [ ] **Step 8: Verify build + tests**

Run: `npm test` → PASS. Run: `npx next build` → compiles without errors.

- [ ] **Step 9: Commit and push**

```bash
git add lib/hot-lead-keywords.js tests/hot-lead-keywords.test.mjs lib/ai-service.js app/api/email/webhook/route.js package.json
git commit -m "De-fang hot-lead keywords: everyday words removed, keyword score capped below hot threshold (shared module + tests)"
git push
```

---

### Task 2: Triage core — classes, decision rule, prompt builder, conservative reply

Pure logic only, no DB and no network beyond the OpenAI client object (unused in tests). This file is what the eval script and tests import, so it must NOT import `./database.js`.

**Files:**
- Create: `lib/intent-triage.js`
- Create: `tests/intent-triage.test.mjs`

**Interfaces:**
- Produces (consumed by Tasks 3–6 and the eval script):
  - `TRIAGE_CLASSES: string[]`
  - `conservativeReply(businessName: string) → string`
  - `decideAction(classification: {class, confidence}, opts?: {threadAlreadyFlagged?: boolean}) → { action: 'reply'|'conservative_reply'|'flag'|'skip' }`
  - `buildTriagePrompt(signals) → { system: string, user: string }` where `signals = { subject, body, fromEmail, fromName, isReplyToOurThread, isExistingContact, contactSummary, businessName, industry, businessDescription, corrections: [{fromEmail, subject, bodySnippet, correctedClass}] }`
  - `classifyEmailIntent(signals) → Promise<{ class, confidence, reason, model }>`

- [ ] **Step 1: Write the failing tests**

Create `tests/intent-triage.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRIAGE_CLASSES,
  conservativeReply,
  decideAction,
  buildTriagePrompt,
} from '../lib/intent-triage.js';

test('the five triage classes exist exactly', () => {
  assert.deepEqual(
    [...TRIAGE_CLASSES].sort(),
    ['ambiguous', 'automated', 'business_correspondence', 'existing_lead_reply', 'new_lead']
  );
});

test('only high-confidence lead classes earn an automatic reply', () => {
  assert.equal(decideAction({ class: 'new_lead', confidence: 'high' }).action, 'reply');
  assert.equal(decideAction({ class: 'existing_lead_reply', confidence: 'high' }).action, 'reply');
});

test('high-confidence business correspondence is flagged, never replied to', () => {
  assert.equal(decideAction({ class: 'business_correspondence', confidence: 'high' }).action, 'flag');
});

test('high-confidence automated is skipped silently', () => {
  assert.equal(decideAction({ class: 'automated', confidence: 'high' }).action, 'skip');
});

test('ALL uncertainty routes to the conservative reply + flag', () => {
  // medium/low confidence of ANY class, and the ambiguous class at any confidence
  assert.equal(decideAction({ class: 'new_lead', confidence: 'medium' }).action, 'conservative_reply');
  assert.equal(decideAction({ class: 'business_correspondence', confidence: 'low' }).action, 'conservative_reply');
  assert.equal(decideAction({ class: 'ambiguous', confidence: 'high' }).action, 'conservative_reply');
  assert.equal(decideAction({ class: 'automated', confidence: 'medium' }).action, 'conservative_reply');
});

test('an already-flagged thread never gets a second automatic reply', () => {
  const result = decideAction(
    { class: 'ambiguous', confidence: 'low' },
    { threadAlreadyFlagged: true }
  );
  assert.equal(result.action, 'flag');
});

test('garbage classification fails safe to conservative reply', () => {
  assert.equal(decideAction({ class: 'banana', confidence: 'high' }).action, 'conservative_reply');
  assert.equal(decideAction({}).action, 'conservative_reply');
});

test('conservative reply is content-free and carries the business name', () => {
  const reply = conservativeReply('Sunrise Solar');
  assert.ok(reply.includes('Sunrise Solar'));
  assert.ok(reply.includes('?'));           // asks a question
  assert.ok(!/price|quote|\$|book/i.test(reply)); // promises nothing
});

test('prompt includes the rich signals', () => {
  const { system, user } = buildTriagePrompt({
    subject: 'Wholesale panel pricing',
    body: 'We manufacture panels and would like to offer wholesale pricing.',
    fromEmail: 'sales@panelcorp.com',
    fromName: 'Panel Corp',
    isReplyToOurThread: false,
    isExistingContact: false,
    contactSummary: '',
    businessName: 'Sunrise Solar',
    industry: 'Solar installation',
    businessDescription: 'Residential solar installer',
    corrections: [{ fromEmail: 'joe@vendor.com', subject: 'Invoice', bodySnippet: 'attached invoice', correctedClass: 'business_correspondence' }],
  });
  assert.ok(system.includes('new_lead'));
  assert.ok(system.includes('business_correspondence'));
  assert.ok(user.includes('Sunrise Solar'));
  assert.ok(user.includes('sales@panelcorp.com'));
  assert.ok(user.includes('role address'));          // sales@ detected
  assert.ok(user.includes('corporate domain'));      // not freemail
  assert.ok(user.includes('joe@vendor.com'));        // correction injected
  assert.ok(user.includes('Wholesale panel pricing'));
});

test('prompt flags freemail senders and replies to our own threads', () => {
  const { user } = buildTriagePrompt({
    subject: 'Re: your quote',
    body: 'Sounds good, when can you come out?',
    fromEmail: 'jane.doe@gmail.com',
    fromName: 'Jane Doe',
    isReplyToOurThread: true,
    isExistingContact: true,
    contactSummary: 'Existing contact, lead score 55 (warm)',
    businessName: 'Sunrise Solar',
    industry: '',
    businessDescription: '',
    corrections: [],
  });
  assert.ok(user.includes('personal/freemail'));
  assert.ok(user.includes('REPLY to a thread'));
  assert.ok(user.includes('lead score 55'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../lib/intent-triage.js'`

- [ ] **Step 3: Write the core module**

Create `lib/intent-triage.js`:

```js
// lib/intent-triage.js
// Email intent triage CORE — pure logic + OpenAI classification. No database
// imports (the eval script and tests import this file standalone; DB work
// lives in lib/intent-triage-store.js).
//
// Design principle — ASYMMETRIC CAUTION: wrongly auto-replying to business
// correspondence is a reputation wound; wrongly flagging a real lead costs
// hours and stays visible. All uncertainty routes to flag-first. An automatic
// reply requires a high-confidence lead classification; nothing else earns one.
// Spec: docs/superpowers/specs/2026-07-19-intent-triage-design.md

import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const TRIAGE_CLASSES = [
  'new_lead',
  'existing_lead_reply',
  'business_correspondence',
  'automated',
  'ambiguous',
];

const CONFIDENCE_LEVELS = ['high', 'medium', 'low'];

export function conservativeReply(businessName) {
  const name = (businessName || '').trim() || 'us';
  return `Thanks for reaching out to ${name} — happy to help! Could you share a bit more about what you're looking for?`;
}

/**
 * The single routing rule. Only high-confidence lead classes auto-reply;
 * high-confidence business correspondence is flagged; high-confidence
 * automated is skipped; EVERYTHING else (ambiguous class, medium/low
 * confidence, malformed input) gets one conservative reply + flag — unless
 * the thread is already flagged, in which case flag only (never a second
 * automatic reply on a flagged thread).
 */
export function decideAction(classification = {}, { threadAlreadyFlagged = false } = {}) {
  const cls = classification.class;
  const confidence = classification.confidence;

  if (confidence === 'high' && (cls === 'new_lead' || cls === 'existing_lead_reply')) {
    return { action: 'reply' };
  }
  if (confidence === 'high' && cls === 'business_correspondence') {
    return { action: 'flag' };
  }
  if (confidence === 'high' && cls === 'automated') {
    return { action: 'skip' };
  }
  // Ambiguous handling (includes garbage/malformed classifications — fail safe)
  if (threadAlreadyFlagged) return { action: 'flag' };
  return { action: 'conservative_reply' };
}

const FREEMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
  'icloud.com', 'me.com', 'msn.com', 'live.com', 'proton.me', 'protonmail.com',
];

const ROLE_ADDRESSES = [
  'support', 'billing', 'sales', 'info', 'admin', 'accounts', 'accounting',
  'hr', 'careers', 'jobs', 'legal', 'invoices', 'help', 'service',
  'noreply', 'no-reply', 'team', 'office', 'contact',
];

function describeSender(fromEmail = '') {
  const email = fromEmail.toLowerCase();
  const [localPart, domain = ''] = email.split('@');
  const traits = [];
  traits.push(
    FREEMAIL_DOMAINS.includes(domain)
      ? 'personal/freemail domain (individual person — consumers writing from these are often genuine leads)'
      : `corporate domain (${domain || 'unknown'})`
  );
  if (ROLE_ADDRESSES.includes(localPart)) {
    traits.push(`role address ("${localPart}@" — typically a company function like support/billing/sales, not a consumer inquiry)`);
  }
  return traits.join('; ');
}

/**
 * Builds the classification prompt from the gathered signals.
 * signals: { subject, body, fromEmail, fromName, isReplyToOurThread,
 *            isExistingContact, contactSummary, businessName, industry,
 *            businessDescription, corrections }
 */
export function buildTriagePrompt(signals) {
  const {
    subject = '', body = '', fromEmail = '', fromName = '',
    isReplyToOurThread = false, isExistingContact = false, contactSummary = '',
    businessName = '', industry = '', businessDescription = '',
    corrections = [],
  } = signals || {};

  const system = `You classify inbound email for a small business's AI assistant. The assistant may ONLY auto-reply to genuine sales leads — misclassifying company correspondence as a lead (and pitching services to, say, a support engineer) damages the business's reputation.

Classify the email into exactly one class:
- "new_lead": a prospective CUSTOMER of this business asking about its services — a genuine inquiry this business would want to win (what counts as a lead depends on the business profile below: someone BUYING what this business sells, not someone SELLING to it).
- "existing_lead_reply": a reply from a known lead continuing an existing sales conversation.
- "business_correspondence": vendors, suppliers, wholesale offers, customer-support agents of OTHER companies replying to this business, partners, recruiting, legal, invoices owed BY the business, platform/account notices written by a human. Never something to auto-reply to.
- "automated": newsletters, receipts, automated notifications, marketing blasts, no-reply machinery.
- "ambiguous": too little content to tell (terse notes, bare "call me", unclear intent).

Confidence rules (asymmetric caution): use "high" only when the evidence is strong and consistent. If a reasonable person could read the email either way, use "medium" or "low". It is far worse to call business correspondence a lead than to be unsure.

Reply with STRICT JSON only: {"class": "<one class>", "confidence": "high"|"medium"|"low", "reason": "<one short sentence>"}`;

  let user = `THE BUSINESS RECEIVING THIS EMAIL:
- Name: ${businessName || 'unknown'}`;
  if (industry) user += `\n- Industry: ${industry}`;
  if (businessDescription) user += `\n- What they do: ${businessDescription.slice(0, 400)}`;

  user += `\n\nSENDER:
- From: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}
- Sender traits: ${describeSender(fromEmail)}
- ${isReplyToOurThread ? 'This IS a REPLY to a thread our assistant already participated in.' : 'This is NOT a reply to any thread of ours (fresh inbound).'}
- ${isExistingContact ? `Sender is a KNOWN contact. ${contactSummary}`.trim() : 'Sender is not a known contact.'}`;

  if (Array.isArray(corrections) && corrections.length > 0) {
    user += `\n\nOWNER CORRECTIONS (ground truth this business owner gave on past classifications — weigh these heavily for similar emails):`;
    for (const c of corrections.slice(0, 10)) {
      user += `\n- From ${c.fromEmail} | Subject: "${(c.subject || '').slice(0, 80)}" | "${(c.bodySnippet || '').slice(0, 120)}" → correct class: ${c.correctedClass}`;
    }
  }

  user += `\n\nTHE EMAIL:
Subject: ${subject.slice(0, 300)}
Body:
${(body || '').slice(0, 2500)}`;

  return { system, user };
}

async function runClassifierModel(model, system, user) {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 150,
    temperature: 0.1,
  });
  const raw = JSON.parse(completion.choices[0].message.content);
  const cls = TRIAGE_CLASSES.includes(raw.class) ? raw.class : 'ambiguous';
  const confidence = CONFIDENCE_LEVELS.includes(raw.confidence) ? raw.confidence : 'low';
  return { class: cls, confidence, reason: String(raw.reason || '').slice(0, 300), model };
}

/**
 * Two-tier classification: gpt-4o-mini first; anything short of high
 * confidence gets one second opinion from gpt-4o, which is final.
 * Fails safe: any error returns ambiguous/low (→ conservative reply + flag).
 */
export async function classifyEmailIntent(signals) {
  if (!openai) {
    return { class: 'ambiguous', confidence: 'low', reason: 'OpenAI not configured', model: 'none' };
  }
  const { system, user } = buildTriagePrompt(signals);
  try {
    const first = await runClassifierModel('gpt-4o-mini', system, user);
    if (first.confidence === 'high') return first;
    try {
      const second = await runClassifierModel('gpt-4o', system, user);
      return second;
    } catch (secondErr) {
      console.error('⚠️ [TRIAGE] gpt-4o second opinion failed, using first-tier result:', secondErr.message);
      return first; // non-high confidence → still routes to conservative handling
    }
  } catch (err) {
    console.error('❌ [TRIAGE] classification failed — failing safe to ambiguous:', err.message);
    return { class: 'ambiguous', confidence: 'low', reason: `classifier error: ${err.message}`.slice(0, 300), model: 'error' };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests from Tasks 1–2)

- [ ] **Step 5: Commit and push**

```bash
git add lib/intent-triage.js tests/intent-triage.test.mjs
git commit -m "Intent triage core: 5 classes, asymmetric-caution routing, rich-signal prompt, two-tier classifier"
git push
```

---

### Task 3: Triage store — `email_triage` table, signals, corrections, `runTriage()` orchestrator

**Files:**
- Create: `lib/intent-triage-store.js`

**Interfaces:**
- Consumes: `classifyEmailIntent`, `decideAction` from `lib/intent-triage.js`; `query` from `lib/database.js`.
- Produces (consumed by Tasks 5–7):
  - `runTriage({ customerId, channel, messageId, threadId, fromEmail, fromName, subject, body, isReplyToOurThread }) → Promise<{ action, classification: {class, confidence, reason, model}, businessName, reused: boolean }>`
  - `recordCorrection({ customerId, channel, messageId, correctedClass }) → Promise<{ success, notFound? }>`
  - `getTriageForCustomer(customerId, limit = 100) → Promise<rows>`
  - `ensureTriageTable() → Promise<void>`
- Table `email_triage`: `id, customer_id, channel ('gmail'|'outlook'), message_id (UNIQUE), thread_id, contact_email, contact_name, subject, body_snippet, class, confidence, reason, model, action ('replied'|'conservative_reply'|'flagged'|'skipped'), corrected_class, corrected_at, created_at`. A row is "flagged/Left for you" when `action IN ('flagged','conservative_reply') AND corrected_class IS NULL`.

- [ ] **Step 1: Write the store module**

(No isolated unit test — every function is a thin DB wrapper; behavior is covered by the eval script in Task 4 and live verification in Tasks 5–6. The pure logic it orchestrates is already tested.)

Create `lib/intent-triage-store.js`:

```js
// lib/intent-triage-store.js
// DB side of email intent triage: the email_triage table, per-customer signal
// gathering, owner corrections (few-shot examples), and the runTriage()
// orchestrator the email monitors call before any reply is generated.

import { query } from './database.js';
import { classifyEmailIntent, decideAction } from './intent-triage.js';

export async function ensureTriageTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS email_triage (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      channel TEXT,
      message_id TEXT UNIQUE,
      thread_id TEXT,
      contact_email TEXT,
      contact_name TEXT,
      subject TEXT,
      body_snippet TEXT,
      class TEXT,
      confidence TEXT,
      reason TEXT,
      model TEXT,
      action TEXT,
      corrected_class TEXT,
      corrected_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}

async function getTriageRecord(channel, messageId) {
  const result = await query(
    `SELECT * FROM email_triage WHERE channel = $1 AND message_id = $2 LIMIT 1`,
    [channel, messageId]
  ).catch(() => ({ rows: [] }));
  return result.rows[0] || null;
}

async function isThreadFlagged(customerId, channel, threadId) {
  if (!threadId) return false;
  const result = await query(
    `SELECT id FROM email_triage
     WHERE customer_id = $1 AND channel = $2 AND thread_id = $3
       AND action IN ('flagged', 'conservative_reply')
       AND corrected_class IS NULL
     LIMIT 1`,
    [customerId, channel, threadId]
  ).catch(() => ({ rows: [] }));
  return result.rows.length > 0;
}

async function getCorrections(customerId, limit = 10) {
  const result = await query(
    `SELECT contact_email, subject, body_snippet, corrected_class
     FROM email_triage
     WHERE customer_id = $1 AND corrected_class IS NOT NULL
     ORDER BY corrected_at DESC
     LIMIT $2`,
    [customerId, limit]
  ).catch(() => ({ rows: [] }));
  return result.rows.map(r => ({
    fromEmail: r.contact_email,
    subject: r.subject,
    bodySnippet: r.body_snippet,
    correctedClass: r.corrected_class,
  }));
}

async function gatherTriageSignals({ customerId, fromEmail, fromName, subject, body, isReplyToOurThread }) {
  // Business profile: who is this business, so "lead" is defined per-business
  const bizResult = await query(
    `SELECT c.business_name, acs.industry, acs.business_description
     FROM customers c
     LEFT JOIN ai_channel_settings acs ON acs.customer_id = c.id AND acs.channel = 'email'
     WHERE c.id = $1
     LIMIT 1`,
    [customerId]
  ).catch(() => ({ rows: [] }));
  const biz = bizResult.rows[0] || {};

  // Is the sender a contact we already know?
  const contactResult = await query(
    `SELECT id, name, lead_score, temperature FROM contacts
     WHERE customer_id = $1 AND LOWER(email) = LOWER($2)
     LIMIT 1`,
    [customerId, fromEmail]
  ).catch(() => ({ rows: [] }));
  const contact = contactResult.rows[0] || null;

  const corrections = await getCorrections(customerId);

  return {
    subject,
    body,
    fromEmail,
    fromName,
    isReplyToOurThread: !!isReplyToOurThread,
    isExistingContact: !!contact,
    contactSummary: contact
      ? `Known contact${contact.name ? ` "${contact.name}"` : ''}, lead score ${contact.lead_score ?? 'unknown'} (${contact.temperature || 'unknown'}).`
      : '',
    businessName: biz.business_name || '',
    industry: biz.industry || '',
    businessDescription: biz.business_description || '',
    corrections,
  };
}

/**
 * The one entry point the email monitors call BEFORE generating any reply.
 * Idempotent per message: a message already triaged returns its stored result
 * (no duplicate OpenAI spend, stable decisions across cron re-runs).
 */
export async function runTriage(input) {
  const { customerId, channel, messageId, threadId, fromEmail, fromName, subject, body, isReplyToOurThread } = input;

  await ensureTriageTable();

  const existing = await getTriageRecord(channel, messageId);
  if (existing) {
    return {
      action: existing.action,
      classification: {
        class: existing.class,
        confidence: existing.confidence,
        reason: existing.reason,
        model: existing.model,
      },
      businessName: '', // callers only need this on first classification
      reused: true,
    };
  }

  const signals = await gatherTriageSignals({ customerId, fromEmail, fromName, subject, body, isReplyToOurThread });
  const classification = await classifyEmailIntent(signals);
  const threadAlreadyFlagged = await isThreadFlagged(customerId, channel, threadId);
  const { action } = decideAction(classification, { threadAlreadyFlagged });

  // Store 'replied' for the reply action so the row reads as an outcome log
  const storedAction =
    action === 'reply' ? 'replied'
    : action === 'skip' ? 'skipped'
    : action === 'flag' ? 'flagged'
    : action;

  await query(
    `INSERT INTO email_triage
       (customer_id, channel, message_id, thread_id, contact_email, contact_name,
        subject, body_snippet, class, confidence, reason, model, action)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (message_id) DO NOTHING`,
    [customerId, channel, messageId, threadId || null, fromEmail, fromName || null,
     (subject || '').slice(0, 500), (body || '').slice(0, 500),
     classification.class, classification.confidence, classification.reason,
     classification.model, storedAction]
  ).catch(err => console.error('⚠️ [TRIAGE] failed to record triage row:', err.message));

  console.log(`🧠 [TRIAGE] ${channel} ${fromEmail}: ${classification.class}/${classification.confidence} → ${action} (${classification.reason})`);

  return { action, classification, businessName: signals.businessName, reused: false };
}

/** Owner one-click correction: "This was a lead" / "Not a lead". */
export async function recordCorrection({ customerId, channel, messageId, correctedClass }) {
  await ensureTriageTable();
  const result = await query(
    `UPDATE email_triage
     SET corrected_class = $1, corrected_at = NOW()
     WHERE customer_id = $2 AND channel = $3 AND message_id = $4
     RETURNING id`,
    [correctedClass, customerId, channel, messageId]
  ).catch(() => ({ rows: [] }));
  if (result.rows.length === 0) return { success: false, notFound: true };
  return { success: true };
}

/** All recent triage results for a customer (inbox overlay + flag list). */
export async function getTriageForCustomer(customerId, limit = 100) {
  await ensureTriageTable();
  const result = await query(
    `SELECT channel, message_id, thread_id, contact_email, subject,
            class, confidence, reason, action, corrected_class, created_at
     FROM email_triage
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [customerId, limit]
  ).catch(() => ({ rows: [] }));
  return result.rows;
}
```

- [ ] **Step 2: Verify build + tests still pass**

Run: `npm test` → PASS. Run: `npx next build` → compiles.

- [ ] **Step 3: Commit and push**

```bash
git add lib/intent-triage-store.js
git commit -m "Intent triage store: email_triage table, per-customer signals + corrections, runTriage orchestrator"
git push
```

---

### Task 4: Labeled eval set + eval script — the go-live gate

Quality is a number, not a feeling. The classifier does not gate real traffic until it clears this set, and every future prompt change re-runs the same script.

**Files:**
- Create: `scripts/triage-eval-set.json`
- Create: `scripts/triage-eval.mjs`

**Interfaces:**
- Consumes: `classifyEmailIntent` from `lib/intent-triage.js` (core only — no DB import, so the script runs anywhere with `OPENAI_API_KEY`).
- Produces: console report (per-class accuracy + confusion detail) and exit code 0/1. Pass criteria (Global Constraints): business_correspondence recall 100%, zero business_correspondence → high-confidence lead, overall ≥90%.

- [ ] **Step 1: Write the labeled eval set**

Create `scripts/triage-eval-set.json`. The `business` block simulates a solar installer (mirrors the live test persona — and the Microsoft Support incident happened against exactly this profile). `signals` defaults: `isReplyToOurThread: false`, `isExistingContact: false` unless stated.

```json
{
  "business": {
    "businessName": "Sunrise Solar",
    "industry": "Residential solar installation",
    "businessDescription": "We design and install rooftop solar systems for homeowners, including free site assessments and financing options."
  },
  "emails": [
    { "id": "ms-support-replay", "label": "business_correspondence", "fromEmail": "support@microsoft.com", "fromName": "Microsoft Support", "subject": "RE: Your Microsoft 365 support request 2607110040000834", "body": "Hello, thank you for contacting Microsoft Support. Following up on your case regarding outbound email restrictions on your tenant. We have reviewed the mailbox configuration and need you to confirm the affected addresses so we can proceed. Please reply with the information at your earliest convenience so we can help resolve this issue. Best regards, Microsoft Support Engineer" },
    { "id": "vendor-wholesale", "label": "business_correspondence", "fromEmail": "sales@brightpanel.com", "fromName": "BrightPanel Manufacturing", "subject": "Wholesale panel pricing for your installs", "body": "Hi, we manufacture tier-1 solar panels and would love to become your supplier. Our wholesale pricing beats your current distributor by 12%. Can we schedule a call to discuss a partnership?" },
    { "id": "recruiter", "label": "business_correspondence", "fromEmail": "talent@hirewise.io", "fromName": "HireWise Recruiting", "subject": "Great installer candidates available this month", "body": "Hello! We specialize in staffing for solar companies and currently have three certified installers looking for placement in your area. Would you be open to a quick chat about your hiring needs?" },
    { "id": "twilio-support-reply", "label": "business_correspondence", "fromEmail": "help@twilio.com", "fromName": "Twilio Support", "subject": "RE: Ticket 4482913 — toll-free verification status", "body": "Hi, this is a follow-up on your open support ticket. Your toll-free verification is still in review with our carrier partners. We will update you when the status changes. Let us know if you have questions about your case." },
    { "id": "supplier-invoice-human", "label": "business_correspondence", "fromEmail": "amanda@solardistrib.com", "fromName": "Amanda Reyes", "subject": "Past due: invoice 10441", "body": "Hi, just following up on invoice 10441 for the March panel order — it shows as unpaid on our end. Could you check with your accounting and let me know when we can expect payment? Thanks, Amanda, Accounts Receivable, Solar Distribution Co." },
    { "id": "partnership-pitch", "label": "business_correspondence", "fromEmail": "bd@roofpro.com", "fromName": "RoofPro Exteriors", "subject": "Referral partnership between our companies", "body": "Hey there — we're a roofing company working the same neighborhoods as you. Lots of our re-roof customers ask about solar. Want to set up a mutual referral arrangement? We could send each other qualified jobs." },
    { "id": "saas-renewal-human", "label": "business_correspondence", "fromEmail": "csm@fieldsoftware.com", "fromName": "Kyle from FieldSoftware", "subject": "Your annual plan renews next month", "body": "Hi! I'm your account manager at FieldSoftware. Your annual subscription renews on the 15th. I'd love to walk you through the new scheduling features before then — do you have 20 minutes this week?" },
    { "id": "legal-notice", "label": "business_correspondence", "fromEmail": "compliance@stateboard.gov", "fromName": "State Contractor Board", "subject": "Action required: license renewal documentation", "body": "This notice is to inform you that your contractor license renewal requires updated proof of insurance. Please submit the required documentation within 30 days to avoid a lapse in licensure. Contact our office with any questions." },
    { "id": "clear-lead-quote", "label": "new_lead", "fromEmail": "jenny.morales88@gmail.com", "fromName": "Jenny Morales", "subject": "Quote for solar on my house?", "body": "Hi! We just bought a home in Chester and our electric bills are crazy. How much would it cost to get solar panels installed on a 2,100 sq ft house? Do you do free estimates?" },
    { "id": "clear-lead-financing", "label": "new_lead", "fromEmail": "dwayne.p@yahoo.com", "fromName": "Dwayne P", "subject": "Financing options", "body": "Saw your truck in my neighborhood. Do you offer financing or leasing for solar? My roof is about 10 years old, is that a problem? Would like to talk to someone about getting this done before summer." },
    { "id": "clear-lead-corporate-sender", "label": "new_lead", "fromEmail": "mark.chen@acmelogistics.com", "fromName": "Mark Chen", "subject": "Solar for my home", "body": "Hi, writing from my work email — my wife and I are interested in getting a site assessment for our house on Riverside Dr. What does your schedule look like next week?" },
    { "id": "clear-lead-referral", "label": "new_lead", "fromEmail": "tbaker1962@aol.com", "fromName": "Tom Baker", "subject": "My neighbor recommended you", "body": "The Hendersons on my street had you install their panels last spring and they can't stop talking about the savings. I'd like to find out what a system would run me. When could someone come take a look?" },
    { "id": "lead-detailed-question", "label": "new_lead", "fromEmail": "priya.n@icloud.com", "fromName": "Priya N", "subject": "Battery backup question", "body": "Hello — we lose power a few times every winter. If we get solar through you, can you also install battery backup so the house stays on during outages? What brands do you carry and roughly what does a system with batteries cost?" },
    { "id": "lead-ready-to-book", "label": "new_lead", "fromEmail": "sgutierrez.home@gmail.com", "fromName": "Sofia Gutierrez", "subject": "Ready to schedule the site visit", "body": "Hi, I filled out the form on your website last night. I'd like to go ahead and schedule the free site assessment. I'm available weekday afternoons. What times do you have?" },
    { "id": "existing-lead-scheduling", "label": "existing_lead_reply", "signals": { "isReplyToOurThread": true, "isExistingContact": true, "contactSummary": "Known contact \"Rachel Kim\", lead score 65 (hot)." }, "fromEmail": "rachel.kim@gmail.com", "fromName": "Rachel Kim", "subject": "Re: Your solar quote from Sunrise Solar", "body": "Thanks for the breakdown! The 8kW option makes sense for us. Tuesday at 2pm works for the site visit — see you then." },
    { "id": "existing-lead-question", "label": "existing_lead_reply", "signals": { "isReplyToOurThread": true, "isExistingContact": true, "contactSummary": "Known contact \"Bill Ford\", lead score 50 (warm)." }, "fromEmail": "bford.home@hotmail.com", "fromName": "Bill Ford", "subject": "Re: Following up on your solar questions", "body": "One more question before we decide — does the warranty cover the inverter too, or just the panels?" },
    { "id": "existing-lead-delay", "label": "existing_lead_reply", "signals": { "isReplyToOurThread": true, "isExistingContact": true, "contactSummary": "Known contact \"Dana S\", lead score 45 (warm)." }, "fromEmail": "dana.s.home@gmail.com", "fromName": "Dana S", "subject": "Re: Checking in from Sunrise Solar", "body": "Hey, sorry for the slow reply — we've been traveling. Still very interested, can we pick this back up next month when we're home?" },
    { "id": "newsletter-slipped", "label": "automated", "fromEmail": "digest@solarindustrynews.com", "fromName": "Solar Industry News", "subject": "This week in solar: policy changes and panel prices", "body": "Your weekly roundup: Federal tax credit guidance updated. Panel prices dip 3% quarter over quarter. Top installers by state ranked. Read the full stories on our site." },
    { "id": "receipt-human-looking", "label": "automated", "fromEmail": "orders@toolsupplyco.com", "fromName": "Tool Supply Co", "subject": "Order 88214 confirmation", "body": "Thanks for your purchase! Your order of 2x torque wrench sets has shipped and will arrive Thursday. Track your package using the link in your account." },
    { "id": "webinar-invite", "label": "automated", "fromEmail": "events@solarconf.com", "fromName": "SolarCon Events", "subject": "You're invited: scaling your installation business", "body": "Join 5,000 installers at our annual virtual summit. Early bird tickets end Friday. Register now to save your seat and get the session recordings." },
    { "id": "terse-call-me", "label": "ambiguous", "fromEmail": "jm4482@gmail.com", "fromName": "", "subject": "", "body": "call me 804-555-0182" },
    { "id": "terse-how-much", "label": "ambiguous", "fromEmail": "kdog.racing@yahoo.com", "fromName": "K", "subject": "question", "body": "how much" },
    { "id": "unclear-forward", "label": "ambiguous", "fromEmail": "linda.hayes@gmail.com", "fromName": "Linda Hayes", "subject": "FW: the thing we discussed", "body": "See below. Thoughts?" },
    { "id": "unclear-oneword", "label": "ambiguous", "fromEmail": "info@chesterchamber.org", "fromName": "Chester Chamber", "subject": "Quick question", "body": "Are you the right person to talk to about this?" }
  ]
}
```

24 emails: 8 business_correspondence, 6 new_lead, 3 existing_lead_reply, 3 automated, 4 ambiguous. **The founder reviews these labels before the eval verdict counts** (they are the ground truth; the "ms-support-replay" entry reconstructs the real incident).

- [ ] **Step 2: Write the eval script**

Create `scripts/triage-eval.mjs`:

```js
#!/usr/bin/env node
// Eval gate for the email intent-triage classifier.
// Usage: node scripts/triage-eval.mjs
// Requires OPENAI_API_KEY (reads .env.local if present).
// Pass criteria (spec): business_correspondence recall 100% on this set,
// ZERO business_correspondence classified as a high-confidence lead,
// overall accuracy >= 90%. Exit 0 on pass, 1 on fail.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env.local loader (no dotenv dependency in this project)
const envPath = join(root, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set (checked env + .env.local). Cannot run eval.');
  process.exit(1);
}

const { classifyEmailIntent } = await import('../lib/intent-triage.js');

const { business, emails } = JSON.parse(readFileSync(join(root, 'scripts', 'triage-eval-set.json'), 'utf8'));

const results = [];
for (const email of emails) {
  const signals = {
    subject: email.subject,
    body: email.body,
    fromEmail: email.fromEmail,
    fromName: email.fromName,
    isReplyToOurThread: false,
    isExistingContact: false,
    contactSummary: '',
    corrections: [],
    ...business,
    ...(email.signals || {}),
  };
  const got = await classifyEmailIntent(signals);
  const correct = got.class === email.label;
  results.push({ id: email.id, expected: email.label, got: got.class, confidence: got.confidence, model: got.model, correct, reason: got.reason });
  console.log(`${correct ? '✅' : '❌'} ${email.id}: expected ${email.label}, got ${got.class}/${got.confidence} [${got.model}] — ${got.reason}`);
}

// ── Report ──────────────────────────────────────────────────────────────────
const classes = ['new_lead', 'existing_lead_reply', 'business_correspondence', 'automated', 'ambiguous'];
console.log('\nPer-class accuracy:');
for (const cls of classes) {
  const ofClass = results.filter(r => r.expected === cls);
  if (ofClass.length === 0) continue;
  const right = ofClass.filter(r => r.correct).length;
  console.log(`  ${cls}: ${right}/${ofClass.length} (${Math.round((right / ofClass.length) * 100)}%)`);
}

const overall = results.filter(r => r.correct).length / results.length;
console.log(`\nOverall: ${results.filter(r => r.correct).length}/${results.length} (${Math.round(overall * 100)}%)`);

const bc = results.filter(r => r.expected === 'business_correspondence');
const bcMisses = bc.filter(r => !r.correct);
const bcAsHighLead = bc.filter(r =>
  ['new_lead', 'existing_lead_reply'].includes(r.got) && r.confidence === 'high'
);

console.log('\nGate checks:');
console.log(`  business_correspondence recall 100%: ${bcMisses.length === 0 ? 'PASS' : `FAIL (missed: ${bcMisses.map(r => r.id).join(', ')})`}`);
console.log(`  zero bc → high-confidence lead:      ${bcAsHighLead.length === 0 ? 'PASS' : `FAIL (${bcAsHighLead.map(r => r.id).join(', ')})`}`);
console.log(`  overall >= 90%:                      ${overall >= 0.9 ? 'PASS' : 'FAIL'}`);

const pass = bcMisses.length === 0 && bcAsHighLead.length === 0 && overall >= 0.9;
console.log(`\n${pass ? '🟢 EVAL PASSED — classifier may gate real traffic.' : '🔴 EVAL FAILED — do NOT wire the classifier to live email.'}`);
process.exit(pass ? 0 : 1);
```

- [ ] **Step 3: Run the eval**

Run: `node scripts/triage-eval.mjs`
Expected: per-email lines, per-class accuracy, and `🟢 EVAL PASSED`.

- [ ] **Step 4: If the eval fails, tune the prompt — not the labels**

Adjust the wording in `buildTriagePrompt` in `lib/intent-triage.js` (e.g., sharpen a class definition that's being confused), re-run `node scripts/triage-eval.mjs` after each change until it passes. Only change a label in the eval set if the label itself is wrong AND the founder agrees. Re-run `npm test` after any prompt edit (the prompt tests check signal presence, not exact wording — they should stay green).

Note on the ambiguous class: a misclassification between `ambiguous` and `new_lead` at NON-high confidence is behaviorally identical (both → conservative reply + flag). If a failure is exactly that pattern, it still counts against overall accuracy but is low-stakes — spend tuning effort on business_correspondence confusion first.

- [ ] **Step 5: Commit and push (only after the eval passes)**

```bash
git add scripts/triage-eval-set.json scripts/triage-eval.mjs
git commit -m "Triage eval gate: 24-email labeled set + accuracy script (bc recall 100% + overall >=90% required)"
git push
```

---

### Task 5: Wire triage into the Outlook monitor

The Outlook monitor is the fully-automatic replier (hourly cron + on-demand). Triage runs after the automated-sender pre-filter and before any AI generation.

**Files:**
- Modify: `app/api/outlook/monitor/route.js` (the message loop inside `processAccount`, lines 147–303)

**Interfaces:**
- Consumes: `runTriage` from `lib/intent-triage-store.js`; `conservativeReply` from `lib/intent-triage.js`.
- Produces: flagged emails now exist as `outlook_messages` rows with `ai_response = NULL` (so `alreadyProcessed` dedup stops hourly reprocessing, and Task 7's inbox join can show them). Flagged messages are NOT marked read in Outlook — the owner sees them unread in their real mailbox.

- [ ] **Step 1: Add imports**

At the top of `app/api/outlook/monitor/route.js`, add:

```js
import { runTriage } from '@/lib/intent-triage-store.js';
import { conservativeReply } from '@/lib/intent-triage.js';
```

- [ ] **Step 2: Replace the message-loop body**

Replace the entire `for (const msg of messages) { ... }` loop body in `processAccount` (lines 147–303) with the version below. What changed: (a) thread history moves up so `isReplyToOurThread` is known before classifying; (b) `runTriage` gates everything; (c) `skip`/`flag` claim a NULL-reply message row and continue; (d) `conservative_reply` sends the template without calling the AI; (e) contact creation and hot-lead alerts only run for real lead replies and the conservative case.

```js
  for (const msg of messages) {
    try {
      const fromEmail = msg.from?.emailAddress?.address || '';
      const fromName = msg.from?.emailAddress?.name || '';
      diag.senders.push(fromEmail);

      if (await alreadyProcessed(msg.id)) { diag.skippedProcessed++; continue; }

      // Skip emails sent to yourself (own replies)
      if (fromEmail.toLowerCase() === conn.outlook_email.toLowerCase()) { diag.skippedSelf++; continue; }

      // Filter out automated senders. checkEmailFilter expects an object
      // (same shape Gmail uses) and returns { shouldFilter }.
      const bodyText = msg.body?.content?.replace(/<[^>]*>/g, ' ').trim() || '';
      const filterResult = await checkEmailFilter({
        from: fromEmail,
        subject: msg.subject || '',
        body: bodyText,
        headers: {},
        isMassEmail: false,
      });
      if (filterResult?.shouldFilter) {
        console.log(`⏭️ Outlook skipping automated email from ${fromEmail}`);
        diag.skippedAutomated++;
        continue;
      }

      // Get/build conversation history for this thread (also tells triage
      // whether this is a reply to a thread the AI already participated in)
      const threadMessages = await query(
        `SELECT content, ai_response FROM outlook_messages om
         JOIN outlook_conversations oc ON oc.id = om.conversation_id
         WHERE oc.conversation_id = $1 AND oc.clerk_user_id = $2
         ORDER BY om.sent_at ASC LIMIT 10`,
        [msg.conversationId, customer.clerk_user_id]
      ).catch(() => ({ rows: [] }));

      const history = threadMessages.rows.flatMap(r => [
        { role: 'user', content: r.content },
        { role: 'assistant', content: r.ai_response },
      ]).filter(m => m.content);

      // ── INTENT TRIAGE: classify BEFORE the AI is allowed to reply ─────────
      const triage = await runTriage({
        customerId: customer.id,
        channel: 'outlook',
        messageId: msg.id,
        threadId: msg.conversationId,
        fromEmail,
        fromName,
        subject: msg.subject || '',
        body: bodyText,
        isReplyToOurThread: threadMessages.rows.some(r => r.ai_response),
      });

      // Decide what (if anything) we send
      let replyText = null;
      let aiResult = null;

      if (triage.action === 'reply' || triage.action === 'replied') {
        aiResult = await generateAIResponse({
          userMessage: bodyText,
          channel: 'email',
          clerkUserId: customer.clerk_user_id,
          contactEmail: fromEmail,
          conversationHistory: history,
        });
        if (!aiResult?.success || !aiResult?.response) {
          diag.skippedNoAi = (diag.skippedNoAi || 0) + 1;
          diag.aiInfo = {
            success: aiResult?.success ?? null,
            hasResponse: !!aiResult?.response,
            error: aiResult?.error || aiResult?.metadata?.error || null,
          };
          continue;
        }
        replyText = aiResult.response;
      } else if (triage.action === 'conservative_reply') {
        // One content-free reply; the email is also flagged "Left for you"
        replyText = conservativeReply(triage.businessName || customer.business_name);
      }
      // 'flag' and 'skip'/'skipped': replyText stays null — no send

      // Ensure the conversation exists (needed before we can record the message)
      await ensureTables();
      let convResult = await query(
        `SELECT id FROM outlook_conversations
         WHERE clerk_user_id = $1 AND conversation_id = $2 LIMIT 1`,
        [customer.clerk_user_id, msg.conversationId]
      ).catch(() => ({ rows: [] }));

      let convId;
      if (convResult.rows.length > 0) {
        convId = convResult.rows[0].id;
        await query(
          `UPDATE outlook_conversations SET last_message_at = NOW() WHERE id = $1`,
          [convId]
        ).catch(() => {});
      } else {
        const ins = await query(
          `INSERT INTO outlook_conversations
             (customer_id, clerk_user_id, outlook_email, contact_email, contact_name, subject, conversation_id, last_message_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
          [customer.id, customer.clerk_user_id, conn.outlook_email, fromEmail, fromName, msg.subject, msg.conversationId]
        ).catch(() => ({ rows: [] }));
        convId = ins.rows[0]?.id;
      }

      // Can't safely dedup without a conversation row — skip sending to avoid spam.
      if (!convId) {
        diag.errors = diag.errors || [];
        diag.errors.push(`no conversation id for ${msg.id}`);
        continue;
      }

      // CLAIM the message first: insert the dedup row before sending. If the row
      // already exists (another run handled it), we get no row back and skip the
      // send — this makes double-replies impossible. Flagged/skipped messages
      // claim with ai_response NULL so hourly cron runs don't reclassify them.
      const claim = await query(
        `INSERT INTO outlook_messages (conversation_id, outlook_message_id, direction, content, ai_response, sent_at)
         VALUES ($1, $2, 'inbound', $3, $4, NOW())
         ON CONFLICT (outlook_message_id) DO NOTHING
         RETURNING id`,
        [convId, msg.id, bodyText.slice(0, 5000), replyText]
      ).catch(() => ({ rows: [] }));

      if (claim.rows.length === 0) {
        diag.skippedProcessed++;
        if (replyText) await markAsRead(accessToken, msg.id).catch(() => {});
        continue;
      }

      if (triage.action === 'flag' || triage.action === 'flagged') {
        // Left for the owner: no reply, and deliberately NOT marked read —
        // it stays unread in their real Outlook inbox.
        diag.flagged = (diag.flagged || 0) + 1;
        console.log(`🚩 Outlook left for owner (${triage.classification.class}): ${fromEmail}`);
        continue;
      }

      if (triage.action === 'skip' || triage.action === 'skipped') {
        // Classifier-confirmed automated mail that slipped the pre-filter
        diag.skippedAutomated++;
        await markAsRead(accessToken, msg.id).catch(() => {});
        continue;
      }

      // We own this message — send the reply and mark it read.
      await sendReply(accessToken, msg.id, replyText);
      await markAsRead(accessToken, msg.id);

      // Track lead (real leads and possible-leads that got the conservative reply)
      await createOrUpdateContact(customer.id, {
        email: fromEmail,
        name: fromName,
        source_channel: 'outlook',
      }).catch(() => {});

      await trackLeadEvent(customer.id, {
        type: 'message_received',
        channel: 'outlook',
        email: fromEmail,
        name: fromName,
        message: bodyText,
      }).catch(() => {});

      if (aiResult?.hotLead?.isHotLead) {
        // hot_lead event bumps hot_lead_count → rescores → temperature 'hot'
        await trackLeadEvent(customer.id, {
          type: 'hot_lead',
          channel: 'outlook',
          email: fromEmail,
          name: fromName,
          message: bodyText,
        }).catch(() => {});
        await sendHotLeadAlert(customer.clerk_user_id, {
          contactName: fromName,
          contactEmail: fromEmail,
          channel: 'outlook',
          message: bodyText,
          score: aiResult.hotLead.score || 80,
        });
      }

      diag.processed++;
      console.log(`✅ Outlook replied to ${fromEmail} for ${customer.clerk_user_id} (triage: ${triage.classification.class}/${triage.classification.confidence})`);

    } catch (err) {
      diag.errors = diag.errors || [];
      diag.errors.push(err.message);
      console.error(`❌ Outlook message error (${msg.id}):`, err.message);
    }
  }
```

- [ ] **Step 3: Verify build + tests**

Run: `npm test` → PASS. Run: `npx next build` → compiles.

- [ ] **Step 4: Commit and push**

```bash
git add app/api/outlook/monitor/route.js
git commit -m "Outlook monitor: intent triage gates every reply — leads reply, business correspondence flagged, ambiguous gets one conservative reply"
git push
```

---

### Task 6: Wire triage into the Gmail monitor

Gmail's reply gate is `respondToEmail` (dashboard button / auto-poll — the cron only runs `check`). Triage runs in `respondToEmail` before the dedup claim, and also during `checkForNewEmails` so the inbox shows flags and non-leads stop becoming contacts. Because triage is idempotent per message (stored row is reused), classifying in both paths costs one OpenAI call total.

**Files:**
- Modify: `app/api/gmail/monitor/route.js`

**Interfaces:**
- Consumes: `runTriage` from `lib/intent-triage-store.js`; `conservativeReply` from `lib/intent-triage.js`.
- Produces: `check` responses now include `triage: { class, confidence, reason, action }` per email; `respond` refuses with `{ success: false, triageFlagged: true }` for non-lead email.

- [ ] **Step 1: Add imports**

At the top of `app/api/gmail/monitor/route.js`, add:

```js
import { runTriage } from '@/lib/intent-triage-store.js';
import { conservativeReply } from '@/lib/intent-triage.js';
```

- [ ] **Step 2: Triage in `checkForNewEmails` — gate lead creation, attach flags**

In `checkForNewEmails`, find the block that begins `// Email passed all filters (or is whitelisted) — now create the lead` (line ~589, the `if (customerSettings.customer_id) {` block) and wrap it with triage. Replace:

```js
              // Email passed all filters (or is whitelisted) — now create the lead
              if (customerSettings.customer_id) {
```

with:

```js
              // ── INTENT TRIAGE: classify before anything treats this as a lead ──
              let triage = null;
              if (customerSettings.customer_id) {
                try {
                  const aiThreadCheck = await query(
                    `SELECT 1 FROM gmail_messages gm
                     JOIN gmail_conversations gc ON gm.conversation_id = gc.id
                     WHERE gc.thread_id = $1 AND gm.is_ai_response = true LIMIT 1`,
                    [messageData.data.threadId]
                  ).catch(() => ({ rows: [] }));

                  triage = await runTriage({
                    customerId: customerSettings.customer_id,
                    channel: 'gmail',
                    messageId: message.id,
                    threadId: messageData.data.threadId,
                    fromEmail: customerEmail,
                    fromName: customerName,
                    subject: subjectHeader?.value || '',
                    body: body,
                    isReplyToOurThread: aiThreadCheck.rows.length > 0,
                  });
                } catch (triageErr) {
                  console.error('⚠️ Gmail triage failed during check:', triageErr.message);
                }
              }
              const triageSaysLead = !triage ||
                ['replied', 'reply', 'conservative_reply'].includes(triage.action);

              // Email passed all filters (or is whitelisted) — now create the lead
              // (but NOT for business correspondence / automated mail: a support
              // engineer must never become a contact, let alone a hot lead)
              if (customerSettings.customer_id && triageSaysLead) {
```

Then, inside that same lead-creation block, DELETE the broken `sendHotLeadAlert` call (lines 629–634 — it references `emailText` and `hotLeadScore`, variables that do not exist in this function; it has been throwing a caught ReferenceError on every email since it was added):

```js
                      await sendHotLeadAlert(customerSettings.clerk_user_id, {
                        contactEmail: fromEmail,
                        channel: 'email',
                        message: emailText,
                        score: hotLeadScore || 80,
                      });
```

(Remove those 6 lines entirely. Gmail hot-lead alerting will be handled properly when the Gmail hot-lead path is fixed — see CLAUDE.md carried TODO #8.)

Finally, attach triage to the email list item. In the `emailDetails.push({ ... })` call (line ~644), add one property after `isUnread`:

```js
              isUnread: messageData.data.labelIds?.includes('UNREAD') || false,
              triage: triage ? {
                class: triage.classification.class,
                confidence: triage.classification.confidence,
                reason: triage.classification.reason,
                action: triage.action,
              } : null
```

- [ ] **Step 3: Triage in `respondToEmail` — the send gate**

In `respondToEmail`, directly BEFORE the `// ── Dedup claim ──` comment block (line ~904), insert:

```js
    // ── INTENT TRIAGE: the send gate. Only high-confidence leads earn an
    // automatic AI reply; ambiguous email gets one conservative reply; business
    // correspondence and automated mail are never auto-replied to. ───────────
    let triageAction = 'reply';
    let triageBusinessName = customerSettings?.business_name || '';
    if (customerSettings?.customer_id) {
      try {
        const aiThreadCheck = await query(
          `SELECT 1 FROM gmail_messages gm
           JOIN gmail_conversations gc ON gm.conversation_id = gc.id
           WHERE gc.thread_id = $1 AND gm.is_ai_response = true LIMIT 1`,
          [messageData.data.threadId]
        ).catch(() => ({ rows: [] }));

        const triage = await runTriage({
          customerId: customerSettings.customer_id,
          channel: 'gmail',
          messageId: emailId,
          threadId: messageData.data.threadId,
          fromEmail: replyToEmail,
          fromName: customerName,
          subject: subject,
          body: originalBody,
          isReplyToOurThread: aiThreadCheck.rows.length > 0,
        });
        triageAction = triage.action;
        if (triage.businessName) triageBusinessName = triage.businessName;

        if (['flag', 'flagged', 'skip', 'skipped'].includes(triageAction) && !customResponse) {
          console.log(`🚩 Gmail triage blocked auto-reply to ${replyToEmail}: ${triage.classification.class}/${triage.classification.confidence}`);
          return NextResponse.json({
            success: false,
            triageFlagged: true,
            triageClass: triage.classification.class,
            reason: triage.classification.reason,
            message: `This email was classified as ${triage.classification.class.replace(/_/g, ' ')} and left for you — no automatic reply sent.`,
          });
        }
      } catch (triageErr) {
        // Fail safe: a triage system error must not let a reply through unvetted
        console.error('❌ Gmail triage error — blocking auto-reply:', triageErr.message);
        if (!customResponse) {
          return NextResponse.json({
            success: false,
            triageFlagged: true,
            triageClass: 'ambiguous',
            reason: `triage error: ${triageErr.message}`,
            message: 'Could not classify this email — left for you, no automatic reply sent.',
          });
        }
      }
    }
```

Note: `customResponse` (the owner typing their own reply from the dashboard) always passes — triage only gates AUTOMATIC replies.

- [ ] **Step 4: Conservative reply in `respondToEmail`**

In the response-generation section, replace the line (inside the `else` branch that generates the AI response, line ~940):

```js
      // 🎯 GENERATE AI RESPONSE USING CENTRALIZED SERVICE
      console.log('🧠 Using centralized AI service from lib/ai-service.js...');
```

with:

```js
      // 🎯 GENERATE AI RESPONSE USING CENTRALIZED SERVICE
      console.log('🧠 Using centralized AI service from lib/ai-service.js...');

      if (triageAction === 'conservative_reply') {
        // Ambiguous email: one content-free reply, no AI generation, and the
        // email stays flagged "Left for you" in the dashboard.
        aiText = conservativeReply(triageBusinessName);
      }
```

and guard the existing generation block so it only runs when we don't already have the conservative text — change:

```js
      try {
        // Call your centralized AI service
        const aiResult = await generateGmailResponse(
```

to:

```js
      try {
        if (triageAction === 'conservative_reply') throw { conservativeShortCircuit: true };
        // Call your centralized AI service
        const aiResult = await generateGmailResponse(
```

and change the start of its `catch (aiError) {` to:

```js
      } catch (aiError) {
        if (aiError?.conservativeShortCircuit) {
          // aiText already holds the conservative reply — nothing to do
        } else {
        console.error('❌ Centralized AI generation failed:', aiError.message);
        
        // Fallback response
        const businessName = customerSettings?.business_name || 'our team';
        aiText = `Thank you for reaching out to ${businessName}. We've received your message and will provide you with detailed information shortly.

Best regards,
${businessName}`;
        }
      }
```

(Same lines as today, just wrapped in the `else`. The conservative text set before the try survives untouched.)

- [ ] **Step 5: Verify build + tests**

Run: `npm test` → PASS. Run: `npx next build` → compiles.

- [ ] **Step 6: Commit and push**

```bash
git add app/api/gmail/monitor/route.js
git commit -m "Gmail monitor: triage gates auto-replies + lead creation; removes broken hot-lead alert call (undefined vars)"
git push
```

---

### Task 7: Triage API — inbox overlay + one-click correction

**Files:**
- Create: `app/api/email/triage/route.js`
- Modify: `app/api/outlook/inbox/route.js`

**Interfaces:**
- Consumes: `getTriageForCustomer`, `recordCorrection` from `lib/intent-triage-store.js`.
- Produces:
  - `GET /api/email/triage` → `{ success, triage: [{ channel, messageId, threadId, contactEmail, subject, class, confidence, reason, action, correctedClass, createdAt }] }` (Clerk session auth)
  - `POST /api/email/triage` body `{ channel, messageId, correction: 'lead' | 'not_lead' }` → `{ success }`. `'lead'` stores `corrected_class = 'new_lead'`; `'not_lead'` stores `'business_correspondence'`.
  - Outlook inbox emails gain `triage: { class, confidence, reason, action, correctedClass } | null`.

- [ ] **Step 1: Create the route**

Create `app/api/email/triage/route.js`:

```js
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { query } from '@/lib/database.js';
import { getTriageForCustomer, recordCorrection } from '@/lib/intent-triage-store.js';

export const dynamic = 'force-dynamic';

async function getCustomerId(userId) {
  const result = await query(
    `SELECT id FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
    [userId]
  ).catch(() => ({ rows: [] }));
  return result.rows[0]?.id || null;
}

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const customerId = await getCustomerId(userId);
    if (!customerId) return NextResponse.json({ success: true, triage: [] });

    const rows = await getTriageForCustomer(customerId);
    return NextResponse.json({
      success: true,
      triage: rows.map(r => ({
        channel: r.channel,
        messageId: r.message_id,
        threadId: r.thread_id,
        contactEmail: r.contact_email,
        subject: r.subject,
        class: r.class,
        confidence: r.confidence,
        reason: r.reason,
        action: r.action,
        correctedClass: r.corrected_class,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('❌ Triage GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId } = auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const customerId = await getCustomerId(userId);
    if (!customerId) return NextResponse.json({ error: 'No customer record' }, { status: 404 });

    const { channel, messageId, correction } = await request.json();
    if (!['gmail', 'outlook'].includes(channel) || !messageId || !['lead', 'not_lead'].includes(correction)) {
      return NextResponse.json({ error: 'channel, messageId and correction (lead|not_lead) are required' }, { status: 400 });
    }

    const correctedClass = correction === 'lead' ? 'new_lead' : 'business_correspondence';
    const result = await recordCorrection({ customerId, channel, messageId, correctedClass });
    if (!result.success) {
      return NextResponse.json({ error: 'Triage record not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, correctedClass });
  } catch (error) {
    console.error('❌ Triage POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Join triage into the Outlook inbox**

In `app/api/outlook/inbox/route.js`, replace the query (lines 25–41) with:

```js
    const result = await query(`
      SELECT
        om.id,
        om.outlook_message_id,
        om.content,
        om.ai_response,
        om.created_at,
        oc.contact_email,
        oc.contact_name,
        oc.subject,
        oc.conversation_id,
        et.class      AS triage_class,
        et.confidence AS triage_confidence,
        et.reason     AS triage_reason,
        et.action     AS triage_action,
        et.corrected_class AS triage_corrected_class
      FROM outlook_messages om
      JOIN outlook_conversations oc ON oc.id = om.conversation_id
      LEFT JOIN email_triage et
        ON et.channel = 'outlook' AND et.message_id = om.outlook_message_id
      WHERE oc.clerk_user_id = $1 AND om.direction = 'inbound'
      ORDER BY om.created_at DESC
      LIMIT 50
    `, [userId]).catch(() => ({ rows: [] }));
```

and add to each mapped email object (after `source: 'outlook',`):

```js
      triage: row.triage_class ? {
        class: row.triage_class,
        confidence: row.triage_confidence,
        reason: row.triage_reason,
        action: row.triage_action,
        correctedClass: row.triage_corrected_class,
      } : null,
```

- [ ] **Step 3: Verify build + tests**

Run: `npm test` → PASS. Run: `npx next build` → compiles.

- [ ] **Step 4: Commit and push**

```bash
git add app/api/email/triage/route.js app/api/outlook/inbox/route.js
git commit -m "Triage API: inbox overlay GET + one-click correction POST; Outlook inbox carries triage verdicts"
git push
```

---

### Task 8: "Left for you" flag + correction buttons in the email dashboard

**Files:**
- Modify: `app/(dashboard)/email/page.js`

**Interfaces:**
- Consumes: `GET /api/email/triage`, `POST /api/email/triage` (Task 7); `email.triage` on Outlook inbox emails; `email.triage` on Gmail check results (Task 6).

- [ ] **Step 1: Add triage state, fetch, helpers, and correction handler**

Near the other `useState` declarations (around line 108, next to `activeEmailView`), add:

```js
  // Triage: which emails the AI left for the owner ("Left for you") + corrections
  const [triageMap, setTriageMap] = useState({});

  const loadTriage = async () => {
    try {
      const res = await fetch('/api/email/triage');
      const data = await res.json();
      if (data.success) {
        const map = {};
        for (const t of data.triage) map[`${t.channel}:${t.messageId}`] = t;
        setTriageMap(map);
      }
    } catch (e) {
      console.error('Failed to load triage flags:', e);
    }
  };

  // An email's triage record: Outlook rows carry it inline; Gmail rows are
  // looked up by message id in the fetched map.
  const getTriage = (email) => {
    if (email.triage) return email.triage;
    const channel = email.source === 'outlook' ? 'outlook' : 'gmail';
    const messageId = email.source === 'outlook' ? email.outlookMessageId : email.id;
    return triageMap[`${channel}:${messageId}`] || null;
  };

  const isLeftForYou = (email) => {
    const t = getTriage(email);
    return !!t && ['flagged', 'conservative_reply'].includes(t.action) && !t.correctedClass;
  };

  const submitTriageCorrection = async (email, correction) => {
    const channel = email.source === 'outlook' ? 'outlook' : 'gmail';
    const messageId = email.source === 'outlook' ? email.outlookMessageId : email.id;
    try {
      const res = await fetch('/api/email/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, messageId, correction }),
      });
      const data = await res.json();
      if (data.success) {
        setTriageMap(prev => ({
          ...prev,
          [`${channel}:${messageId}`]: {
            ...(prev[`${channel}:${messageId}`] || getTriage(email) || {}),
            channel, messageId,
            correctedClass: data.correctedClass,
          },
        }));
      }
    } catch (e) {
      console.error('Failed to save correction:', e);
    }
  };
```

Then find the component's initial-load `useEffect` (the one that runs the existing loaders on mount) and add `loadTriage();` alongside the other load calls. Also call `loadTriage()` at the end of `checkAllEmails` so a manual sweep refreshes flags.

Caveat for the Outlook inline case: `email.triage` objects from the inbox route won't reflect a just-saved correction stored only in `triageMap` — so in `getTriage`, check the map FIRST, then fall back to `email.triage`:

```js
  const getTriage = (email) => {
    const channel = email.source === 'outlook' ? 'outlook' : 'gmail';
    const messageId = email.source === 'outlook' ? email.outlookMessageId : email.id;
    return triageMap[`${channel}:${messageId}`] || email.triage || null;
  };
```

(Use this version, not the first one.)

- [ ] **Step 2: Amber "Left for you" badge on inbox rows**

In the inbox row JSX (line ~1492, inside `<div className="flex items-center gap-2">` just BEFORE the Gmail/Outlook tag ternary `{isGmail ? (`), add:

```jsx
                                    {isLeftForYou(email) && (
                                      <div className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-medium">
                                        Left for you
                                      </div>
                                    )}
```

And extend the row ring so flagged rows read amber instead of the blue unreplied ring — replace (line ~1473):

```jsx
                                } ${!isSelected && isUnreplied ? 'ring-1 ring-inset ring-blue-400/60 rounded-lg' : ''} ${index === 0 ? 'border-t-0' : ''}`}
```

with:

```jsx
                                } ${!isSelected && isLeftForYou(email) ? 'ring-1 ring-inset ring-amber-400/60 rounded-lg' : !isSelected && isUnreplied ? 'ring-1 ring-inset ring-blue-400/60 rounded-lg' : ''} ${index === 0 ? 'border-t-0' : ''}`}
```

- [ ] **Step 3: Flag card with correction buttons in the detail panels**

Create ONE small component so both panels share it. Below the helper functions from Step 1 (inside the page component), add:

```jsx
  const TriageFlagCard = ({ email }) => {
    const t = getTriage(email);
    if (!t) return null;
    if (t.correctedClass) {
      return (
        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 text-sm text-emerald-300">
          Thanks — your answer was saved and the AI will learn from it.
        </div>
      );
    }
    if (!['flagged', 'conservative_reply'].includes(t.action)) return null;
    return (
      <div className="bg-amber-500/10 rounded-xl p-6 border border-amber-500/20">
        <p className="text-sm font-medium text-amber-300 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Left for you — the AI didn't handle this one
        </p>
        <p className="text-sm text-gray-300 mb-1">
          {t.action === 'conservative_reply'
            ? 'This email was unclear, so the AI sent one short, neutral reply asking what they need — and left the rest to you.'
            : 'This looks like company business (a vendor, support desk, or partner), not a sales lead, so the AI stayed out of it.'}
        </p>
        {t.reason && <p className="text-xs text-gray-500 mb-4">AI's read: {t.reason}</p>}
        <p className="text-xs text-gray-400 mb-2">Was the AI right? Your answer teaches it for next time:</p>
        <div className="flex gap-3">
          <button
            onClick={() => submitTriageCorrection(email, 'lead')}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            This was a lead
          </button>
          <button
            onClick={() => submitTriageCorrection(email, 'not_lead')}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-sm font-medium transition-colors"
          >
            Not a lead — AI was right
          </button>
        </div>
      </div>
    );
  };
```

(Ensure `AlertTriangle` is in the existing `lucide-react` import at the top of the file; add it if missing.)

Insert `<TriageFlagCard email={selectedOutlookEmail} />` in the Outlook detail panel directly ABOVE the `{selectedOutlookEmail.aiReply && (` block (line ~1658), and `<TriageFlagCard email={selectedGmailEmail} />` in the Gmail detail panel directly BELOW the Email Content card's closing `</div>` (line ~1699, before the preview section).

- [ ] **Step 4: Verify build**

Run: `npx next build` → compiles. Then run `npm run dev`, open `/email`, and confirm the page renders without console errors (flags won't show until real triage rows exist — that's expected).

- [ ] **Step 5: Commit and push**

```bash
git add "app/(dashboard)/email/page.js"
git commit -m "Email inbox: amber 'Left for you' flags + one-click triage corrections that teach the classifier"
git push
```

---

### Task 9: Replay verification + docs

**Files:**
- Modify: `CLAUDE.md` (status sections)

- [ ] **Step 1: Full test suite + eval one more time**

Run: `npm test` → all PASS.
Run: `node scripts/triage-eval.mjs` → `🟢 EVAL PASSED`. The `ms-support-replay` line must read `expected business_correspondence, got business_correspondence` (spec success criterion #2).

- [ ] **Step 2: Update CLAUDE.md**

- In **Core Features Status → Completed**, add: `- Email intent triage — every inbound email classified (5 classes, two-tier gpt-4o-mini→gpt-4o, asymmetric caution) before any AI reply; "Left for you" inbox flags + one-click corrections feed few-shot learning; eval-gated (scripts/triage-eval.mjs); HOT_LEAD_KEYWORDS de-fanged (shared lib/hot-lead-keywords.js, capped below hot threshold)`
- In **NEXT SESSION TODO**, replace the "TOP PRIORITY: build EMAIL INTENT TRIAGE" block with: `**📧 INTENT TRIAGE SHIPPED — founder: reconnect Outlook** (Email → Setup), then send one vendor-style email + one lead-style email to verify live: vendor gets NO reply + amber "Left for you" flag; lead gets an AI reply. Success criterion: one week of real traffic, zero wrong-target auto-replies.`
- Remove/strike carried TODO item `1. [ ] Build INTENT TRIAGE (roadmap item #0)…` (done).

- [ ] **Step 3: Commit and push**

```bash
git add CLAUDE.md
git commit -m "Doc: intent triage shipped — Outlook reconnect unblocked, eval-gated go-live steps recorded"
git push
```

---

## Post-plan (founder actions, not code)

1. Review the 24 eval-set labels in `scripts/triage-eval-set.json` — they are the ground truth the classifier is graded against.
2. Reconnect Outlook from Email → Setup.
3. Live test: send a vendor-ish email and a lead-ish email to the connected mailbox; confirm flag vs. reply behavior after the next cron pass (or press "Check for emails").
4. Watch one week of traffic for wrong-target auto-replies (spec success criterion #3).
