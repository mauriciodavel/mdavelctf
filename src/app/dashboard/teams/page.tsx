'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import Modal from '@/components/Modal';
import { Users, Plus, Copy, Search, Send, MessageCircle, UserPlus, LogOut, Crown, Globe, Lock, PanelRightClose, PanelRightOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeamsPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const [teams, setTeams] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [chatTeam, setChatTeam] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [search, setSearch] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const profileCacheRef = useRef<Record<string, string>>({});
  const pollIntervalRef = useRef<any>(null);

  const [form, setForm] = useState({ name: '', is_public: false, image_url: '' });
  const channelRef = useRef<any>(null);
  const [teamMemberCounts, setTeamMemberCounts] = useState<Record<string, number>>({});

  // Mini-chat state
  const [miniChatEnabled, setMiniChatEnabled] = useState(false);

  // Load mini-chat state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('miniChatTeam');
      if (stored) setMiniChatEnabled(true);
    } catch {}
  }, []);

  const toggleMiniChat = (team: any) => {
    if (miniChatEnabled) {
      // Disable
      localStorage.removeItem('miniChatTeam');
      setMiniChatEnabled(false);
      window.dispatchEvent(new Event('miniChatChanged'));
      toast.success(t('chat.mini_disabled'));
    } else {
      // Enable
      localStorage.setItem('miniChatTeam', JSON.stringify({ id: team.id, name: team.name, code: team.code }));
      setMiniChatEnabled(true);
      window.dispatchEvent(new Event('miniChatChanged'));
      toast.success(t('chat.mini_enabled'));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profile) return;
      try {
        await loadTeams(cancelled);
      } catch (err) {
        console.error('Teams load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  // Cleanup realtime subscription and polling on unmount or when chat closes
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatTeam]);

  const loadTeams = async (cancelled = false) => {
    if (!profile) return;
    setLoading(true);
    try {
      // My teams
      const { data: memberData, error: memberErr } = await supabase.from('team_members')
        .select('team_id, role, teams(*)').eq('user_id', profile.id);
      if (memberErr) console.error('Team members query error:', memberErr.message);
      if (!cancelled) setMyTeams((memberData || []).map((m: any) => ({ ...m.teams, memberRole: m.role })));

      // All public teams
      const { data: allTeams, error: teamsErr } = await supabase.from('teams').select('*')
        .eq('is_public', true).order('created_at', { ascending: false });
      if (teamsErr) console.error('Public teams query error:', teamsErr.message);
      if (!cancelled) setTeams(allTeams || []);

      // Fetch member counts for all relevant teams
      const allTeamIds = [
        ...(memberData || []).map((m: any) => m.team_id),
        ...(allTeams || []).map((t: any) => t.id)
      ];
      const uniqueTeamIds = [...new Set(allTeamIds)];
      if (uniqueTeamIds.length > 0) {
        const { data: memberCountData } = await supabase.from('team_members')
          .select('team_id').in('team_id', uniqueTeamIds);
        const counts: Record<string, number> = {};
        (memberCountData || []).forEach((m: any) => {
          counts[m.team_id] = (counts[m.team_id] || 0) + 1;
        });
        if (!cancelled) setTeamMemberCounts(counts);
      }
    } catch (err) {
      console.error('loadTeams exception:', err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }

    const { data, error } = await supabase.from('teams')
      .insert({ name: form.name, is_public: form.is_public, image_url: form.image_url || null, created_by: profile?.id })
      .select().single();
    if (error) { toast.error(error.message); return; }

    // Add creator as leader
    await supabase.from('team_members').insert({ team_id: data.id, user_id: profile?.id, role: 'leader' });

    toast.success('Equipe criada!');
    setCreateModalOpen(false);
    setForm({ name: '', is_public: false, image_url: '' });
    await loadTeams();
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { toast.error('Informe o código'); return; }
    const { data: team } = await supabase.from('teams').select('id').eq('code', joinCode.toUpperCase()).single();
    if (!team) { toast.error('Equipe não encontrada'); return; }

    const { error } = await supabase.from('team_members')
      .insert({ team_id: team.id, user_id: profile?.id });

    if (error) {
      if (error.code === '23505') toast.error('Você já está nesta equipe');
      else toast.error(error.message);
      return;
    }
    toast.success('Ingressou na equipe!');
    setJoinModalOpen(false);
    setJoinCode('');
    await loadTeams();
  };

  const handleLeave = async (teamId: string) => {
    if (!confirm('Sair da equipe?')) return;
    await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', profile?.id);
    toast.success('Saiu da equipe');
    setChatTeam(null);
    await loadTeams();
  };

  const openChat = async (team: any) => {
    // Clean up previous subscription and polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setChatTeam(team);
    const { data: members } = await supabase.from('team_members')
      .select('*, profiles(display_name)').eq('team_id', team.id);
    setTeamMembers(members || []);

    // Build profile name cache
    const cache: Record<string, string> = {};
    (members || []).forEach((m: any) => { cache[m.user_id] = m.profiles?.display_name || '?'; });
    profileCacheRef.current = cache;

    await loadMessages(team.id);

    // Start polling interval (guaranteed to work regardless of realtime config)
    pollIntervalRef.current = setInterval(() => loadMessages(team.id), 3000);

    // Also try realtime subscription (faster when available)
    try {
      const channel = supabase
        .channel(`team-chat-${team.id}-${Date.now()}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `team_id=eq.${team.id}` },
          () => {
            // On any new message, refetch to get the full data with profiles
            loadMessages(team.id);
          })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Chat] Realtime connected for team', team.id);
            // Realtime working — slow down polling to 10s (just as safety net)
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = setInterval(() => loadMessages(team.id), 10000);
            }
          }
        });
      channelRef.current = channel;
    } catch (err) {
      console.warn('[Chat] Realtime setup failed, using polling only:', err);
    }
  };

  const loadMessages = async (teamId: string) => {
    const { data } = await supabase.from('chat_messages')
      .select('*, profiles(display_name)')
      .eq('team_id', teamId)
      .order('sent_at', { ascending: true })
      .limit(100);
    if (data) {
      setChatMessages(prev => {
        // Only update if messages actually changed (avoid unnecessary re-renders)
        if (prev.length === data.length && prev.length > 0 && prev[prev.length - 1]?.id === data[data.length - 1]?.id) {
          return prev;
        }
        return data;
      });
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatTeam || !profile) return;
    const msg = newMessage.trim();
    setNewMessage('');

    // Optimistically add message to UI immediately
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      team_id: chatTeam.id,
      user_id: profile.id,
      message: msg,
      sent_at: new Date().toISOString(),
      profiles: { display_name: profile.display_name },
    };
    setChatMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    // Insert into database
    const { error } = await supabase.from('chat_messages')
      .insert({ team_id: chatTeam.id, user_id: profile.id, message: msg });
    if (error) {
      toast.error(error.message);
      // Remove optimistic message on error
      setChatMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      return;
    }

    // Refetch to replace optimistic message with real one
    await loadMessages(chatTeam.id);
  };

  const filtered = teams.filter(tt =>
    tt.name.toLowerCase().includes(search.toLowerCase()) ||
    tt.code.toLowerCase().includes(search.toLowerCase())
  );

  // Chat view
  if (chatTeam) {
    return (
      <div className="animate-fade-in h-[calc(100vh-7rem)] flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyber-border bg-cyber-card rounded-t-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
              }
              setChatTeam(null);
            }} className="text-gray-400 hover:text-white">
              <Users size={20} />
            </button>
            <div>
              <h2 className="font-bold text-white">{chatTeam.name}</h2>
              <p className="text-xs text-gray-500">{teamMembers.length} membros</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mini-chat toggle */}
            <button
              onClick={() => toggleMiniChat(chatTeam)}
              className={`flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg border transition-all duration-200 ${
                miniChatEnabled
                  ? 'bg-cyber-cyan/20 border-cyber-cyan/40 text-cyber-cyan'
                  : 'bg-white/5 border-cyber-border text-gray-400 hover:text-white hover:border-cyber-cyan/40'
              }`}
              title={miniChatEnabled ? t('chat.disable_mini') : t('chat.enable_mini')}
            >
              {miniChatEnabled ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              <span className="hidden sm:inline">{t('chat.mini_chat')}</span>
              {/* Toggle indicator */}
              <div className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${
                miniChatEnabled ? 'bg-cyber-cyan/40' : 'bg-gray-600'
              }`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${
                  miniChatEnabled ? 'right-0.5 bg-cyber-cyan' : 'left-0.5 bg-gray-400'
                }`} />
              </div>
            </button>
            <button onClick={() => { navigator.clipboard.writeText(chatTeam.code); toast.success(t('common.copied')); }}
              className="flex items-center gap-1 text-xs font-mono text-cyber-cyan cyber-btn-secondary py-1 px-2">
              <Copy size={12} /> {chatTeam.code}
            </button>
            <button onClick={() => handleLeave(chatTeam.id)}
              className="cyber-btn-danger text-xs flex items-center gap-1 py-1 px-2">
              <LogOut size={12} /> {t('team.leave')}
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-cyber-darker/50">
          {chatMessages.map((msg: any) => {
            const isMe = msg.user_id === profile?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-xl ${
                  isMe
                    ? 'bg-cyber-cyan/20 border border-cyber-cyan/30 text-gray-200'
                    : 'bg-white/5 border border-cyber-border text-gray-300'
                }`}>
                  {!isMe && (
                    <p className="text-xs text-cyber-purple font-semibold mb-1">{msg.profiles?.display_name}</p>
                  )}
                  <p className="text-sm break-words">{msg.message}</p>
                  <p className="text-[10px] text-gray-500 mt-1 text-right">
                    {new Date(msg.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-cyber-border bg-cyber-card rounded-b-xl">
          <div className="flex gap-2">
            <input
              type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={t('team.send_message')} className="cyber-input flex-1 py-2"
            />
            <button onClick={sendMessage} className="cyber-btn-primary">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="text-cyber-cyan" size={28} /> {t('nav.teams')}
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')} className="cyber-input pl-9 py-2 text-sm" />
          </div>
          <button onClick={() => setJoinModalOpen(true)}
            className="cyber-btn-success flex items-center gap-2 text-sm whitespace-nowrap">
            <UserPlus size={16} /> {t('team.join')}
          </button>
          <button onClick={() => { setForm({ name: '', is_public: false, image_url: '' }); setCreateModalOpen(true); }}
            className="cyber-btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
            <Plus size={16} /> {t('team.create')}
          </button>
        </div>
      </div>

      {/* My Teams */}
      {myTeams.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-cyber-purple mb-3">Minhas Equipes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myTeams.map((team: any) => (
              <div key={team.id} className="cyber-card-glow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{team.name}</h3>
                      {team.memberRole === 'leader' && <Crown size={14} className="text-amber-400" />}
                    </div>
                    <span className={`cyber-badge mt-1 ${team.is_public ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {team.is_public ? <><Globe size={10} className="mr-1" />{t('team.public')}</> : <><Lock size={10} className="mr-1" />{t('team.private')}</>}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                  <Users size={14} className="text-cyber-cyan" />
                  <span>{teamMemberCounts[team.id] || 0} {t('team.members')}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => { navigator.clipboard.writeText(team.code); toast.success(t('common.copied')); }}
                    className="flex items-center gap-1 text-xs font-mono text-cyber-cyan">
                    <Copy size={12} /> {team.code}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openChat(team)}
                    className="cyber-btn-primary flex-1 flex items-center justify-center gap-1 text-sm">
                    <MessageCircle size={14} /> {t('team.chat')}
                  </button>
                  <button onClick={() => handleLeave(team.id)}
                    className="cyber-btn-danger text-sm">
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public Teams */}
      <div>
        <h2 className="text-lg font-bold text-cyber-green mb-3">Equipes Públicas</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="cyber-card text-center py-8">
            <Users size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-500">{t('team.no_teams')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((team: any) => (
              <div key={team.id} className="cyber-card">
                <h3 className="font-bold text-white">{team.name}</h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                  <Users size={14} className="text-cyber-cyan" />
                  <span>{teamMemberCounts[team.id] || 0} {t('team.members')}</span>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(team.code); toast.success(t('common.copied')); }}
                  className="flex items-center gap-1 text-xs font-mono text-cyber-cyan mt-2">
                  <Copy size={12} /> {team.code}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title={t('team.create')}>
        <div className="space-y-4">
          <div>
            <label className="cyber-label">{t('team.name')} *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="cyber-input" />
          </div>
          <div className="flex items-center gap-3">
            <label className="cyber-label mb-0">Visibilidade:</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_public}
                onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                className="w-4 h-4 rounded bg-cyber-darker border-cyber-border text-cyber-cyan focus:ring-cyber-cyan" />
              {form.is_public ? t('team.public') : t('team.private')}
            </label>
          </div>
          <div>
            <label className="cyber-label">{t('common.image_url')} ({t('common.optional')})</label>
            <input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="cyber-input" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setCreateModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleCreate} className="cyber-btn-primary">{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      {/* Join Team Modal */}
      <Modal isOpen={joinModalOpen} onClose={() => setJoinModalOpen(false)} title={t('team.join')}>
        <div className="space-y-4">
          <div>
            <label className="cyber-label">{t('team.code')}</label>
            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="cyber-input font-mono text-center text-2xl tracking-widest" maxLength={6} placeholder="ABC123" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setJoinModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleJoin} className="cyber-btn-primary">{t('team.join')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
