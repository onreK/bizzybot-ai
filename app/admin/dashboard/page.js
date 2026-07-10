'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  Users, DollarSign, TrendingUp, AlertCircle, ExternalLink,
  Clock, Mail, Smartphone, MessageSquare, Download, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Activity, BarChart3,
} from 'lucide-react';

const PLAN_COLORS = {
  starter:      'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  professional: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  business:     'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  free:         'bg-gray-700/40 text-gray-400 border border-gray-600/30',
};

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'bg-green-500/15 text-green-400 border border-green-500/30' },
  trialing:  { label: 'Trial',     color: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' },
  canceled:  { label: 'Churned',   color: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  past_due:  { label: 'Past Due',  color: 'bg-orange-500/15 text-orange-400 border border-orange-500/30' },
  trial:     { label: 'Trial',     color: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' },
};

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(date) {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function StatCard({ icon: Icon, label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl p-5 border ${highlight ? 'bg-violet-600/10 border-violet-500/30' : 'bg-[#0D1421] border-[#1E2D40]'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${highlight ? 'text-violet-400' : 'text-gray-500'}`} />
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function TrialBadge({ daysLeft }) {
  if (daysLeft < 0) return <span className="text-xs text-gray-600">Expired</span>;
  if (daysLeft <= 3) return <span className="text-xs font-semibold text-red-400">{daysLeft}d left ⚠</span>;
  return <span className="text-xs text-cyan-400">{daysLeft}d left</span>;
}

function ChannelDots({ gmail, sms, facebook }) {
  return (
    <div className="flex items-center gap-1.5">
      <span title="Email" className={`w-2 h-2 rounded-full ${gmail ? 'bg-green-400' : 'bg-gray-700'}`} />
      <span title="SMS" className={`w-2 h-2 rounded-full ${sms ? 'bg-green-400' : 'bg-gray-700'}`} />
      <span title="Facebook" className={`w-2 h-2 rounded-full ${facebook ? 'bg-green-400' : 'bg-gray-700'}`} />
    </div>
  );
}

function exportCSV(customers) {
  const headers = [
    'Business Name', 'Email', 'Phone', 'Plan', 'Status',
    'Industry', 'Company Size', 'Website', 'Address', 'City', 'State', 'ZIP', 'Country',
    'Business Description',
    'Signed Up', 'Trial Ends', 'Churned At', 'Last Active',
    'AI Interactions', 'Email Connected', 'SMS Connected', 'Stripe Customer ID',
  ];
  const rows = customers.map(c => [
    c.business_name || '',
    c.email || '',
    c.contact_phone || c.phone || '',
    c.plan || '',
    c.subscription_status || (c.is_on_trial ? 'trialing' : 'free'),
    c.industry || '',
    c.employee_count || '',
    c.website || '',
    c.address || '',
    c.city || '',
    c.state || '',
    c.zip_code || '',
    c.country || '',
    c.description || '',
    fmt(c.created_at),
    fmt(c.trial_ends_at),
    fmt(c.churned_at),
    fmt(c.last_active_at),
    c.ai_interactions || 0,
    c.has_gmail ? 'Yes' : 'No',
    c.has_sms ? 'Yes' : 'No',
    c.stripe_customer_id || '',
  ]);

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bizzybot-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [unitEconomics, setUnitEconomics] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.push('/sign-in'); return; }
    loadData();
  }, [isLoaded, user]);

  async function loadData() {
    setLoading(true);
    setApiError(null);
    try {
      const [res, costsRes] = await Promise.all([
        fetch('/api/admin/customers'),
        fetch('/api/admin/usage-costs'),
      ]);
      if (res.status === 403) { setAccessDenied(true); return; }
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
        setSummary(data.summary);
      } else {
        setApiError(`${data.error} — ${data.details || ''}`);
      }
      const costsData = await costsRes.json().catch(() => null);
      if (costsData?.success) setUnitEconomics(costsData);
    } catch (err) {
      setApiError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = customers;
    if (tab === 'trial')   list = customers.filter(c => c.is_on_trial);
    if (tab === 'paid')    list = customers.filter(c => c.is_paid);
    if (tab === 'churned') list = customers.filter(c => c.is_churned);
    if (tab === 'pastdue') list = customers.filter(c => c.is_past_due);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.email || '').toLowerCase().includes(q) ||
        (c.business_name || '').toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      );
    }
    return list;
  }, [customers, tab, search]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm">Your account is not authorized for this page.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'all',     label: 'All',      count: summary?.total },
    { id: 'trial',   label: 'Trial',    count: summary?.trial },
    { id: 'paid',    label: 'Paid',     count: summary?.paid },
    { id: 'churned', label: 'Churned',  count: summary?.churned },
    { id: 'pastdue', label: 'Past Due', count: summary?.past_due },
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      {/* Header */}
      <div className="border-b border-[#1E2D40] px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">BizzyBot Admin</h1>
          <p className="text-gray-500 text-xs mt-0.5">Founder command center — visible only to you</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => exportCSV(customers)}
            className="flex items-center gap-1.5 text-xs bg-[#1E2D40] hover:bg-[#2A3A55] text-gray-300 px-3 py-1.5 rounded-lg transition-colors border border-[#2A3A55]"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <a href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
            Customer View <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="px-8 py-8 max-w-7xl mx-auto">

        {apiError && (
          <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-xl px-5 py-4 text-red-300 text-sm font-mono">
            {apiError}
          </div>
        )}

        {/* KPI row */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            <StatCard icon={DollarSign}   label="MRR"         value={`$${summary.mrr.toLocaleString()}`}   sub={`$${summary.arr.toLocaleString()} ARR`} highlight />
            <StatCard icon={Users}        label="Paid"         value={summary.paid}                          sub="Active subscribers" />
            <StatCard icon={Clock}        label="On Trial"     value={summary.trial}                         sub={summary.expiring_soon > 0 ? `${summary.expiring_soon} expiring soon` : 'All good'} />
            <StatCard icon={XCircle}      label="Churned"      value={summary.churned}                       sub="All time" />
            <StatCard icon={AlertTriangle} label="Past Due"    value={summary.past_due}                      sub="Need attention" />
            <StatCard icon={TrendingUp}   label="Conversion"   value={`${summary.trial_conversion_rate}%`}  sub="Trial → paid" />
            <StatCard icon={Activity}     label="Total Signups" value={summary.total}                        sub="All time" />
          </div>
        )}

        {/* Unit economics — usage costs + margins (this month) */}
        {unitEconomics && (
          <div className="mb-8 bg-[#0D1420] border border-[#1E2D40] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E2D40] flex items-center justify-between">
              <div>
                <h3 className="text-white text-sm font-semibold">Unit Economics — {unitEconomics.month}</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  Estimated usage costs per customer (number rental, SMS, voice minutes, AI tokens, Stripe fees)
                </p>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide">Est. Costs</p>
                  <p className="text-white text-sm font-bold">${unitEconomics.totals.cost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] uppercase tracking-wide">Gross Margin</p>
                  <p className="text-emerald-400 text-sm font-bold">
                    ${unitEconomics.totals.margin.toLocaleString()}
                    {unitEconomics.totals.marginPct !== null && (
                      <span className="text-gray-500 font-normal ml-1">({unitEconomics.totals.marginPct}%)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#1E2D40]">
                    <th className="text-left px-5 py-2.5 font-medium">Customer</th>
                    <th className="text-left px-3 py-2.5 font-medium">Plan</th>
                    <th className="text-right px-3 py-2.5 font-medium">Revenue</th>
                    <th className="text-right px-3 py-2.5 font-medium">SMS</th>
                    <th className="text-right px-3 py-2.5 font-medium">Voice min</th>
                    <th className="text-right px-3 py-2.5 font-medium">Number</th>
                    <th className="text-right px-3 py-2.5 font-medium">Est. Cost</th>
                    <th className="text-right px-5 py-2.5 font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {unitEconomics.customers
                    .filter(c => c.price > 0 || c.costs.total > 0)
                    .sort((a, b) => b.costs.total - a.costs.total)
                    .slice(0, 15)
                    .map(c => (
                      <tr key={c.id} className="border-b border-[#1E2D40]/50 hover:bg-white/[0.02]">
                        <td className="px-5 py-2.5">
                          <span className="text-white">{c.businessName}</span>
                          <span className="text-gray-600 ml-2">{c.email}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 capitalize">{c.plan}</td>
                        <td className="px-3 py-2.5 text-right text-gray-300">${c.price}</td>
                        <td className="px-3 py-2.5 text-right text-gray-400">
                          {c.usage.smsExchanges} <span className="text-gray-600">(${c.costs.sms})</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-400">
                          {c.usage.voiceMinutes} <span className="text-gray-600">(${c.costs.voice})</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">${c.costs.number}</td>
                        <td className="px-3 py-2.5 text-right text-white font-medium">${c.costs.total}</td>
                        <td className={`px-5 py-2.5 text-right font-medium ${c.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${c.margin}
                          {c.marginPct !== null && <span className="text-gray-600 font-normal ml-1">({c.marginPct}%)</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Plan MRR breakdown */}
        {summary && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { plan: 'starter',      price: 29,  color: 'blue' },
              { plan: 'professional', price: 69,  color: 'violet' },
              { plan: 'business',     price: 199, color: 'amber' },
            ].map(({ plan, price, color }) => {
              const count = customers.filter(c => c.is_paid && c.plan === plan).length;
              return (
                <div key={plan} className="bg-[#0D1421] border border-[#1E2D40] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${PLAN_COLORS[plan]}`}>{plan}</span>
                    <span className="text-gray-500 text-xs">${price}/mo</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{count}</div>
                  <div className="text-xs text-gray-500 mt-1">${(count * price).toLocaleString()} MRR</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs + search */}
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div className="flex gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  tab === t.id
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab === t.id ? 'bg-white/20' : 'bg-white/10'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#0D1421] border border-[#1E2D40] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 w-64"
          />
        </div>

        {/* Customer table */}
        <div className="bg-[#0D1421] border border-[#1E2D40] rounded-xl overflow-hidden">
          <div className="px-6 py-3 border-b border-[#1E2D40] flex items-center justify-between">
            <span className="text-xs text-gray-500">{filtered.length} customers</span>
            <div className="flex items-center gap-4 text-[10px] text-gray-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Email</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> SMS</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Facebook</span>
              <span className="text-gray-700">— = not connected</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center text-gray-600 text-sm">No customers in this view.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-gray-600 uppercase tracking-wider border-b border-[#1E2D40]">
                    <th className="text-left px-6 py-3 font-medium">Business</th>
                    <th className="text-left px-6 py-3 font-medium">Email</th>
                    <th className="text-left px-6 py-3 font-medium">Phone</th>
                    <th className="text-left px-6 py-3 font-medium">Plan</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                    <th className="text-left px-6 py-3 font-medium">Trial / Joined</th>
                    <th className="text-left px-6 py-3 font-medium">Last Active</th>
                    <th className="text-left px-6 py-3 font-medium">AI Uses</th>
                    <th className="text-left px-6 py-3 font-medium">Channels</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#131D2E]">
                  {filtered.map(c => {
                    const statusKey = c.is_churned ? 'canceled' : c.is_past_due ? 'past_due' : c.is_paid ? 'active' : 'trialing';
                    const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.trialing;

                    return (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white text-sm">{c.business_name || '—'}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-xs">{c.email || '—'}</td>
                        <td className="px-6 py-4 text-gray-400 text-xs">{c.phone || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${PLAN_COLORS[c.plan] || PLAN_COLORS.free}`}>
                            {c.plan || 'free'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {c.is_on_trial ? (
                            <div>
                              <TrialBadge daysLeft={c.trial_days_left} />
                              <div className="text-[10px] text-gray-600 mt-0.5">Joined {fmt(c.created_at)}</div>
                            </div>
                          ) : c.is_churned ? (
                            <div>
                              <span className="text-xs text-red-400">Churned {fmt(c.churned_at)}</span>
                              <div className="text-[10px] text-gray-600 mt-0.5">Joined {fmt(c.created_at)}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">{fmt(c.created_at)}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">{timeAgo(c.last_active_at)}</td>
                        <td className="px-6 py-4 text-xs text-gray-300">
                          {parseInt(c.ai_interactions || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <ChannelDots gmail={c.has_gmail} sms={c.has_sms} facebook={c.has_facebook} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note for company sale */}
        <p className="text-xs text-gray-700 mt-6 text-center">
          Export CSV contains all customer data needed for due diligence — emails, phones, plans, usage, and churn dates.
        </p>
      </div>
    </div>
  );
}
