'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Instagram, CheckCircle, AlertCircle, MessageCircle, MessageSquare,
  UserCheck, Zap, RefreshCw, Settings, ExternalLink, Activity,
  BarChart3, Clock,
} from 'lucide-react';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const COLOR = {
  pink:   { bg: 'bg-pink-500/10',   text: 'text-pink-400' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400' },
  blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-400' },
  green:  { bg: 'bg-green-500/10',  text: 'text-green-400' },
};

const TABS = [
  { id: 'dashboard',  label: 'Dashboard',  icon: BarChart3 },
  { id: 'connection', label: 'Connection', icon: Settings },
];

export default function InstagramDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState(null);
  const [stats, setStats] = useState({
    dmsReplied: 0, commentReplies: 0,
    leadsFromInstagram: 0, avgResponseTime: '—', recentMessages: [],
  });
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    handleCallback();
    loadData();
  }, []);

  const handleCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const username = params.get('username');

    if (success === 'connected') {
      setMessage({ type: 'success', text: `Instagram connected${username ? ` — @${username}` : ''}` });
    } else if (error) {
      const msgs = {
        oauth_denied: 'Access was denied. Please try again and approve the requested permissions.',
        no_pages: 'No Facebook Pages found. Instagram Business accounts must be linked to a Facebook Page.',
        no_instagram: 'No Instagram Business account found. Make sure your Instagram is set to Business or Creator in Meta Business Settings.',
        oauth_failed: 'Connection failed. Please try again.',
      };
      setMessage({ type: 'error', text: msgs[error] || 'Something went wrong.' });
    }
    if (success || error) window.history.replaceState({}, '', window.location.pathname);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, statsRes] = await Promise.all([
        fetch('/api/instagram/status'),
        fetch('/api/instagram/stats'),
      ]);
      if (statusRes.ok) setConnection(await statusRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {}
    setLoading(false);
  };

  const connect = () => {
    setConnecting(true);
    window.location.href = '/api/auth/facebook?type=instagram';
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Instagram? Your AI will stop responding to DMs and comments.')) return;
    await fetch('/api/instagram/configure', { method: 'DELETE' });
    setConnection({ configured: false });
    setMessage({ type: 'success', text: 'Instagram disconnected.' });
  };

  const statCards = [
    { label: 'DMs Replied',     value: stats.dmsReplied,           subtext: 'Last 30 days',   icon: MessageCircle,  color: 'pink'   },
    { label: 'Comment Replies', value: stats.commentReplies,       subtext: 'Last 30 days',   icon: MessageSquare,  color: 'violet' },
    { label: 'Leads Captured',  value: stats.leadsFromInstagram,   subtext: 'From Instagram', icon: UserCheck,      color: 'blue'   },
    { label: 'Response Speed',  value: stats.avgResponseTime,      subtext: 'AI reply time',  icon: Zap,            color: 'green'  },
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Instagram</h1>
        <p className="text-sm text-gray-500 mt-0.5">AI-powered DM and comment automation</p>
      </div>

      {/* Message banner */}
      {message.text && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          }
          <span className="text-sm">{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex space-x-6">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap py-2.5 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Dashboard Tab ── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">

          {/* Status banner */}
          {connection?.configured ? (
            <div className="bg-[#161B22] border border-green-500/20 rounded-xl p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white flex items-center gap-2">
                      AI Active
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-md font-medium">LIVE</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {connection.username ? `@${connection.username}` : `Page ${connection.pageId}`}
                      {' · '}Responding to DMs and comments automatically
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadData}
                    className="p-2 rounded-lg bg-[#0D1117] border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white transition-colors"
                    title="Refresh stats"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => router.push('/ai-settings')}
                    className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    AI Settings
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/5 rounded-xl border border-yellow-500/20 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-white">Instagram not connected</p>
                    <p className="text-sm text-gray-400 mt-0.5">Connect your account to start the AI</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('connection')}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded-lg text-sm transition-colors flex-shrink-0"
                >
                  Connect Instagram
                </button>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(card => {
              const Icon = card.icon;
              const colors = COLOR[card.color];
              return (
                <div key={card.label} className="bg-[#161B22] rounded-xl border border-gray-800 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{card.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{card.subtext}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div className="bg-[#161B22] rounded-xl border border-gray-800">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-pink-400" />
                <div>
                  <h3 className="font-semibold text-white">Recent AI Conversations</h3>
                  <p className="text-xs text-gray-500 mt-0.5">DMs and post comments your AI handled</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/leads')}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                View all leads →
              </button>
            </div>

            <div className="p-5">
              {stats.recentMessages?.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentMessages.map((msg, i) => {
                    const isDM = msg.type === 'dm';
                    return (
                      <div key={i} className="flex items-start gap-3 p-4 bg-[#0D1117] rounded-lg border border-gray-800">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isDM ? 'bg-pink-500/10' : 'bg-violet-500/10'}`}>
                          {isDM
                            ? <MessageCircle className="w-4 h-4 text-pink-400" />
                            : <MessageSquare className="w-4 h-4 text-violet-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white text-sm font-medium">
                              {msg.sender_username ? `@${msg.sender_username}` : 'Instagram user'}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isDM ? 'bg-pink-500/10 text-pink-400' : 'bg-violet-500/10 text-violet-400'}`}>
                              {isDM ? 'DM' : 'Comment'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">{msg.message_text}</p>
                          {msg.ai_reply && (
                            <p className="text-xs text-gray-600 mt-1 truncate">
                              <span className="text-gray-500">AI:</span> {msg.ai_reply}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{timeAgo(msg.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-14 h-14 bg-pink-500/10 border border-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Instagram className="w-7 h-7 text-pink-400" />
                  </div>
                  <p className="text-white font-medium mb-2">No conversations yet</p>
                  <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
                    {connection?.configured
                      ? 'Instagram DMs and comment replies will appear here once your first message comes in after Meta App Review is approved.'
                      : 'Connect your Instagram account to start tracking AI conversations.'
                    }
                  </p>
                  {!connection?.configured && (
                    <button
                      onClick={() => setActiveTab('connection')}
                      className="mt-5 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)' }}
                    >
                      Connect Instagram
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Connection Tab ── */}
      {activeTab === 'connection' && (
        <div className="max-w-xl space-y-6">

          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-pink-500/10 border border-pink-500/20 rounded-lg flex items-center justify-center">
              <Instagram className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Connect Instagram DMs</h2>
              <p className="text-sm text-gray-500">Your AI responds to direct messages automatically</p>
            </div>
          </div>

          {/* Connection card */}
          <div className={`bg-[#161B22] border rounded-2xl p-6 ${connection?.configured ? 'border-green-500/30' : 'border-gray-800'}`}>
            {connection?.configured ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Instagram connected</p>
                    {connection.username && <p className="text-sm text-gray-400">@{connection.username}</p>}
                    {connection.connectedAt && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        Connected {new Date(connection.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-[#0D1117] border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    AI is responding to Instagram DMs automatically
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    Lead scoring active on every conversation
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    Comment reply enabled on your posts
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => router.push('/ai-settings')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Settings className="w-4 h-4" /> Customize AI behavior
                  </button>
                  <button
                    onClick={connect}
                    disabled={connecting}
                    className="px-4 py-2.5 bg-[#0D1117] border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    Reconnect
                  </button>
                  <button
                    onClick={disconnect}
                    className="px-4 py-2.5 bg-[#0D1117] border border-red-900/50 hover:border-red-500/50 text-red-500 hover:text-red-400 rounded-lg text-sm transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-start gap-2">
                    <span className="text-violet-400 font-bold mt-0.5">1.</span>
                    Click "Connect Instagram" below
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-violet-400 font-bold mt-0.5">2.</span>
                    Log in to Facebook and select the Page linked to your Instagram
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-violet-400 font-bold mt-0.5">3.</span>
                    Approve the permissions — your AI starts responding to DMs immediately
                  </div>
                </div>

                <div className="p-4 bg-pink-500/10 border border-pink-500/20 rounded-lg text-sm text-pink-300">
                  <strong className="text-pink-200">Requirement:</strong> Your Instagram must be a Business or Creator account connected to a Facebook Page in Meta Business Settings.
                </div>

                <button
                  onClick={connect}
                  disabled={connecting}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-lg font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)' }}
                >
                  <Instagram className="w-5 h-5" />
                  {connecting ? 'Redirecting to Facebook...' : 'Connect Instagram'}
                </button>

                <p className="text-xs text-gray-600 text-center">
                  Instagram connects through Facebook — you'll see a Facebook login screen. This is normal.
                </p>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-600 text-center">
            AI tone and behavior are managed in{' '}
            <button onClick={() => router.push('/ai-settings')} className="text-violet-400 hover:underline">
              AI Settings
            </button>
            {' · '}
            <a
              href="https://help.instagram.com/570895513091465"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-gray-400 transition-colors"
            >
              Instagram Business Help <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
