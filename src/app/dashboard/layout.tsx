'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n, Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import MiniChat from '@/components/MiniChat';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Shield, LayoutDashboard, Trophy, Users, Flag, Award, BookOpen,
  HelpCircle, User, LogOut, Menu, X, ChevronDown, Globe,
  Swords, GraduationCap, Settings, Shell, MessageCircle
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, initialized, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [miniChatTeam, setMiniChatTeam] = useState<{ id: string; name: string; code: string } | null>(null);
  const chatChannelRef = useRef<any>(null);
  const chatPollRef = useRef<any>(null);
  const lastSeenMsgRef = useRef<string | null>(null);
  const teamNamesRef = useRef<Record<string, string>>({});
  const teamIdsRef = useRef<string[]>([]);
  const supabase = createClient();

  const showChatNotification = useCallback(async (msg: any) => {
    if (!profile) return;
    // Ignore own messages
    if (msg.user_id === profile.id) return;

    const teamName = teamNamesRef.current[msg.team_id] || 'Equipe';
    const senderName = msg.profiles?.display_name || msg._senderName || 'Alguém';

    // Detect if current user is @mentioned
    const isMentioned = profile.display_name &&
      msg.message?.includes(`@${profile.display_name}`);

    // Increment unread counter
    if (!pathname.includes('/dashboard/teams')) {
      setUnreadChat(prev => prev + 1);
    }

    // Show toast notification (highlighted if mentioned)
    toast(
      (tt) => (
        <div
          className="flex items-start gap-3 cursor-pointer max-w-xs"
          onClick={() => {
            toast.dismiss(tt.id);
            router.push('/dashboard/teams');
          }}
        >
          <MessageCircle size={20} className={`mt-0.5 shrink-0 ${isMentioned ? 'text-amber-400' : 'text-cyber-cyan'}`} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{teamName}</p>
            <p className={`text-xs ${isMentioned ? 'text-amber-400' : 'text-cyber-cyan'}`}>
              {senderName} {isMentioned ? 'mencionou você' : ''}
            </p>
            <p className="text-xs text-gray-400 truncate">{msg.message}</p>
          </div>
        </div>
      ),
      {
        duration: isMentioned ? 8000 : 5000,
        position: 'top-right',
        style: {
          background: '#1a1a2e',
          border: isMentioned ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid rgba(0, 255, 255, 0.3)',
          borderRadius: '12px',
          padding: '12px 16px',
        },
      }
    );

    // Play notification sound — louder & distinct for @mentions
    try {
      const ctx = new AudioContext();
      if (isMentioned) {
        // @mention sound: two-tone alert, louder
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

        const osc1 = ctx.createOscillator();
        osc1.connect(gain);
        osc1.frequency.value = 1047; // C6
        osc1.type = 'triangle';
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);

        const osc2 = ctx.createOscillator();
        osc2.connect(gain);
        osc2.frequency.value = 1319; // E6
        osc2.type = 'triangle';
        osc2.start(ctx.currentTime + 0.18);
        osc2.stop(ctx.currentTime + 0.35);

        const osc3 = ctx.createOscillator();
        osc3.connect(gain);
        osc3.frequency.value = 1568; // G6
        osc3.type = 'triangle';
        osc3.start(ctx.currentTime + 0.38);
        osc3.stop(ctx.currentTime + 0.6);
      } else {
        // Normal notification: single soft tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch { /* audio not available */ }
  }, [profile, pathname, router]);

  // Global chat notification — polling + realtime
  useEffect(() => {
    if (!profile?.id) return;

    let cancelled = false;

    const setupChatNotifications = async () => {
      // Get all teams the user is a member of
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, teams(name)')
        .eq('user_id', profile.id);

      if (cancelled || !memberships || memberships.length === 0) return;

      const teamIds = memberships.map((m: any) => m.team_id);
      teamIdsRef.current = teamIds;
      memberships.forEach((m: any) => {
        teamNamesRef.current[m.team_id] = (m.teams as any)?.name || 'Equipe';
      });

      // Get latest message timestamp to know what's "new"
      const { data: latestMsg } = await supabase
        .from('chat_messages')
        .select('id, sent_at')
        .in('team_id', teamIds)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();
      lastSeenMsgRef.current = latestMsg?.sent_at || new Date().toISOString();

      // Polling: check for new messages every 5s
      chatPollRef.current = setInterval(async () => {
        if (!lastSeenMsgRef.current || teamIdsRef.current.length === 0) return;
        const { data: newMsgs } = await supabase
          .from('chat_messages')
          .select('*, profiles(display_name)')
          .in('team_id', teamIdsRef.current)
          .gt('sent_at', lastSeenMsgRef.current)
          .neq('user_id', profile.id)
          .order('sent_at', { ascending: true })
          .limit(10);

        if (newMsgs && newMsgs.length > 0) {
          lastSeenMsgRef.current = newMsgs[newMsgs.length - 1].sent_at;
          // Show notification for each new message (max 3 to avoid spam)
          for (const msg of newMsgs.slice(0, 3)) {
            showChatNotification(msg);
          }
          if (newMsgs.length > 3) {
            setUnreadChat(prev => prev + (newMsgs.length - 3));
          }
        }
      }, 5000);

      // Also try realtime (will be faster when enabled)
      try {
        const channel = supabase
          .channel(`global-chat-notify-${profile.id}-${Date.now()}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'chat_messages' },
            async (payload: any) => {
              const msg = payload.new;
              if (msg.user_id === profile.id) return;
              if (!teamIdsRef.current.includes(msg.team_id)) return;
              // Update lastSeen so polling doesn't duplicate
              lastSeenMsgRef.current = msg.sent_at;
              // Get sender name
              const { data: sender } = await supabase
                .from('profiles').select('display_name').eq('id', msg.user_id).single();
              msg._senderName = sender?.display_name || 'Alguém';
              showChatNotification(msg);
            })
          .subscribe();
        chatChannelRef.current = channel;
      } catch { /* realtime not available, polling handles it */ }
    };

    setupChatNotifications();

    return () => {
      cancelled = true;
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    };
  }, [profile?.id]);

  // Clear unread when visiting teams page
  useEffect(() => {
    if (pathname.includes('/dashboard/teams')) {
      setUnreadChat(0);
    }
  }, [pathname]);

  // Mini-chat: load from localStorage and listen for changes
  useEffect(() => {
    const loadMiniChat = () => {
      try {
        const stored = localStorage.getItem('miniChatTeam');
        if (stored) {
          setMiniChatTeam(JSON.parse(stored));
        } else {
          setMiniChatTeam(null);
        }
      } catch {
        setMiniChatTeam(null);
      }
    };

    loadMiniChat();
    window.addEventListener('miniChatChanged', loadMiniChat);
    window.addEventListener('storage', loadMiniChat);
    return () => {
      window.removeEventListener('miniChatChanged', loadMiniChat);
      window.removeEventListener('storage', loadMiniChat);
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      // Grace period: wait 1.5s before redirecting to avoid transient auth null states
      const timer = setTimeout(() => {
        router.push('/');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, user, router]);

  if (loading || !initialized) return <LoadingScreen />;
  if (!user) return <LoadingScreen />;
  if (!profile) {
    return (
      <div className="min-h-screen bg-cyber-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-400">Não foi possível carregar o perfil.</p>
          <button
            onClick={() => window.location.reload()}
            className="cyber-btn-primary px-6 py-2"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === 'super_admin' || profile.role === 'admin';
  const isInstructor = profile.role === 'instructor';
  const isAdminOrInstructor = isAdmin || isInstructor;

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, show: true },
    { href: '/dashboard/events', label: t('nav.events'), icon: Flag, show: true },
    { href: '/dashboard/leagues', label: t('nav.leagues'), icon: Trophy, show: isAdminOrInstructor },
    { href: '/dashboard/classes', label: t('nav.classes'), icon: GraduationCap, show: true },
    { href: '/dashboard/teams', label: t('nav.teams'), icon: Users, show: true },
    { href: '/dashboard/scoreboard', label: t('nav.scoreboard'), icon: Swords, show: true },
    { href: '/dashboard/badges', label: t('nav.badges'), icon: Award, show: true },
    { href: '/dashboard/profile', label: t('nav.profile'), icon: User, show: true },
    { href: '/dashboard/admin', label: t('nav.admin'), icon: Settings, show: isAdmin },
    { href: '/dashboard/help', label: t('nav.help'), icon: HelpCircle, show: true },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const toggleLocale = () => {
    setLocale(locale === 'pt-BR' ? 'en' : 'pt-BR');
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Usuário',
    admin: 'Administrador',
    instructor: 'Instrutor',
    competitor: 'Competidor',
  };

  const roleColors: Record<string, string> = {
    super_admin: 'text-red-400',
    admin: 'text-cyber-purple-light',
    instructor: 'text-cyber-cyan',
    competitor: 'text-cyber-green',
  };

  return (
    <div className="min-h-screen bg-cyber-bg grid-bg">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-cyber-darker/95 backdrop-blur-md border-b border-cyber-border">
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          {/* Left: Logo + Mobile Menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-cyber-cyan" />
              <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-purple hidden sm:inline">
                mdavelCTF
              </span>
            </Link>
          </div>

          {/* Right: Language Toggle + Shells + User */}
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                bg-white/5 border border-cyber-border text-gray-400 hover:text-white hover:border-cyber-cyan/40
                transition-all duration-200"
              title={locale === 'pt-BR' ? 'Switch to English' : 'Mudar para Português'}
            >
              <Globe size={16} />
              <span className="hidden sm:inline">{locale === 'pt-BR' ? 'EN' : 'PT'}</span>
            </button>

            {/* Shells Balance */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Shell size={16} className="text-amber-400" />
              <span className="text-sm font-bold text-amber-400">{profile.shells}</span>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-purple
                  flex items-center justify-center text-sm font-bold text-white">
                  {profile.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-gray-200 leading-tight">{profile.display_name}</p>
                  <p className={`text-xs ${roleColors[profile.role]} leading-tight`}>
                    {roleLabels[profile.role]}
                  </p>
                </div>
                <ChevronDown size={16} className="text-gray-500 hidden md:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-cyber-card border border-cyber-border
                  rounded-xl shadow-xl py-2 animate-fade-in">
                  <div className="px-4 py-2 border-b border-cyber-border">
                    <p className="text-sm font-medium">{profile.display_name}</p>
                    <p className="text-xs text-gray-500">{profile.email}</p>
                    <p className={`text-xs mt-1 ${roleColors[profile.role]}`}>
                      {roleLabels[profile.role]} • Level {profile.level}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5"
                  >
                    <User size={16} /> {t('nav.profile')}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 w-full"
                  >
                    <LogOut size={16} /> {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-16 left-0 z-40 w-64 h-[calc(100vh-4rem)] bg-cyber-darker/95
        backdrop-blur-md border-r border-cyber-border overflow-y-auto transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <nav className="p-4 space-y-1">
          {navItems.filter(item => item.show).map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const isTeamsItem = item.href === '/dashboard/teams';
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
              >
                <item.icon size={18} className={isActive ? 'text-cyber-cyan' : 'text-gray-500 group-hover:text-gray-300'} />
                {item.label}
                {isTeamsItem && unreadChat > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full
                    bg-red-500 text-white text-xs font-bold animate-pulse">
                    {unreadChat > 99 ? '99+' : unreadChat}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* XP Bar at bottom of sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyber-border bg-cyber-darker/95">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Level {profile.level}</span>
            <span>{profile.xp_points % 100}/100 XP</span>
          </div>
          <div className="w-full h-2 bg-cyber-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-purple rounded-full transition-all duration-500"
              style={{ width: `${profile.xp_points % 100}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 min-h-screen">
        <div className="p-4 lg:p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      {/* Click outside to close user menu */}
      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}

      {/* Mini-chat floating widget */}
      {miniChatTeam && (
        <MiniChat
          team={miniChatTeam}
          onClose={() => {
            localStorage.removeItem('miniChatTeam');
            setMiniChatTeam(null);
            window.dispatchEvent(new Event('miniChatChanged'));
          }}
        />
      )}
    </div>
  );
}
