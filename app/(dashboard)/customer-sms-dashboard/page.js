'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare, RefreshCw, Settings, Phone, Bell, BellOff,
  Clock, Flame, Users, Send, CheckCircle2, AlertTriangle, ChevronDown,
} from 'lucide-react';

function formatPhoneNumber(number) {
  if (!number) return 'Unknown';
  const cleaned = String(number).replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return number;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function scoreTone(score) {
  if (score >= 9) return 'text-red-400 bg-red-500/10';
  if (score >= 7) return 'text-orange-400 bg-orange-500/10';
  if (score >= 5) return 'text-yellow-400 bg-yellow-500/10';
  return 'text-green-400 bg-green-500/10';
}

function StatCard({ label, value, sub, valueClass = 'text-white' }) {
  return (
    <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`font-semibold text-lg ${valueClass}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, valueClass = 'text-white' }) {
  return (
    <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500" />
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ConversationRow({ conversation }) {
  const [expanded, setExpanded] = useState(false);
  const messages = conversation.messages || [];
  const last = messages[messages.length - 1];
  const topScore = messages.length
    ? Math.max(...messages.map(m => m.hotLeadScore || 0))
    : 0;
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white text-sm font-medium">{formatPhoneNumber(conversation.fromNumber)}</span>
              {conversation.leadCaptured && (
                <span className="bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded-full">Lead</span>
              )}
              {topScore >= 7 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${scoreTone(topScore)}`}>🔥 {topScore}/10</span>
              )}
            </div>
            {!expanded && last?.body && (
              <p className="text-gray-400 text-xs truncate">{last.body}</p>
            )}
          </div>
          <div className="flex items-start gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="text-gray-500 text-xs">{timeAgo(conversation.createdAt)}</div>
              <div className="text-gray-600 text-xs mt-0.5">{messages.length} msgs</div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 bg-[#0D1117] px-4 py-3 space-y-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                m.direction === 'inbound'
                  ? 'bg-gray-800 text-gray-200 rounded-bl-sm'
                  : 'bg-blue-500/15 text-blue-100 border border-blue-500/20 rounded-br-sm'
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${m.direction === 'inbound' ? 'text-gray-500' : 'text-blue-300/60'}`}>
                  {m.direction === 'inbound' ? 'Lead' : 'AI'} · {timeAgo(m.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomerSMSDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState({
    conversations: [],
    totalConversations: 0,
    totalMessages: 0,
    leadsGenerated: 0,
    hotLeadAlerts: [],
    hotLeadStats: { totalHotLeads: 0, alertsLast24h: 0, averageScore: 0, highestScore: 0 },
    smsConfig: null,
  });

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const conversationsResponse = await fetch('/api/sms/conversations');
      const conversationsData = await conversationsResponse.json().catch(() => ({}));

      let smsConfig = null;
      try {
        const provRes = await fetch('/api/sms/provision');
        const prov = await provRes.json();
        if (prov?.assigned && prov?.phoneNumber) {
          let businessName = 'Your Business';
          try {
            const profRes = await fetch('/api/customer/update-profile');
            const profData = await profRes.json();
            businessName = profData?.profile?.businessName || businessName;
          } catch { /* ignore */ }
          smsConfig = {
            phoneNumber: prov.phoneNumber,
            businessName,
            verificationStatus: prov.verificationStatus || null,
            verified: !!prov.verified,
          };
        }
      } catch (configError) {
        console.warn('Could not load SMS provisioning:', configError);
      }

      setDashboardData(prev => ({
        conversations: conversationsData.conversations || [],
        totalConversations: conversationsData.totalConversations || 0,
        totalMessages: conversationsData.totalMessages || 0,
        leadsGenerated: conversationsData.conversations?.filter(c => c.leadCaptured).length || 0,
        hotLeadAlerts: prev.hotLeadAlerts,
        hotLeadStats: prev.hotLeadStats,
        smsConfig: smsConfig ? { ...smsConfig, enableHotLeadAlerts: prev.smsConfig?.enableHotLeadAlerts, alertBusinessHours: prev.smsConfig?.alertBusinessHours } : null,
      }));
    } catch (error) {
      console.error('Dashboard loading error:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const toggleHotLeadAlerts = async () => {
    if (!dashboardData.smsConfig?.phoneNumber) return;
    try {
      const newSetting = !dashboardData.smsConfig.enableHotLeadAlerts;
      const response = await fetch('/api/customer-sms/configure-ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: dashboardData.smsConfig.phoneNumber, updates: { enableHotLeadAlerts: newSetting } }),
      });
      if (response.ok) {
        setDashboardData(prev => ({ ...prev, smsConfig: { ...prev.smsConfig, enableHotLeadAlerts: newSetting } }));
      }
    } catch (error) {
      console.error('Failed to toggle hot lead alerts:', error);
    }
  };

  const setBusinessHours = async (businessHoursOnly) => {
    if (!dashboardData.smsConfig?.phoneNumber) return;
    if (!!dashboardData.smsConfig.alertBusinessHours === businessHoursOnly) return;
    try {
      const response = await fetch('/api/customer-sms/configure-ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: dashboardData.smsConfig.phoneNumber, updates: { alertBusinessHours: businessHoursOnly } }),
      });
      if (response.ok) {
        setDashboardData(prev => ({ ...prev, smsConfig: { ...prev.smsConfig, alertBusinessHours: businessHoursOnly } }));
      }
    } catch (error) {
      console.error('Failed to update alert schedule:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-7 h-7 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading SMS dashboard...</p>
        </div>
      </div>
    );
  }

  const cfg = dashboardData.smsConfig;
  const verified = !!cfg?.verified;
  const needsInfo = cfg?.verificationStatus === 'needs_info';
  const alertsOn = !!cfg?.enableHotLeadAlerts;
  const businessHoursOnly = !!cfg?.alertBusinessHours;

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">SMS AI</h1>
            <p className="text-sm text-gray-500">Your AI answers every text, 24/7</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => window.location.href = '/sms-onboarding'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* No number yet */}
      {!cfg && (
        <div className="bg-[#161B22] border border-gray-800 rounded-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto">
            <MessageSquare className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg mb-1">Set Up SMS AI</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Get a dedicated number and your AI will answer texts from leads automatically, around the clock.
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/sms-onboarding'}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Phone className="w-4 h-4" />
            Get My Number
          </button>
        </div>
      )}

      {cfg && (
        <>
          {/* Status row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Status</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${verified ? 'bg-green-400 animate-pulse' : needsInfo ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`} />
                <span className="text-white font-semibold">
                  {verified ? 'Active' : needsInfo ? 'Action needed' : 'Pending'}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {verified ? 'AI is answering texts' : needsInfo ? 'Business info required' : 'Carrier verification'}
              </p>
            </div>

            <StatCard
              label="Your SMS Number"
              value={formatPhoneNumber(cfg.phoneNumber)}
              sub="SMS + Voice share this number"
            />
            <StatCard
              label="Business"
              value={cfg.businessName}
              sub="Shown to leads in AI replies"
            />
          </div>

          {/* Verification banner */}
          {!verified && (
            <div className={`flex items-start gap-3 rounded-xl border p-4 ${needsInfo ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
              {needsInfo
                ? <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                : <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm font-medium ${needsInfo ? 'text-red-400' : 'text-amber-400'}`}>
                  {needsInfo ? 'We need a bit more business info' : 'Carriers are verifying your number'}
                </p>
                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
                  {needsInfo
                    ? 'Complete your business details so we can submit your number for carrier approval.'
                    : "Usually 1–5 business days. Once approved your AI answers texts automatically — we'll email you the moment it's live."}
                </p>
              </div>
              {needsInfo && (
                <button
                  onClick={() => window.location.href = '/sms-onboarding'}
                  className="ml-auto flex-shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Complete Setup
                </button>
              )}
            </div>
          )}
          {verified && (
            <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-gray-300 text-sm">
                Your number is live. Put it on your website, Google listing, ads, and signage so leads can text you.
              </p>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={MessageSquare} label="Conversations" value={dashboardData.totalConversations} />
            <KpiCard icon={Send} label="Messages" value={dashboardData.totalMessages} />
            <KpiCard icon={Users} label="Leads" value={dashboardData.leadsGenerated} />
            <KpiCard icon={Flame} label="Hot Leads (24h)" value={dashboardData.hotLeadStats.alertsLast24h} valueClass="text-red-400" />
          </div>

          {/* Alert settings */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-400" />
              <span className="text-white font-medium text-sm">Alert Settings</span>
            </div>

            {/* Hot lead alerts on/off */}
            <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0D1117] p-4">
              <div className="flex items-center gap-3">
                {alertsOn ? <Bell className="w-4 h-4 text-blue-400" /> : <BellOff className="w-4 h-4 text-gray-500" />}
                <div>
                  <p className="text-white text-sm font-medium">Hot Lead Alerts</p>
                  <p className="text-gray-500 text-xs">Get a text + email the moment a high-intent lead comes in.</p>
                </div>
              </div>
              <button
                onClick={toggleHotLeadAlerts}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${alertsOn ? 'bg-blue-600' : 'bg-gray-700'}`}
                aria-pressed={alertsOn}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${alertsOn ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {/* Schedule */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Alert schedule</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBusinessHours(false)}
                  className={`text-left p-4 rounded-lg border transition-colors ${!businessHoursOnly ? 'bg-blue-500/10 border-blue-500/40' : 'bg-[#0D1117] border-gray-800 hover:border-gray-700'}`}
                >
                  <p className="text-white text-sm font-medium">24/7</p>
                  <p className="text-gray-500 text-xs mt-1">Alert me any time, day or night.</p>
                </button>
                <button
                  onClick={() => setBusinessHours(true)}
                  className={`text-left p-4 rounded-lg border transition-colors ${businessHoursOnly ? 'bg-blue-500/10 border-blue-500/40' : 'bg-[#0D1117] border-gray-800 hover:border-gray-700'}`}
                >
                  <p className="text-white text-sm font-medium">Business hours</p>
                  <p className="text-gray-500 text-xs mt-1">Only alert me during working hours.</p>
                </button>
              </div>
            </div>
          </div>

          {/* Recent conversations */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <h3 className="text-white font-medium text-sm">Recent Conversations</h3>
            </div>
            {dashboardData.conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <MessageSquare className="w-8 h-8 text-gray-700 mb-3" />
                <p className="text-gray-500 text-sm">No conversations yet</p>
                <p className="text-gray-600 text-xs mt-1">Texts from leads will appear here once your number is live.</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {dashboardData.conversations.slice(0, 15).map((c, i) => (
                  <ConversationRow key={c.id || i} conversation={c} />
                ))}
              </div>
            )}
          </div>

          {/* Hot lead alerts */}
          <div className="bg-[#161B22] border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <h3 className="text-white font-medium text-sm">Hot Lead Alerts</h3>
            </div>
            {dashboardData.hotLeadAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <Flame className="w-8 h-8 text-gray-700 mb-3" />
                <p className="text-gray-500 text-sm">No hot leads detected yet</p>
                <p className="text-gray-600 text-xs mt-1">High-intent leads from your texts will surface here.</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {dashboardData.hotLeadAlerts.map((alert, i) => (
                  <div key={alert.id || i} className="border border-gray-800 rounded-lg px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${scoreTone(alert.leadInfo?.score || 0)}`}>
                            🔥 {alert.leadInfo?.score || 0}/10
                          </span>
                          <span className="text-gray-500 text-xs">from {alert.source === 'sms' ? 'SMS' : 'Website'}</span>
                        </div>
                        <p className="text-gray-300 text-xs">{alert.messageContent}</p>
                        {alert.leadInfo?.reasoning && (
                          <p className="text-gray-500 text-xs mt-1"><span className="text-gray-400 font-medium">AI:</span> {alert.leadInfo.reasoning}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 text-gray-500 text-xs">
                        {timeAgo(alert.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
