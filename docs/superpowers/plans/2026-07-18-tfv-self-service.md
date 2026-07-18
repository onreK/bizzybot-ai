# Self-Service TFV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every new customer's toll-free number verification is submitted with per-customer branded evidence pages and a records-matching legal name, fully self-service, with a jargon-free status card.

**Architecture:** Two new public server-rendered pages (`/sms-optin/{digits}`, `/sms-terms/{digits}`) driven by a shared DB lookup helper; one new column (`sms_verification_info.legal_business_name`); submission code builds `"{legal} DBA {brand}"` and links the branded pages; dashboard reads the already-exposed `verificationStatus`.

**Tech Stack:** Next.js 14 App Router (JS, not TS), Tailwind, PostgreSQL via `lib/database.js` `query()`, Clerk middleware, Twilio REST (direct `twilioClient.request`, SDK 4.23 drops new fields).

**Spec:** `docs/superpowers/specs/2026-07-18-tfv-self-service-design.md`

## Global Constraints

- No test framework exists in this repo — each task ends with explicit manual verification (local or live) instead of unit tests. Never claim done without running the verification step.
- Commit directly to `main`; every push auto-deploys via Railway (~2 min build). Never force-push.
- `/sms-optin-example` and `/privacy` must NOT be modified — BizzyBot's own approved verification references them.
- Customer-facing copy must never contain: "rejected", "verification", "compliance", "carrier requirement codes". Use "being activated" / "activation".
- No new npm dependencies.
- Founder is non-technical: after each task, report in plain English what changed and how to see it.
- JPH resubmission (Task 6) hard deadline: priority review window ends ~2026-07-22.

---

### Task 1: Shared lookup helper + branded opt-in page ✅ DONE 2026-07-18 (note: legal_business_name ALTER pulled forward from Task 3 — helper needs the column)

**Files:**
- Create: `lib/branded-pages.js`
- Create: `app/sms-optin/[number]/page.js`
- Modify: `middleware.js` (publicRoutes array, after the `"/sms-optin-example"` entry)

**Interfaces:**
- Produces: `getBrandedPageData(numberParam)` → `Promise<null | { brand, legalName, phoneDigits, formattedNumber, website, websiteDomain, businessEmail }>` — used by Tasks 1, 2. `brand` falls back to legal name and vice-versa; returns `null` when the number isn't assigned to any customer.

- [ ] **Step 1: Create `lib/branded-pages.js`**

```js
import { query } from './database.js';

// Look up the customer that owns a toll-free number, for the public
// branded opt-in / SMS-terms pages. numberParam is the URL segment —
// accepts 10 digits, 11 digits with leading 1, or anything containing them.
export async function getBrandedPageData(numberParam) {
  const digits = String(numberParam || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (digits.length !== 10) return null;

  const result = await query(
    `SELECT cpn.phone_number,
            c.business_name,
            bp.website,
            svi.legal_business_name,
            svi.business_email
     FROM customer_phone_numbers cpn
     JOIN customers c ON c.clerk_user_id = cpn.clerk_user_id
     LEFT JOIN business_profiles bp ON bp.customer_id = c.id
     LEFT JOIN sms_verification_info svi ON svi.clerk_user_id = cpn.clerk_user_id
     WHERE regexp_replace(cpn.phone_number, '\\D', '', 'g') IN ($1, '1' || $1)
     ORDER BY (bp.website IS NOT NULL AND bp.website <> '') DESC
     LIMIT 1`,
    [digits]
  ).catch(() => ({ rows: [] }));

  const row = result.rows[0];
  if (!row) return null;

  const brand = (row.business_name || '').trim() || (row.legal_business_name || '').trim();
  const legalName = (row.legal_business_name || '').trim() || brand;
  if (!brand) return null;

  const website = (row.website || '').trim();
  const websiteDomain = website.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

  return {
    brand,
    legalName,
    phoneDigits: digits,
    formattedNumber: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
    website,
    websiteDomain,
    businessEmail: (row.business_email || '').trim(),
  };
}
```

- [ ] **Step 2: Create `app/sms-optin/[number]/page.js`**

Server component. Same visual structure/Tailwind classes as `app/sms-optin-example/page.js` (dark `#070B14` theme), with customer substitutions:

```js
import { notFound } from 'next/navigation';
import { getBrandedPageData } from '@/lib/branded-pages.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const data = await getBrandedPageData(params.number);
  return { title: data ? `SMS Opt-In — ${data.brand}` : 'SMS Opt-In' };
}

export default async function BrandedSmsOptin({ params }) {
  const data = await getBrandedPageData(params.number);
  if (!data) notFound();
  const { brand, formattedNumber, website, websiteDomain, phoneDigits } = data;

  return (
    <div className="min-h-screen bg-[#070B14] text-gray-300">
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-white font-bold text-lg tracking-tight">{brand}</span>
          <a href={`/sms-terms/${phoneDigits}`} className="text-sm text-gray-400 hover:text-white transition-colors">SMS Terms</a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">How customers opt in to text messages from {brand}</h1>
          <p className="text-gray-400 text-lg">SMS opt-in documentation for {formattedNumber}</p>
        </div>

        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">How it works</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            All text messaging with {brand} is <strong className="text-white">consumer-initiated (mobile-originated)</strong> — a consumer chooses to text {brand} first, and an automated reply answers their inquiry.
          </p>
          <p className="text-gray-300 leading-relaxed">
            No messages are ever sent to a consumer unless they initiate contact. The consumer&apos;s act of texting {brand} constitutes consent to receive a reply. Every reply includes STOP opt-out instructions.
          </p>
        </div>

        <h2 className="text-2xl font-bold text-white mb-6">Step-by-step opt-in</h2>
        <div className="space-y-6 mb-12">

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">1</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Consumer finds {brand}&apos;s phone number</h3>
                <p className="text-gray-400 text-sm mb-4">
                  {brand} advertises {formattedNumber} publicly{websiteDomain ? <> on its website ({websiteDomain})</> : null}, business listings, and printed materials, inviting customers to call or text.
                </p>
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">{websiteDomain ? `${websiteDomain} — contact section:` : 'Business contact section:'}</p>
                  <div className="border border-gray-700 rounded-lg p-4 bg-[#111827]">
                    <p className="text-white font-semibold text-lg mb-1">{brand}</p>
                    <div className="flex items-start gap-3 bg-white/5 rounded-lg p-3 mt-3">
                      <div className="text-2xl">💬</div>
                      <div>
                        <p className="text-white text-sm font-medium">Questions? Call or text us</p>
                        <p className="text-violet-400 text-sm font-mono">{formattedNumber}</p>
                        <p className="text-gray-500 text-xs mt-1">Text us any time with questions. Standard message and data rates may apply. Reply STOP to opt out.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">2</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Consumer texts {brand} (opt-in)</h3>
                <p className="text-gray-400 text-sm mb-4">The consumer chooses to send a text to {formattedNumber}. This act of texting constitutes their consent to receive an automated reply to their inquiry.</p>
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">Consumer sends first message:</p>
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-br-md px-4 py-2 max-w-xs">
                      Hi, I&apos;m interested in your services. Can you tell me more?
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">3</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">{brand} replies to the inquiry</h3>
                <p className="text-gray-400 text-sm mb-4">An automated reply answers the consumer&apos;s question. Every reply identifies {brand} and includes STOP opt-out instructions and the Msg &amp; data rates disclosure.</p>
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">Reply to consumer:</p>
                  <div className="flex justify-start">
                    <div className="bg-gray-700 text-white text-sm rounded-2xl rounded-bl-md px-4 py-2 max-w-sm">
                      Hi! Thanks for reaching out to {brand}. Happy to help — what are you looking for? Reply STOP to opt out, HELP for help. Msg &amp; data rates may apply.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">✕</div>
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">Consumer can opt out at any time by replying STOP</h3>
                <p className="text-gray-400 text-sm mb-4">If the consumer replies STOP (or UNSUBSCRIBE, CANCEL, END, QUIT), they are immediately unsubscribed. No further messages are sent.</p>
                <div className="rounded-lg border border-white/10 bg-[#0D1421] p-5 space-y-3">
                  <div className="flex justify-end"><div className="bg-blue-600 text-white text-sm rounded-2xl rounded-br-md px-4 py-2">STOP</div></div>
                  <div className="flex justify-start">
                    <div className="bg-gray-700 text-white text-sm rounded-2xl rounded-bl-md px-4 py-2 max-w-sm">
                      You have been unsubscribed from {brand}. No further messages will be sent. Reply START to resubscribe.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">Standard messaging keywords</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { keyword: 'STOP / UNSUBSCRIBE / CANCEL / QUIT / END', desc: 'Immediately opt out — no further messages will be sent.', color: 'text-red-400' },
              { keyword: 'HELP / INFO', desc: 'Returns help message with business name and opt-out instructions.', color: 'text-yellow-400' },
              { keyword: 'START / JOIN', desc: 'Re-subscribes a consumer who previously opted out.', color: 'text-green-400' },
            ].map((k, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-[#0D1421] p-4">
                <p className={`font-mono text-sm font-bold mb-1 ${k.color}`}>{k.keyword}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{k.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-500 space-y-2">
          <p>Messages are sent by {brand}. Mobile information is never shared with third parties or affiliates for marketing or promotional purposes.</p>
          <p>
            See the full <a href={`/sms-terms/${phoneDigits}`} className="text-violet-400 hover:text-violet-300">SMS Messaging Terms for {brand}</a>.
          </p>
          <p className="pt-4 text-xs text-gray-600">Messaging service powered by BizzyBot AI.</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add public routes in `middleware.js`**

After the `"/sms-optin-example",` line add:

```js
    "/sms-optin/(.*)",               // per-customer branded opt-in evidence (Twilio reviewers, no login)
    "/sms-terms/(.*)",               // per-customer branded SMS terms (Twilio reviewers, no login)
```

- [ ] **Step 4: Verify locally against prod DB**

```bash
cd /c/Users/Kerno/New-Real-estate-Agent
DATABASE_URL="<public DB url from: railway variables --service Postgres --kv | grep DATABASE_PUBLIC_URL>" npm run dev
```

- `http://localhost:3000/sms-optin/8669445685` → renders with "Bizzy Bot Ai LLC" (866) 944-5685, no "Sunshine Home Services" anywhere.
- `http://localhost:3000/sms-optin/8886014185` → renders JPH's page (brand from their `customers.business_name`).
- `http://localhost:3000/sms-optin/5555555555` → 404 page.
- Logged out (incognito): same URLs load without Clerk redirect.

- [ ] **Step 5: Commit and push**

```bash
git add lib/branded-pages.js "app/sms-optin/[number]/page.js" middleware.js
git commit -m "Per-customer branded SMS opt-in page for toll-free verification evidence"
git push origin main
```

After deploy: spot-check `https://bizzybotai.com/sms-optin/8669445685` and the 404 case.

---

### Task 2: Branded SMS terms page ✅ DONE 2026-07-18

**Files:**
- Create: `app/sms-terms/[number]/page.js`

**Interfaces:**
- Consumes: `getBrandedPageData(numberParam)` from `lib/branded-pages.js` (Task 1).

- [ ] **Step 1: Create `app/sms-terms/[number]/page.js`**

```js
import { notFound } from 'next/navigation';
import { getBrandedPageData } from '@/lib/branded-pages.js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const data = await getBrandedPageData(params.number);
  return { title: data ? `SMS Terms — ${data.brand}` : 'SMS Terms' };
}

export default async function BrandedSmsTerms({ params }) {
  const data = await getBrandedPageData(params.number);
  if (!data) notFound();
  const { brand, legalName, formattedNumber, websiteDomain, businessEmail, phoneDigits } = data;

  return (
    <div className="min-h-screen bg-[#070B14] text-gray-300">
      <nav className="border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-white font-bold text-lg tracking-tight">{brand}</span>
          <a href={`/sms-optin/${phoneDigits}`} className="text-sm text-gray-400 hover:text-white transition-colors">How opt-in works</a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-white mb-2">SMS Messaging Terms</h1>
        <p className="text-gray-400 text-lg mb-1">{brand}{legalName && legalName !== brand ? ` (${legalName})` : ''}</p>
        <p className="text-gray-500 text-sm mb-10">Texting number: {formattedNumber}</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Program description</h2>
            <p className="mb-3">
              {brand} uses {formattedNumber} to reply to text message inquiries from its own customers and leads. Messaging is <strong className="text-gray-200">consumer-initiated</strong>: you will only receive messages if you text {brand} first. Replies answer questions about services, pricing, and appointment scheduling. Message frequency varies based on your conversation.
            </p>
            <p><strong className="text-gray-200">Message and data rates may apply.</strong> Carriers are not liable for delayed or undelivered messages.</p>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Opting out and getting help</h2>
            <ul className="space-y-2 pl-4">
              <li className="flex gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Reply STOP</strong> (or UNSUBSCRIBE, CANCEL, QUIT, END) at any time to opt out. You will receive one confirmation message and nothing further.</span></li>
              <li className="flex gap-2"><span className="text-yellow-400 mt-0.5">•</span><span><strong className="text-white">Reply HELP</strong> (or INFO) for assistance at any time.</span></li>
              <li className="flex gap-2"><span className="text-green-400 mt-0.5">•</span><span><strong className="text-white">Reply START</strong> (or JOIN) to re-subscribe after opting out.</span></li>
            </ul>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Privacy</h2>
            <p className="mb-3">
              {brand} does not send unsolicited marketing messages. Mobile phone numbers and text message content are <strong className="text-gray-200">never shared with or sold to third parties or affiliates for marketing or promotional purposes</strong>. Your number is used only to respond to your inquiries.
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions about text messaging from {brand}? {businessEmail ? <>Email <span className="text-violet-400">{businessEmail}</span>{websiteDomain ? <> or visit <span className="text-violet-400">{websiteDomain}</span></> : null}.</> : websiteDomain ? <>Visit <span className="text-violet-400">{websiteDomain}</span>.</> : <>Text HELP to {formattedNumber}.</>}
            </p>
          </section>

          <p className="text-xs text-gray-600 pt-2">Messaging service powered by BizzyBot AI.</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify locally** — `http://localhost:3000/sms-terms/8669445685` renders BizzyBot's terms; `/sms-terms/5555555555` → 404; STOP/HELP lines visually bold; cross-links between the two branded pages work both ways.

- [ ] **Step 3: Commit and push**

```bash
git add "app/sms-terms/[number]/page.js"
git commit -m "Per-customer branded SMS terms page"
git push origin main
```

---

### Task 3: `legal_business_name` — DB column + API

**Files:**
- Modify: `lib/tollfree-verification.js` (`ensureVerificationInfoTable`, ~line 44)
- Modify: `app/api/sms/verification-info/route.js` (GET + POST)

**Interfaces:**
- Produces: `sms_verification_info.legal_business_name` TEXT column; API field `legalBusinessName` (GET returns it, POST requires non-empty). Tasks 4–5 rely on these exact names.

- [ ] **Step 1: Add the column** — in `ensureVerificationInfoTable`, after the `business_email` ALTER line:

```js
  await query(`ALTER TABLE sms_verification_info ADD COLUMN IF NOT EXISTS legal_business_name TEXT`).catch(() => {});
```

- [ ] **Step 2: API GET** — add to the SELECT column list `legal_business_name` and to the response object:

```js
      legalBusinessName: row.legal_business_name || '',
```

- [ ] **Step 3: API POST** — destructure `legalBusinessName` from the body; validate after the businessType check:

```js
    const cleanLegalName = (legalBusinessName || '').trim();
    if (!cleanLegalName) {
      return NextResponse.json({ success: false, error: 'Legal business name is required — exactly as it appears on your EIN letter or state registration' }, { status: 400 });
    }
```

Add `legal_business_name` to the INSERT column list, `$7` to VALUES, `legal_business_name = EXCLUDED.legal_business_name` to the UPDATE clause, and `cleanLegalName` to the parameter array.

- [ ] **Step 4: Verify** — run local dev; in browser devtools on any logged-in page:

```js
await (await fetch('/api/sms/verification-info', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ businessType: 'PRIVATE_PROFIT', ein: '12-3456789', contactFirstName: 'Test', contactLastName: 'Person', businessEmail: 'a@b.com' }) })).json()
```
→ error mentions legal business name. Repeat with `legalBusinessName: 'Test, LLC'` → `{ success: true }`, and GET returns it.

- [ ] **Step 5: Commit and push**

```bash
git add lib/tollfree-verification.js app/api/sms/verification-info/route.js
git commit -m "Add legal business name to SMS verification info (column + API)"
git push origin main
```

---

### Task 4: Onboarding form — legal name + brand name fields

**Files:**
- Modify: `app/sms-onboarding/page.js`

**Interfaces:**
- Consumes: `legalBusinessName` API field (Task 3).
- `profile.businessName` (existing) becomes the **brand**; new state `legalBusinessName` is the legal name.

- [ ] **Step 1: State + prefill** — add `const [legalBusinessName, setLegalBusinessName] = useState('');` beside the other verification states (~line 33). In `loadInitialState`, in the verification-info prefill block add `setLegalBusinessName(infoData.legalBusinessName || '');`.

- [ ] **Step 2: Replace the "Business name" field** (~line 356) with two fields plus the conditional warning:

```jsx
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Legal business name *</label>
              <input
                type="text"
                value={legalBusinessName}
                onChange={(e) => setLegalBusinessName(e.target.value)}
                placeholder="JPH, LLC"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Exactly as it appears on your IRS EIN letter or state registration, including punctuation.
                Carriers reject verifications when this doesn&apos;t match official records.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand name customers know you by (if different)</label>
              <input
                type="text"
                value={profile.businessName}
                onChange={setField('businessName')}
                placeholder="Maryland Clean Energy"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank if you operate under your legal name.</p>
            </div>

            {legalBusinessName.trim() && profile.businessName.trim() &&
              legalBusinessName.trim().toLowerCase() !== profile.businessName.trim().toLowerCase() && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <strong>Heads up:</strong> carriers will visit your website to confirm these names belong together.
                If your site only shows &quot;{profile.businessName.trim()}&quot;, add a line to your site footer like:
                <em> &quot;{profile.businessName.trim()} is operated by {legalBusinessName.trim()}.&quot;</em>
              </div>
            )}
```

- [ ] **Step 3: Validation + submit** — in `validateForm`, replace the businessName check with `if (!legalBusinessName.trim()) return 'Legal business name is required';`. In `handleGetNumber`: profile save uses `businessName: (profile.businessName.trim() || legalBusinessName.trim())` (brand falls back to legal); verification-info POST body gains `legalBusinessName: legalBusinessName.trim()`.

- [ ] **Step 4: Verify locally** — form shows both fields; warning appears only when both are filled and differ; submitting with empty legal name blocks with the right message; devtools Network shows `legalBusinessName` in the verification-info POST.

- [ ] **Step 5: Commit and push**

```bash
git add app/sms-onboarding/page.js
git commit -m "SMS onboarding: legal name vs brand name fields with DBA footer warning"
git push origin main
```

---

### Task 5: Submission uses DBA name + branded page URLs

**Files:**
- Modify: `lib/tollfree-verification.js` (`submitTollfreeVerification`)

**Interfaces:**
- Consumes: `legal_business_name` column (Task 3); branded routes `/sms-optin/{digits}`, `/sms-terms/{digits}` (Tasks 1–2).

- [ ] **Step 1: Fetch the phone number digits** — the existing first query reads `tfv_sid, tfv_status`; extend it to also select `phone_number`:

```js
    `SELECT tfv_sid, tfv_status, phone_number FROM customer_phone_numbers WHERE twilio_sid = $1 LIMIT 1`,
```

and after `const existing = ...` add:

```js
  const phoneDigits = String(existing.phone_number || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
```

- [ ] **Step 2: Read legal name + build the submitted name** — add `legal_business_name` to the `sms_verification_info` SELECT list. After the `businessEmail` line:

```js
  // Legal name for carrier records; brand stays what the AI uses with leads.
  // Back-compat: customers from before this field treat their saved business
  // name as the legal name until they edit onboarding.
  const legalName = (info.legal_business_name || '').trim() || (customer.business_name || '').trim();
```

Replace `const businessName = customer.business_name.trim();` with:

```js
  const brandName = (customer.business_name || '').trim() || legalName;
  const businessName = brandName.toLowerCase() !== legalName.toLowerCase()
    ? `${legalName} DBA ${brandName}`
    : legalName;
```

In the `needsInfo` checks, replace the businessName check with `if (!legalName) needsInfo.push('legalBusinessName');`.

- [ ] **Step 3: Swap the evidence URLs and brand the copy** — in the `data` object: `UseCaseSummary` and `ProductionMessageSample` use `${brandName}` instead of `${businessName}` (consumers see the brand, paperwork carries the DBA form); replace:

```js
    OptInImageUrls: [`${BASE_URL}/sms-optin/${phoneDigits}`],
```
and
```js
    AdditionalInformation:
      `Messaging is consumer-initiated customer care handled on behalf of ${businessName}. ` +
      `Opt-in documentation: ${BASE_URL}/sms-optin/${phoneDigits}. ` +
      `SMS terms: ${BASE_URL}/sms-terms/${phoneDigits}`,
```

Guard: if `phoneDigits.length !== 10`, keep the legacy URLs (`/sms-optin-example`, `/privacy#sms-terms`) so a malformed row can't submit broken links:

```js
  const optInUrl = phoneDigits.length === 10 ? `${BASE_URL}/sms-optin/${phoneDigits}` : `${BASE_URL}/sms-optin-example`;
  const termsUrl = phoneDigits.length === 10 ? `${BASE_URL}/sms-terms/${phoneDigits}` : `${BASE_URL}/privacy#sms-terms`;
```
and use `optInUrl` / `termsUrl` in the two fields above.

- [ ] **Step 4: Verify** — temporary log before the `twilioClient.request` call: `console.log('TFV payload:', JSON.stringify(data, null, 2));`. Locally (prod DB URL + Twilio env NOT set → it throws 'Twilio not configured' before submitting, so instead) run a dry read: `node -e "..."` is impractical here; instead verify by code review + the JPH resubmission in Task 6, which prints the payload. Remove the log line after Task 6 confirms.

- [ ] **Step 5: Commit and push**

```bash
git add lib/tollfree-verification.js
git commit -m "TFV submission: DBA-format business name + per-customer branded evidence URLs"
git push origin main
```

---

### Task 6: JPH resubmission (operational — deadline ~2026-07-22)

**Files:**
- Create (scratchpad, not committed): `resubmit-jph.js`

**Prereqs:** Tasks 1–5 deployed; JPH's site shows the footer line (confirm with founder/Jesse's brother); founder has JPH's exact legal name from their EIN letter.

- [ ] **Step 1: Set JPH's names + email in prod** — one-off script against the public DB URL: find their row (`SELECT c.id, c.clerk_user_id, c.business_name FROM customers c JOIN customer_phone_numbers cpn ON cpn.clerk_user_id = c.clerk_user_id WHERE cpn.phone_number LIKE '%8886014185'`), then upsert `sms_verification_info` for that `clerk_user_id`: `legal_business_name = 'JPH, LLC'` (verbatim from EIN letter), `business_email = 'MDCLEANENERGY@outlook.com'` (or the info@ domain address if it exists by then), and set `customers.business_name = 'Maryland Clean Energy Initiative'` if it isn't already.

- [ ] **Step 2: Verify their branded pages live** — `https://bizzybotai.com/sms-optin/8886014185` and `/sms-terms/8886014185` show Maryland Clean Energy Initiative + (888) 601-4185, logged out.

- [ ] **Step 3: Resubmit** — script that loads env (public `DATABASE_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `NEXT_PUBLIC_BASE_URL=https://bizzybotai.com` — values via `railway variables --kv`) then:

```js
const { submitTollfreeVerification } = await import('./lib/tollfree-verification.js');
const result = await submitTollfreeVerification({ clerkUserId: '<JPH clerk id from Step 1>', phoneNumberSid: '<their twilio_sid>' });
console.log(result);
```

Expected: payload log shows `BusinessName: "JPH, LLC DBA Maryland Clean Energy Initiative"`, branded URLs, and the edit-in-place path (existing `tfv_status = 'TWILIO_REJECTED'` → POST to `.../Verifications/HH1cce95ab20b875fbbe473f0a31b28284`); result `{ submitted: true, status: 'PENDING_REVIEW' }`.

- [ ] **Step 4: Confirm + clean up** — `customer_phone_numbers.tfv_status` now `PENDING_REVIEW`; remove the temporary payload log from Task 5; commit that removal. Tell the founder: resubmitted, hourly cron watches it, approval email lands automatically.

---

### Task 7: Customer-facing activation status card

**Files:**
- Modify: `app/(dashboard)/customer-sms-dashboard/page.js` (status banner area, uses existing `cfg.verificationStatus`)
- Modify: `app/sms-onboarding/page.js` ("assigned" status screen, uses existing `assigned.verificationStatus`)

**Interfaces:**
- Consumes: `verificationStatus` already returned by GET `/api/sms/provision` (`needs_info` | `PENDING_REVIEW` | `IN_REVIEW` | `TWILIO_REJECTED` | `TWILIO_APPROVED` | null).

- [ ] **Step 1: Shared status mapping** — add to both files (small, duplicated by design — client components):

```js
const ACTIVATION_STATES = {
  approved: { texting: 'Live', textingDetail: 'Your AI is answering texts 24/7.', tone: 'green' },
  pending:  { texting: 'Being activated', textingDetail: 'Usually 3–5 business days. Calls already work.', tone: 'blue' },
  rejected: { texting: 'Activation in progress', textingDetail: 'Our team is handling a carrier requirement — no action needed on your end. Calls already work.', tone: 'blue' },
  needsInfo:{ texting: 'Waiting on your info', textingDetail: 'Finish the setup form to start activation.', tone: 'amber' },
};
function activationState(verificationStatus) {
  if (verificationStatus === 'TWILIO_APPROVED') return ACTIVATION_STATES.approved;
  if (verificationStatus === 'TWILIO_REJECTED') return ACTIVATION_STATES.rejected;
  if (!verificationStatus || verificationStatus === 'needs_info') return ACTIVATION_STATES.needsInfo;
  return ACTIVATION_STATES.pending;
}
```

- [ ] **Step 2: Render the card** — in both pages' status area, a two-row card:

```jsx
  <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700">📞 Calls</span>
      <span className="text-sm font-semibold text-green-600">Live</span>
    </div>
    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700">💬 Texting</span>
      <span className={`text-sm font-semibold ${state.tone === 'green' ? 'text-green-600' : state.tone === 'amber' ? 'text-amber-600' : 'text-blue-600'}`}>{state.texting}</span>
    </div>
    <p className="text-xs text-gray-500">{state.textingDetail}</p>
  </div>
```

where `const state = activationState(cfg?.verificationStatus)` (dashboard) / `activationState(assigned?.verificationStatus)` (onboarding). Match each page's existing styling (onboarding is light-themed; dashboard follows the Voice-page design standard — adapt classes to its dark card style on that page).

- [ ] **Step 3: Verify** — founder's own account shows Calls Live · Texting Live (approved). Temporarily flip a test value in the component (`activationState('TWILIO_REJECTED')`) to eyeball the rejected wording, then restore. Confirm the word "rejected" appears nowhere customer-visible.

- [ ] **Step 4: Commit and push**

```bash
git add "app/(dashboard)/customer-sms-dashboard/page.js" app/sms-onboarding/page.js
git commit -m "Customer-facing number activation status card (calls/texting, no carrier jargon)"
git push origin main
```

---

## Self-Review Notes

- Spec coverage: Piece 1 → Task 1; Piece 5 → Task 2; Piece 2 → Tasks 3–4; submission changes → Task 5; JPH → Task 6; Piece 3 → Task 7. Out-of-scope items (widget, 10DLC) have no tasks — correct.
- Back-compat path (legacy customers without legal name) implemented in Task 5 Step 2 and matches the spec.
- Naming consistency: `legalBusinessName` (API/state), `legal_business_name` (column), `getBrandedPageData` used in Tasks 1–2 — consistent.
- `/sms-optin-example` untouched everywhere; legacy URL kept as malformed-row fallback in Task 5 Step 3.
