'use client';

import { useState, useEffect } from 'react';

export default function CustomerSMSDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState({
    conversations: [],
    totalConversations: 0,
    totalMessages: 0,
    leadsGenerated: 0,
    hotLeadAlerts: [],
    hotLeadStats: {
      totalHotLeads: 0,
      alertsLast24h: 0,
      averageScore: 0,
      highestScore: 0
    },
    smsConfig: null
  });

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');

  useEffect(() => {
    loadDashboardData();
    // Refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load SMS conversations
      const conversationsResponse = await fetch('/api/sms/conversations');
      const conversationsData = await conversationsResponse.json();
      
      // Load SMS configuration (assuming we have a phone number)
      let smsConfig = null;
      let hotLeadAlerts = [];
      let hotLeadStats = {
        totalHotLeads: 0,
        alertsLast24h: 0,
        averageScore: 0,
        highestScore: 0
      };

      // Read the provisioned number + verification status directly (source of
      // truth) — not from conversations, which don't exist until texts arrive.
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

      setDashboardData({
        conversations: conversationsData.conversations || [],
        totalConversations: conversationsData.totalConversations || 0,
        totalMessages: conversationsData.totalMessages || 0,
        leadsGenerated: conversationsData.conversations?.filter(c => c.leadCaptured).length || 0,
        hotLeadAlerts,
        hotLeadStats,
        smsConfig
      });

    } catch (error) {
      console.error('Dashboard loading error:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (number) => {
    if (!number) return 'Unknown';
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const areaCode = cleaned.slice(1, 4);
      const exchange = cleaned.slice(4, 7);
      const number_suffix = cleaned.slice(7);
      return `+1 (${areaCode}) ${exchange}-${number_suffix}`;
    }
    return number;
  };

  const getScoreColor = (score) => {
    if (score >= 9) return 'text-red-600 bg-red-100';
    if (score >= 7) return 'text-orange-600 bg-orange-100';
    if (score >= 5) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getScoreEmoji = (score) => {
    if (score >= 9) return '🚨';
    if (score >= 7) return '🔥';
    if (score >= 5) return '⚡';
    return '📝';
  };

  const toggleHotLeadAlerts = async () => {
    if (!dashboardData.smsConfig?.phoneNumber) return;

    try {
      const newSetting = !dashboardData.smsConfig.enableHotLeadAlerts;
      
      const response = await fetch('/api/customer-sms/configure-ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: dashboardData.smsConfig.phoneNumber,
          updates: { enableHotLeadAlerts: newSetting }
        })
      });

      if (response.ok) {
        setDashboardData(prev => ({
          ...prev,
          smsConfig: { ...prev.smsConfig, enableHotLeadAlerts: newSetting }
        }));
      }
    } catch (error) {
      console.error('Failed to toggle hot lead alerts:', error);
    }
  };

  const toggleBusinessHours = async () => {
    if (!dashboardData.smsConfig?.phoneNumber) return;

    try {
      const newSetting = !dashboardData.smsConfig.alertBusinessHours;
      
      const response = await fetch('/api/customer-sms/configure-ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: dashboardData.smsConfig.phoneNumber,
          updates: { alertBusinessHours: newSetting }
        })
      });

      if (response.ok) {
        setDashboardData(prev => ({
          ...prev,
          smsConfig: { ...prev.smsConfig, alertBusinessHours: newSetting }
        }));
      }
    } catch (error) {
      console.error('Failed to toggle business hours setting:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading SMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">SMS AI</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {dashboardData.smsConfig?.businessName || 'Your Business'} SMS Assistant
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-gray-800"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => window.location.href = '/sms-onboarding'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-gray-800"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">💬</div>
              <div>
                <p className="text-sm font-medium text-gray-400">Total Conversations</p>
                <p className="text-2xl font-bold text-white">{dashboardData.totalConversations}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">📨</div>
              <div>
                <p className="text-sm font-medium text-gray-400">Total Messages</p>
                <p className="text-2xl font-bold text-white">{dashboardData.totalMessages}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">👥</div>
              <div>
                <p className="text-sm font-medium text-gray-400">Leads Generated</p>
                <p className="text-2xl font-bold text-white">{dashboardData.leadsGenerated}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">🔥</div>
              <div>
                <p className="text-sm font-medium text-gray-400">Hot Leads (24h)</p>
                <p className="text-2xl font-bold text-red-600">{dashboardData.hotLeadStats.alertsLast24h}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-800">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setActiveTab('conversations')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'conversations'
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                💬 Conversations
              </button>
              <button
                onClick={() => setActiveTab('hotleads')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'hotleads'
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                🔥 Hot Lead Alerts
              </button>
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* SMS Configuration Status */}
            <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4">⚙️ SMS AI Configuration</h2>
              {dashboardData.smsConfig ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">📱 SMS Number:</span>
                      <span className="font-mono">{formatPhoneNumber(dashboardData.smsConfig.phoneNumber)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">🏢 Business:</span>
                      <span>{dashboardData.smsConfig.businessName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">📶 Status:</span>
                      <span className={dashboardData.smsConfig.verified ? 'text-green-500' : 'text-yellow-500'}>
                        {dashboardData.smsConfig.verified
                          ? '✅ Active — texting live'
                          : dashboardData.smsConfig.verificationStatus === 'needs_info'
                            ? '⚠️ Needs business info'
                            : '⏳ Pending carrier verification'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {dashboardData.smsConfig.verified
                        ? 'Your AI is answering texts on this number 24/7. Put it on your website, Google listing, ads, and signage so leads can reach you.'
                        : 'Carriers are verifying your number (usually 1–5 business days). Once approved, your AI automatically answers texts — we\'ll email you the moment it\'s live.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">No SMS configuration found</p>
                  <button
                    onClick={() => window.location.href = '/sms-onboarding'}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    🚀 Set Up SMS AI
                  </button>
                </div>
              )}
            </div>

            {/* Hot Lead Statistics */}
            <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4">🔥 Hot Lead Performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-red-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{dashboardData.hotLeadStats.totalHotLeads}</div>
                  <div className="text-sm text-red-700">Total Hot Leads</div>
                </div>
                <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{dashboardData.hotLeadStats.alertsLast24h}</div>
                  <div className="text-sm text-orange-700">Alerts (24h)</div>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{dashboardData.hotLeadStats.averageScore}</div>
                  <div className="text-sm text-blue-700">Average Score</div>
                </div>
                <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{dashboardData.hotLeadStats.highestScore}</div>
                  <div className="text-sm text-purple-700">Highest Score</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold mb-4">⚡ Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <button
                  onClick={toggleHotLeadAlerts}
                  className={`p-4 rounded-lg border ${
                    dashboardData.smsConfig?.enableHotLeadAlerts
                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  <div className="text-xl mb-2">
                    {dashboardData.smsConfig?.enableHotLeadAlerts ? '🔥' : '❄️'}
                  </div>
                  <div className="text-sm font-medium">
                    {dashboardData.smsConfig?.enableHotLeadAlerts ? 'Disable' : 'Enable'} Hot Lead Alerts
                  </div>
                </button>

                <button
                  onClick={toggleBusinessHours}
                  className={`p-4 rounded-lg border ${
                    dashboardData.smsConfig?.alertBusinessHours
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : 'bg-gray-50 border-gray-200 text-gray-200'
                  }`}
                >
                  <div className="text-xl mb-2">🕐</div>
                  <div className="text-sm font-medium">
                    {dashboardData.smsConfig?.alertBusinessHours ? 'Business Hours' : '24/7 Alerts'}
                  </div>
                </button>

                <button
                  onClick={() => window.location.href = '/sms-onboarding'}
                  className="p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                >
                  <div className="text-xl mb-2">⚙️</div>
                  <div className="text-sm font-medium">Configure Settings</div>
                </button>

                <button
                  onClick={loadDashboardData}
                  className="p-4 rounded-lg border bg-purple-500/10 border-purple-500/20 text-purple-400"
                >
                  <div className="text-xl mb-2">🔄</div>
                  <div className="text-sm font-medium">Refresh Data</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conversations Tab */}
        {activeTab === 'conversations' && (
          <div className="bg-[#161B22] rounded-xl border border-gray-800">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">💬 Recent Conversations</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {dashboardData.conversations.length > 0 ? (
                dashboardData.conversations.slice(0, 10).map((conversation, index) => (
                  <div key={conversation.id || index} className="p-6 hover:bg-white/[0.02]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="font-medium">{formatPhoneNumber(conversation.fromNumber)}</span>
                          {conversation.leadCaptured && (
                            <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full">
                              📝 Lead
                            </span>
                          )}
                          {conversation.messages?.some(m => m.hotLeadScore >= 7) && (
                            <span className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded-full">
                              🔥 Hot Lead
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          {conversation.messages?.length || 0} messages • 
                          Started {new Date(conversation.createdAt).toLocaleDateString()}
                        </div>
                        {conversation.messages?.length > 0 && (
                          <div className="text-sm text-gray-200">
                            Last: "{conversation.messages[conversation.messages.length - 1].body.slice(0, 100)}..."
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {conversation.messages?.some(m => m.hotLeadScore >= 7) && (
                          <div className="text-right mb-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${getScoreColor(Math.max(...conversation.messages.map(m => m.hotLeadScore || 0)))}`}>
                              {getScoreEmoji(Math.max(...conversation.messages.map(m => m.hotLeadScore || 0)))} 
                              {Math.max(...conversation.messages.map(m => m.hotLeadScore || 0))}/10
                            </span>
                          </div>
                        )}
                        <div className="text-xs text-gray-400">
                          {new Date(conversation.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">📱</div>
                  <h3 className="text-lg font-medium text-white mb-2">No conversations yet</h3>
                  <p className="text-gray-400">SMS conversations will appear here once customers start texting your AI.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hot Leads Tab */}
        {activeTab === 'hotleads' && (
          <div className="bg-[#161B22] rounded-xl border border-gray-800">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">🔥 Hot Lead Alerts</h2>
              <p className="text-sm text-gray-400 mt-1">
                Real-time alerts sent to {dashboardData.smsConfig?.businessOwnerPhone || 'business owner'}
              </p>
            </div>
            <div className="divide-y divide-gray-800">
              {dashboardData.hotLeadAlerts.length > 0 ? (
                dashboardData.hotLeadAlerts.map((alert, index) => (
                  <div key={alert.id || index} className="p-6 hover:bg-white/[0.02]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`text-lg ${getScoreColor(alert.leadInfo?.score || 0)}`}>
                            {getScoreEmoji(alert.leadInfo?.score || 0)}
                          </span>
                          <span className="font-medium">
                            Score: {alert.leadInfo?.score || 0}/10
                          </span>
                          <span className="text-sm text-gray-400">
                            from {alert.source === 'sms' ? 'SMS' : 'Website'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-200 mb-2">
                          "{alert.messageContent}"
                        </div>
                        <div className="text-sm text-gray-400">
                          <strong>AI Reasoning:</strong> {alert.leadInfo?.reasoning}
                        </div>
                        {alert.leadInfo?.nextAction && (
                          <div className="text-sm text-blue-600 mt-1">
                            <strong>Suggested Action:</strong> {alert.leadInfo.nextAction}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-400">
                        <div>{new Date(alert.timestamp).toLocaleDateString()}</div>
                        <div>{new Date(alert.timestamp).toLocaleTimeString()}</div>
                        {alert.alertSent && (
                          <div className="text-green-600 mt-1">✅ Alert Sent</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-4">🔥</div>
                  <h3 className="text-lg font-medium text-white mb-2">No hot leads detected yet</h3>
                  <p className="text-gray-400 mb-4">
                    Hot lead alerts will appear here when our AI detects high-intent customers.
                  </p>
                  {!dashboardData.smsConfig?.enableHotLeadAlerts && (
                    <button
                      onClick={toggleHotLeadAlerts}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                    >
                      🔥 Enable Hot Lead Alerts
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
