'use client';

import { useState, useEffect } from 'react';
import {
  Mail, Users, Star, Phone, MessageCircle, Mic,
  RefreshCw, Sliders, Shield, Bot, Cpu, Save,
  CheckCircle, AlertCircle, AlertTriangle, Clock, FileText
} from 'lucide-react';

const TABS = [
  { id: 'email',     label: 'Email',      icon: Mail },
  { id: 'facebook',  label: 'Facebook',   icon: Users },
  { id: 'instagram', label: 'Instagram',  icon: Star },
  { id: 'text',      label: 'Text/SMS',   icon: Phone },
  { id: 'chatbot',   label: 'Chatbot',    icon: MessageCircle },
  { id: 'voice',     label: 'Voice AI',   icon: Mic },
];

const DEFAULT_CHANNEL = {
  businessName: '',
  industry: '',
  businessDescription: '',
  responseTone: 'Professional',
  responseLength: 'Short',
  knowledgeBase: '',
  customInstructions: '',
  escalationEnabled: false,
  escalationTriggers: '',
  escalationMessage: '',
  followupEnabled: false,
  followupDelayDays: 3,
  followupMaxCount: 2,
  documents: [],
};

const inputClass = "w-full px-4 py-2 bg-[#0D1117] border border-gray-800 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500 text-sm";
const selectClass = "px-3 py-1.5 bg-[#0D1117] border border-gray-800 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 [&>option]:bg-[#161B22]";
const toggleClass = "w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-violet-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600";

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className={toggleClass} />
    </label>
  );
}

function Section({ icon: Icon, iconColor = 'text-violet-400', title, children }) {
  return (
    <div className="bg-[#161B22] rounded-xl border border-gray-800 p-5">
      <h4 className="text-white font-medium mb-4 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {title}
      </h4>
      {children}
    </div>
  );
}

function SharedFields({ channel, ch, update, accentColor = 'text-violet-400' }) {
  return (
    <>
      {/* Top row: 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={Mail} iconColor={accentColor} title="Business Profile">
          <p className="text-xs text-gray-500 mb-3">Tell the AI about your business</p>
          <div className="space-y-3">
            <input placeholder="Business Name" value={ch.businessName} onChange={e => update(channel, 'businessName', e.target.value)} className={inputClass} />
            <input placeholder="Industry (e.g. Real Estate, Healthcare, Retail)" value={ch.industry} onChange={e => update(channel, 'industry', e.target.value)} className={inputClass} />
            <textarea placeholder="Business description..." value={ch.businessDescription} onChange={e => update(channel, 'businessDescription', e.target.value)} className={`${inputClass} h-24 resize-none`} />
          </div>
        </Section>

        <Section icon={Sliders} iconColor={accentColor} title="Communication Settings">
          <p className="text-xs text-gray-500 mb-3">Control the AI's tone and response style</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Response tone</label>
              <div className="grid grid-cols-2 gap-2">
                {['Professional', 'Casual', 'Formal', 'Friendly'].map(tone => (
                  <button
                    key={tone}
                    onClick={() => update(channel, 'responseTone', tone)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      ch.responseTone === tone
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >{tone}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-2">Response length</label>
              <div className="grid grid-cols-3 gap-2">
                {['Short', 'Medium', 'Long'].map(len => (
                  <button
                    key={len}
                    onClick={() => update(channel, 'responseLength', len)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      ch.responseLength === len
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >{len}</button>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Bottom row: 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section icon={Shield} iconColor={accentColor} title="Business Knowledge Base">
          <p className="text-xs text-gray-500 mb-3">Add FAQs, pricing, policies — the AI will use this to answer customers</p>
          <textarea placeholder="Enter business-specific information, FAQs, policies, etc..." value={ch.knowledgeBase} onChange={e => update(channel, 'knowledgeBase', e.target.value)} className={`${inputClass} h-40 resize-none`} />
        </Section>

        <Section icon={Bot} iconColor={accentColor} title="Custom AI Instructions">
          <p className="text-xs text-gray-500 mb-3">Tell the AI exactly how to behave and respond to customers</p>
          <textarea placeholder={`e.g. Never mention competitors by name.\nAlways end with a question to keep the conversation going.\nIf someone asks for pricing, give a range then offer a free consultation.\nNever promise same-day availability without checking the schedule first.\nIf a lead seems hesitant, offer a free estimate to reduce friction.\nAlways mention our 5-star rating when a lead asks why they should choose us.`} value={ch.customInstructions} onChange={e => update(channel, 'customInstructions', e.target.value)} className={`${inputClass} h-40 resize-none`} />
        </Section>
      </div>

      {/* Documents to Send */}
      <Section icon={FileText} iconColor="text-emerald-400" title="Documents / Forms to Send Leads">
        <p className="text-xs text-gray-500 mb-4">Add any documents leads need to complete before you begin — waivers, intake forms, service agreements, etc. The AI includes them naturally once a lead is ready to move forward.</p>
        <div className="space-y-3">
          {(ch.documents || []).map((doc, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-2">
                <input
                  placeholder="Document name (e.g. Liability Waiver)"
                  value={doc.description || ''}
                  onChange={e => {
                    const next = [...(ch.documents || [])];
                    next[i] = { ...next[i], description: e.target.value };
                    update(channel, 'documents', next);
                  }}
                  className={inputClass}
                />
                <input
                  type="url"
                  placeholder="https://docs.google.com/... or DocuSign/PandaDoc link"
                  value={doc.link || ''}
                  onChange={e => {
                    const next = [...(ch.documents || [])];
                    next[i] = { ...next[i], link: e.target.value };
                    update(channel, 'documents', next);
                  }}
                  className={inputClass}
                />
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
              </div>
              <button
                onClick={() => {
                  const next = (ch.documents || []).filter((_, idx) => idx !== i);
                  update(channel, 'documents', next);
                }}
                className="mt-1 text-gray-600 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
                title="Remove"
              >×</button>
            </div>
          ))}
          <button
            onClick={() => update(channel, 'documents', [...(ch.documents || []), { description: '', link: '', when: '' }])}
            className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add document
          </button>
          {(ch.documents || []).some(d => d.link && d.description) && (
            <p className="text-xs text-emerald-500">AI will include these links when a lead is ready to proceed.</p>
          )}
        </div>
      </Section>

      {/* Escalation Handling */}
      <Section icon={AlertTriangle} iconColor="text-amber-400" title="Escalation Handling">
        <p className="text-xs text-gray-500 mb-4">When the AI detects a situation it cannot handle (angry customers, legal questions, explicit requests for a human), it will step aside and send your custom message instead.</p>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-300 font-medium">Enable escalation</span>
          <Toggle checked={ch.escalationEnabled || false} onChange={e => update(channel, 'escalationEnabled', e.target.checked)} />
        </div>
        {ch.escalationEnabled && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Trigger keywords <span className="text-gray-600">(comma-separated)</span></label>
              <input
                placeholder="e.g. speak to human, lawsuit, refund, furious, manager"
                value={ch.escalationTriggers || ''}
                onChange={e => update(channel, 'escalationTriggers', e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-gray-600 mt-1">Leave blank to let the AI decide on its own — it's already instructed to flag situations it can't handle.</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Escalation message</label>
              <textarea
                placeholder="e.g. Thank you for reaching out. A member of our team will contact you personally within 24 hours to assist you directly."
                value={ch.escalationMessage || ''}
                onChange={e => update(channel, 'escalationMessage', e.target.value)}
                className={`${inputClass} h-24 resize-none`}
              />
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

export default function AISettingsPage() {
  const [activeTab, setActiveTab] = useState('email');
  const [settings, setSettings] = useState({
    email:     { ...DEFAULT_CHANNEL },
    facebook:  { ...DEFAULT_CHANNEL, autoRespondMessages: false, autoRespondComments: false },
    instagram: { ...DEFAULT_CHANNEL, autoRespondDMs: false, autoRespondComments: false },
    text:      { ...DEFAULT_CHANNEL, enableAutoResponses: false, hotLeadDetection: false, responseDelay: '' },
    chatbot:   { ...DEFAULT_CHANNEL, proactiveEngagement: false, collectContactInfo: false },
    voice:     { ...DEFAULT_CHANNEL, firstMessage: '' },
  });
  const [voiceSyncing, setVoiceSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/ai-settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(prev => {
            const next = { ...prev };
            Object.keys(data.settings).forEach(ch => {
              if (next[ch]) next[ch] = { ...next[ch], ...data.settings[ch] };
            });
            return next;
          });
        }
      }
    } catch (e) {
      console.error('Error loading AI settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const update = (channel, field, value) => {
    setSettings(prev => ({ ...prev, [channel]: { ...prev[channel], [field]: value } }));
  };

  const save = async (channel) => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, settings: settings[channel] }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error saving settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const saveVoice = async () => {
    setSaving(true);
    setVoiceSyncing(true);
    setMessage({ type: '', text: '' });
    try {
      // 1. Save to DB (same as other channels)
      await fetch('/api/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'voice', settings: settings.voice }),
      });
      // 2. Push updated settings to the Vapi assistant. The assistant keeps a
      // static copy of its instructions — an unsynced save means calls keep
      // using the OLD settings, so retry once and be honest on failure.
      let syncRes = await fetch('/api/vapi/provision', { method: 'PATCH' });
      if (!syncRes.ok) {
        syncRes = await fetch('/api/vapi/provision', { method: 'PATCH' });
      }
      if (syncRes.ok) {
        setMessage({ type: 'success', text: 'Voice AI settings saved and synced!' });
      } else {
        setMessage({ type: 'error', text: 'Settings saved, but syncing to your voice assistant failed — calls are still using your previous settings. Please click Save & Sync again.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error saving settings.' });
    } finally {
      setSaving(false);
      setVoiceSyncing(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 6000);
    }
  };

  const ch = settings[activeTab];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-7 h-7 text-violet-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center">
          <Cpu className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AI Settings</h1>
          <p className="text-sm text-gray-500">Control how your AI responds on each channel</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-2.5 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">

        {activeTab === 'email' && (
          <>
            <SharedFields channel="email" ch={ch} update={update} accentColor="text-blue-400" />

            {/* Automated Follow-ups — email only */}
            <Section icon={Clock} iconColor="text-blue-400" title="Automated Follow-ups">
              <p className="text-xs text-gray-500 mb-4">If a lead goes silent after the AI's last reply, automatically send a friendly follow-up to re-engage them.</p>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-300 font-medium">Enable follow-ups</span>
                <Toggle checked={ch.followupEnabled || false} onChange={e => update('email', 'followupEnabled', e.target.checked)} />
              </div>
              {ch.followupEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-2">Send follow-up after</label>
                    <div className="flex gap-2">
                      {[2, 3, 5, 7].map(days => (
                        <button
                          key={days}
                          onClick={() => update('email', 'followupDelayDays', days)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            (ch.followupDelayDays || 3) === days
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                          }`}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-2">Max follow-ups per lead</label>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(n => (
                        <button
                          key={n}
                          onClick={() => update('email', 'followupMaxCount', n)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            (ch.followupMaxCount || 2) === n
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                          }`}
                        >
                          {n}×
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Section>
          </>
        )}

        {activeTab === 'facebook' && (
          <>
            <SharedFields channel="facebook" ch={ch} update={update} accentColor="text-blue-400" />
            <Section icon={Users} iconColor="text-blue-400" title="Facebook AI Configuration">
              <p className="text-xs text-gray-500 mb-4">Configure AI for Facebook Messenger and post responses</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Auto-respond to messages</span>
                  <Toggle checked={ch.autoRespondMessages || false} onChange={e => update('facebook', 'autoRespondMessages', e.target.checked)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Auto-respond to comments</span>
                  <Toggle checked={ch.autoRespondComments || false} onChange={e => update('facebook', 'autoRespondComments', e.target.checked)} />
                </div>
              </div>
            </Section>
          </>
        )}

        {activeTab === 'instagram' && (
          <>
            <SharedFields channel="instagram" ch={ch} update={update} accentColor="text-pink-400" />
            <Section icon={Star} iconColor="text-pink-400" title="Instagram AI Configuration">
              <p className="text-xs text-gray-500 mb-4">Configure AI for Instagram DMs and post responses</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Auto-respond to DMs</span>
                  <Toggle checked={ch.autoRespondDMs || false} onChange={e => update('instagram', 'autoRespondDMs', e.target.checked)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Auto-respond to comments</span>
                  <Toggle checked={ch.autoRespondComments || false} onChange={e => update('instagram', 'autoRespondComments', e.target.checked)} />
                </div>
              </div>
            </Section>
          </>
        )}

        {activeTab === 'text' && (
          <>
            <SharedFields channel="text" ch={ch} update={update} accentColor="text-green-400" />
            <Section icon={Phone} iconColor="text-green-400" title="SMS/Text AI Configuration">
              <p className="text-xs text-gray-500 mb-4">Configure AI for text message responses and lead qualification</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Enable auto-responses</span>
                  <Toggle checked={ch.enableAutoResponses || false} onChange={e => update('text', 'enableAutoResponses', e.target.checked)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Hot lead detection</span>
                  <Toggle checked={ch.hotLeadDetection || false} onChange={e => update('text', 'hotLeadDetection', e.target.checked)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Response delay (seconds)</label>
                  <input type="number" placeholder="0" value={ch.responseDelay || ''} onChange={e => update('text', 'responseDelay', e.target.value)} className={inputClass} />
                </div>
              </div>
            </Section>
          </>
        )}

        {activeTab === 'chatbot' && (
          <>
            <SharedFields channel="chatbot" ch={ch} update={update} accentColor="text-violet-400" />
            <Section icon={MessageCircle} iconColor="text-violet-400" title="Web Chatbot Configuration">
              <p className="text-xs text-gray-500 mb-4">Configure AI for website chat widget responses</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Proactive engagement</span>
                  <Toggle checked={ch.proactiveEngagement || false} onChange={e => update('chatbot', 'proactiveEngagement', e.target.checked)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Collect contact info</span>
                  <Toggle checked={ch.collectContactInfo || false} onChange={e => update('chatbot', 'collectContactInfo', e.target.checked)} />
                </div>
              </div>
            </Section>
          </>
        )}

        {activeTab === 'voice' && (
          <>
            <SharedFields channel="voice" ch={ch} update={update} accentColor="text-violet-400" />
            <Section icon={Mic} iconColor="text-violet-400" title="Voice AI Configuration">
              <p className="text-xs text-gray-500 mb-4">Customize how your AI greets callers and behaves on phone calls. Changes are synced to your live assistant.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Greeting message <span className="text-gray-600">(what the AI says when it picks up)</span></label>
                  <input
                    placeholder={`e.g. Hi there! Thanks for calling ${ch.businessName || 'us'}. How can I help you today?`}
                    value={ch.firstMessage || ''}
                    onChange={e => update('voice', 'firstMessage', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg px-4 py-3 text-xs text-gray-400 space-y-1">
                  <p className="text-violet-400 font-medium">Voice AI tips</p>
                  <p>Keep the greeting short — callers just want to know they reached the right place.</p>
                  <p>The AI uses your Business Profile + Knowledge Base to answer questions naturally.</p>
                  <p>Saving these settings also updates your live Vapi assistant immediately.</p>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* Save Button */}
        <div className="pt-2">
          <button
            onClick={() => activeTab === 'voice' ? saveVoice() : save(activeTab)}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving
              ? (activeTab === 'voice' && voiceSyncing ? 'Syncing to Voice AI...' : 'Saving...')
              : activeTab === 'voice' ? 'Save & Sync to Voice AI' : `Save ${TABS.find(t => t.id === activeTab)?.label} Settings`}
          </button>

          {message.text && (
            <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success'
                ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
