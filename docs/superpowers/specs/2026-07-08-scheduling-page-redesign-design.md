# Scheduling Page Redesign — Design

**Date:** 2026-07-08 · **Status:** approved by founder

## Problem

`/scheduling` is a narrow `max-w-2xl` column of three small cards; two-thirds of
the viewport is empty. The page also under-sells reality: since the 2026-07-07
deep dive, scheduling includes full Outlook AI booking (real free slots →
`[BOOK:]` → calendar event + invite), a `business_timezone` column with **no
UI**, and real `appointment_booked` analytics events with nowhere to display.

## Layout

`max-w-6xl`, responsive grid `lg:grid-cols-[400px,1fr]` (stacks on mobile).

### Left column — settings

1. **Your Booking Link** card (existing, unchanged).
2. **AI Auto-Send** card (existing, unchanged).
3. **Outlook AI Booking** card (new):
   - Connection status: green dot + connected email, or "Connect Outlook" CTA
     linking to `/email` (existing OAuth flow lives there).
   - **Timezone** select (Eastern / Central / Mountain / Arizona / Pacific /
     Alaska / Hawaii) → persists `customers.business_timezone`. Controls the
     9am–5pm window the AI offers and how slot times are displayed.
   - One-line explainer of direct AI booking.
4. Single **Save** button persists `booking_url`, `booking_auto_send`,
   `business_timezone`.

### Right column — live, read-only

1. **This Week** — owner's real Outlook events, next 7 days, grouped by day,
   times in business timezone. Backed by new `getWeekAgenda(clerkUserId)` in
   `lib/microsoft-calendar.js` (Graph `calendarView`, `$select=subject,start,end`),
   exposed via `GET /api/outlook/calendar?view=agenda`.
2. **Times the AI is offering right now** — the exact free slots leads get,
   from existing `GET /api/outlook/calendar` (`getAvailableSlots`). Live sanity
   check for the timezone picker.
3. **AI-booked appointments** — recent `appointment_booked` events (when,
   attendee, channel), returned as `aiBookings` on the existing
   `GET /api/customer/scheduling` response (page already calls it).

### States

- **Outlook not connected:** right column is a single panel selling the
  feature ("Connect Outlook and the AI books appointments straight onto your
  calendar") with a connect CTA.
- **Agenda/slots fetch fails:** quiet inline "couldn't load calendar" line;
  settings column unaffected.
- **No AI bookings yet:** "No AI-booked appointments yet — they'll appear
  here."

## API changes

- `GET /api/customer/scheduling`: add `business_timezone` + `aiBookings`
  (last 10 `appointment_booked` events for the customer).
- `POST /api/customer/scheduling`: accept `business_timezone`.
- `GET /api/outlook/calendar?view=agenda`: returns `{ events, timezone }`.
- `lib/microsoft-calendar.js`: new `getWeekAgenda()`.

No new tables, no new dependencies.

## Out of scope

Calendly OAuth (decided link-only 2026-07-07), document receiving, editing
calendar events from BizzyBot, non-US timezones (add to the list if a customer
asks).
