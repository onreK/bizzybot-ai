'use client';

import { useState, useEffect } from 'react';
import { Calendar, Save, Loader2, Check, Info, Copy, ExternalLink } from 'lucide-react';

const PLATFORMS = [
  { name: 'Calendly',    placeholder: 'https://calendly.com/yourbusiness/consultation' },
  { name: 'Acuity',      placeholder: 'https://acuityscheduling.com/schedule.php?owner=...' },
  { name: 'Square',      placeholder: 'https://squareup.com/appointments/book/...' },
  { name: 'Vagaro',      placeholder: 'https://www.vagaro.com/yourbusiness' },
  { name: 'SimplyBook',  placeholder: 'https://yourbusiness.simplybook.me' },
  { name: 'Other',       placeholder: 'https://yourbookingpage.com' },
];

export default function SchedulingPage() {
  const [scheduling, setScheduling] = useState({ booking_url: '', booking_auto_send: true });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/customer/scheduling')
      .then(r => r.json())
      .then(data => setScheduling({ booking_url: data.booking_url || '', booking_auto_send: data.booking_auto_send !== false }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      }
    } catch {}
    finally { setSaving(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(scheduling.booking_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Scheduling</h1>
          <p className="text-sm text-gray-500">
            Connect your booking page so the AI can send it automatically when customers ask to schedule.
          </p>
        </div>
      </div>

      {/* Booking URL */}
      <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 mb-5">
        <h2 className="text-white font-semibold mb-1">Your Booking Link</h2>
        <p className="text-gray-400 text-sm mb-5">
          Works with any booking platform — paste your link below.
        </p>

        {/* Platform chips */}
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
              className="flex-1 px-4 py-2.5 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500 text-sm"
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
      <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">AI Auto-Send</h3>
            <p className="text-gray-400 text-sm mt-0.5 max-w-sm">
              When on, the AI automatically shares your booking link whenever a customer asks to schedule, book, or set up an appointment — across SMS, Email, Web Chat, Facebook, and Instagram.
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

      {/* Manual send note */}
      <div className="bg-[#0D1117] border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-white text-sm font-medium mb-1">Sending it manually</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              You can also copy your booking link using the button above and paste it directly into any conversation. The AI handles it automatically, but you're always in control.
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
  );
}
