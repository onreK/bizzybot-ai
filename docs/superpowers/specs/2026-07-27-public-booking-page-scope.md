# Public booking page — scope

**Date:** 2026-07-27
**Status:** SCOPED, NOT STARTED. Founder asked for this as a future to-do after seeing ServiceTitan's "Book online" button in Google search results.
**Prompt:** competitor research while building a call list — HVAC companies running ServiceTitan show a Google-native booking button. See "Why, and what it is not" below.

## Goal

Give every BizzyBot customer a public page where a lead can book an appointment without calling, texting, or visiting a website — `bizzybotai.com/book/acme-plumbing`. The link goes in the **Appointment link** field of their Google Business Profile, on their site, and in email signatures.

Sales line it unlocks: *"leads can book you straight from Google, and it lands on your calendar."*

## Why, and what it is NOT

ServiceTitan's booking button in Google is **Reserve with Google** — an approved-booking-partner programme requiring merchant/service/availability feeds, a booking server Google calls in real time, and Google's certification, which they grant selectively to platforms with many merchants. **This scope is deliberately not that.** It is a hosted booking page whose URL any business can paste into their own Google Business Profile with no partnership. Reserve with Google is a much larger build and premature until BizzyBot has enough merchants to be worth Google's approval process.

Also worth remembering: ServiceTitan costs $245–500/tech/month plus $5K–50K setup. A business running it is not a BizzyBot prospect — treat a ServiceTitan booking link as a **disqualifier** when building target lists.

## What already exists (this is mostly assembly)

- `lib/microsoft-calendar.js` — `getAvailableSlots(clerkUserId)`, `createCalendarEvent(...)` with attendee invite
- `customers.meeting_duration_minutes` — per-customer slot length
- `customers.business_timezone` — slots presented in business-local time
- Booking already works end-to-end via the AI's `[BOOK:...]` marker on text channels, including validation that the chosen slot was one actually offered
- The `/web-chat` page is the model for "here is your link, copy it, here is where to paste it"

## What has to be built

1. **Per-customer slug.** New `customers.booking_slug`, derived from business name, unique, with collision handling. Immutable once set (a changed slug breaks every link already pasted into Google).
2. **Public availability endpoint** keyed by slug, not by Clerk id. Must return only free slot start times — never calendar subjects, attendees, or anything else from the owner's calendar.
3. **Public booking endpoint.** Creates the Outlook event, invites the lead, and runs the lead through the same contact pipeline as every other channel so it appears in Leads with `channel = 'booking'`.
4. **The page itself.** Pick a slot → name, phone, email, optional note → confirm. Mobile-first: most of this traffic arrives from a phone via Google.
5. **Confirmations.** Email/SMS to the lead, owner notification consistent with existing hot-lead alerts.
6. **Dashboard surface** on the Scheduling page: the link, a copy button, and instructions for pasting it into Google Business Profile.
7. **`middleware.js` publicRoutes** entry for `/book/(.*)` and its API routes — without this, crawlers and leads get bounced to sign-in (the same bug that cost seven weeks of indexing).

## Risks that must be designed for, not discovered

- **Abuse.** This is an unauthenticated endpoint that writes real events to a real person's calendar. Someone could book out every slot. Needs rate limiting per IP and per phone/email, and a cap on bookings per lead per day. This is the single biggest difference from everything built so far — every other public endpoint either replies to a message or reads data.
- **Race on slot selection.** A slot can be taken between the page loading and the lead submitting. Re-validate at submit time and fail gracefully with fresh options — the `[BOOK:]` path already validates against actually-offered slots and is the pattern to copy.
- **No calendar connected.** A customer without Outlook has no availability to show. Fall back to their `booking_url` if set, otherwise the page should say the business prefers a call and show the number, never a broken empty grid.
- **Trial expiry.** Decide deliberately whether an expired-trial customer's booking page keeps working. Everything else in the product goes silent (`lib/trial-access.js`); consistency argues for the page showing a "call us" fallback rather than booking.
- **Timezone.** Existing code presents slots in business-local time with the timezone stated. Keep that; do not silently convert to the lead's timezone.

## Deliberately out of scope for v1

- Reserve with Google partnership (see above)
- Service selection / catalog — BizzyBot has no service list; a free-text "what do you need?" field is enough
- Rescheduling and cancellation by the lead — v1 is book-only; changes go through the business
- Payment or deposit collection

## Compounding opportunity

ServiceTitan's first step is *"Where are you? We'll check if we service your area."* BizzyBot cannot ask that today because service areas are not structured data — which is exactly **AI-brain roadmap #2 (service-area zips/radius + business-hours fields)**. Build #2 first and the booking page gets a genuine coverage check for free, plus hours-aware availability. That ordering is worth respecting: #2 makes this page materially better, and #2 is independently the highest-value roadmap item.

## Success criteria

1. A lead lands on the page from a phone, picks a time, and the event appears on the owner's Outlook calendar with an invite sent.
2. The booking appears in Leads as a contact with `channel = 'booking'`, like every other channel.
3. The link works when pasted into a Google Business Profile appointment field.
4. Hammering the public endpoint does not fill a real calendar with junk.
