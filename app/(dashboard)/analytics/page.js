'use client';

// Force dynamic rendering for authentication
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  TrendingUp, Activity, Target, DollarSign, Clock, Users,
  BarChart3, Zap, Phone, Calendar, MessageSquare, Award,
  ArrowUpRight, ArrowDownRight, RefreshCw, Download,
  ChevronRight, AlertCircle, CheckCircle, Info, Mic, PhoneCall
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AnalyticsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('month');
  const [analytics, setAnalytics] = useState(null);
  const [customer, setCustomer] = useState(null);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/customer/analytics?period=${period}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch analytics');
      }
      
      if (data.success && data.analytics) {
        setAnalytics(data.analytics);
        setCustomer(data.customer);
      } else {
        // Set empty analytics if no data
        setAnalytics(getEmptyAnalytics());
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error.message);
      setAnalytics(getEmptyAnalytics());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      fetchAnalytics();
    }
  }, [isLoaded, user, period]);

  // Get empty analytics structure
  const getEmptyAnalytics = () => ({
    overview: {
      effectiveness_score: 0,
      total_interactions_month: 0,
      interactions_today: 0,
      hot_leads_today: 0,
      hot_leads_month: 0,
      phone_requests_today: 0,
      phone_requests_month: 0,
      appointments_month: 0,
      ai_engagement_rate: 0,
      contact_capture_rate: 0,
      avg_response_speed_minutes: 0,
      total_leads_captured: 0
    },
    channels: [],
    insights: [],
    behaviors: [],
    topBehaviors: [],
    businessValue: { total: 0, breakdown: {} },
    dailyTrend: []
  });

  // Format number with commas
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num || 0);
  };

  // Get color for effectiveness score
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  // Get icon for insight type
  const getInsightIcon = (type) => {
    switch(type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'info': return <Info className="w-5 h-5 text-blue-400" />;
      case 'alert': return <Zap className="w-5 h-5 text-orange-400" />;
      default: return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  const getHealthScoreMessage = (overview, channels) => {
    const score = overview?.effectiveness_score || 0;
    const total = overview?.total_interactions_month || 0;
    const hotLeads = overview?.hot_leads_month || 0;
    const leads = overview?.total_leads_captured || 0;
    if (total === 0) return 'No activity yet — connect a channel to get started';
    if (score < 30) {
      if (hotLeads === 0 && leads > 0) return 'Improve: tune your AI prompt to better detect high-intent signals like pricing or scheduling requests';
      if (leads === 0) return 'Improve: have your AI ask visitors for their name and contact info';
      return 'Early stage — more consistent engagement will push your score up';
    }
    if (score < 50) return 'Growing — refine your AI prompt or connect more channels to improve';
    if (score < 70) return 'Developing well — focus on converting more interactions into hot leads';
    if (score < 85) return 'Healthy — your AI is performing well across your channels';
    return 'Excellent — your AI is firing on all cylinders!';
  };

  const generateSmartInsights = (overview, channels, trend) => {
    const insights = [];
    const total = overview?.total_interactions_month || 0;
    const leads = overview?.total_leads_captured || 0;
    const hotLeads = overview?.hot_leads_month || 0;
    const responseTime = overview?.avg_response_speed_minutes || 0;

    if (total === 0) {
      return [{ type: 'alert', message: 'No AI activity recorded yet — make sure your channels are connected and AI is enabled in AI Settings' }];
    }

    const convRate = total > 0 ? Math.round((leads / total) * 100) : 0;
    if (convRate < 2 && total > 10) {
      insights.push({ type: 'warning', message: `Lead capture rate is ${convRate}% — try having your AI ask for contact info earlier in the conversation` });
    } else if (convRate >= 5) {
      insights.push({ type: 'success', message: `Strong lead capture rate of ${convRate}% — your AI is qualifying leads effectively` });
    }

    if (leads > 0 && hotLeads === 0) {
      insights.push({ type: 'alert', message: `You have ${formatNumber(leads)} leads but 0 hot leads — update your AI prompt to detect high-intent signals like pricing questions or scheduling requests` });
    } else if (leads > 0) {
      const hotRate = Math.round((hotLeads / leads) * 100);
      if (hotRate >= 20) {
        insights.push({ type: 'success', message: `${hotRate}% of your leads are hot — great job identifying high-intent prospects` });
      }
    }

    if (responseTime > 0 && responseTime < 3) {
      insights.push({ type: 'success', message: `Lightning-fast average response time of ${responseTime} min — leads get answers before they lose interest` });
    } else if (responseTime > 30) {
      insights.push({ type: 'warning', message: `Average response time is ${responseTime} min — slow responses risk losing hot leads. Check your AI automation settings` });
    }

    const activeChannels = channels?.length || 0;
    if (activeChannels === 1) {
      insights.push({ type: 'info', message: `You're only active on ${channels[0]?.name || 'one channel'} — adding SMS or Web Chat typically doubles lead capture` });
    }

    if (trend && trend.length > 1) {
      const bestDay = trend.reduce((best, day) =>
        (day.metrics?.total || 0) > (best.metrics?.total || 0) ? day : best, trend[0]);
      if (bestDay?.metrics?.total > 0) {
        const dayLabel = new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        insights.push({ type: 'info', message: `Your busiest day was ${dayLabel} with ${formatNumber(bestDay.metrics.total)} interactions — a great day to prioritize manual follow-ups` });
      }
    }

    if (insights.length === 0) {
      insights.push({ type: 'success', message: `Your AI handled ${formatNumber(total)} interactions this period. Consistent activity builds a strong health score.` });
    }

    return insights;
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-gray-400">Please sign in to view analytics</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your AI's performance and business impact</p>
        </div>
        <button
          onClick={fetchAnalytics}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-gray-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div>
        {/* Period Selector */}
        <div className="flex gap-2 mb-8">
          {['today', 'week', 'month', 'year', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg capitalize text-sm transition-all ${
                period === p
                  ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                  : 'bg-[#161B22] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {p === 'all' ? 'All Time' : p}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading analytics...</p>
            </div>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Effectiveness Score Hero */}
            <div className="bg-[#161B22] rounded-xl border border-gray-800 p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-300 mb-3">AI Health Score</h3>
                  <div className={`text-6xl font-bold ${getScoreColor(analytics.overview?.effectiveness_score || 0)}`}>
                    {analytics.overview?.effectiveness_score || 0}
                  </div>
                  <div className="text-gray-500 text-sm mt-1">out of 100</div>
                  <div className="mt-4 px-1">
                    <div className="relative h-2 rounded-full" style={{ background: 'linear-gradient(to right, #ef4444 0%, #ef4444 39%, #f59e0b 40%, #f59e0b 69%, #22c55e 70%, #22c55e 100%)' }}>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow border-2 border-gray-900"
                        style={{ left: `calc(${Math.min(97, Math.max(3, analytics.overview?.effectiveness_score || 0))}% - 6px)` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1.5">
                      <span>Needs Work</span>
                      <span>Developing</span>
                      <span>Healthy</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 leading-relaxed px-2">
                    {getHealthScoreMessage(analytics.overview, analytics.channels)}
                  </p>
                </div>
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="text-3xl font-bold text-white">
                      {formatNumber(analytics.overview?.total_interactions_month || 0)}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Total Interactions</div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="text-3xl font-bold text-green-400">
                      {formatNumber(analytics.overview?.hot_leads_month || 0)}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Hot Leads</div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="text-3xl font-bold text-blue-400">
                      {formatNumber(analytics.overview?.phone_requests_month || 0)}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Phone Requests</div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="text-3xl font-bold text-purple-400">
                      {formatNumber(analytics.overview?.appointments_month || 0)}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Appointments</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-gray-400">AI Engagement Rate</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {analytics.overview?.ai_engagement_rate || 0}%
                </div>
              </div>
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-gray-400">Contact Capture</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {analytics.overview?.contact_capture_rate || 0}%
                </div>
              </div>
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-400">Avg Response</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {analytics.overview?.avg_response_speed_minutes || 0} min
                </div>
              </div>
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  <span className="text-sm text-gray-400">Leads Captured</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatNumber(analytics.overview?.total_leads_captured || 0)}
                </div>
              </div>
            </div>

            {/* Business Value & Top Behaviors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conversion Funnel */}
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-blue-400" />
                    Conversion Funnel
                  </h3>
                </div>
                {(() => {
                  const steps = [
                    { label: 'Total Interactions', value: analytics.overview?.total_interactions_month || 0, color: 'bg-blue-500' },
                    { label: 'Leads Captured', value: analytics.overview?.total_leads_captured || 0, color: 'bg-purple-500' },
                    { label: 'Hot Leads', value: analytics.overview?.hot_leads_month || 0, color: 'bg-orange-500' },
                    { label: 'Appointments', value: analytics.overview?.appointments_month || 0, color: 'bg-green-500' },
                  ];
                  const maxVal = steps[0].value || 1;
                  return (
                    <div className="space-y-4">
                      {steps.map((step, i) => {
                        const widthPct = Math.max(4, Math.round((step.value / maxVal) * 100));
                        const convRate = i > 0 && steps[i - 1].value > 0
                          ? Math.round((step.value / steps[i - 1].value) * 100)
                          : null;
                        return (
                          <div key={step.label}>
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <span className="text-gray-300">{step.label}</span>
                              <div className="flex items-center gap-3">
                                {convRate !== null && (
                                  <span className="text-xs text-gray-500">{convRate}% conv.</span>
                                )}
                                <span className="text-white font-bold">{formatNumber(step.value)}</span>
                              </div>
                            </div>
                            <div className="w-full bg-black/30 rounded-full h-2.5">
                              <div
                                className={`${step.color} h-2.5 rounded-full transition-all duration-500`}
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Top Behaviors Card */}
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Target className="w-6 h-6 text-purple-400" />
                    Top AI Behaviors
                  </h3>
                </div>
                {analytics.behaviors && analytics.behaviors.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.behaviors.slice(0, 5).map((behavior, index) => {
                      const maxCount = analytics.behaviors[0]?.count || 1;
                      const pct = Math.round((behavior.count / maxCount) * 100);
                      return (
                        <div key={index}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="text-gray-300 capitalize">
                              {behavior.label || behavior.event_type?.replace(/_/g, ' ')}
                            </span>
                            <span className="text-white font-medium">{behavior.count}</span>
                          </div>
                          <div className="w-full bg-black/30 rounded-full h-1.5">
                            <div className="bg-violet-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No behavior data available yet</p>
                )}
              </div>
            </div>

            {/* Channel Performance */}
            {analytics.channels && analytics.channels.length > 0 && (
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-blue-400" />
                  Channel Performance
                </h3>
                {(() => {
                  const totalInteractions = analytics.channels.reduce((sum, c) => sum + (c.total_interactions || 0), 0) || 1;
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {analytics.channels.map((channel, index) => {
                        const sharePct = Math.round((channel.total_interactions / totalInteractions) * 100);
                        return (
                          <div key={index} className="bg-black/30 rounded-xl p-4 border border-white/10">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-lg font-medium text-white capitalize">{channel.name}</div>
                              <span className="text-xs text-gray-500">{sharePct}% of total</span>
                            </div>
                            <div className="w-full bg-black/40 rounded-full h-1 mb-4">
                              <div className="bg-blue-500 h-1 rounded-full transition-all duration-500" style={{ width: `${sharePct}%` }} />
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Interactions</span>
                                <span className="text-white font-medium">{formatNumber(channel.total_interactions)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Hot Leads</span>
                                <span className="text-green-400 font-medium">{channel.hot_leads}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Phone Requests</span>
                                <span className="text-blue-400 font-medium">{channel.phone_requests}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Appointments</span>
                                <span className="text-purple-400 font-medium">{channel.appointments}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Voice AI Performance */}
            {analytics.voice && (
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
                <h3 className="text-xl font-semibold text-white mb-5 flex items-center gap-2">
                  <Mic className="w-6 h-6 text-violet-400" />
                  Voice AI Performance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <PhoneCall className="w-4 h-4 text-violet-400" />
                      <span className="text-xs text-gray-400">Total Calls</span>
                    </div>
                    <div className="text-3xl font-bold text-white">
                      {formatNumber(analytics.voice.totalCalls)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">this {period === 'all' ? 'time' : period}</div>
                  </div>

                  <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-gray-400">Answered</span>
                    </div>
                    <div className="text-3xl font-bold text-green-400">
                      {formatNumber(analytics.voice.answeredCalls)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {analytics.voice.totalCalls > 0
                        ? `${Math.round((analytics.voice.answeredCalls / analytics.voice.totalCalls) * 100)}% answer rate`
                        : 'no calls yet'}
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-400">Minutes Talked</span>
                    </div>
                    <div className="text-3xl font-bold text-blue-400">
                      {formatNumber(analytics.voice.totalMinutes)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">total this period</div>
                  </div>

                  <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-gray-400">Avg Duration</span>
                    </div>
                    <div className="text-3xl font-bold text-amber-400">
                      {analytics.voice.avgDurationFormatted}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">per call</div>
                  </div>
                </div>

                {analytics.voice.totalCalls === 0 && (
                  <div className="mt-4 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                    <p className="text-xs text-gray-400">
                      No voice calls yet for this period. Once Voice AI is active and calls come in,
                      stats will appear here automatically.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* AI Insights & Recommendations */}
            {(() => {
              const smartInsights = generateSmartInsights(analytics.overview, analytics.channels, analytics.dailyTrend);
              return (
                <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
                  <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-yellow-400" />
                    Insights & Recommendations
                  </h3>
                  <div className="space-y-3">
                    {smartInsights.map((insight, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-black/30 rounded-lg border border-white/10">
                        {getInsightIcon(insight.type)}
                        <p className="text-gray-300 flex-1 text-sm leading-relaxed">{insight.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Activity Trend — Bar Chart */}
            {analytics.dailyTrend && analytics.dailyTrend.length > 0 && (
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-indigo-400" />
                    Activity Trend
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />
                      Interactions
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
                      Hot Leads
                    </span>
                  </div>
                </div>
                {(() => {
                  const trend = analytics.dailyTrend;
                  const maxVal = Math.max(...trend.map(d => d.metrics?.total || 0), 1);
                  const W = 800, chartH = 180, PAD_TOP = 16, totalSvgH = 220;
                  const PAD_L = 52, PAD_R = 12;
                  const chartW = W - PAD_L - PAD_R;
                  const barSpacing = chartW / trend.length;
                  const barW = Math.min(60, Math.max(3, barSpacing * 0.72));
                  const labelEvery = Math.ceil(trend.length / 8);
                  const yLabels = [0, 0.5, 1];
                  const fmtY = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
                  return (
                    <svg viewBox={`0 0 ${W} ${totalSvgH}`} className="w-full" style={{ height: '220px' }}>
                      {/* Y-axis gridlines + labels */}
                      {yLabels.map(pct => {
                        const y = PAD_TOP + Math.round(chartH * (1 - pct));
                        return (
                          <g key={pct}>
                            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#1f2937" strokeWidth={1} />
                            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fill="#6b7280" fontSize={11}>
                              {fmtY(Math.round(maxVal * pct))}
                            </text>
                          </g>
                        );
                      })}
                      {/* Bars */}
                      {trend.map((day, i) => {
                        const total = day.metrics?.total || 0;
                        const hot   = day.metrics?.hotLeads || 0;
                        const bH = total > 0 ? Math.max(2, Math.round((total / maxVal) * chartH)) : 0;
                        const hH = hot   > 0 ? Math.max(2, Math.round((hot   / maxVal) * chartH)) : 0;
                        const x = PAD_L + i * barSpacing + (barSpacing - barW) / 2;
                        return (
                          <g key={i}>
                            {bH > 0 && <rect x={x} y={PAD_TOP + chartH - bH} width={barW} height={bH} rx={2} fill="#7c3aed" opacity={0.8} />}
                            {hH > 0 && <rect x={x} y={PAD_TOP + chartH - hH} width={barW} height={hH} rx={2} fill="#ef4444" />}
                            {i % labelEvery === 0 && (
                              <text x={x + barW / 2} y={totalSvgH - 2} textAnchor="middle" fill="#6b7280" fontSize={10}>
                                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
              </div>
            )}

            {/* No Data Message */}
            {(!analytics.overview || analytics.overview.total_interactions_month === 0) && (
              <div className="bg-[#161B22] rounded-xl border border-gray-800 p-12">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No Analytics Data Yet</h3>
                  <p className="text-gray-400 mb-6">
                    Analytics will appear here once your AI starts interacting with customers.
                  </p>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => router.push('/email')}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
                    >
                      Configure Email AI
                    </button>
                    <button
                      onClick={() => router.push('/ai-config')}
                      className="px-6 py-3 bg-[#161B22] hover:bg-white/5 text-gray-300 rounded-lg transition-all border border-gray-800"
                    >
                      AI Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
