import { query } from './database.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

// ── Token management ────────────────────────────────────────────────────────

async function getValidToken(clerkUserId) {
  const result = await query(
    `SELECT access_token, refresh_token, token_expiry
     FROM outlook_connections WHERE user_id = $1 AND status = 'connected' LIMIT 1`,
    [clerkUserId]
  ).catch(() => ({ rows: [] }));

  const conn = result.rows[0];
  if (!conn) return null;

  // Refresh if expiring within 5 minutes
  if (conn.token_expiry && Date.now() < conn.token_expiry - 300000) {
    return conn.access_token;
  }
  if (!conn.refresh_token) return conn.access_token;

  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await res.json();
  if (!tokens.access_token) return conn.access_token;

  const newExpiry = Date.now() + tokens.expires_in * 1000;
  await query(
    `UPDATE outlook_connections SET access_token = $1, token_expiry = $2, updated_at = NOW()
     WHERE user_id = $3`,
    [tokens.access_token, newExpiry, clerkUserId]
  ).catch(() => {});

  return tokens.access_token;
}

async function graphRequest(accessToken, method, path, body) {
  const res = await fetch(`${GRAPH}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 403) throw new Error('NEEDS_RECONNECT');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph ${method} ${path} failed (${res.status}): ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Availability ─────────────────────────────────────────────────────────────

const DEFAULT_TIMEZONE = 'America/New_York';

// The customer's local timezone — business hours and displayed times use this.
// Falls back to Eastern until a settings UI writes business_timezone.
export async function getBusinessTimezone(clerkUserId) {
  const result = await query(
    `SELECT business_timezone FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
    [clerkUserId]
  ).catch(() => ({ rows: [] }));
  return result.rows[0]?.business_timezone || DEFAULT_TIMEZONE;
}

// How long the customer's meetings run (Scheduling page setting; default 1hr)
export async function getMeetingDurationMinutes(clerkUserId) {
  const result = await query(
    `SELECT meeting_duration_minutes FROM customers WHERE clerk_user_id = $1 LIMIT 1`,
    [clerkUserId]
  ).catch(() => ({ rows: [] }));
  const minutes = Number(result.rows[0]?.meeting_duration_minutes);
  return [15, 30, 45, 60].includes(minutes) ? minutes : 60;
}

// Weekday + hour of a Date as seen in the business's timezone
function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(date);
  return {
    weekday: parts.find(p => p.type === 'weekday')?.value,
    hour: parseInt(parts.find(p => p.type === 'hour')?.value, 10),
  };
}

// Returns up to 6 free slots (customer's configured meeting length) across
// the next 7 days, inside 9am–5pm *business-local* time (was UTC before —
// which offered 5am meetings to Eastern-time businesses)
export async function getAvailableSlots(clerkUserId) {
  const token = await getValidToken(clerkUserId);
  if (!token) return { slots: [], needsReconnect: false, error: 'not_connected' };

  try {
    const timezone = await getBusinessTimezone(clerkUserId);
    const durationMs = (await getMeetingDurationMinutes(clerkUserId)) * 60 * 1000;
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);

    // Fetch existing events in window
    const startStr = now.toISOString();
    const endStr = end.toISOString();
    const path = `/me/calendarView?startDateTime=${startStr}&endDateTime=${endStr}&$select=start,end&$top=100`;

    const data = await graphRequest(token, 'GET', path);
    const busySlots = (data?.value || []).map(e => ({
      start: new Date(e.start.dateTime + (e.start.dateTime.endsWith('Z') ? '' : 'Z')).getTime(),
      end:   new Date(e.end.dateTime   + (e.end.dateTime.endsWith('Z')   ? '' : 'Z')).getTime(),
    }));

    const available = [];
    const cursor = new Date(now);
    cursor.setMinutes(0, 0, 0);
    cursor.setHours(cursor.getHours() + 1); // Start from next full hour

    while (available.length < 6 && cursor < end) {
      const { weekday, hour } = localParts(cursor, timezone);

      // Skip weekends, skip outside 9am–4pm local (so events end by 5pm)
      if (weekday !== 'Sat' && weekday !== 'Sun' && hour >= 9 && hour < 16) {
        const slotStart = cursor.getTime();
        const slotEnd = slotStart + durationMs;

        const isBusy = busySlots.some(b => b.start < slotEnd && b.end > slotStart);
        if (!isBusy) {
          available.push({ start: new Date(slotStart), end: new Date(slotEnd) });
        }
      }

      cursor.setHours(cursor.getHours() + 1);
    }

    return { slots: available, timezone, needsReconnect: false };
  } catch (err) {
    if (err.message === 'NEEDS_RECONNECT') {
      return { slots: [], needsReconnect: true };
    }
    console.error('⚠️ getAvailableSlots error:', err.message);
    return { slots: [], needsReconnect: false, error: err.message };
  }
}

// Format slots as readable text for the AI system prompt. Displayed times are
// business-local (with timezone abbreviation); the [SLOT:] marker stays UTC
// ISO so [BOOK:] parsing is unambiguous.
export function formatSlotsForAI(slots, timeZone = DEFAULT_TIMEZONE) {
  if (!slots?.length) return '';
  const lines = slots.map(s => {
    const d = s.start;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone });
    const monthDay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone, timeZoneName: 'short' });
    const isoStart = d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM (UTC)
    return `- ${dayName} ${monthDay} at ${time} [SLOT:${isoStart}]`;
  });
  return lines.join('\n');
}

// The owner's real events for the next 7 days — powers the "This Week"
// agenda on the Scheduling page
export async function getWeekAgenda(clerkUserId) {
  const token = await getValidToken(clerkUserId);
  if (!token) return { events: [], error: 'not_connected' };

  try {
    const timezone = await getBusinessTimezone(clerkUserId);
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 7);

    const path = `/me/calendarView?startDateTime=${now.toISOString()}&endDateTime=${end.toISOString()}` +
      `&$select=subject,start,end&$orderby=start/dateTime&$top=50`;
    const data = await graphRequest(token, 'GET', path);

    const events = (data?.value || []).map(e => ({
      subject: e.subject || '(no title)',
      start: new Date(e.start.dateTime + (e.start.dateTime.endsWith('Z') ? '' : 'Z')).toISOString(),
      end:   new Date(e.end.dateTime   + (e.end.dateTime.endsWith('Z')   ? '' : 'Z')).toISOString(),
    }));

    return { events, timezone };
  } catch (err) {
    if (err.message === 'NEEDS_RECONNECT') return { events: [], needsReconnect: true };
    console.error('⚠️ getWeekAgenda error:', err.message);
    return { events: [], error: err.message };
  }
}

// ── Event creation ────────────────────────────────────────────────────────────

function formatPhoneForTitle(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export async function createCalendarEvent(clerkUserId, {
  startISO,       // e.g. "2026-06-05T14:00"
  attendeeEmail,
  attendeeName,
  attendeePhone,  // shown in the title so the owner can always call back
  businessName,
}) {
  const token = await getValidToken(clerkUserId);
  if (!token) throw new Error('No Outlook connection found');

  const start = new Date(startISO + ':00Z');
  const durationMs = (await getMeetingDurationMinutes(clerkUserId)) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  // Identify the lead as specifically as we can: name, else phone, else email
  const leadLabel = attendeeName || formatPhoneForTitle(attendeePhone) || attendeeEmail || 'Lead';

  const event = {
    subject: `Meeting with ${leadLabel} — ${businessName || 'BizzyBot AI'}`,
    start:   { dateTime: start.toISOString(), timeZone: 'UTC' },
    end:     { dateTime: end.toISOString(),   timeZone: 'UTC' },
    body: {
      contentType: 'Text',
      content:
        `This appointment was scheduled automatically via BizzyBot AI on behalf of ${businessName || 'your business'}.` +
        (attendeePhone ? `\nLead phone: ${formatPhoneForTitle(attendeePhone)}` : '') +
        (attendeeEmail ? `\nLead email: ${attendeeEmail}` : ''),
    },
    ...(attendeeEmail ? {
      attendees: [{
        emailAddress: { address: attendeeEmail, name: attendeeName || attendeeEmail },
        type: 'required',
      }],
    } : {}),
  };

  const created = await graphRequest(token, 'POST', '/me/events', event);
  return { success: true, eventId: created?.id, webLink: created?.webLink };
}
