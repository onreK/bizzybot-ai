'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Mail, CheckCircle, AlertCircle, RefreshCw, Settings } from 'lucide-react';

export default function EmailSetup() {
  const router = useRouter();
  const { user } = useUser();
  const [gmailStatus, setGmailStatus] = useState({ connected: false, email: null });
  const [outlookStatus, setOutlookStatus] = useState({ connected: false, email: null });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    handleOAuthCallback();
    checkConnections();
  }, []);

  const handleOAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const success = params.get('success');
    const email = params.get('email');

    if (error) {
      const messages = {
        oauth_denied: 'Access was denied. Please try again.',
        oauth_failed: 'Connection failed. Please try again.',
        token_failed: 'Could not retrieve access token. Please try again.',
        missing_params: 'Something went wrong. Please try again.',
      };
      setMessage({ type: 'error', text: messages[error] || 'Connection failed.' });
    } else if (success === 'gmail_connected' && email) {
      setMessage({ type: 'success', text: `Gmail connected — ${decodeURIComponent(email)}` });
      setGmailStatus({ connected: true, email: decodeURIComponent(email) });
    } else if (success === 'outlook_connected' && email) {
      setMessage({ type: 'success', text: `Outlook connected — ${decodeURIComponent(email)}` });
      setOutlookStatus({ connected: true, email: decodeURIComponent(email) });
    }

    if (error || success) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const checkConnections = async () => {
    setLoading(true);
    try {
      const [gmailRes, outlookRes] = await Promise.all([
        fetch('/api/auth/google', { method: 'POST' }),
        fetch('/api/auth/outlook/status'),
      ]);
      if (gmailRes.ok) {
        const d = await gmailRes.json();
        if (d.success) setGmailStatus({ connected: d.connected, email: d.email });
      }
      if (outlookRes.ok) {
        const d = await outlookRes.json();
        setOutlookStatus({ connected: d.connected, email: d.email });
      }
    } catch {}
    setLoading(false);
  };

  const connectGmail = () => {
    if (gmailStatus.connected) {
      if (!confirm(`Gmail is connected to ${gmailStatus.email}.\n\nDisconnect and reconnect?`)) return;
    }
    window.location.href = `/api/auth/google?userId=${user?.id || ''}`;
  };

  const connectOutlook = () => {
    if (outlookStatus.connected) {
      if (!confirm(`Outlook is connected to ${outlookStatus.email}.\n\nDisconnect and reconnect?`)) return;
    }
    window.location.href = `/api/auth/outlook?userId=${user?.id || ''}`;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
          <Mail className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Email Connections</h1>
          <p className="text-sm text-gray-500">Connect your inbox so the AI can read and reply to leads automatically</p>
        </div>
      </div>

      {/* Status message */}
      {message.text && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
          <span className="text-sm">{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
        </div>
      )}

      {/* Gmail card */}
      <ConnectionCard
        name="Gmail"
        description="Google Workspace or personal Gmail"
        status={gmailStatus}
        accentColor="red"
        logo={
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        }
        onConnect={connectGmail}
        onSettings={() => router.push('/ai-settings')}
      />

      {/* Outlook card */}
      <ConnectionCard
        name="Outlook"
        description="Microsoft 365, Outlook.com, or Hotmail"
        status={outlookStatus}
        accentColor="blue"
        logo={
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="3" fill="#0078D4"/>
            <path d="M13 6h7v12h-7V6z" fill="#50D9FF" opacity=".8"/>
            <path d="M4 8.5C4 7.12 5.12 6 6.5 6S9 7.12 9 8.5v7C9 16.88 7.88 18 6.5 18S4 16.88 4 15.5v-7z" fill="white"/>
            <ellipse cx="6.5" cy="12" rx="2.5" ry="3.5" fill="#0078D4"/>
          </svg>
        }
        onConnect={connectOutlook}
        onSettings={() => router.push('/ai-settings')}
      />

      <p className="text-xs text-gray-600 text-center">
        AI tone and behavior are managed in{' '}
        <button onClick={() => router.push('/ai-settings')} className="text-violet-400 hover:underline">AI Settings</button>
      </p>
    </div>
  );
}

function ConnectionCard({ name, description, status, accentColor, logo, onConnect, onSettings }) {
  const colors = {
    red: { border: 'border-red-500/30', bg: 'bg-red-500/10', icon: 'text-red-400' },
    blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', icon: 'text-blue-400' },
  };
  const c = colors[accentColor] || colors.blue;

  return (
    <div className={`bg-[#161B22] border rounded-2xl p-6 ${status.connected ? c.border : 'border-gray-800'}`}>
      {status.connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${c.bg} border ${c.border} rounded-full flex items-center justify-center`}>
              <CheckCircle className={`w-5 h-5 ${c.icon}`} />
            </div>
            <div>
              <p className="font-semibold text-white">{name} connected</p>
              <p className="text-sm text-gray-400">{status.email}</p>
            </div>
          </div>
          <div className="bg-[#0D1117] border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              AI is reading new emails and replying automatically
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              Lead scoring active on every inbound email
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onSettings}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium"
            >
              <Settings className="w-4 h-4" /> Customize AI
            </button>
            <button
              onClick={onConnect}
              className="px-4 py-2.5 bg-[#0D1117] border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg text-sm"
            >
              Reconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0D1117] border border-gray-800 rounded-xl flex items-center justify-center">
              {logo}
            </div>
            <div>
              <p className="font-semibold text-white">{name}</p>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
          </div>
          <button
            onClick={onConnect}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-medium text-sm transition-colors"
          >
            {logo}
            Connect {name}
          </button>
        </div>
      )}
    </div>
  );
}
