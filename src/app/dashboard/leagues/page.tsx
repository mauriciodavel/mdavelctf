'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { toDirectImageUrl, DIFFICULTY_COLORS } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import Modal from '@/components/Modal';
import {
  Trophy, Plus, Edit, Trash2, Copy, Search, ArrowLeft, Calendar,
  Flag, Target, Clock, ChevronRight, Zap, BarChart3, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ── Types ── */
interface League {
  id: string;
  code: string;
  name: string;
  image_url: string | null;
  event_codes: string;
  created_by: string;
  created_at: string;
}

interface EventData {
  id: string;
  code: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  image_url: string | null;
  visibility: string;
  category: string;
  shell_reward: number;
  league_code: string | null;
}

interface MissionData {
  id: string;
  event_id: string;
  name: string;
  description: string;
  difficulty: string;
  sequence: number;
}

interface ChallengeData {
  id: string;
  mission_id: string;
  title: string;
  description: string;
  points: number;
  max_attempts: number | null;
  sequence_number: number;
}

interface MissionWithChallenges extends MissionData {
  challenges: ChallengeData[];
}

interface EnrichedEvent extends EventData {
  missions: MissionWithChallenges[];
  challengesCount: number;
}

interface EnrichedLeague extends League {
  events: EnrichedEvent[];
  startDate: string | null;
  endDate: string | null;
  totalChallenges: number;
}

type View = 'list' | 'league-detail' | 'event-detail';

/* ── Helpers ── */
function getLeagueStatus(league: EnrichedLeague): { label: string; color: string } {
  if (league.events.length === 0) return { label: '—', color: 'bg-gray-500/20 text-gray-400' };
  const now = new Date();
  const start = league.startDate ? new Date(league.startDate) : null;
  const end = league.endDate ? new Date(league.endDate) : null;
  if (start && now < start) return { label: 'Agendada', color: 'bg-blue-500/20 text-blue-400' };
  if (end && now > end) return { label: 'Encerrada', color: 'bg-gray-500/20 text-gray-400' };
  return { label: 'Ativa', color: 'bg-green-500/20 text-green-400 animate-pulse' };
}

function getEventStatus(event: EventData): { label: string; color: string } {
  const now = new Date();
  const start = new Date(event.start_date);
  const end = new Date(event.end_date);
  if (now < start) return { label: 'Agendado', color: 'bg-blue-500/20 text-blue-400' };
  if (now > end) return { label: 'Encerrado', color: 'bg-gray-500/20 text-gray-400' };
  return { label: 'Ao Vivo', color: 'bg-green-500/20 text-green-400 animate-pulse' };
}

function getRemainingHours(endDate: string | null): number | null {
  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return -1; // finished
  return Math.round(ms / (1000 * 60 * 60) * 10) / 10;
}

function formatRemaining(endDate: string | null): string {
  if (!endDate) return '—';
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return '✓';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── Component ── */
export default function LeaguesPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const router = useRouter();
  const [leagues, setLeagues] = useState<EnrichedLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', image_url: '', event_codes: '' });

  // Navigation
  const [view, setView] = useState<View>('list');
  const [selectedLeague, setSelectedLeague] = useState<EnrichedLeague | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EnrichedEvent | null>(null);

  const canManage = profile?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'instructor';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadLeagues(cancelled);
      } catch (err) {
        console.error('Leagues load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Data Loading ── */
  const loadLeagues = async (cancelled = false) => {
    setLoading(true);
    try {
      // 1. Load all leagues
      const { data: leagueData, error } = await supabase
        .from('leagues').select('*').order('created_at', { ascending: false });
      if (error) { console.error('Leagues query error:', error.message); return; }
      const rawLeagues: League[] = leagueData || [];

      // 2. Collect all event codes from all leagues
      const allCodes: string[] = [];
      const leagueCodes: string[] = [];
      rawLeagues.forEach(l => {
        leagueCodes.push(l.code);
        if (l.event_codes) {
          l.event_codes.split(',').forEach(c => {
            const code = c.trim();
            if (code) allCodes.push(code);
          });
        }
      });

      // 3. Batch-query events by codes + by league_code
      let allEvents: EventData[] = [];
      const seenEventIds = new Set<string>();

      if (allCodes.length > 0) {
        const { data } = await supabase.from('events').select('*').in('code', allCodes);
        (data || []).forEach(e => { if (!seenEventIds.has(e.id)) { allEvents.push(e); seenEventIds.add(e.id); } });
      }
      if (leagueCodes.length > 0) {
        const { data } = await supabase.from('events').select('*').in('league_code', leagueCodes);
        (data || []).forEach(e => { if (!seenEventIds.has(e.id)) { allEvents.push(e); seenEventIds.add(e.id); } });
      }

      // 4. Batch-query missions
      const eventIds = allEvents.map(e => e.id);
      let allMissions: MissionData[] = [];
      if (eventIds.length > 0) {
        const { data } = await supabase.from('missions')
          .select('id, event_id, name, description, difficulty, sequence')
          .in('event_id', eventIds).order('sequence');
        allMissions = data || [];
      }

      // 5. Batch-query challenges
      const missionIds = allMissions.map(m => m.id);
      let allChallenges: ChallengeData[] = [];
      if (missionIds.length > 0) {
        const { data } = await supabase.from('challenges')
          .select('id, mission_id, title, description, points, max_attempts, sequence_number')
          .in('mission_id', missionIds).order('sequence_number');
        allChallenges = data || [];
      }

      if (cancelled) return;

      // 6. Build lookup maps
      const challengesByMission = new Map<string, ChallengeData[]>();
      allChallenges.forEach(c => {
        const arr = challengesByMission.get(c.mission_id) || [];
        arr.push(c);
        challengesByMission.set(c.mission_id, arr);
      });

      const missionsByEvent = new Map<string, MissionWithChallenges[]>();
      allMissions.forEach(m => {
        const arr = missionsByEvent.get(m.event_id) || [];
        arr.push({ ...m, challenges: challengesByMission.get(m.id) || [] });
        missionsByEvent.set(m.event_id, arr);
      });

      // 7. Build enriched events mapped by code and by id
      const enrichedByCode = new Map<string, EnrichedEvent>();
      const enrichedById = new Map<string, EnrichedEvent>();
      allEvents.forEach(ev => {
        const missions = missionsByEvent.get(ev.id) || [];
        const challengesCount = missions.reduce((sum, m) => sum + m.challenges.length, 0);
        const enriched: EnrichedEvent = { ...ev, missions, challengesCount };
        enrichedByCode.set(ev.code, enriched);
        enrichedById.set(ev.id, enriched);
      });

      // 8. Assemble enriched leagues
      const enrichedLeagues: EnrichedLeague[] = rawLeagues.map(league => {
        const eventCodesList = league.event_codes
          ? league.event_codes.split(',').map(c => c.trim()).filter(Boolean)
          : [];
        const events: EnrichedEvent[] = [];
        const seen = new Set<string>();

        // By event_codes
        eventCodesList.forEach(code => {
          const ev = enrichedByCode.get(code);
          if (ev && !seen.has(ev.id)) { events.push(ev); seen.add(ev.id); }
        });
        // By league_code match
        allEvents.forEach(ev => {
          if (ev.league_code === league.code && !seen.has(ev.id)) {
            const enriched = enrichedById.get(ev.id);
            if (enriched) { events.push(enriched); seen.add(ev.id); }
          }
        });

        events.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

        const startDate = events.length > 0 ? events[0].start_date : null;
        const endDate = events.length > 0
          ? events.reduce((latest, ev) => new Date(ev.end_date) > new Date(latest) ? ev.end_date : latest, events[0].end_date)
          : null;
        const totalChallenges = events.reduce((sum, ev) => sum + ev.challengesCount, 0);

        return { ...league, events, startDate, endDate, totalChallenges };
      });

      setLeagues(enrichedLeagues);

      // Update selected league/event if they were open
      if (selectedLeague) {
        const updated = enrichedLeagues.find(l => l.id === selectedLeague.id);
        if (updated) {
          setSelectedLeague(updated);
          if (selectedEvent) {
            const updatedEv = updated.events.find(e => e.id === selectedEvent.id);
            if (updatedEv) setSelectedEvent(updatedEv);
          }
        }
      }
    } catch (err) {
      console.error('loadLeagues exception:', err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  /* ── CRUD Handlers ── */
  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }

    if (editingLeague) {
      const { error } = await supabase.from('leagues')
        .update({ name: form.name, image_url: form.image_url || null, event_codes: form.event_codes, updated_at: new Date().toISOString() })
        .eq('id', editingLeague.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Liga atualizada!');
    } else {
      const { error } = await supabase.from('leagues')
        .insert({ name: form.name, image_url: form.image_url || null, event_codes: form.event_codes, created_by: profile?.id });
      if (error) { toast.error(error.message); return; }
      toast.success('Liga criada!');
    }

    setModalOpen(false);
    setEditingLeague(null);
    setForm({ name: '', image_url: '', event_codes: '' });
    await loadLeagues();
  };

  const handleEdit = (league: League, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLeague(league);
    setForm({ name: league.name, image_url: league.image_url || '', event_codes: league.event_codes || '' });
    setModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('common.confirm_delete'))) return;
    const { error } = await supabase.from('leagues').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Liga excluída!');
    if (selectedLeague?.id === id) { setView('list'); setSelectedLeague(null); }
    await loadLeagues();
  };

  const copyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    toast.success(t('common.copied'));
  };

  /* ── Navigation ── */
  const openLeagueDetail = (league: EnrichedLeague) => {
    setSelectedLeague(league);
    setSelectedEvent(null);
    setView('league-detail');
  };

  const openEventDetail = (event: EnrichedEvent) => {
    setSelectedEvent(event);
    setView('event-detail');
  };

  const goBack = () => {
    if (view === 'event-detail') {
      setSelectedEvent(null);
      setView('league-detail');
    } else {
      setSelectedLeague(null);
      setView('list');
    }
  };

  const filtered = leagues.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  );

  /* ── RENDER: Event Detail ── */
  if (view === 'event-detail' && selectedEvent && selectedLeague) {
    const status = getEventStatus(selectedEvent);
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={goBack} className="flex items-center gap-2 text-gray-400 hover:text-cyber-cyan transition-colors">
          <ArrowLeft size={20} /> {t('common.back')} — {selectedLeague.name}
        </button>

        <div className="cyber-card">
          {selectedEvent.image_url && (
            <img src={toDirectImageUrl(selectedEvent.image_url)} alt={selectedEvent.name}
              className="w-full h-48 object-cover rounded-lg mb-4" />
          )}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{selectedEvent.name}</h1>
              <p className="text-sm text-gray-400 mt-1 font-mono">{selectedEvent.code}</p>
            </div>
            <span className={`cyber-badge ${status.color}`}>{status.label}</span>
          </div>
          {selectedEvent.description && (
            <p className="text-gray-400 text-sm mb-4">{selectedEvent.description}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <Calendar size={16} className="mx-auto text-cyber-cyan mb-1" />
              <p className="text-xs text-gray-500">{t('league.start_date')}</p>
              <p className="text-sm font-medium text-gray-300">{formatDateTime(selectedEvent.start_date)}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <Calendar size={16} className="mx-auto text-cyber-purple mb-1" />
              <p className="text-xs text-gray-500">{t('league.end_date')}</p>
              <p className="text-sm font-medium text-gray-300">{formatDateTime(selectedEvent.end_date)}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <Target size={16} className="mx-auto text-cyber-green mb-1" />
              <p className="text-xs text-gray-500">{t('league.total_challenges')}</p>
              <p className="text-sm font-bold text-cyber-green">{selectedEvent.challengesCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <BarChart3 size={16} className="mx-auto text-amber-400 mb-1" />
              <p className="text-xs text-gray-500">{t('nav.missions')}</p>
              <p className="text-sm font-bold text-amber-400">{selectedEvent.missions.length}</p>
            </div>
          </div>
        </div>

        {/* Missions & Challenges */}
        <h2 className="text-lg font-bold text-cyber-cyan flex items-center gap-2">
          <Flag size={20} /> {t('nav.missions')} & {t('league.challenges')}
        </h2>

        {selectedEvent.missions.length === 0 ? (
          <div className="cyber-card text-center py-8">
            <p className="text-gray-500">{t('mission.no_missions')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedEvent.missions.map((mission, idx) => (
              <div key={mission.id} className="cyber-card">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-cyber-cyan/20 flex items-center justify-center text-cyber-cyan font-bold text-sm">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="font-bold text-white">{mission.name}</h3>
                      {mission.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{mission.description}</p>
                      )}
                    </div>
                  </div>
                  <span className={`cyber-badge ${DIFFICULTY_COLORS[mission.difficulty] || ''}`}>
                    {mission.difficulty}
                  </span>
                  <button onClick={() => router.push(`/dashboard/events/${selectedEvent.id}`)}
                    className="cyber-btn-secondary flex items-center gap-1 text-xs px-3 py-1">
                    <ExternalLink size={12} /> Acessar Evento
                  </button>
                </div>

                {mission.challenges.length === 0 ? (
                  <p className="text-xs text-gray-600 ml-11">Nenhum desafio</p>
                ) : (
                  <div className="ml-11 space-y-2">
                    {mission.challenges.map((ch) => (
                      <div key={ch.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-cyber-border">
                        <div className="flex items-center gap-3 min-w-0">
                          <Flag size={14} className="text-cyber-green flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">{ch.title}</p>
                            {ch.description && (
                              <p className="text-xs text-gray-500 truncate">{ch.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span className="text-xs text-cyber-cyan font-mono">{ch.points} pts</span>
                          {ch.max_attempts && (
                            <span className="text-xs text-gray-500">{ch.max_attempts} max</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ── RENDER: League Detail ── */
  if (view === 'league-detail' && selectedLeague) {
    const status = getLeagueStatus(selectedLeague);
    const remaining = getRemainingHours(selectedLeague.endDate);
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={goBack} className="flex items-center gap-2 text-gray-400 hover:text-cyber-cyan transition-colors">
          <ArrowLeft size={20} /> {t('common.back')}
        </button>

        <div className="cyber-card">
          {selectedLeague.image_url && (
            <img src={toDirectImageUrl(selectedLeague.image_url)} alt={selectedLeague.name}
              className="w-full h-48 object-cover rounded-lg mb-4" />
          )}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Trophy size={28} className="text-cyber-cyan" /> {selectedLeague.name}
              </h1>
              <p className="text-sm text-cyber-cyan font-mono mt-1">{selectedLeague.code}</p>
            </div>
            <span className={`cyber-badge ${status.color}`}>{status.label}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <Calendar size={16} className="mx-auto text-cyber-cyan mb-1" />
              <p className="text-xs text-gray-500">{t('league.start_date')}</p>
              <p className="text-sm font-medium text-gray-300">
                {selectedLeague.startDate ? formatDateTime(selectedLeague.startDate) : '—'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <Calendar size={16} className="mx-auto text-cyber-purple mb-1" />
              <p className="text-xs text-gray-500">{t('league.end_date')}</p>
              <p className="text-sm font-medium text-gray-300">
                {selectedLeague.endDate ? formatDateTime(selectedLeague.endDate) : '—'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <Target size={16} className="mx-auto text-cyber-green mb-1" />
              <p className="text-xs text-gray-500">{t('league.total_challenges')}</p>
              <p className="text-sm font-bold text-cyber-green">{selectedLeague.totalChallenges}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 text-center">
              <Clock size={16} className="mx-auto text-amber-400 mb-1" />
              <p className="text-xs text-gray-500">{t('league.remaining_time')}</p>
              <p className="text-sm font-bold text-amber-400">
                {remaining === null ? '—' : remaining < 0 ? t('league.finished') : formatRemaining(selectedLeague.endDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Events List */}
        <h2 className="text-lg font-bold text-cyber-cyan flex items-center gap-2">
          <Flag size={20} /> {t('league.events')} ({selectedLeague.events.length})
        </h2>

        {selectedLeague.events.length === 0 ? (
          <div className="cyber-card text-center py-8">
            <p className="text-gray-500">{t('league.no_events')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedLeague.events.map((event) => {
              const evStatus = getEventStatus(event);
              return (
                <div key={event.id} onClick={() => openEventDetail(event)}
                  className="cyber-card hover:border-cyber-cyan/40 cursor-pointer transition-all group">
                  <div className="flex items-center gap-4">
                    {event.image_url && (
                      <img src={toDirectImageUrl(event.image_url)} alt={event.name}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white truncate">{event.name}</h3>
                        <span className={`cyber-badge text-[10px] ${evStatus.color}`}>{evStatus.label}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {formatDateTime(event.start_date)} — {formatDateTime(event.end_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 size={12} /> {event.missions.length} {t('league.missions')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Flag size={12} className="text-cyber-green" /> {event.challengesCount} {t('league.challenges')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-600 group-hover:text-cyber-cyan transition-colors flex-shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ── RENDER: League List ── */
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-cyber-cyan" size={28} /> {t('nav.leagues')}
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')} className="cyber-input pl-9 py-2 text-sm"
            />
          </div>
          {canManage && (
            <button onClick={() => { setEditingLeague(null); setForm({ name: '', image_url: '', event_codes: '' }); setModalOpen(true); }}
              className="cyber-btn-primary flex items-center gap-2">
              <Plus size={16} /> {t('league.create')}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="cyber-card text-center py-12">
          <Trophy size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">{t('league.no_leagues')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((league) => {
            const status = getLeagueStatus(league);
            const remaining = getRemainingHours(league.endDate);
            return (
              <div key={league.id} onClick={() => openLeagueDetail(league)}
                className="cyber-card-glow group cursor-pointer">
                {league.image_url && (
                  <img src={toDirectImageUrl(league.image_url)} alt={league.name}
                    className="w-full h-32 object-cover rounded-lg mb-4" />
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white truncate">{league.name}</h3>
                    <button onClick={(e) => copyCode(league.code, e)}
                      className="flex items-center gap-1 mt-1 text-sm text-cyber-cyan hover:text-cyber-cyan-light font-mono">
                      <Copy size={14} /> {league.code}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`cyber-badge text-[10px] ${status.color}`}>{status.label}</span>
                    {canManage && (
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                        <button onClick={(e) => handleEdit(league, e)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-cyber-cyan">
                          <Edit size={14} />
                        </button>
                        <button onClick={(e) => handleDelete(league.id, e)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dates */}
                {league.startDate && league.endDate && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <Calendar size={12} />
                    <span>{formatDateTime(league.startDate)}</span>
                    <span className="text-gray-600">→</span>
                    <span>{formatDateTime(league.endDate)}</span>
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="p-2 rounded-lg bg-white/5 text-center">
                    <p className="text-lg font-bold text-cyber-cyan">{league.events.length}</p>
                    <p className="text-[10px] text-gray-500">{t('nav.events')}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 text-center">
                    <p className="text-lg font-bold text-cyber-green">{league.totalChallenges}</p>
                    <p className="text-[10px] text-gray-500">Flags</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 text-center">
                    <p className="text-lg font-bold text-amber-400">
                      {remaining === null ? '—' : remaining < 0 ? '✓' : formatRemaining(league.endDate)}
                    </p>
                    <p className="text-[10px] text-gray-500">{remaining !== null && remaining < 0 ? t('league.finished') : t('league.remaining_time')}</p>
                  </div>
                </div>

                {/* Per-event breakdown */}
                {league.events.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cyber-border space-y-1.5">
                    {league.events.map(ev => (
                      <div key={ev.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 truncate flex-1 mr-2">{ev.name}</span>
                        <span className="text-gray-500 flex-shrink-0">
                          <span className="text-cyber-green">{ev.challengesCount}</span> flags
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editingLeague ? t('league.edit') : t('league.create')}>
        <div className="space-y-4">
          <div>
            <label className="cyber-label">{t('league.name')} *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="cyber-input" placeholder="Nome da Liga" />
          </div>
          <div>
            <label className="cyber-label">{t('common.image_url')} ({t('common.optional')})</label>
            <input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className="cyber-input" placeholder="https://..." />
          </div>
          <div>
            <label className="cyber-label">{t('league.event_codes')}</label>
            <input type="text" value={form.event_codes} onChange={(e) => setForm({ ...form, event_codes: e.target.value })}
              className="cyber-input" placeholder="ABC123, DEF456" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleSave} className="cyber-btn-primary">{t('common.save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
