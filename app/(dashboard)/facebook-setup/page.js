'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Facebook, Settings, ExternalLink, RefreshCw } from 'lucide-react';

export default function FacebookSetup() {
  const router = useRouter();
  const [status, setStatus] = useState({ connected: false, pageName: null });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    handleCallback();
    checkConnection();
  }, []);

  const handleCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const page = params.get('page');

    if (success === 'connected') {
      setMessage({ type: 'success', text: `Facebook Page connected${page ? ` — ${page}` : ''}` });
      setStatus({ connected: true, pageName: page });
    } else if (error) {
      const messages = {
        oauth_denied: 'Access was denied. Please try again and approve the requested permissions.',
        no_pages: 'No Facebook Pages found on your account. Make sure you have a Business Page.',
        oauth_failed: 'Connection failed. Please try again.',
        not_configured: 'Facebook OAuth is not yet configured. Please contact support.'
      };
      setMessage({ type: 'error', text: messages[error] || 'Something went wrong.' });
    }

    if (success || error) window.history.replaceState({}, '', window.location.pathname);
  };

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/facebook/configure');
      const data = await res.json();
      if (data.configured) setStatus({ connected: true, pageName: data.connection?.page_name || null });
    } catch {}
    setLoading(false);
  };

  const connect = () => {
    setConnecting(true);
    window.location.href = '/api/auth/facebook?type=facebook';
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Facebook? Your AI will stop responding to Messenger messages.')) return;
    await fetch('/api/facebook/configure', { method: 'DELETE' });
    setStatus({ connected: false, pageName: null });
    setMessage({ type: 'success', text: 'Facebook disconnected.' });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
          <Facebook className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Connect Facebook Messenger</h1>
          <p className="text-sm text-gray-500">Your AI will respond to messages on your Facebook Page automatically</p>
        </div>
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

      {/* Connection card */}
      <div className={`bg-[#161B22] border rounded-2xl p-6 ${status.connected ? 'border-green-500/30' : 'border-gray-800'}`}>
        {status.connected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Facebook Page connected</p>
                {status.pageName && <p className="text-sm text-gray-400">{status.pageName}</p>}
              </div>
            </div>

            <div className="bg-[#0D1117] border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                AI is responding to Messenger DMs automatically
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                Lead scoring active on every conversation
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                Post comment replies enabled
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => router.push('/ai-settings')} className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium">
                <Settings className="w-4 h-4" /> Customize AI behavior
              </button>
              <button onClick={connect} disabled={connecting} className="px-4 py-2.5 bg-[#0D1117] border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white rounded-lg text-sm disabled:opacity-50">
                Reconnect
              </button>
              <button onClick={disconnect} className="px-4 py-2.5 bg-[#0D1117] border border-red-900/50 hover:border-red-500/50 text-red-500 hover:text-red-400 rounded-lg text-sm">
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-start gap-2"><span className="text-violet-400 font-bold mt-0.5">1.</span> Click "Connect Facebook Page" below</div>
              <div className="flex items-start gap-2"><span className="text-violet-400 font-bold mt-0.5">2.</span> Log in to Facebook and select your Business Page</div>
              <div className="flex items-start gap-2"><span className="text-violet-400 font-bold mt-0.5">3.</span> Approve the permissions — your AI starts responding immediately</div>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
              BizzyBot only accesses your Page's messages — not your personal profile, friends, or timeline.
            </div>

            <button
              onClick={connect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-3 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              <Facebook className="w-5 h-5" />
              {connecting ? 'Redirecting to Facebook...' : 'Connect Facebook Page'}
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 text-center">
        AI tone and behavior are managed in{' '}
        <button onClick={() => router.push('/ai-settings')} className="text-violet-400 hover:underline">AI Settings</button>
        {' · '}
        <a href="https://www.facebook.com/business/help/messages" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-400">
          Facebook Business Help <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}
