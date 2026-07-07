'use client';

import { useState, useEffect } from 'react';
import { Phone, PhoneCall, PhoneOff, Clock, Mic, RefreshCw, ChevronDown, ChevronUp, Zap, ArrowUpRight } from 'lucide-react';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatPhone(phone) {
  if (!phone) return 'Unknown caller';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function CallRow({ call }) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = call.status === 'completed' || call.status === 'customer-ended-call' || call.status === 'assistant-ended-call';

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => call.transcript && setExpanded(p => !p)}
        className={`w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors ${call.transcript ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          {isCompleted
            ? <PhoneCall className="w-4 h-4 text-green-400" />
            : <PhoneOff className="w-4 h-4 text-red-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium">{formatPhone(call.caller_phone)}</div>
          <div className="text-gray-500 text-xs">{timeAgo(call.started_at)}</div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-gray-300 text-sm">{formatDuration(call.duration_seconds)}</div>
            <div className={`text-xs capitalize ${isCompleted ? 'text-green-500' : 'text-gray-600'}`}>
              {call.status?.replace(/-/g, ' ') || 'unknown'}
            </div>
          </div>
          {call.transcript && (
            expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </div>
      </button>

      {expanded && call.transcript && (
        <div className="px-4 pb-4 border-t border-gray-800/50 pt-3 space-y-2">
          {call.summary && (
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-violet-400 font-medium mb-1">AI Summary</p>
              <p className="text-gray-300 text-xs leading-relaxed">{call.summary}</p>
            </div>
          )}
          <div className="bg-[#0D1117] rounded-lg px-3 py-2 max-h-48 overflow-y-auto">
            <p className="text-xs text-gray-500 font-medium mb-2">Transcript</p>
            <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap">{call.transcript}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VoicePage() {
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState('');

  // Call-handling settings (ring owner first vs AI first)
  const [forwardCell, setForwardCell] = useState('');
  const [callMode, setCallMode] = useState('human_first');
  const [ringSeconds, setRingSeconds] = useState(18);
  const [savingCall, setSavingCall] = useState(false);
  const [callMsg, setCallMsg] = useState('');

  async function saveCallSettings() {
    setSavingCall(true);
    setCallMsg('');
    try {
      const res = await fetch('/api/vapi/call-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forwardCell, callMode, ringSeconds }),
      });
      const data = await res.json();
      setCallMsg(data.success ? '✓ Saved' : (data.error || 'Failed to save'));
    } catch {
      setCallMsg('Something went wrong');
    }
    setSavingCall(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statusRes, statsRes] = await Promise.all([
        fetch('/api/vapi/provision'),
        fetch('/api/vapi/stats'),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      try {
        const csRes = await fetch('/api/vapi/call-settings');
        if (csRes.ok) {
          const cs = await csRes.json();
          setForwardCell(cs.forwardCell || '');
          setCallMode(cs.callMode || 'human_first');
          setRingSeconds(cs.ringSeconds ?? 18);
        }
      } catch {}
    } catch {}
    setLoading(false);
  }

  async function handleProvision() {
    setProvisioning(true);
    setError('');
    try {
      const res = await fetch('/api/vapi/provision', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to set up Voice AI. Please try again.');
      } else {
        await loadData();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setProvisioning(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-7 h-7 text-violet-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading voice dashboard...</p>
        </div>
      </div>
    );
  }

  const minutesUsed = stats?.minutesUsed || 0;
  const minutesLimit = stats?.minutesLimit || 15;
  const minutesPct = Math.min(100, Math.round((minutesUsed / minutesLimit) * 100));
  const calls = stats?.calls || [];
  const plan = stats?.plan || 'starter';
  const isAtLimit = minutesUsed >= minutesLimit;

  const UPGRADE_PLAN = { starter: 'Professional', professional: 'Business' };
  const UPGRADE_MINUTES = { starter: 100, professional: 400 };
  const nextPlan = UPGRADE_PLAN[plan];
  const nextMinutes = UPGRADE_MINUTES[plan];

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center">
            <Mic className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Voice Calls</h1>
            <p className="text-sm text-gray-500">Your AI answers every call, 24/7</p>
          </div>
        </div>
        {status?.provisioned && (
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        )}
      </div>

      {/* Not provisioned */}
      {!status?.provisioned && (
        <div className="bg-[#161B22] border border-gray-800 rounded-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center mx-auto">
            <Phone className="w-7 h-7 text-violet-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg mb-1">Set Up AI Voice</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              {status?.hasNumber
                ? "Your phone number is ready. Activate Voice AI and your AI will answer every call using your business information."
                : "You need an SMS number assigned before setting up Voice AI. Go to SMS → Get My Number first."}
            </p>
          </div>

          {status?.hasNumber && (
            <>
              <div className="bg-[#0D1117] border border-gray-800 rounded-lg p-4 max-w-sm mx-auto text-left space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="text-gray-300">Same number as your SMS</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="text-gray-300">Uses your AI settings automatically</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="text-gray-300">Full transcripts saved after every call</span>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 max-w-sm mx-auto">{error}</p>
              )}

              <button
                onClick={handleProvision}
                disabled={provisioning}
                className="flex items-center gap-2 mx-auto px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed"
              >
                {provisioning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                {provisioning ? 'Setting up...' : 'Activate Voice AI'}
              </button>
            </>
          )}

          {!status?.hasNumber && (
            <a
              href="/customer-sms-dashboard"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <Phone className="w-4 h-4" />
              Go to SMS Setup
            </a>
          )}
        </div>
      )}

      {/* Provisioned — live dashboard */}
      {status?.provisioned && (
        <>
          {/* Status + phone number */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Status</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white font-semibold">Active</span>
              </div>
              <p className="text-gray-500 text-xs mt-1">AI is answering calls</p>
            </div>

            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your Phone Number</p>
              <p className="text-white font-semibold text-lg">{formatPhone(status.phoneNumber)}</p>
              <p className="text-gray-500 text-xs mt-1">SMS + Voice share this number</p>
            </div>

            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Calls This Month</p>
              <p className="text-white font-semibold text-lg">{calls.filter(c => {
                const d = new Date(c.started_at);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length}</p>
              <p className="text-gray-500 text-xs mt-1">All time: {calls.length}</p>
            </div>
          </div>

          {/* Call handling */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-violet-400" />
              <span className="text-white font-medium text-sm">Call Handling</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setCallMode('human_first')}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  callMode === 'human_first' ? 'bg-violet-500/10 border-violet-500/40' : 'bg-[#0D1117] border-gray-800 hover:border-gray-700'
                }`}
              >
                <p className="text-white text-sm font-medium">Ring my phone first</p>
                <p className="text-gray-500 text-xs mt-1">Calls ring your cell; the AI answers only if you can't pick up.</p>
              </button>
              <button
                onClick={() => setCallMode('ai_first')}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  callMode === 'ai_first' ? 'bg-violet-500/10 border-violet-500/40' : 'bg-[#0D1117] border-gray-800 hover:border-gray-700'
                }`}
              >
                <p className="text-white text-sm font-medium">AI answers first</p>
                <p className="text-gray-500 text-xs mt-1">The AI picks up every call immediately.</p>
              </button>
            </div>

            {callMode === 'human_first' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Your cell phone (where calls forward)</label>
                  <input
                    type="tel"
                    value={forwardCell}
                    onChange={(e) => setForwardCell(e.target.value)}
                    placeholder="(858) 555-0123"
                    className="w-full bg-[#0D1117] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Ring for (seconds before AI takes over)</label>
                  <input
                    type="number"
                    min={5}
                    max={45}
                    value={ringSeconds}
                    onChange={(e) => setRingSeconds(e.target.value)}
                    className="w-full bg-[#0D1117] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={saveCallSettings}
                disabled={savingCall}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {savingCall ? 'Saving…' : 'Save Call Settings'}
              </button>
              {callMsg && <span className="text-sm text-gray-400">{callMsg}</span>}
            </div>
            <p className="text-xs text-gray-600">
              When you miss a forwarded call, the AI answers the caller and you get a text + email about the lead.
            </p>
          </div>

          {/* Minutes usage */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <span className="text-white font-medium text-sm">Minutes Used This Month</span>
                <span className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full capitalize">{plan}</span>
              </div>
              <span className="text-gray-400 text-sm">
                <span className={minutesPct >= 90 ? 'text-red-400 font-semibold' : 'text-white'}>{minutesUsed}</span>
                <span className="text-gray-600"> / {minutesLimit} min</span>
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${minutesPct >= 90 ? 'bg-red-500' : minutesPct >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                style={{ width: `${minutesPct}%` }}
              />
            </div>
            {minutesPct >= 80 && nextPlan && (
              <div className={`mt-3 flex items-center justify-between p-3 rounded-lg border ${
                isAtLimit
                  ? 'bg-red-500/10 border-red-500/20'
                  : 'bg-amber-500/10 border-amber-500/20'
              }`}>
                <div>
                  <p className={`text-xs font-medium ${isAtLimit ? 'text-red-400' : 'text-amber-400'}`}>
                    {isAtLimit
                      ? `You've used all ${minutesLimit} minutes on your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`
                      : `Almost at your ${minutesLimit} min ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan limit`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upgrade to {nextPlan} for {nextMinutes} minutes/mo
                  </p>
                </div>
                <a
                  href="/settings?tab=subscription"
                  className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors flex-shrink-0 ml-3"
                >
                  Upgrade <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Call log */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-violet-400" />
              <h3 className="text-white font-medium text-sm">Recent Calls</h3>
              <span className="ml-auto text-gray-600 text-xs">Click a call to view transcript</span>
            </div>

            {calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <Phone className="w-8 h-8 text-gray-700 mb-3" />
                <p className="text-gray-500 text-sm">No calls yet</p>
                <p className="text-gray-600 text-xs mt-1">Calls will appear here after your first inbound call</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {calls.map(call => (
                  <CallRow key={call.vapi_call_id} call={call} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
