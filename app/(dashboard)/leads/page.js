'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Phone, 
  Mail, 
  Calendar,
  TrendingUp,
  MessageSquare,
  Clock,
  Building,
  ChevronRight,
  ChevronLeft,
  Flame,
  Thermometer,
  Snowflake,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Trash2,
  ArrowUp,
  ArrowDown,
  DollarSign
} from 'lucide-react';

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [temperatureFilter, setTemperatureFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');  // Changed default to 'recent'
  const [deletingLeadId, setDeletingLeadId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [channelStats, setChannelStats] = useState({});
  const [stageUpdates, setStageUpdates] = useState({});
  const [stageFilter, setStageFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortDir, setSortDir] = useState('desc');
  const [channelFilter, setChannelFilter] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage] = useState(10); // Show 10 leads per page
  
  const [stats, setStats] = useState({
    total: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    totalValue: 0,
    avgScore: 0
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    filterAndSortLeads();
  }, [leads, searchTerm, temperatureFilter, stageFilter, sortBy, stageUpdates, dateFilter, sortDir, channelFilter]);

  useEffect(() => {
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [searchTerm, temperatureFilter, stageFilter, sortBy, dateFilter, channelFilter]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/customer/leads');
      
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
        setChannelStats(data.summary?.channels || {});

        // Calculate stats with proper value handling
        const leadStats = {
          total: data.leads?.length || 0,
          hot: data.leads?.filter(l => l.temperature === 'hot').length || 0,
          warm: data.leads?.filter(l => l.temperature === 'warm').length || 0,
          cold: data.leads?.filter(l => l.temperature === 'cold').length || 0,
          totalValue: data.leads?.reduce((sum, lead) => {
            // Parse the value properly - handle various formats
            const value = parseFloat(lead.potential_value) || 0;
            return sum + value;
          }, 0) || 0,
          avgScore: data.leads?.length > 0 
            ? Math.round(data.leads.reduce((sum, l) => sum + (l.score || 0), 0) / data.leads.length)
            : 0
        };
        setStats(leadStats);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteLead = async (leadId) => {
    try {
      setDeletingLeadId(leadId);
      
      const response = await fetch(`/api/customer/leads/${leadId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Remove the lead from the list
        setLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadId));
        setDeleteConfirmId(null);
        
        // Show success message (you could use a toast here)
        console.log('Lead deleted successfully');
      } else {
        console.error('Failed to delete lead');
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
    } finally {
      setDeletingLeadId(null);
    }
  };

  const updateStage = async (leadId, newStage) => {
    setStageUpdates(prev => ({ ...prev, [leadId]: newStage }));
    try {
      await fetch(`/api/customer/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      });
    } catch (error) {
      console.error('Error updating stage:', error);
      setStageUpdates(prev => {
        const updated = { ...prev };
        delete updated[leadId];
        return updated;
      });
    }
  };

  const filterAndSortLeads = () => {
    let filtered = [...leads];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm) ||
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Temperature filter
    if (temperatureFilter !== 'all') {
      filtered = filtered.filter(lead => lead.temperature === temperatureFilter);
    }

    // Stage filter
    if (stageFilter !== 'all') {
      filtered = filtered.filter(lead => {
        const leadStage = stageUpdates[lead.id] ?? lead.status ?? 'new';
        return leadStage === stageFilter;
      });
    }

    // Channel filter
    if (channelFilter !== 'all') {
      filtered = filtered.filter(lead => lead.primary_channel === channelFilter);
    }

    // Date filter — by when the lead was first created
    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoff = {
        today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        '7d':  new Date(now - 7  * 24 * 60 * 60 * 1000),
        '30d': new Date(now - 30 * 24 * 60 * 60 * 1000),
        '90d': new Date(now - 90 * 24 * 60 * 60 * 1000),
      }[dateFilter];
      filtered = filtered.filter(lead =>
        new Date(lead.created_at || lead.last_interaction) >= cutoff
      );
    }

    // Sorting with direction. The comparators below are written descending
    // (b - a), so 'desc' multiplies by 1 and 'asc' flips with -1 — the old
    // mapping was inverted, showing oldest activity first by default.
    const dir = sortDir === 'asc' ? -1 : 1;
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => dir * (new Date(b.last_interaction) - new Date(a.last_interaction)));
        break;
      case 'added':
        filtered.sort((a, b) => dir * (new Date(b.created_at || b.last_interaction) - new Date(a.created_at || a.last_interaction)));
        break;
      case 'score':
        filtered.sort((a, b) => dir * (b.score - a.score));
        break;
      case 'value':
        filtered.sort((a, b) => dir * (b.potential_value - a.potential_value));
        break;
      default:
        break;
    }

    setFilteredLeads(filtered);
  };

  // Pagination logic
  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  const currentLeads = filteredLeads.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Score', 'Temperature', 'Last Contact', 'Channel', 'Value'];
    const csvData = filteredLeads.map(lead => [
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.company || '',
      lead.score,
      lead.temperature,
      new Date(lead.last_interaction).toLocaleDateString(),
      lead.primary_channel,
      lead.potential_value
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getTemperatureIcon = (temperature) => {
    switch (temperature) {
      case 'hot':
        return <Flame className="w-4 h-4" />;
      case 'warm':
        return <Thermometer className="w-4 h-4" />;
      case 'cold':
        return <Snowflake className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTemperatureColor = (temperature) => {
    switch (temperature) {
      case 'hot':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warm':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cold':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [name, secondsInInterval] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInInterval);
      if (interval >= 1) {
        return `${interval} ${name}${interval > 1 ? 's' : ''} ago`;
      }
    }
    return 'Just now';
  };

  const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Format currency properly
  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage all your potential customers</p>
        </div>
        <button
          onClick={fetchLeads}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-gray-800"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Leads</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Hot Leads</p>
                <p className="text-2xl font-bold text-red-400">{stats.hot}</p>
              </div>
              <Flame className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Warm Leads</p>
                <p className="text-2xl font-bold text-orange-400">{stats.warm}</p>
              </div>
              <Thermometer className="w-8 h-8 text-orange-400" />
            </div>
          </div>

          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Cold Leads</p>
                <p className="text-2xl font-bold text-blue-400">{stats.cold}</p>
              </div>
              <Snowflake className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Score</p>
                <p className="text-2xl font-bold text-green-400">{stats.avgScore}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Value</p>
                <p className="text-xl font-bold text-purple-400 truncate">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Source Breakdown */}
        {Object.keys(channelStats).length > 0 && (
          <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Lead Source Breakdown</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(channelStats)
                .sort(([, a], [, b]) => b - a)
                .map(([channel, count]) => {
                  const total = Object.values(channelStats).reduce((s, v) => s + v, 0);
                  const pct = Math.round((count / total) * 100);
                  const colors = {
                    email: 'bg-red-500/20 text-red-300 border-red-500/30',
                    outlook: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                    sms: 'bg-green-500/20 text-green-300 border-green-500/30',
                    voice: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
                    chat: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                    facebook: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                    instagram: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
                    unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                  };
                  const colorClass = colors[channel] || colors.unknown;
                  return (
                    <div key={channel} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${colorClass}`}>
                      <span className="capitalize font-medium">{channel}</span>
                      <span className="font-bold">{count}</span>
                      <span className="opacity-60">({pct}%)</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-[#161B22] border border-gray-800 rounded-xl p-6 mb-6 space-y-4">

          {/* Row 1: Search + Temperature + Channel + Stage + Sort + Export */}
          <div className="flex flex-col lg:flex-row gap-3 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#0D1117] border border-gray-800 text-white placeholder:text-gray-600 rounded-lg focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Temperature Filter */}
            <div className="flex gap-2">
              {[
                { val: 'all',  label: 'All',  active: 'bg-purple-600 text-white', icon: null },
                { val: 'hot',  label: 'Hot',  active: 'bg-red-600 text-white',    icon: <Flame className="w-4 h-4" /> },
                { val: 'warm', label: 'Warm', active: 'bg-orange-600 text-white', icon: <Thermometer className="w-4 h-4" /> },
                { val: 'cold', label: 'Cold', active: 'bg-blue-600 text-white',   icon: <Snowflake className="w-4 h-4" /> },
              ].map(({ val, label, active, icon }) => (
                <button
                  key={val}
                  onClick={() => setTemperatureFilter(val)}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1 ${
                    temperatureFilter === val
                      ? active
                      : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Channel Filter */}
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-4 py-2 bg-[#0D1117] border border-gray-800 text-white rounded-lg focus:outline-none focus:border-violet-500 [&>option]:bg-[#161B22] [&>option]:text-white"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all">All Channels</option>
              <option value="email">Gmail</option>
              <option value="outlook">Outlook</option>
              <option value="sms">SMS</option>
              <option value="voice">Voice AI</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="chat">Web Chat</option>
            </select>

            {/* Stage Filter */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-4 py-2 bg-[#0D1117] border border-gray-800 text-white rounded-lg focus:outline-none focus:border-violet-500 [&>option]:bg-[#161B22] [&>option]:text-white"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all">All Stages</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>

            {/* Sort + Direction Toggle */}
            <div className="flex items-center gap-1">
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setSortDir('desc'); }}
                className="px-4 py-2 bg-[#0D1117] border border-gray-800 text-white rounded-lg focus:outline-none focus:border-violet-500 [&>option]:bg-[#161B22] [&>option]:text-white"
                style={{ colorScheme: 'dark' }}
              >
                <option value="recent">Sort by Last Active</option>
                <option value="added">Sort by Date Added</option>
                <option value="score">Sort by Score</option>
                <option value="value">Sort by Value</option>
              </select>
              <button
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                title={sortDir === 'desc' ? 'Descending — click to reverse' : 'Ascending — click to reverse'}
                className="p-2 bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 rounded-lg transition-colors"
              >
                {sortDir === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Export Button */}
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Row 2: Date Filter */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-800/60">
            <span className="text-xs text-gray-500 flex-shrink-0">Date added:</span>
            <div className="flex gap-2 flex-wrap">
              {[
                { val: 'all',   label: 'All time' },
                { val: 'today', label: 'Today' },
                { val: '7d',    label: '7 Days' },
                { val: '30d',   label: '30 Days' },
                { val: '90d',   label: '90 Days' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setDateFilter(val)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    dateFilter === val
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#0D1117] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-[#161B22] border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-800">
                <tr className="text-left">
                  <th className="p-4 text-gray-400 font-medium">Lead</th>
                  <th className="p-4 text-gray-400 font-medium">Contact</th>
                  <th className="p-4 text-gray-400 font-medium">Score</th>
                  <th className="p-4 text-gray-400 font-medium">Temperature</th>
                  <th className="p-4 text-gray-400 font-medium">Stage</th>
                  <th className="p-4 text-gray-400 font-medium">Last Activity</th>
                  <th className="p-4 text-gray-400 font-medium">Channel</th>
                  <th className="p-4 text-gray-400 font-medium">Value</th>
                  <th className="p-4 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentLeads.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-gray-400">
                      {searchTerm || temperatureFilter !== 'all' 
                        ? 'No leads found matching your filters'
                        : 'No leads yet. They will appear here as your AI interacts with customers.'}
                    </td>
                  </tr>
                ) : (
                  currentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{lead.name || 'Unknown'}</p>
                          {lead.company && (
                            <p className="text-gray-400 text-sm flex items-center mt-1">
                              <Building className="w-3 h-3 mr-1" />
                              {lead.company}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {lead.email && (
                            <p className="text-gray-300 text-sm flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {lead.email}
                            </p>
                          )}
                          {lead.phone && (
                            <p className="text-gray-300 text-sm flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {lead.phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(lead.score)}`}>
                          {lead.score}/100
                        </div>
                      </td>
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getTemperatureColor(lead.temperature)}`}>
                          {getTemperatureIcon(lead.temperature)}
                          <span className="capitalize">{lead.temperature}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const currentStage = stageUpdates[lead.id] ?? lead.status ?? 'new';
                          const stageColors = {
                            new: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
                            contacted: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                            qualified: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                            converted: 'bg-green-500/20 text-green-300 border-green-500/30',
                            lost: 'bg-red-500/20 text-red-300 border-red-500/30',
                          };
                          return (
                            <select
                              value={currentStage}
                              onChange={(e) => updateStage(lead.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-xs font-medium px-2 py-1 rounded border cursor-pointer bg-transparent ${stageColors[currentStage] || stageColors.new}`}
                              style={{ colorScheme: 'dark' }}
                            >
                              <option value="new" className="bg-gray-800 text-white">New</option>
                              <option value="contacted" className="bg-gray-800 text-white">Contacted</option>
                              <option value="qualified" className="bg-gray-800 text-white">Qualified</option>
                              <option value="converted" className="bg-gray-800 text-white">Converted</option>
                              <option value="lost" className="bg-gray-800 text-white">Lost</option>
                            </select>
                          );
                        })()}
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="text-gray-300 text-sm">{formatTimeAgo(lead.last_interaction)}</p>
                          {lead.created_at && (
                            <p className="text-gray-600 text-xs mt-0.5">Added {formatDate(lead.created_at)}</p>
                          )}
                          {lead.last_message && (
                            <p className="text-gray-500 text-xs mt-1 truncate max-w-xs">
                              "{lead.last_message}"
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-[#0D1117] text-gray-400 border border-gray-800 rounded text-sm">
                          {lead.primary_channel}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-green-400 font-medium">{formatCurrency(lead.potential_value)}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/leads/${lead.id}`)}
                            className="px-3 py-1 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/20 rounded-lg transition-colors text-sm flex items-center gap-1"
                          >
                            View
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          
                          {deleteConfirmId === lead.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteLead(lead.id)}
                                disabled={deletingLeadId === lead.id}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs disabled:opacity-50"
                              >
                                {deletingLeadId === lead.id ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(lead.id)}
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                              title="Delete lead"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {filteredLeads.length > leadsPerPage && (
            <div className="px-6 py-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Showing {indexOfFirstLead + 1} to {Math.min(indexOfLastLead, filteredLeads.length)} of {filteredLeads.length} leads
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg transition-colors ${
                      currentPage === 1
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                        : 'bg-[#161B22] text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex gap-1">
                    {[...Array(Math.min(5, totalPages))].map((_, index) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = index + 1;
                      } else if (currentPage <= 3) {
                        pageNum = index + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + index;
                      } else {
                        pageNum = currentPage - 2 + index;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`px-3 py-1 rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? 'bg-purple-600 text-white'
                              : 'bg-[#161B22] text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="px-2 text-gray-500">...</span>
                        <button
                          onClick={() => goToPage(totalPages)}
                          className="px-3 py-1 bg-[#161B22] text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg transition-colors ${
                      currentPage === totalPages
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                        : 'bg-[#161B22] text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
