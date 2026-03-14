'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import { CATEGORIES, toDirectImageUrl } from '@/lib/utils';
import Modal from '@/components/Modal';
import { Flag, Plus, Edit, Trash2, Copy, Search, Eye, Clock, Users, ArrowRight, Calendar, Timer, Target, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Event {
  id: string;
  code: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  visibility: string;
  team_mode: string;
  category: string;
  custom_category: string | null;
  league_code: string | null;
  class_id: string | null;
  image_url: string | null;
  shell_reward: number;
  created_by: string;
  created_at: string;
}

export default function EventsPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, { missions: number; challenges: number; captured: number }>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [search, setSearch] = useState('');

  const emptyForm = {
    name: '', description: '', start_date: '', end_date: '',
    visibility: 'public', team_mode: 'event_teams', category: 'Tecnologia da Informação',
    custom_category: '', league_code: '', class_id: '', image_url: '', shell_reward: 0,
  };
  const [form, setForm] = useState(emptyForm);

  const canManage = ['super_admin', 'admin', 'instructor'].includes(profile?.role || '');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadEvents(cancelled);
        await loadClasses();
      } catch (err) {
        console.error('Events load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  // Load stats after events are loaded
  useEffect(() => {
    if (events.length === 0 || !profile?.id) return;
    loadEventStats();
  }, [events, profile?.id]);

  const loadEventStats = async () => {
    try {
      const eventIds = events.map(e => e.id);

      // Get all missions for these events
      const { data: allMissions } = await supabase
        .from('missions').select('id, event_id').in('event_id', eventIds);

      const missionIds = (allMissions || []).map(m => m.id);

      // Get all challenges for these missions
      let allChallenges: any[] = [];
      if (missionIds.length > 0) {
        const { data } = await supabase
          .from('challenges').select('id, mission_id').in('mission_id', missionIds);
        allChallenges = data || [];
      }

      // Get user's correct submissions for these challenges
      const challengeIds = allChallenges.map(c => c.id);
      let userCorrectSubs: any[] = [];
      if (challengeIds.length > 0) {
        const { data } = await supabase
          .from('submissions').select('challenge_id')
          .in('challenge_id', challengeIds)
          .eq('user_id', profile!.id)
          .eq('is_correct', true);
        userCorrectSubs = data || [];
      }

      const capturedSet = new Set(userCorrectSubs.map(s => s.challenge_id));

      // Build stats per event
      const stats: Record<string, { missions: number; challenges: number; captured: number }> = {};
      for (const ev of events) {
        const evMissions = (allMissions || []).filter(m => m.event_id === ev.id);
        const evMissionIds = new Set(evMissions.map(m => m.id));
        const evChallenges = allChallenges.filter(c => evMissionIds.has(c.mission_id));
        const evCaptured = evChallenges.filter(c => capturedSet.has(c.id)).length;
        stats[ev.id] = {
          missions: evMissions.length,
          challenges: evChallenges.length,
          captured: evCaptured,
        };
      }
      setEventStats(stats);
    } catch (err) {
      console.error('loadEventStats error:', err);
    }
  };

  const loadEvents = async (cancelled = false) => {
    setLoading(true);
    try {
      let query = supabase.from('events').select('*').order('start_date', { ascending: false });

      if (profile?.role === 'competitor') {
        // Competitors see public events + events from their classes
        const { data: memberData } = await supabase
          .from('class_members').select('class_id').eq('user_id', profile.id).eq('status', 'active');
        const classIds = memberData?.map((m: any) => m.class_id) || [];

        if (classIds.length > 0) {
          query = supabase.from('events').select('*')
            .or(`visibility.eq.public,class_id.in.(${classIds.join(',')})`)
            .order('start_date', { ascending: false });
        } else {
          query = supabase.from('events').select('*')
            .eq('visibility', 'public')
            .order('start_date', { ascending: false });
        }
      }

      const { data, error } = await query;
      if (error) console.error('Events query error:', error.message);
      if (!cancelled) setEvents(data || []);
    } catch (err) {
      console.error('loadEvents exception:', err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  const loadClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name, code');
    setClasses(data || []);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.start_date || !form.end_date) { toast.error('Datas são obrigatórias'); return; }

    const payload = {
      name: form.name,
      description: form.description,
      start_date: form.start_date,
      end_date: form.end_date,
      visibility: form.visibility,
      team_mode: form.team_mode,
      category: form.category,
      custom_category: form.category === 'Customizar Tipo' ? form.custom_category : null,
      league_code: form.league_code || null,
      class_id: form.class_id || null,
      image_url: form.image_url || null,
      shell_reward: form.shell_reward || 0,
      updated_at: new Date().toISOString(),
    };

    if (editingEvent) {
      const { error } = await supabase.from('events').update(payload).eq('id', editingEvent.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Evento atualizado!');
    } else {
      const { error } = await supabase.from('events')
        .insert({ ...payload, created_by: profile?.id });
      if (error) { toast.error(error.message); return; }
      toast.success('Evento criado!');
    }

    setModalOpen(false);
    setEditingEvent(null);
    setForm(emptyForm);
    await loadEvents();
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setForm({
      name: event.name, description: event.description,
      start_date: event.start_date?.slice(0, 16) || '',
      end_date: event.end_date?.slice(0, 16) || '',
      visibility: event.visibility, team_mode: event.team_mode,
      category: event.category, custom_category: event.custom_category || '',
      league_code: event.league_code || '', class_id: event.class_id || '',
      image_url: event.image_url || '', shell_reward: event.shell_reward,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Evento excluído!');
    await loadEvents();
  };

  const getEventStatus = (event: Event) => {
    const now = new Date();
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    if (now < start) return { label: 'Agendado', color: 'bg-blue-500/20 text-blue-400' };
    if (now > end) return { label: 'Encerrado', color: 'bg-gray-500/20 text-gray-400' };
    return { label: 'Ao Vivo', color: 'bg-green-500/20 text-green-400 animate-pulse' };
  };

  const formatDuration = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms <= 0) return '—';
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}min`);
    return parts.join(' ') || '< 1min';
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const filtered = events.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.code.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flag className="text-cyber-cyan" size={28} /> {t('nav.events')}
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')} className="cyber-input pl-9 py-2 text-sm" />
          </div>
          {canManage && (
            <button onClick={() => { setEditingEvent(null); setForm(emptyForm); setModalOpen(true); }}
              className="cyber-btn-primary flex items-center gap-2 whitespace-nowrap">
              <Plus size={16} /> {t('event.create')}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="cyber-card text-center py-12">
          <Flag size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">{t('event.no_events')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => {
            const status = getEventStatus(event);
            const stats = eventStats[event.id];
            return (
              <div key={event.id} className="cyber-card-glow group flex flex-col">
                {event.image_url && (
                  <img src={toDirectImageUrl(event.image_url)} alt={event.name} className="w-full h-36 object-cover rounded-lg mb-4" />
                )}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`cyber-badge ${status.color}`}>{status.label}</span>
                      <span className={`cyber-badge ${event.visibility === 'public' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {event.visibility === 'public' ? t('event.public') : t('event.private')}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white truncate">{event.name}</h3>
                  </div>
                  {canManage && event.created_by === profile?.id && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(event)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-cyber-cyan">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(event.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-400 line-clamp-2 mb-3">{event.description}</p>

                {/* Stats row */}
                {stats && (
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-lg">
                      <Target size={12} className="text-cyber-purple-light" /> {stats.missions} {stats.missions === 1 ? 'Missão' : 'Missões'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-lg">
                      <Shield size={12} className="text-cyber-cyan" /> {stats.challenges} {stats.challenges === 1 ? 'Desafio' : 'Desafios'}
                    </span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-semibold ${
                      stats.captured === stats.challenges && stats.challenges > 0
                        ? 'bg-green-500/15 text-green-400'
                        : stats.captured > 0
                          ? 'bg-cyber-cyan/10 text-cyber-cyan'
                          : 'bg-white/5 text-gray-400'
                    }`}>
                      <Flag size={12} /> {stats.captured}/{stats.challenges} Flags
                    </span>
                  </div>
                )}

                <div className="space-y-2 text-xs text-gray-500 mt-auto">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-green-400" />
                    <span className="text-gray-400">Início:</span> {formatDateTime(event.start_date)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-red-400" />
                    <span className="text-gray-400">Fim:</span> {formatDateTime(event.end_date)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Timer size={12} className="text-cyber-cyan" />
                    <span className="text-gray-400">Duração:</span> {formatDuration(event.start_date, event.end_date)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="cyber-badge bg-cyber-purple/20 text-cyber-purple-light text-xs">{event.category}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <button onClick={() => { navigator.clipboard.writeText(event.code); toast.success(t('common.copied')); }}
                      className="flex items-center gap-1 text-cyber-cyan hover:text-cyber-cyan-light font-mono">
                      <Copy size={12} /> {event.code}
                    </button>
                    {event.shell_reward > 0 && (
                      <span className="text-amber-400 font-mono">🐚 {event.shell_reward}</span>
                    )}
                  </div>
                </div>

                <Link href={`/dashboard/events/${event.id}`}
                  className="mt-4 cyber-btn-secondary text-center text-sm flex items-center justify-center gap-1">
                  {t('common.view')} <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editingEvent ? t('event.edit') : t('event.create')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="cyber-label">{t('event.name')} *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="cyber-input" />
            </div>
            <div className="md:col-span-2">
              <label className="cyber-label">{t('event.description')}</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="cyber-textarea" rows={3} />
            </div>
            <div>
              <label className="cyber-label">{t('event.start_date')} *</label>
              <input type="datetime-local" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('event.end_date')} *</label>
              <input type="datetime-local" value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('event.visibility')}</label>
              <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="cyber-select">
                <option value="public">{t('event.public')}</option>
                <option value="private">{t('event.private')}</option>
              </select>
            </div>
            <div>
              <label className="cyber-label">{t('event.team_mode')}</label>
              <select value={form.team_mode} onChange={(e) => setForm({ ...form, team_mode: e.target.value })} className="cyber-select">
                <option value="event_teams">{t('event.event_teams')}</option>
                <option value="public_teams">{t('event.public_teams')}</option>
              </select>
            </div>
            <div>
              <label className="cyber-label">{t('event.category')}</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="cyber-select">
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            {form.category === 'Customizar Tipo' && (
              <div>
                <label className="cyber-label">Tipo Customizado</label>
                <input type="text" value={form.custom_category}
                  onChange={(e) => setForm({ ...form, custom_category: e.target.value })} className="cyber-input" />
              </div>
            )}
            <div>
              <label className="cyber-label">{t('event.class')} ({t('common.optional')})</label>
              <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="cyber-select">
                <option value="">{t('common.none')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="cyber-label">{t('event.league_code')} ({t('common.optional')})</label>
              <input type="text" value={form.league_code}
                onChange={(e) => setForm({ ...form, league_code: e.target.value.toUpperCase() })}
                className="cyber-input font-mono" maxLength={6} placeholder="ABC123" />
            </div>
            <div>
              <label className="cyber-label">{t('event.shell_reward')} 🐚</label>
              <input type="number" value={form.shell_reward} min={0}
                onChange={(e) => setForm({ ...form, shell_reward: parseInt(e.target.value) || 0 })} className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('common.image_url')} ({t('common.optional')})</label>
              <input type="url" value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="cyber-input" />
            </div>
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
