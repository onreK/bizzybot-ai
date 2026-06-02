'use client';

import { useUser, SignOutButton } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard, BarChart3, Mail, Phone, MessageCircle,
  Facebook, Instagram, Settings, Bot, LogOut, Target,
  Bell, Flame, X, Calendar, Mic
} from 'lucide-react';

const NAV = [
  {
    group: null,
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    ]
  },
  {
    group: 'Leads',
    items: [
      { label: 'Lead Management', href: '/leads', icon: Target },
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    ]
  },
  {
    group: 'Channels',
    items: [
      { label: 'Email', href: '/email', icon: Mail },
      { label: 'SMS', href: '/customer-sms-dashboard', icon: Phone },
      { label: 'Voice AI', href: '/voice', icon: Mic },
      { label: 'Facebook', href: '/facebook', icon: Facebook },
      { label: 'Instagram', href: '/instagram', icon: Instagram },
      { label: 'Scheduling', href: '/scheduling', icon: Calendar },
      { label: 'Web Chat', href: '/web-chat', icon: MessageCircle },
    ]
  },
  {
    group: 'Account',
    items: [
      { label: 'AI Settings', href: '/ai-settings', icon: Bot },
      { label: 'Settings', href: '/settings', icon: Settings },
    ]
  }
];

const CHANNEL_ICONS = {
  sms: Phone,
  email: Mail,
  facebook: Facebook,
  instagram: Instagram,
  web: MessageCircle,
  chat: MessageCircle,
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DashboardLayout({ children }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [lastReadAt, setLastReadAt] = useState(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push('/sign-in');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    const stored = localStorage.getItem('notifications_last_read');
    if (stored) setLastReadAt(new Date(stored));
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      fetchNotifications();
      // Refresh every 2 minutes
      const interval = setInterval(fetchNotifications, 120000);
      return () => clearInterval(interval);
    }
  }, [isSignedIn, fetchNotifications]);

  const unreadCount = notifications.filter(n =>
    !lastReadAt || new Date(n.timestamp) > lastReadAt
  ).length;

  const markAllRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem('notifications_last_read', now);
    setLastReadAt(new Date(now));
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) return null;

  const displayName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'User';

  return (
    <div className="flex h-screen bg-[#0D1117] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 bg-[#0F1117] border-r border-gray-800 flex flex-col">

        {/* Brand */}
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src="/Bizzybot Logo 2.png"
                  alt="BizzyBot"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-white font-semibold text-sm leading-tight">BizzyBot AI</div>
                <div className="text-gray-500 text-xs truncate">{displayName}</div>
              </div>
            </div>

            {/* Bell */}
            <button
              onClick={() => setShowPanel(p => !p)}
              className="relative p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
              aria-label="Notifications"
            >
              <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-violet-400' : 'text-gray-500'}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-violet-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {NAV.map((section, si) => (
            <div key={si} className={si > 0 ? 'pt-4' : ''}>
              {section.group && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                  {section.group}
                </p>
              )}
              {section.items.map(item => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={`${item.href}-${item.label}`}
                    href={item.href}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${
                      isActive
                        ? 'text-white bg-violet-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-500 rounded-r-full" />
                    )}
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? 'text-violet-400' : 'text-gray-500 group-hover:text-gray-300'
                    }`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sign out + legal links */}
        <div className="px-3 py-4 border-t border-gray-800 space-y-1">
          <SignOutButton>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all w-full">
              <LogOut className="w-4 h-4 text-gray-500" />
              Sign Out
            </button>
          </SignOutButton>
          <div className="flex items-center gap-3 px-3 pt-1">
            <Link href="/privacy" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">Privacy</Link>
            <span className="text-gray-700 text-[11px]">·</span>
            <Link href="/terms" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">Terms</Link>
          </div>
        </div>
      </aside>

      {/* ── Notification Panel ── */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />
          {/* Panel */}
          <div className="fixed left-60 top-0 h-full w-80 z-50 bg-[#161B22] border-r border-gray-800 shadow-2xl flex flex-col">
            {/* Panel header */}
            <div className="px-4 py-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-violet-400" />
                <h3 className="text-white font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-violet-500/20 text-violet-400 text-xs rounded-full font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="p-1 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Bell className="w-8 h-8 text-gray-700 mb-3" />
                  <p className="text-gray-500 text-sm">No recent activity</p>
                  <p className="text-gray-600 text-xs mt-1">Hot leads and alerts will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {notifications.map(n => {
                    const isUnread = !lastReadAt || new Date(n.timestamp) > lastReadAt;
                    const ChannelIcon = CHANNEL_ICONS[n.channel?.toLowerCase()] || MessageCircle;
                    return (
                      <Link
                        key={n.id}
                        href={n.href}
                        onClick={() => setShowPanel(false)}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors ${
                          isUnread ? 'bg-violet-500/[0.04]' : ''
                        }`}
                      >
                        {/* Icon */}
                        <div className="w-8 h-8 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Flame className="w-4 h-4 text-red-400" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-white text-xs font-medium">{n.title}</span>
                            {isUnread && (
                              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-gray-400 text-xs truncate">{n.description}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <ChannelIcon className="w-3 h-3 text-gray-600" />
                            <span className="text-gray-600 text-xs capitalize">{n.channel || 'web'}</span>
                            <span className="text-gray-700 text-xs">·</span>
                            <span className="text-gray-600 text-xs">{timeAgo(n.timestamp)}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
              <Link
                href="/leads"
                onClick={() => setShowPanel(false)}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                View all leads →
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
