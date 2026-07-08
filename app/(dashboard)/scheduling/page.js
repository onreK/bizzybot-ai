'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Save, Loader2, Check, Info, Copy, ExternalLink,
  Clock, CalendarCheck, CalendarDays, Sparkles, AlertCircle
} from 'lucide-react';

const PLATFORMS = [
  { name: 'Calendly',    placeholder: 'https://calendly.com/yourbusiness/consultation' },
  { name: 'Acuity',      placeholder: 'https://acuityscheduling.com/schedule.php?owner=...' },
  { name: 'Square',      placeholder: 'https://squareup.com/appointments/book/...' },
  { name: 'Vagaro',      placeholder: 'https://www.vagaro.com/yourbusiness' },
  { name: 'SimplyBook',  placeholder: 'https://yourbusiness.simplybook.me' },
  { name: 'Other',       placeholder: 'https://yourbookingpage.com' },
];

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Phoenix',     label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HT)' },
];

const CHANNEL_LABELS = { gmail: 'Gmail', outlook: 'Outlook', email: 'Email', sms: 'SMS', chat: 'Web Chat', facebook: 'Facebook', instagram: 'Instagram', voice: 'Voice' };

export default function SchedulingPage() {
  const [scheduling, setScheduling] = useState({ booking_url: '', booking_auto_send: true, business_timezone: 'America/New_York' });
  const [aiBookings, setAiBookings] = useState([]);
  const [outlook, setOutlook] = useState({ connected: false, email: '' });
  const [slots, setSlots] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [calendarError, setCalendarError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calLoading, setCalLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const tz = scheduling.business_timezone || 'America/New_York';

  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    setCalendarError(false);
    try {
      const [slotsRes, agendaRes] = await Promise.all([
        fetch('/api/outlook/calendar'),
        fetch('/api/outlook/calendar?view=agenda'),
      ]);
      if (slotsRes.ok) { const d = await slotsRes.json(); setSlots(d.slots || []); }
      if (agendaRes.ok) { const d = await agendaRes.json(); setAgenda(d.events || []); }
      if (!slotsRes.ok && !agendaRes.ok) setCalendarError(true);
    } catch {
      setCalendarError(true);
    } finally {
      setCalLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [schedRes, outlookRes] = await Promise.all([
          fetch('/api/customer/scheduling'),
          fetch('/api/auth/outlook/status'),
        ]);
        if (schedRes.ok) {
          const data = await schedRes.json();
          setScheduling({
            booking_url: data.booking_url || '',
            booking_auto_send: data.booking_auto_send !== false,
            business_timezone: data.business_timezone || 'America/New_York',
          });
          setAiBookings(data.aiBookings || []);
        }
        if (outlookRes.ok) {
          const o = await outlookRes.json();
          setOutlook({ connected: !!o.connected, email: o.email || '' });
          if (o.connected) fetchCalendar();
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [fetchCalendar]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/customer/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduling),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        // Slots depend on the timezone setting — refresh so the preview matches
        if (outlook.connected) fetchCalendar();
      }
    } catch {}
    finally { setSaving(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(scheduling.booking_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });
  const fmtSlot = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz, timeZoneName: 'short' });
  const dayKey = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: tz });

  // Group agenda events by business-local day
  const agendaByDay = agenda.reduce((acc, ev) => {
    const key = dayKey(ev.start);
    (acc[key] = acc[key] || []).push(ev);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Scheduling</h1>
          <p className="text-sm text-gray-500">
            The AI books appointments on your calendar, or sends your booking link — your choice.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-6 items-start">

        {/* ─── LEFT: settings ─────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Booking URL */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-1">Your Booking Link</h2>
            <p className="text-gray-400 text-sm mb-5">
              Works with any booking platform — paste your link below.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {PLATFORMS.map(p => (
                <span key={p.name} className="px-2.5 py-1 bg-[#0D1117] border border-gray-800 rounded-full text-xs text-gray-400">
                  {p.name}
                </span>
              ))}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Booking URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={scheduling.booking_url}
                  onChange={e => setScheduling(s => ({ ...s, booking_url: e.target.value }))}
                  placeholder="https://calendly.com/yourbusiness/consultation"
                  className="flex-1 min-w-0 px-4 py-2.5 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500 text-sm"
                />
                {scheduling.booking_url && (
                  <button
                    onClick={handleCopy}
                    title="Copy link"
                    className="px-3 py-2.5 bg-[#0D1117] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
                {scheduling.booking_url && (
                  <a
                    href={scheduling.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open link"
                    className="px-3 py-2.5 bg-[#0D1117] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              {scheduling.booking_url && (
                <p className="text-green-400 text-xs flex items-center gap-1 pt-1">
                  <Check className="w-3 h-3" /> AI will share this link across all channels
                </p>
              )}
            </div>
          </div>

          {/* AI Auto-Send */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">AI Auto-Send</h3>
                <p className="text-gray-400 text-sm mt-0.5">
                  The AI shares your booking link whenever a customer asks to schedule — across every channel.
                </p>
              </div>
              <button
                onClick={() => setScheduling(s => ({ ...s, booking_auto_send: !s.booking_auto_send }))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 ml-6 items-center rounded-full transition-colors ${
                  scheduling.booking_auto_send ? 'bg-violet-600' : 'bg-gray-700'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  scheduling.booking_auto_send ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Outlook AI Booking */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <h3 className="text-white font-semibold">Outlook AI Booking</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              When your Outlook calendar is connected, the AI offers your real open times and books confirmed appointments directly — invite included.
            </p>

            {outlook.connected ? (
              <div className="flex items-center gap-2 text-sm mb-4">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                <span className="text-green-400">Connected</span>
                {outlook.email && <span className="text-gray-500">· {outlook.email}</span>}
              </div>
            ) : (
              <a
                href="/email"
                className="inline-flex items-center gap-2 px-4 py-2 mb-4 bg-[#0D1117] border border-gray-700 hover:border-violet-500 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
              >
                <CalendarCheck className="w-4 h-4" />
                Connect Outlook
              </a>
            )}

            <label className="block text-sm font-medium text-gray-300 mb-2">Business Timezone</label>
            <select
              value={scheduling.business_timezone}
              onChange={e => setScheduling(s => ({ ...s, business_timezone: e.target.value }))}
              className="w-full px-4 py-2.5 bg-[#0D1117] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500"
            >
              {TIMEZONES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-gray-500 text-xs mt-2">
              The AI offers times between 9 AM and 5 PM in this timezone.
            </p>
          </div>

          {/* Manual send note */}
          <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-white text-sm font-medium mb-1">Sending it manually</h4>
                <p className="text-gray-400 text-sm leading-relaxed">
                  You can always copy your booking link and paste it into any conversation yourself. The AI handles it automatically, but you&apos;re in control.
                </p>
              </div>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>

        {/* ─── RIGHT: live calendar ───────────────────────────────── */}
        <div className="space-y-5">
          {!outlook.connected ? (
            /* Not connected — sell the feature instead of empty space */
            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-10 text-center">
              <CalendarDays className="w-12 h-12 text-violet-400/60 mx-auto mb-4" />
              <h3 className="text-white text-lg font-semibold mb-2">See your calendar here</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                Connect Outlook and this space shows your week at a glance, the open times
                your AI is offering leads, and every appointment it books for you —
                automatically, invite included.
              </p>
              <a
                href="/email"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <CalendarCheck className="w-4 h-4" />
                Connect Outlook Calendar
              </a>
            </div>
          ) : (
            <>
              {/* This Week */}
              <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-violet-400" />
                    This Week
                  </h3>
                  {calLoading && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
                </div>

                {calendarError ? (
                  <p className="text-gray-500 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500" /> Couldn&apos;t load your calendar right now.
                  </p>
                ) : Object.keys(agendaByDay).length === 0 && !calLoading ? (
                  <p className="text-gray-500 text-sm">Nothing on the calendar for the next 7 days — wide open.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(agendaByDay).map(([day, events]) => (
                      <div key={day}>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{day}</div>
                        <div className="space-y-1.5">
                          {events.map((ev, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-[#0D1117] border border-gray-800 rounded-lg">
                              <span className="text-violet-400 text-xs font-medium w-20 flex-shrink-0">{fmtTime(ev.start)}</span>
                              <span className="text-gray-300 text-sm truncate">{ev.subject}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Slots the AI is offering */}
              <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-green-400" />
                  Times the AI is offering right now
                </h3>
                <p className="text-gray-500 text-xs mb-4">
                  Pulled live from your calendar — these are the open slots leads can book.
                </p>
                {slots.length === 0 && !calLoading ? (
                  <p className="text-gray-500 text-sm">No open slots found in the next 7 business days.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s, i) => (
                      <span key={i} className="px-3 py-1.5 bg-green-500/5 border border-green-500/20 rounded-lg text-sm text-green-300">
                        {fmtSlot(s.start)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* AI-booked appointments */}
              <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6">
                <h3 className="text-white font-semibold flex items-center gap-2 mb-1">
                  <CalendarCheck className="w-4 h-4 text-violet-400" />
                  Booked by your AI
                </h3>
                <p className="text-gray-500 text-xs mb-4">
                  Appointments the AI scheduled for you, most recent first.
                </p>
                {aiBookings.length === 0 ? (
                  <p className="text-gray-500 text-sm">No AI-booked appointments yet — they&apos;ll appear here.</p>
                ) : (
                  <div className="space-y-2">
                    {aiBookings.map((b, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-[#0D1117] border border-gray-800 rounded-lg">
                        <div className="min-w-0">
                          <div className="text-sm text-white">
                            {b.start ? fmtSlot(b.start + (b.start.length === 16 ? ':00Z' : '')) : 'Appointment'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {b.attendee || 'No email on file'}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded-full px-2.5 py-1 flex-shrink-0 ml-3">
                          {CHANNEL_LABELS[b.channel] || b.channel}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
