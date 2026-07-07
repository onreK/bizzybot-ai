'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  Users, MessageCircle, Phone, Mail,
  Target, ArrowUpRight, Activity, RefreshCw,
  AlertCircle, ChevronRight, UserCheck, CheckCircle,
  Facebook, Instagram, Zap, ExternalLink, Flame, Bot, Clock
} from 'lucide-react';

export default function MainDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState('');
  const [recentActivity, setRecentActivity] = useState([]);
  const [dailyTrend, setDailyTrend] = useState([]);
  const [todayData, setTodayData] = useState({ conversations: 0, leads: 0, hotLeads: 0, messages: 0 });

  const [dashboardData, setDashboardData] = useState({
    webChat: { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0, aiStatus: 'checking' },
    sms: { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0, phoneNumbers: [], hotLeadAlerts: [], hotLeadStats: { totalHotLeads: 0, alertsLast24h: 0, averageScore: 0, highestScore: 0 } },
    email: { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0, hotLeadsToday: 0, aiEngagementRate: 0, emailSettings: null, templates: [] },
    facebook: { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0, postsManaged: 0, aiResponseRate: 0, pageConnected: false, lastSync: null },
    instagram: { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0, postsManaged: 0, aiResponseRate: 0, accountConnected: false, lastSync: null },
    combined: { totalLeads: 0, totalConversations: 0, totalMessages: 0, hotLeadsToday: 0 },
    analytics: { phoneRequestsToday: 0, hotLeadsMonth: 0, hotLeadsToday: 0, appointmentsScheduled: 0, totalInteractions: 0, aiEngagementRate: 0, avgResponseTime: 0, leadsCapture: 0, effectiveness: 0 }
  });

  // Redirect to onboarding if not yet completed
  useEffect(() => {
    if (!isLoaded) return;
    fetch('/api/onboarding/status')
      .then(r => r.json())
      .then(data => { if (!data.completed) router.replace('/onboarding'); })
      .catch(() => {});
  }, [isLoaded]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      let webChatData = { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0 };
      let aiStatusData = { connected: false };
      try { const r = await fetch('/api/chat?action=conversations'); if (r.ok) webChatData = await r.json(); } catch {}
      try { const r = await fetch('/api/chat?action=test-connection'); if (r.ok) aiStatusData = await r.json(); } catch {}

      let smsData = { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0, phoneNumbers: [], hotLeadAlerts: [], hotLeadStats: { totalHotLeads: 0, alertsLast24h: 0, averageScore: 0, highestScore: 0 } };
      try { const r = await fetch('/api/sms/conversations'); if (r.ok) smsData = await r.json(); } catch {}

      let emailConversations = [], emailMessages = 0, emailLeads = 0, emailHotLeadsToday = 0, aiEngagementRate = 0, emailSettingsData = { settings: null }, emailTemplatesData = { templates: [] };
      try { const r = await fetch('/api/customer/email-conversations'); if (r.ok) { const d = await r.json(); emailConversations = d.conversations || []; } } catch {}
      try { const r = await fetch('/api/customer/email-settings'); if (r.ok) emailSettingsData = await r.json(); } catch {}
      try { const r = await fetch('/api/customer/email-templates'); if (r.ok) emailTemplatesData = await r.json(); } catch {}
      try { const r = await fetch('/api/customer/email-stats'); if (r.ok) { const d = await r.json(); if (d.success && d.stats) { aiEngagementRate = d.stats.aiEngagementRate || 0; emailHotLeadsToday = d.stats.activeToday || 0; } } } catch {}
      emailMessages = emailConversations.reduce((acc, c) => acc + (c.messageCount || 0), 0);
      emailLeads = emailConversations.filter(c => c.status === 'lead').length;

      let analyticsData = { phoneRequestsToday: 0, hotLeadsMonth: 0, hotLeadsToday: 0, appointmentsScheduled: 0, totalInteractions: 0, aiEngagementRate: 0, avgResponseTime: 0, leadsCapture: 0, effectiveness: 0 };
      let trendData = [];
      try {
        const r = await fetch('/api/customer/analytics?period=month');
        if (r.ok) {
          const d = await r.json();
          if (d.success && d.analytics) {
            analyticsData = {
              phoneRequestsToday: d.analytics.overview?.phone_requests_today || 0,
              hotLeadsMonth: d.analytics.overview?.hot_leads_month || 0,
              hotLeadsToday: d.analytics.overview?.hot_leads_today || 0,
              appointmentsScheduled: d.analytics.overview?.appointments_month || 0,
              totalInteractions: d.analytics.overview?.total_interactions_month || 0,
              aiEngagementRate: d.analytics.overview?.ai_engagement_rate || 0,
              avgResponseTime: d.analytics.overview?.avg_response_speed_minutes || 2,
              leadsCapture: d.analytics.overview?.total_leads_captured || 0,
              effectiveness: d.analytics.overview?.effectiveness_score || 0
            };
            if (Array.isArray(d.analytics.dailyTrend)) {
              trendData = [...d.analytics.dailyTrend]
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .slice(-7);
            }
          }
        }
      } catch {}

      let facebookData = { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0, postsManaged: 0, aiResponseRate: 0, pageConnected: false, lastSync: null };
      try { const r = await fetch('/api/social/facebook/stats'); if (r.ok) { const d = await r.json(); facebookData = { conversations: d.conversations || [], totalConversations: d.totalConversations || 0, totalMessages: d.totalMessages || 0, leadsGenerated: d.leadsGenerated || 0, postsManaged: d.postsManaged || 0, aiResponseRate: d.aiResponseRate || 0, pageConnected: d.pageConnected || false, lastSync: d.lastSync }; } } catch {}

      let instagramData = { conversations: [], totalConversations: 0, totalMessages: 0, leadsGenerated: 0, postsManaged: 0, aiResponseRate: 0, accountConnected: false, lastSync: null };
      try { const r = await fetch('/api/social/instagram/stats'); if (r.ok) { const d = await r.json(); instagramData = { conversations: d.conversations || [], totalConversations: d.totalConversations || 0, totalMessages: d.totalMessages || 0, leadsGenerated: d.leadsGenerated || 0, postsManaged: d.postsManaged || 0, aiResponseRate: d.aiResponseRate || 0, accountConnected: d.accountConnected || false, lastSync: d.lastSync }; } } catch {}

      const webChat = { conversations: webChatData.conversations || [], totalConversations: webChatData.totalConversations || 0, totalMessages: webChatData.totalMessages || 0, leadsGenerated: webChatData.leadsGenerated || 0, aiStatus: aiStatusData.connected ? 'connected' : 'disconnected' };
      const sms = { conversations: smsData.conversations || [], totalConversations: smsData.totalConversations || 0, totalMessages: smsData.totalMessages || 0, leadsGenerated: smsData.leadsGenerated || 0, phoneNumbers: smsData.phoneNumbers || [], hotLeadAlerts: smsData.hotLeadAlerts || [], hotLeadStats: smsData.hotLeadStats || { totalHotLeads: 0, alertsLast24h: 0, averageScore: 0, highestScore: 0 } };
      const email = { conversations: emailConversations, totalConversations: emailConversations.length, totalMessages: emailMessages, leadsGenerated: emailLeads, hotLeadsToday: emailHotLeadsToday, aiEngagementRate, emailSettings: emailSettingsData.settings, templates: emailTemplatesData.templates || [] };
      const combined = { totalLeads: analyticsData.leadsCapture || (webChat.leadsGenerated + sms.leadsGenerated + email.leadsGenerated + facebookData.leadsGenerated + instagramData.leadsGenerated), totalConversations: analyticsData.totalInteractions || (webChat.totalConversations + sms.totalConversations + email.totalConversations + facebookData.totalConversations + instagramData.totalConversations), totalMessages: analyticsData.totalInteractions || (webChat.totalMessages + sms.totalMessages + email.totalMessages + facebookData.totalMessages + instagramData.totalMessages), hotLeadsToday: analyticsData.hotLeadsToday || (sms.hotLeadStats.alertsLast24h + email.hotLeadsToday) };

      setDashboardData({ webChat, sms, email, facebook: facebookData, instagram: instagramData, combined, analytics: analyticsData });
      setDailyTrend(trendData);

      try {
        const r = await fetch('/api/customer/analytics?period=today');
        if (r.ok) {
          const d = await r.json();
          if (d.success && d.analytics?.overview) {
            setTodayData({
              conversations: d.analytics.overview.total_interactions_month || 0,
              leads: d.analytics.overview.total_leads_captured || 0,
              hotLeads: d.analytics.overview.hot_leads_today || 0,
              messages: d.analytics.overview.total_interactions_month || 0,
            });
          }
        }
      } catch {}

      try {
        const r = await fetch('/api/notifications');
        if (r.ok) {
          const d = await r.json();
          setRecentActivity((d.notifications || []).slice(0, 8));
        }
      } catch {}
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please refresh the page.');
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, trend, color = 'blue' }) => {
    const colors = { blue: 'text-blue-400', green: 'text-green-400', orange: 'text-orange-400', purple: 'text-purple-400', violet: 'text-violet-400' };
    return (
      <div className="relative overflow-hidden rounded-xl border border-gray-800 p-5 bg-[#161B22]">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg bg-white/5">
            <Icon className={`w-5 h-5 ${colors[color] || colors.blue}`} />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              <ArrowUpRight className="w-3 h-3 text-green-400" />
              <span className="text-green-400 font-medium">+{trend}%</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-white">{(value ?? 0).toLocaleString()}</p>
          <p className="text-sm text-gray-400 mt-0.5">{title}</p>
          {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
        </div>
      </div>
    );
  };

  const TrendChart = ({ data }) => {
    const W = 400, H = 120, pad = { t: 12, r: 12, b: 28, l: 32 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    if (!data || data.length < 2) {
      return (
        <div className="flex items-center justify-center h-full text-center">
          <div>
            <Activity className="w-6 h-6 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-600 text-xs">No trend data yet</p>
            <p className="text-gray-700 text-[10px] mt-0.5">Data appears once AI conversations begin</p>
          </div>
        </div>
      );
    }

    const vals = data.map(d => (d.metrics?.hotLeads ?? d.metrics?.total ?? 0));
    const maxVal = Math.max(...vals, 1);
    const xPos = (i) => pad.l + (i / (data.length - 1)) * innerW;
    const yPos = (v) => pad.t + innerH - (v / maxVal) * innerH;
    const pts = data.map((d, i) => [xPos(i), yPos(vals[i])]);

    const linePath = pts.reduce((acc, [x, y], i) => {
      if (i === 0) return `M ${x} ${y}`;
      const [px, py] = pts[i - 1];
      const cpx = (px + x) / 2;
      return `${acc} C ${cpx} ${py}, ${cpx} ${y}, ${x} ${y}`;
    }, '');
    const areaPath = `${linePath} L ${pts[pts.length-1][0]} ${H - pad.b} L ${pts[0][0]} ${H - pad.b} Z`;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + innerH * (1 - f)} y2={pad.t + innerH * (1 - f)} stroke="#1f2937" strokeWidth="1" />
        ))}
        <path d={areaPath} fill="url(#trendGrad)" />
        <path d={linePath} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#8b5cf6" stroke="#161B22" strokeWidth="1.5" />
        ))}
        {data.map((d, i) => (
          <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" style={{ fontSize: '8px', fill: '#6b7280' }}>
            {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}
        {[0, Math.round(maxVal / 2), maxVal].map((v, i) => (
          <text key={i} x={pad.l - 4} y={yPos(v) + 3} textAnchor="end" style={{ fontSize: '8px', fill: '#6b7280' }}>
            {v}
          </text>
        ))}
      </svg>
    );
  };

  const CHANNEL_ICONS = { sms: Phone, email: Mail, facebook: Facebook, instagram: Instagram, web: MessageCircle, chat: MessageCircle };
  function timeAgo(dateStr) {
    const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  if (!isLoaded || initialLoad) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const channels = [
    {
      id: 'email', name: 'Email AI', icon: Mail, iconColor: 'text-blue-400', iconBg: 'bg-blue-500/10 border-blue-500/20',
      href: '/email', setupHref: '/email',
      connected: !!dashboardData.email.emailSettings,
      conversations: dashboardData.email.totalConversations,
      leads: dashboardData.email.leadsGenerated,
    },
    {
      id: 'sms', name: 'SMS', icon: Phone, iconColor: 'text-green-400', iconBg: 'bg-green-500/10 border-green-500/20',
      href: '/customer-sms-dashboard', setupHref: '/customer-sms-dashboard',
      connected: (dashboardData.sms.phoneNumbers?.length || 0) > 0,
      conversations: dashboardData.sms.totalConversations,
      leads: dashboardData.sms.leadsGenerated,
    },
    {
      id: 'webchat', name: 'Web Chat', icon: MessageCircle, iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border-emerald-500/20',
      href: '/web-chat', setupHref: '/web-chat',
      connected: dashboardData.webChat.aiStatus === 'connected',
      conversations: dashboardData.webChat.totalConversations,
      leads: dashboardData.webChat.leadsGenerated,
    },
    {
      id: 'facebook', name: 'Facebook', icon: Facebook, iconColor: 'text-blue-400', iconBg: 'bg-blue-500/10 border-blue-500/20',
      href: '/facebook-setup', setupHref: '/facebook-setup',
      connected: dashboardData.facebook.pageConnected,
      conversations: dashboardData.facebook.totalConversations,
      leads: dashboardData.facebook.leadsGenerated,
    },
    {
      id: 'instagram', name: 'Instagram', icon: Instagram, iconColor: 'text-pink-400', iconBg: 'bg-pink-500/10 border-pink-500/20',
      href: '/instagram-setup', setupHref: '/instagram-setup',
      connected: dashboardData.instagram.accountConnected,
      conversations: dashboardData.instagram.totalConversations,
      leads: dashboardData.instagram.leadsGenerated,
    },
  ];

  return (
    <div className="p-8 space-y-8">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Overview</h1>
            <p className="text-sm text-gray-500">Welcome back, {user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'there'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            {(() => {
              const emailConnected = !!dashboardData.email.emailSettings?.email;
              const anyConnected = emailConnected || dashboardData.webChat.aiStatus === 'connected';
              if (anyConnected) return <>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-gray-400">AI Active</span>
              </>;
              return <>
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-gray-400">AI Ready</span>
              </>;
            })()}
          </div>
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-gray-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Setup Checklist — only shown when channels are missing */}
      {channels.filter(c => !c.connected).length > 0 && (
        <div className="bg-[#161B22] rounded-xl border border-violet-500/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold text-sm">Complete your setup</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                {channels.filter(c => c.connected).length} of {channels.length} channels connected — connect more to capture leads from every source
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-violet-400">{channels.filter(c => c.connected).length}</span>
              <span className="text-gray-600 text-sm">/{channels.length}</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-gray-800 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${(channels.filter(c => c.connected).length / channels.length) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => router.push(ch.connected ? ch.href : ch.setupHref)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                  ch.connected
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400 cursor-default'
                    : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:border-violet-500/50 hover:text-white'
                }`}
              >
                {ch.connected
                  ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  : <ch.icon className="w-3.5 h-3.5 flex-shrink-0" />
                }
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today at a Glance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Conversations today", value: todayData.conversations, color: "text-green-400" },
          { label: "Leads today", value: todayData.leads, color: "text-blue-400" },
          { label: "Hot leads today", value: todayData.hotLeads, color: "text-red-400" },
          { label: "Avg response time", value: dashboardData.analytics?.avgResponseTime ? `${dashboardData.analytics.avgResponseTime}m` : '—', color: "text-violet-400", isText: true },
        ].map(({ label, value, color, isText }) => (
          <div key={label} className="bg-[#161B22] rounded-xl border border-gray-800 px-4 py-3 flex items-center gap-3">
            <div className={`text-xl font-bold ${color}`}>{isText ? value : (value ?? 0)}</div>
            <div className="text-xs text-gray-500 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} title="Total Leads" value={dashboardData.analytics?.leadsCapture || dashboardData.combined.totalLeads} subtitle="All channels" color="blue" />
        <StatCard icon={MessageCircle} title="Conversations" value={dashboardData.analytics?.totalInteractions || dashboardData.combined.totalConversations} subtitle="All channels" color="green" />
        <StatCard icon={Activity} title="Total Messages" value={dashboardData.analytics?.totalInteractions || dashboardData.combined.totalMessages} subtitle="AI responses" color="purple" />
        <StatCard icon={Target} title="Hot Leads (24h)" value={dashboardData.analytics?.hotLeadsToday || dashboardData.combined.hotLeadsToday} subtitle="High intent" color="orange" />
        {/* AI Automation Rate */}
        <div className="relative overflow-hidden rounded-xl border border-gray-800 p-5 bg-[#161B22]">
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-white/5">
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-white">{(dashboardData.analytics?.aiEngagementRate || 0).toFixed(1)}%</p>
            <p className="text-sm text-gray-400 mt-0.5">AI Automation Rate</p>
            <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(dashboardData.analytics?.aiEngagementRate || 0, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Channel Performance */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Channel Performance</h2>
            <p className="text-xs text-gray-500 mt-0.5">Conversations and leads by channel</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {channels.map(channel => (
            <div
              key={channel.id}
              className="bg-[#161B22] rounded-xl border border-gray-800 p-4 flex flex-col gap-4 hover:border-gray-700 transition-colors"
            >
              {/* Channel header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${channel.iconBg}`}>
                    <channel.icon className={`w-4 h-4 ${channel.iconColor}`} />
                  </div>
                  <span className="text-white text-sm font-medium">{channel.name}</span>
                </div>
              </div>

              {/* Status */}
              <div>
                {channel.connected ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    <span className="text-green-400 text-xs font-medium">Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-gray-600 rounded-full" />
                    <span className="text-gray-500 text-xs">Not set up</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0D1117] rounded-lg p-2.5">
                  <p className="text-lg font-bold text-white">{channel.conversations}</p>
                  <p className="text-[10px] text-gray-500">Conversations</p>
                </div>
                <div className="bg-[#0D1117] rounded-lg p-2.5">
                  <p className="text-lg font-bold text-white">{channel.leads}</p>
                  <p className="text-[10px] text-gray-500">Leads</p>
                </div>
              </div>

              {/* Action link */}
              <button
                onClick={() => router.push(channel.connected ? channel.href : channel.setupHref)}
                className="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {channel.connected ? 'View' : 'Set up'}
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* AI Performance + Lead Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* AI Performance */}
        <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Activity className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">AI Performance</h3>
              <p className="text-xs text-gray-500">Real AI behaviors across all channels</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-[#0D1117] rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{dashboardData.analytics?.phoneRequestsToday || 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">Phone Requests Today</div>
            </div>
            <div className="bg-[#0D1117] rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-400">{dashboardData.analytics?.hotLeadsMonth || 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">Hot Leads This Month</div>
            </div>
            <div className="bg-[#0D1117] rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{dashboardData.analytics?.appointmentsScheduled || 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">Appointments Scheduled</div>
            </div>
            <div className="bg-[#0D1117] rounded-lg p-4">
              <div className="text-2xl font-bold text-violet-400">{dashboardData.analytics?.aiEngagementRate?.toFixed(1) || 0}%</div>
              <div className="text-xs text-gray-500 mt-0.5">AI Engagement Rate</div>
            </div>
            <div className="bg-[#0D1117] rounded-lg p-4 col-span-2 flex items-center gap-3">
              <Clock className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              <div>
                <div className="text-2xl font-bold text-cyan-400">{dashboardData.analytics?.avgResponseTime ?? '—'}<span className="text-sm font-normal text-gray-500 ml-1">min</span></div>
                <div className="text-xs text-gray-500">Avg AI Response Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lead Pipeline Funnel */}
        <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <UserCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Lead Pipeline</h3>
              <p className="text-xs text-gray-500">Conversion funnel across all channels</p>
            </div>
          </div>
          {(() => {
            const totalConvs = dashboardData.analytics?.totalInteractions || dashboardData.combined.totalConversations || 0;
            const totalLeads = dashboardData.analytics?.leadsCapture || dashboardData.combined.totalLeads || 0;
            const hotLeads = dashboardData.analytics?.hotLeadsMonth || 0;
            const base = Math.max(totalConvs, 1);
            const stages = [
              { label: 'All Conversations', value: totalConvs, pct: 100, color: 'bg-blue-500', text: 'text-blue-400' },
              { label: 'Leads Captured', value: totalLeads, pct: Math.round((totalLeads / base) * 100), color: 'bg-violet-500', text: 'text-violet-400' },
              { label: 'Hot Leads', value: hotLeads, pct: Math.round((hotLeads / base) * 100), color: 'bg-red-500', text: 'text-red-400' },
            ];
            return (
              <div className="space-y-3">
                {stages.map((s, i) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-4 text-center">{i + 1}</span>
                        <span className="text-sm text-gray-300">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${s.text}`}>{s.value}</span>
                        <span className="text-xs text-gray-600 w-10 text-right">{s.pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.color} rounded-full transition-all duration-700`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                    {i < stages.length - 1 && (
                      <div className="flex justify-center mt-1">
                        <ChevronRight className="w-3 h-3 text-gray-700 rotate-90" />
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-800 mt-3">
                  <p className="text-xs text-gray-600 text-center">
                    {totalConvs > 0
                      ? `${Math.round((totalLeads / Math.max(totalConvs, 1)) * 100)}% conversation → lead conversion rate`
                      : 'Start conversations to see your funnel'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Trend Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Hot Leads Trend */}
        <div className="lg:col-span-2 bg-[#161B22] rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Zap className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Hot Leads Trend</h3>
                <p className="text-xs text-gray-500">Last 7 days across all channels</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/analytics')}
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              Full report <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="h-36">
            <TrendChart data={dailyTrend} />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Recent Activity</h3>
              <p className="text-xs text-gray-500">Latest hot leads</p>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Flame className="w-7 h-7 text-gray-700 mb-2" />
              <p className="text-gray-500 text-sm">No activity yet</p>
              <p className="text-gray-600 text-xs mt-1">Hot leads will appear here</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-48">
              {recentActivity.map(item => {
                const CIcon = CHANNEL_ICONS[item.channel?.toLowerCase()] || MessageCircle;
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.href || '/leads')}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Flame className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{item.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CIcon className="w-3 h-3 text-gray-600" />
                        <span className="text-gray-600 text-[10px] capitalize">{item.channel || 'web'}</span>
                        <span className="text-gray-700 text-[10px]">·</span>
                        <span className="text-gray-600 text-[10px]">{timeAgo(item.timestamp)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <button
            onClick={() => router.push('/leads')}
            className="mt-4 w-full px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium transition-colors border border-orange-500/20"
          >
            View all leads →
          </button>
        </div>
      </div>

    </div>
  );
}
