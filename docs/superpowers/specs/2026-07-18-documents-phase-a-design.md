# Documents Phase A — Smarter Targeting + Voice Email Delivery — Design

**Date:** 2026-07-18
**Status:** Approved by founder (pending final spec review)

## Goal

Two improvements to the existing link-based document feature, with **no file storage**:

1. **Smarter targeting (all text channels):** the AI sends exactly the right document link at the right moment, guided by an optional per-document "when to send" field.
2. **Voice email delivery:** the voice AI offers to email documents (links can't be spoken), collects and confirms the caller's email, and BizzyBot emails the links after the call — also capturing the email onto the lead's contact record.

## Background — what exists today

- Documents are per-channel entries `{ link, description }` stored in `ai_channel_settings.documents` (JSON array). Customers configure them in AI Settings; multiple documents per channel are supported.
- `lib/ai-service.js` (~line 606) adds a DOCUMENTS block to the text-channel prompt: lists every document as "description: link" with loose guidance ("include the relevant document link(s)"). `document_sent` analytics events fire only when a reply actually contains a configured link.
- `lib/vapi.js` `buildVoiceSystemPrompt` has **no document awareness** — voice callers cannot receive documents at all.
- Vapi end-of-call webhooks land at `/api/vapi/webhook` (fields nested under `message`), which stores transcript/summary/duration in `vapi_call_logs`.
- Email sending via Resend (`alerts@bizzybotai.com`) already exists for owner alerts and TFV approval emails.

## Piece 1 — Smarter document targeting (text channels)

**Data:** each entry in the `documents` JSON array gains an optional `when` string (`{ link, description, when }`). JSON column — no migration. Entries without `when` behave as today (description-based matching).

**UI (AI Settings → documents editor):** third input per document row, labeled "When should the AI send this? (optional)" with placeholder like "when the lead asks about payment plans". Saved alongside link/description through the existing save path.

**Prompt (lib/ai-service.js DOCUMENTS block) — new rules:**
- Send **exactly one** document: the one matching the lead's need — match on the `when` text if present, otherwise the description.
- If more than one could fit, ask the lead which they need instead of guessing.
- Never list all documents; never send one the conversation didn't call for; don't re-send a document already shared earlier in the conversation.
- Keep the existing qualification gate (documents come up once a lead is engaged) — this design changes targeting, not timing.

## Piece 2 — Voice documents + post-call email delivery

**In-call (buildVoiceSystemPrompt gains a DOCUMENTS section, when voice-channel documents exist):**
- The assistant knows the documents (description + `when`), knows links can't be delivered on a phone call, and offers: "I can email that to you right after this call — what's your email address?"
- It must read the address back to confirm spelling before moving on, and tell the caller the email arrives shortly after the call.
- Voice settings sync via the existing Save & Sync path (and the updated prompt flows to Vapi the next time any customer saves voice settings; existing assistants keep the old prompt until then — acceptable rollout).

**Post-call (in `/api/vapi/webhook` end-of-call handling):**
1. Runs only when the customer has voice-channel documents configured and a transcript exists.
2. One OpenAI extraction call (gpt-4o-mini) over the transcript returns strict JSON: `{ wants_documents: bool, email: string|null, requested: string[] }` (`requested` = descriptions of the documents the caller asked about; empty = unclear).
3. Email validated with the same regex used elsewhere. Valid + wants_documents → send the email.
4. **Email content:** branded like the existing customer emails, sent via Resend from `{business_name} via BizzyBot <alerts@bizzybotai.com>`; subject "Documents from {business_name}"; body lists the matching document links (all voice-channel documents if `requested` is empty/ambiguous); reply-to set to the customer's business email when one exists.
5. On send: log a `document_sent` analytics event (same shape as text channels) and **save the extracted email onto the lead's contact record** (matched by caller phone number, only filling a blank email — never overwriting an existing one).
6. `wants_documents` true but no valid email → no send; append a note to that call's record (`vapi_call_logs`) visible in the dashboard transcript view: "Caller requested documents — no valid email captured. Follow up: {caller number}."
7. Extraction/send failures are logged and never break call logging (wrap in try/catch like existing webhook steps).

## Out of scope (deliberate)

- File storage, uploads, real attachments (Phase B), document receiving (Phase C).
- Mid-call live sending via Vapi tools (Option B — additive upgrade later; the email-sending piece built here is reused as-is).
- Offering email delivery on SMS/chat (links already work there).
- Changing when documents come up in conversation (qualification gate unchanged).

## Testing

- **Text targeting:** on a test account with 2+ documents (distinct `when` texts): specific ask → exactly one correct link; ambiguous ask → AI asks which; unrelated conversation → no links.
- **Back-compat:** documents without `when` still send as before.
- **Voice end-to-end:** real call to (866) 944-5685 (after configuring test documents + Save & Sync): ask for a document, give an email, confirm read-back; after hanging up confirm (a) branded email arrives with the right link, (b) `document_sent` event logged, (c) contact record gained the email.
- **No-email path:** call, request documents, refuse/garble the email → no send, note appears on the call record.
