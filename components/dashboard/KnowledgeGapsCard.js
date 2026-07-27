'use client';

import { useState, useEffect } from 'react';
import { Brain, Check, X, MessageSquare, Mail, CheckCircle2 } from 'lucide-react';

const CHANNEL_LABELS = {
  sms: 'SMS', gmail: 'email', email: 'email', chat: 'chat',
  facebook: 'Facebook', instagram: 'Instagram', voice: 'call',
};

function relativeDay(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return then.toLocaleDateString('en-US', { weekday: 'short' });
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function KnowledgeGapsCard() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openTopic, setOpenTopic] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [waiting, setWaiting] = useState(null); // { topic, answer, leads }
  const [busyLead, setBusyLead] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/customer/knowledge-gaps');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch {
      // Render nothing rather than a green all-clear: claiming "your AI
      // answered everything" when we simply could not load is worse than
      // showing no card at all.
      setLoadFailed(true);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveAnswer(topic) {
    if (!draft.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/customer/knowledge-gaps/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, answer: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save that answer.');
      } else {
        setWaiting({ topic, answer: draft, leads: data.leads || [] });
        setOpenTopic(null);
        setDraft('');
        load();
      }
    } catch {
      setError('Could not save that answer.');
    }
    setSaving(false);
  }

  async function dismiss(topic) {
    await fetch('/api/customer/knowledge-gaps/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    }).catch(() => {});
    load();
  }

  async function followUp(gapId, method) {
    setBusyLead(`${gapId}-${method}`);
    setError('');
    try {
      const res = await fetch('/api/customer/knowledge-gaps/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gapId, method, answer: waiting?.answer }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send that.');
      } else {
        setWaiting(w => w ? { ...w, leads: w.leads.filter(l => l.gapId !== gapId) } : w);
      }
    } catch {
      setError('Could not send that.');
    }
    setBusyLead(null);
  }

  if (loading) return null;

  // The follow-up panel renders BEFORE the loadFailed gate. It is driven by
  // `waiting`, which came from a save that already succeeded — a failed
  // background refresh must never hide it. These leads exist nowhere else:
  // a fresh mount only fetches open gaps, so hiding this panel loses the
  // "who is still waiting" list for good.
  if (waiting && waiting.leads.length > 0) {
    return (
      <div className="bg-[#161B22] border border-violet-500/20 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold text-sm">Answer saved — these people never got one</h2>
          <button onClick={() => setWaiting(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-300">
            Done
          </button>
        </div>
        <div className="p-3 space-y-2">
          {error && <p className="text-xs text-red-400 px-1">{error}</p>}
          {waiting.leads.map(lead => (
            <div key={lead.gapId} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-[#0D1117] border border-gray-800">
              <span className="text-sm text-white">
                {lead.contactName || lead.contactPhone || lead.contactEmail || 'Unknown'}
              </span>
              <span className="text-xs text-gray-500">
                {CHANNEL_LABELS[lead.channel] || lead.channel} · &ldquo;{lead.question}&rdquo;
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {lead.contactPhone && (
                  <button
                    onClick={() => followUp(lead.gapId, 'sms')}
                    disabled={busyLead === `${lead.gapId}-sms`}
                    className="px-2.5 py-1 text-xs rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 flex items-center gap-1"
                  >
                    <MessageSquare className="w-3 h-3" /> Text
                  </button>
                )}
                {lead.contactEmail && (
                  <button
                    onClick={() => followUp(lead.gapId, 'email')}
                    disabled={busyLead === `${lead.gapId}-email`}
                    className="px-2.5 py-1 text-xs rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" /> Email
                  </button>
                )}
                <button
                  onClick={() => followUp(lead.gapId, 'manual')}
                  disabled={busyLead === `${lead.gapId}-manual`}
                  className="px-2.5 py-1 text-xs rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> I handled it
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Only the queue list below depends on a successful load.
  if (loadFailed) return null;

  if (groups.length === 0) {
    return (
      <div className="bg-[#161B22] border border-gray-800 rounded-xl px-5 py-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <p className="text-sm text-gray-400">
          Your AI answered everything it was asked. Nothing to teach it right now.
        </p>
      </div>
    );
  }

  const total = groups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="bg-[#161B22] border border-violet-500/20 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
        <Brain className="w-4 h-4 text-violet-400" />
        <h2 className="text-white font-semibold text-sm">Your AI got stumped</h2>
        <span className="px-1.5 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full font-medium">
          {total}
        </span>
        <span className="ml-auto text-xs text-gray-500">Answer once — every channel learns it</span>
      </div>

      <div className="p-3 space-y-2">
        {error && <p className="text-xs text-red-400 px-1">{error}</p>}

        {groups.map(group => (
          <div key={group.topic} className="rounded-lg bg-[#0D1117] border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-sm text-white font-medium">{group.label}</span>
              <span className="text-xs text-gray-500">asked {group.count}×</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => { setOpenTopic(openTopic === group.topic ? null : group.topic); setDraft(''); }}
                  className="px-2.5 py-1 text-xs rounded-lg bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
                >
                  {openTopic === group.topic ? 'Cancel' : 'Answer'}
                </button>
                <button
                  onClick={() => dismiss(group.topic)}
                  title="Not worth answering"
                  className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="px-3 pb-2.5 space-y-1">
              {group.questions.map(q => (
                <div key={q.id} className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span className="text-gray-300">&ldquo;{q.question}&rdquo;</span>
                  <span className="text-gray-600">
                    {q.contactName || q.contactPhone || q.contactEmail || 'unknown'} · {CHANNEL_LABELS[q.channel] || q.channel} · {relativeDay(q.createdAt)}
                  </span>
                </div>
              ))}
            </div>

            {openTopic === group.topic && (
              <div className="px-3 pb-3 space-y-2 border-t border-gray-800 pt-2.5">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Type the answer your AI should give from now on…"
                  className="w-full h-20 bg-[#161B22] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => saveAnswer(group.topic)}
                  disabled={saving || !draft.trim()}
                  className="px-3 py-1.5 text-xs rounded-lg bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save to all channels'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
