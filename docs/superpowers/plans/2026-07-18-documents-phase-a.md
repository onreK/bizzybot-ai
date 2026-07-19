# Documents Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI sends exactly the right document link at the right moment on text channels, and voice callers get documents emailed after the call (with their email captured to the lead record).

**Architecture:** Optional `when` field on existing `{link, description}` document entries (JSON column — no migration) + rewritten selection rules in the text prompt; a DOCUMENTS section in the Vapi voice prompt instructing email collection with read-back; a post-call step in the Vapi webhook that extracts intent+email from the transcript via gpt-4o-mini and sends a branded Resend email with the links.

**Tech Stack:** Next.js 14 App Router (JS), PostgreSQL via `lib/database.js` `query()`, OpenAI (`openai` pkg, already installed), Resend (already installed), Vapi webhook at `/api/vapi/webhook`.

**Spec:** `docs/superpowers/specs/2026-07-18-documents-phase-a-design.md`

## Global Constraints

- No test framework — every task ends with explicit manual verification; never claim done without running it.
- Commit directly to `main`; Railway auto-deploys each push. Run `npx next build` before every push.
- No new npm dependencies (`openai` and `resend` are already in package.json).
- Never break existing webhook behavior: call logging, contact creation, hot-lead alerts must survive any failure in the new document step (wrap in try/catch, non-fatal).
- Voice-captured email must NEVER overwrite an existing contact email — `createOrUpdateContact`'s `COALESCE($5, email)` overwrites when passed a value, so only pass `email` when the existing contact has none.
- No fake success: if no valid email is extracted, nothing is sent and a note is appended to the call record.
- Founder is non-technical: report each task in plain English with how to see it.

---

### Task 1: "When to send" field + sharper selection rules (text channels) ✅ DONE 2026-07-18 (live-verified via widget chat)

**Files:**
- Modify: `app/(dashboard)/ai-settings/page.js` (documents editor, ~lines 127–176)
- Modify: `lib/ai-service.js` (DOCUMENTS block, ~lines 606–615)

**Interfaces:**
- Produces: document entries may now carry `when` (string, optional). Task 2's voice prompt and Task 3's email builder read the same entries.

- [ ] **Step 1: Add the third input to the documents editor**

In `app/(dashboard)/ai-settings/page.js`, inside the per-document block (after the link `<input>`, before the remove button's closing `</div>`), add:

```jsx
                <input
                  placeholder="When should the AI send this? (optional — e.g. when the lead asks about payment plans)"
                  value={doc.when || ''}
                  onChange={e => {
                    const next = [...(ch.documents || [])];
                    next[i] = { ...next[i], when: e.target.value };
                    update(channel, 'documents', next);
                  }}
                  className={inputClass}
                />
```

Change the add-button seed from `{ description: '', link: '' }` to `{ description: '', link: '', when: '' }`.

- [ ] **Step 2: Rewrite the DOCUMENTS prompt block**

In `lib/ai-service.js`, replace the block at ~606–615 with:

```js
  // Documents — sent once a lead is clearly qualified and ready to proceed
  const documents = Array.isArray(customerConfig?.documents) ? customerConfig.documents : [];
  const validDocs = documents.filter(d => d?.link?.trim() && d?.description?.trim());
  if (validDocs.length > 0) {
    basePrompt += `\n\nDOCUMENTS: Once a lead is clearly interested and ready to move forward, you may share ONE of these document links as a natural next step:`;
    validDocs.forEach(doc => {
      basePrompt += `\n- ${doc.description}: ${doc.link}${doc.when?.trim() ? ` (send ${doc.when.trim()})` : ''}`;
    });
    basePrompt += `\nDocument rules:` +
      `\n- Send exactly ONE document per message — the one matching what the lead needs or asked about (use each document's "send when" guidance; otherwise match on its name).` +
      `\n- If more than one could fit, ask the lead which they need instead of guessing.` +
      `\n- Never list multiple document links in one message, and never send a document the conversation didn't call for.` +
      `\n- If you already shared a document earlier in this conversation, don't send it again unless the lead asks.`;
  }
```

- [ ] **Step 3: Build**

Run: `npx next build` → exits 0 (pre-existing import warnings in old email routes are expected).

- [ ] **Step 4: Verify live selection behavior**

Deploy (Step 5 commit/push first if verifying on prod, or run local dev with prod `DATABASE_URL` + Clerk keys). On the founder's account (customer 863), in AI Settings → Web Chat channel add two documents with distinct `when` texts (e.g. "Service Agreement" / "send when the lead is ready to book" and "Financing FAQ" / "send when the lead asks about cost or payment"). Then exercise the public widget chat endpoint (find widget id: `SELECT id FROM ...` — the widget auth table used by `/api/widget/[id]/chat`; or use the embedded test chat on the Web Chat page as the founder):
- Ask "how would I pay for this?" → reply contains exactly the Financing FAQ link, not both.
- Ask "can you send me your documents?" → AI asks which one (or sends the single clearly-matching one), never dumps both.
- Ask something unrelated → no links.
Remove the test documents afterward if the founder doesn't want them kept.

- [ ] **Step 5: Commit and push**

```bash
git add "app/(dashboard)/ai-settings/page.js" lib/ai-service.js
git commit -m "Documents: per-document 'when to send' field + one-matching-document selection rules"
git push origin main
```

---

### Task 2: Voice prompt documents section + secret-gated Vapi sync route ✅ DONE 2026-07-18 (verified on Vapi assistant)

**Files:**
- Modify: `app/api/vapi/provision/route.js` (`getVoiceSettings`, ~lines 34–50)
- Modify: `lib/vapi.js` (`buildVoiceSystemPrompt`, ~lines 26–36)
- Create: `app/api/admin/sync-vapi/route.js`
- Modify: `middleware.js` (publicRoutes — after the `/api/admin/resubmit-tfv` entry)

**Interfaces:**
- Consumes: `when` field from Task 1.
- Produces: `buildVoiceSystemPrompt(s)` now uses `s.documents`; ops route `POST /api/admin/sync-vapi` `{ clerkUserId }`, Bearer `CRON_SECRET` — used by Task 4's verification and future ops.

- [ ] **Step 1: Include documents in voice settings**

In `getVoiceSettings` (both the voice query and the text fallback query), change the SELECT list to:

```sql
SELECT business_name, business_description, knowledge_base, custom_instructions, response_tone, documents
```

- [ ] **Step 2: Add DOCUMENTS section to the voice prompt**

In `lib/vapi.js` `buildVoiceSystemPrompt`, after the `custom_instructions` line and before the "Keep responses concise" line, add:

```js
  const docs = Array.isArray(s.documents) ? s.documents.filter(d => d?.link?.trim() && d?.description?.trim()) : [];
  if (docs.length > 0) {
    parts.push(
      `DOCUMENTS: The business has these documents available: ${docs.map(d => `"${d.description}"${d.when?.trim() ? ` (relevant ${d.when.trim()})` : ''}`).join(', ')}. ` +
      `You cannot send links or files during a phone call. When a caller wants a document, offer to email it: ask for their email address, then READ IT BACK to them letter-perfect to confirm the spelling before moving on. ` +
      `Tell them the email will arrive shortly after the call. Never invent document contents — you only know their names.`
    );
  }
```

- [ ] **Step 3: Create the secret-gated sync route**

`app/api/admin/sync-vapi/route.js` (same auth pattern as `/api/admin/resubmit-tfv`):

```js
import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';
import { updateAssistant, buildVoiceSystemPrompt } from '@/lib/vapi.js';

export const dynamic = 'force-dynamic';

// Admin ops tool: push a customer's current voice settings to their Vapi
// assistant without a browser session. Auth: Bearer CRON_SECRET.
export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { clerkUserId } = await request.json();
    if (!clerkUserId) return NextResponse.json({ success: false, error: 'clerkUserId is required' }, { status: 400 });

    const numberResult = await query(
      `SELECT cpn.vapi_assistant_id, COALESCE(cpn.customer_id, c.id) AS customer_id
       FROM customer_phone_numbers cpn
       LEFT JOIN customers c ON (c.clerk_user_id::text = $1 OR c.user_id::text = $1)
       WHERE cpn.clerk_user_id = $1 AND cpn.status = 'active' AND cpn.vapi_assistant_id IS NOT NULL
       LIMIT 1`,
      [clerkUserId]
    );
    const row = numberResult.rows[0];
    if (!row) return NextResponse.json({ success: false, error: 'No Vapi assistant found' }, { status: 404 });

    const sResult = await query(
      `SELECT business_name, business_description, knowledge_base, custom_instructions, response_tone, documents
       FROM ai_channel_settings WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
      [row.customer_id]
    );
    const s = sResult.rows[0] || {};
    const businessName = s.business_name || 'this business';
    await updateAssistant(row.vapi_assistant_id, { businessName, systemPrompt: buildVoiceSystemPrompt(s) });

    return NextResponse.json({ success: true, assistantId: row.vapi_assistant_id });
  } catch (error) {
    console.error('❌ sync-vapi error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

Add to `middleware.js` publicRoutes after the resubmit-tfv line:

```js
    "/api/admin/sync-vapi",          // CRON_SECRET-gated ops tool (server-to-server, no Clerk session)
```

- [ ] **Step 4: Build** — `npx next build` → exits 0.

- [ ] **Step 5: Verify** — after deploy: add a test document to the founder's Voice channel settings, then `POST https://bizzybotai.com/api/admin/sync-vapi` with `Authorization: Bearer <real CRON_SECRET from railway variables>` and body `{"clerkUserId":"user_2yvgWKeeb6XSPFFqtd1QYiUw6cE"}` → `{ success: true }`. Then `GET https://api.vapi.ai/assistant/e5c27c34-1bc0-46c0-9205-e48b0bae87ca` (Bearer `VAPI_PRIVATE_KEY`) and confirm the systemPrompt contains the DOCUMENTS section. Also confirm no-secret request → 401.

- [ ] **Step 6: Commit and push**

```bash
git add app/api/vapi/provision/route.js lib/vapi.js app/api/admin/sync-vapi/route.js middleware.js
git commit -m "Voice: documents awareness + email-collection instructions, secret-gated Vapi sync route"
git push origin main
```

---

### Task 3: Post-call extraction → branded email → contact capture / no-email note ✅ DONE 2026-07-19 (simulated-webhook verified; contact fill switched to targeted UPDATE after unique-constraint bug; email-capture hardened after real-call phantom-dot bug — prompt + extraction rules)

**Files:**
- Create: `lib/voice-document-followup.js`
- Modify: `app/api/vapi/webhook/route.js` (end-of-call block, after the contact/lead step)

**Interfaces:**
- Consumes: document entries `{link, description, when}`; `createOrUpdateContact(customerId, contactData)` from `lib/leads-service.js`; Resend pattern from `lib/tollfree-verification.js`; OpenAI client pattern from `lib/ai-service.js` (match its instantiation + env var name exactly — check before writing).
- Produces: `processVoiceDocumentFollowup({ customerId, clerkUserId, vapiCallId, callerPhone, transcript, existingContact })` → `{ handled, emailedTo?, noted? }`.

- [ ] **Step 1: Create `lib/voice-document-followup.js`**

```js
import OpenAI from 'openai';
import { Resend } from 'resend';
import { query } from './database.js';
import { createOrUpdateContact } from './leads-service.js';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// After a voice call: if the caller asked for documents, email them the links
// (voice can't deliver links live). Never throws — the webhook's call logging
// must survive any failure here.
export async function processVoiceDocumentFollowup({ customerId, clerkUserId, vapiCallId, callerPhone, transcript, existingContact }) {
  try {
    if (!openai || !resend || !transcript) return { handled: false };

    const settingsResult = await query(
      `SELECT business_name, documents FROM ai_channel_settings
       WHERE customer_id = $1 AND channel = 'voice' LIMIT 1`,
      [customerId]
    ).catch(() => ({ rows: [] }));
    const s = settingsResult.rows[0];
    const docs = Array.isArray(s?.documents)
      ? s.documents.filter(d => d?.link?.trim() && d?.description?.trim())
      : [];
    if (docs.length === 0) return { handled: false };

    const businessName = s.business_name || 'the business';

    // Extract intent + email from the transcript (strict JSON)
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You extract facts from a phone call transcript between a caller and ${businessName}'s AI assistant. ` +
            `Available documents: ${docs.map(d => d.description).join('; ')}. ` +
            `Return JSON: {"wants_documents": boolean, "email": string|null, "requested": string[]}. ` +
            `wants_documents = caller asked to receive a document/form or agreed to have one emailed. ` +
            `email = the caller's email address if they stated one (convert spoken form: "john dot smith at gmail dot com" -> "john.smith@gmail.com"); null if none or unclear. ` +
            `requested = which of the available document names the caller wanted (empty if unclear).`,
        },
        { role: 'user', content: transcript.slice(0, 12000) },
      ],
    });
    let parsed;
    try { parsed = JSON.parse(extraction.choices[0].message.content); } catch { return { handled: false }; }
    if (!parsed.wants_documents) return { handled: false };

    const email = (parsed.email || '').trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      // Caller wanted documents but we couldn't capture a usable email — leave
      // a follow-up note on the call record instead of sending blindly.
      await query(
        `UPDATE vapi_call_logs
         SET summary = COALESCE(summary, '') || $1
         WHERE vapi_call_id = $2`,
        [`\n\n⚠️ Caller requested documents — no valid email captured. Follow up: ${callerPhone || 'unknown number'}.`, vapiCallId]
      ).catch(() => {});
      console.log(`⚠️ Voice doc request without valid email on call ${vapiCallId}`);
      return { handled: true, noted: true };
    }

    // Which documents to include: the requested ones, or all if unclear
    const requested = Array.isArray(parsed.requested) ? parsed.requested.map(r => String(r).toLowerCase()) : [];
    const matched = docs.filter(d => requested.some(r => d.description.toLowerCase().includes(r) || r.includes(d.description.toLowerCase())));
    const toSend = matched.length > 0 ? matched : docs;

    // Replies should reach the business, not BizzyBot, when they have an email on file
    const bizEmailResult = await query(
      `SELECT business_email FROM sms_verification_info WHERE clerk_user_id = $1 LIMIT 1`,
      [clerkUserId]
    ).catch(() => ({ rows: [] }));
    const replyTo = (bizEmailResult.rows[0]?.business_email || '').trim();

    await resend.emails.send({
      from: `${businessName} via BizzyBot <alerts@bizzybotai.com>`,
      to: email,
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `Documents from ${businessName}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;background:#0D1117;border-radius:12px;overflow:hidden;border:1px solid #30363D;">
          <div style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 28px;">
            <h1 style="margin:0 0 4px;font-size:20px;color:#fff;font-weight:700;">Documents from ${businessName}</h1>
            <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">As promised on your call</p>
          </div>
          <div style="padding:24px 28px;background:#161B22;">
            <p style="color:#C9D1D9;font-size:14px;line-height:1.6;margin:0 0 16px;">
              Thanks for calling ${businessName}! Here ${toSend.length === 1 ? 'is the document' : 'are the documents'} you asked about:
            </p>
            ${toSend.map(d => `<p style="margin:0 0 12px;"><a href="${d.link}" style="color:#a78bfa;font-size:14px;font-weight:600;">${d.description} →</a></p>`).join('')}
            <p style="color:#8B949E;font-size:12px;line-height:1.6;margin:16px 0 0;">
              Questions? Just reply to this email or give us a call back.
            </p>
          </div>
        </div>
      `,
    });

    // Analytics: same event shape as text-channel document sends
    await query(
      `INSERT INTO ai_analytics_events (customer_id, event_type, metadata, channel, confidence, created_at)
       VALUES ($1, 'document_sent', $2, 'voice', 1.0, CURRENT_TIMESTAMP)`,
      [customerId, JSON.stringify({ documents: toSend.map(d => d.description), email, vapi_call_id: vapiCallId })]
    ).catch(err => console.error('⚠️ voice document_sent event insert failed:', err.message));

    // Capture the email onto the contact — only if it doesn't have one yet
    if (callerPhone && !existingContact?.email) {
      await createOrUpdateContact(customerId, { phone: callerPhone, email }).catch(() => {});
    }

    console.log(`📧 Voice documents emailed to ${email} (call ${vapiCallId}): ${toSend.map(d => d.description).join(', ')}`);
    return { handled: true, emailedTo: email };
  } catch (err) {
    console.error('⚠️ Voice document follow-up failed (non-fatal):', err.message);
    return { handled: false };
  }
}
```

**Before committing:** open `lib/ai-service.js` and `app/api/ai-settings/route.js` to confirm (a) the OpenAI client env var/instantiation matches, and (b) the exact `ai_analytics_events` insert column list matches the text-channel `document_sent` insert (~line 254) — copy that column list verbatim if it differs from the above.

- [ ] **Step 2: Wire into the webhook**

In `app/api/vapi/webhook/route.js`: add the import, and inside the `end-of-call-report` block after step 4 (hot-lead handling), add:

```js
      // 5. Document follow-up: caller asked for documents -> email the links
      const { processVoiceDocumentFollowup } = await import('@/lib/voice-document-followup.js');
      await processVoiceDocumentFollowup({
        customerId: owner.customer_id,
        clerkUserId: owner.clerk_user_id,
        vapiCallId: call.id,
        callerPhone,
        transcript,
        existingContact: contactResult?.contact || null,
      }).catch(() => {});
```

Note: `contactResult` is currently scoped inside `if (callerPhone) { ... }` — either move this step inside that block (documents can still be emailed when callerPhone exists, which is the only case a contact exists anyway) or hoist `let contactResult = null;` above the block. Prefer moving the step inside the `if (callerPhone)` block (a caller with no number can still have said an email — but keep scope: the overwhelming case has a caller number; skip the exotic case).

- [ ] **Step 3: Build** — `npx next build` → exits 0.

- [ ] **Step 4: Simulated end-to-end verification (before any real call)**

Run local dev with prod `DATABASE_URL`, Clerk keys, `OPENAI_API_KEY`, `RESEND_API_KEY`, and `VAPI_WEBHOOK_SECRET=local-test-secret` (all real values except the webhook secret, from `railway variables --kv`). Ensure founder's voice channel has a test document configured. POST a fake end-of-call report:

```bash
curl -s -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" -H "x-vapi-secret: local-test-secret" \
  -d '{"message":{"type":"end-of-call-report","call":{"id":"test-doc-call-1","assistantId":"e5c27c34-1bc0-46c0-9205-e48b0bae87ca"},"customer":{"number":"+15551234567"},"startedAt":"2026-07-18T20:00:00Z","endedAt":"2026-07-18T20:02:00Z","transcript":"AI: Thanks for calling! ... Caller: Can you send me the service agreement? AI: I can email that right after this call — what is your email? Caller: kernopay at gmail dot com. AI: That is kernopay@gmail.com, correct? Caller: Yes.","summary":"Caller asked for service agreement."}}'
```

Confirm: (a) `{received: true}`; (b) email arrives at kernopay@gmail.com with the document link, from "{business} via BizzyBot"; (c) `document_sent` event row exists with channel 'voice'; (d) contact +15551234567 gained the email; (e) repeat with transcript containing NO email → no send, and `vapi_call_logs` row `test-doc-call-2` summary ends with the follow-up note. Clean up test rows (`vapi_call_logs`, `contacts`, `ai_analytics_events` for the fake numbers) afterward.

- [ ] **Step 5: Commit and push**

```bash
git add lib/voice-document-followup.js app/api/vapi/webhook/route.js
git commit -m "Voice: post-call document email delivery with transcript extraction and contact email capture"
git push origin main
```

---

### Task 4: Real-call verification + close-out ⏸️ PENDING 2026-07-19 — first real call exposed the phantom-dot bug (fixed, assistant re-synced); RETEST blocked overnight by carrier-side toll-free routing (calls from 858-900-4220 created NO Twilio call records ~03:00 UTC; app/Twilio config/Vapi all verified healthy). Retest in daylight; if calls still vanish across carriers → Twilio ticket. Test doc "BizzyBot Pricing Guide" still on 863 voice channel.

**Files:** none (operational) + plan checkboxes.

- [ ] **Step 1:** Founder's account: confirm a real document is configured on the Voice channel (AI Settings), then sync via `POST /api/admin/sync-vapi` (real CRON_SECRET).
- [ ] **Step 2:** Founder calls (866) 944-5685 from a non-forwarded phone, asks for the document, gives a real email, confirms the read-back, hangs up.
- [ ] **Step 3:** Confirm within ~2 minutes: branded email received with the correct link; `/voice` dashboard call log shows the call; contact record has the email (if it was blank).
- [ ] **Step 4:** Mark tasks done in this plan file, update `CLAUDE.md` core-features list ("Document sending: per-document targeting + voice email delivery" under Completed), commit.

## Self-Review Notes

- Spec coverage: Piece 1 → Task 1; voice prompt → Task 2; post-call pipeline (extraction, email, event, contact fill-if-blank, no-email note) → Task 3; testing section → Tasks 1/3/4 verification steps. Out-of-scope items have no tasks — correct.
- The spec's "reply-to customer's business email" is implemented in Task 3 Step 1 (`reply_to` from `sms_verification_info.business_email` when present).
- Consistency: `processVoiceDocumentFollowup` signature matches between Task 3 Steps 1–2; `documents` entries `{link, description, when}` consistent across Tasks 1–3; sync route auth mirrors resubmit-tfv.
