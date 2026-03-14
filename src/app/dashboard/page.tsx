'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import StatsCard from '@/components/StatsCard';
import {
  Flag, Users, Trophy, BarChart3, Zap, Lightbulb, Clock, Target,
  GraduationCap, BookOpen, Activity, TrendingUp, Eye, CheckCircle2
} from 'lucide-react';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const [stats, setStats] = useState({
    totalEvents: 0,
    liveNow: 0,
    totalUsers: 0,
    totalSubmissions: 0,
    totalResolutions: 0,
    resolutionRate: '0%',
    hintsUnlocked: 0,
    myClasses: 0,
    myStudents: 0,
    myEvents: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profile) return;
      try {
        await loadDashboardData(cancelled);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const loadDashboardData = async (cancelled: boolean) => {
    if (!profile) return;
    const now = new Date().toISOString();

    const results = await Promise.allSettled([
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true })
        .lte('start_date', now).gte('end_date', now),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('submissions').select('*', { count: 'exact', head: true }),
      supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('is_correct', true),
      supabase.from('hint_usage').select('*', { count: 'exact', head: true }),
    ]);
    if (cancelled) return;

    const val = (i: number) => {
      const r = results[i];
      return r.status === 'fulfilled' ? (r.value.count ?? 0) : 0;
    };

    const totalEvents = val(0);
    const liveNow = val(1);
    const totalUsers = val(2);
    const totalSubmissions = val(3);
    const totalResolutions = val(4);
    const hintsUnlocked = val(5);

    // Instructor-specific stats
    let myClasses = 0, myStudents = 0, myEvents = 0;
    if (profile.role === 'instructor') {
      try {
        const [classRes, eventRes] = await Promise.all([
          supabase.from('classes').select('id', { count: 'exact' }).eq('instructor_id', profile.id),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('created_by', profile.id),
        ]);
        myClasses = classRes.count || 0;
        myEvents = eventRes.count || 0;
        if (classRes.data) {
          const classIds = classRes.data.map((c: any) => c.id);
          if (classIds.length > 0) {
            const { count } = await supabase.from('class_members').select('*', { count: 'exact', head: true })
              .in('class_id', classIds).eq('status', 'active');
            myStudents = count || 0;
          }
        }
      } catch (err) {
        console.error('Instructor stats error:', err);
      }
    }

    if (cancelled) return;

    const rate = totalSubmissions && totalResolutions
      ? Math.round((totalResolutions / totalSubmissions) * 100) + '%'
      : '0%';

    setStats({
      totalEvents, liveNow, totalUsers, totalSubmissions, totalResolutions,
      resolutionRate: rate,
      hintsUnlocked,
      myClasses, myStudents, myEvents,
    });

    // Recent submissions
    try {
      const { data: recent } = await supabase
        .from('submissions')
        .select('*, profiles(display_name), challenges(title)')
        .order('submitted_at', { ascending: false })
        .limit(10);
      if (!cancelled) setRecentActivity(recent || []);
    } catch (err) {
      console.error('Recent activity error:', err);
    }
  };

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';
  const isInstructor = profile?.role === 'instructor';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            {t('dash.welcome_back')}, <span className="text-cyber-cyan">{profile?.display_name}</span>
          </h1>
          <p className="text-gray-500 mt-1">
            {isAdmin ? t('nav.admin') : isInstructor ? t('help.instructor') : t('help.competitor')} Dashboard
          </p>
        </div>
      </div>

      {/* ── Admin Dashboard ── */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard icon={<Flag size={20} />} label={t('dash.total_events')} value={stats.totalEvents} color="cyan" />
            <StatsCard icon={<Zap size={20} />} label={t('dash.live_now')} value={stats.liveNow} color="green" />
            <StatsCard icon={<Users size={20} />} label={t('dash.users')} value={stats.totalUsers} color="purple" />
            <StatsCard icon={<BarChart3 size={20} />} label={t('dash.submissions')} value={stats.totalSubmissions} color="orange" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard icon={<CheckCircle2 size={20} />} label={t('dash.resolutions')} value={stats.totalResolutions} color="green" />
            <StatsCard icon={<Target size={20} />} label={t('dash.resolution_rate')} value={stats.resolutionRate} color="cyan" />
            <StatsCard icon={<Lightbulb size={20} />} label={t('dash.hints_unlocked')} value={stats.hintsUnlocked} color="orange" />
          </div>

          {/* Activity Feed + Hard Challenges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="cyber-card">
              <h3 className="text-lg font-bold text-cyber-cyan mb-4 flex items-center gap-2">
                <Activity size={20} /> {t('dash.activity_feed')}
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recentActivity.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma atividade recente</p>
                ) : (
                  recentActivity.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <div className={`w-2 h-2 rounded-full ${item.is_correct ? 'bg-cyber-green' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium text-gray-200">
                            {item.profiles?.display_name}
                          </span>{' '}
                          <span className={item.is_correct ? 'text-cyber-green' : 'text-red-400'}>
                            {item.is_correct ? 'resolveu' : 'tentou'}
                          </span>{' '}
                          <span className="text-gray-400">{item.challenges?.title}</span>
                        </p>
                      </div>
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {new Date(item.submitted_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="cyber-card">
              <h3 className="text-lg font-bold text-cyber-purple mb-4 flex items-center gap-2">
                <Eye size={20} /> {t('dash.event_overview')}
              </h3>
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-gradient-to-r from-cyber-cyan/10 to-cyber-purple/10 border border-cyber-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{t('dash.total_events')}</span>
                    <span className="text-2xl font-bold text-white">{stats.totalEvents}</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{t('dash.live_now')}</span>
                    <span className="text-2xl font-bold text-emerald-400">{stats.liveNow}</span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{t('dash.season_analysis')}</span>
                    <TrendingUp size={24} className="text-amber-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Instructor Dashboard ── */}
      {isInstructor && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard icon={<GraduationCap size={20} />} label={t('dash.total_classes')} value={stats.myClasses} color="cyan" />
            <StatsCard icon={<Users size={20} />} label={t('dash.total_students')} value={stats.myStudents} color="purple" />
            <StatsCard icon={<Flag size={20} />} label={t('dash.my_events')} value={stats.myEvents} color="green" />
          </div>

          <div className="cyber-card">
            <h3 className="text-lg font-bold text-cyber-cyan mb-4 flex items-center gap-2">
              <BookOpen size={20} /> {t('dash.quick_guide')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white/5 border border-cyber-border">
                <h4 className="font-semibold text-cyber-cyan mb-2">1. Criar Turma</h4>
                <p className="text-sm text-gray-400">Vá em Turmas e crie uma nova turma. Compartilhe o código com seus alunos.</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-cyber-border">
                <h4 className="font-semibold text-cyber-purple mb-2">2. Criar Evento</h4>
                <p className="text-sm text-gray-400">Crie um evento e vincule à sua turma. Adicione missões e desafios.</p>
              </div>
              <div className="p-4 rounded-lg bg-white/5 border border-cyber-border">
                <h4 className="font-semibold text-cyber-green mb-2">3. Acompanhar</h4>
                <p className="text-sm text-gray-400">Acompanhe o progresso dos alunos no placar e nas submissões.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Competitor Dashboard ── */}
      {profile?.role === 'competitor' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard icon={<Target size={20} />} label="XP Total" value={profile.xp_points} color="cyan" />
            <StatsCard icon={<Trophy size={20} />} label="Level" value={profile.level} color="purple" />
            <StatsCard
              icon={<Zap size={20} />}
              label="Shells 🐚"
              value={profile.shells}
              color="orange"
            />
            <StatsCard
              icon={<TrendingUp size={20} />}
              label={t('profile.next_level')}
              value={`${100 - (profile.xp_points % 100)} XP`}
              color="green"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="cyber-card">
              <h3 className="text-lg font-bold text-cyber-cyan mb-4 flex items-center gap-2">
                <BookOpen size={20} /> {t('dash.quick_guide')}
              </h3>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/5 border border-cyber-border">
                  <h4 className="font-semibold text-cyber-cyan text-sm">🏫 Ingressar em Turma</h4>
                  <p className="text-xs text-gray-400 mt-1">Use o código fornecido pelo instrutor para ingressar em uma turma.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-cyber-border">
                  <h4 className="font-semibold text-cyber-purple text-sm">🚩 Resolver Desafios</h4>
                  <p className="text-xs text-gray-400 mt-1">Acesse eventos e resolva desafios para ganhar pontos e subir no ranking.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-cyber-border">
                  <h4 className="font-semibold text-cyber-green text-sm">👥 Criar Equipe</h4>
                  <p className="text-xs text-gray-400 mt-1">Forme uma equipe para competir em grupo e usar o chat interno.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-cyber-border">
                  <h4 className="font-semibold text-amber-400 text-sm">🏆 Conquiste Badges</h4>
                  <p className="text-xs text-gray-400 mt-1">Complete conquistas especiais para ganhar medalhas e recompensas em Shells.</p>
                </div>
              </div>
            </div>

            <div className="cyber-card">
              <h3 className="text-lg font-bold text-cyber-purple mb-4 flex items-center gap-2">
                <Activity size={20} /> {t('dash.activity_feed')}
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recentActivity.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">
                    Nenhuma atividade recente. Comece resolvendo desafios! 🚩
                  </p>
                ) : (
                  recentActivity
                    .filter((item: any) => item.user_id === profile.id)
                    .map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        <div className={`w-2 h-2 rounded-full ${item.is_correct ? 'bg-cyber-green' : 'bg-red-400'}`} />
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className={item.is_correct ? 'text-cyber-green' : 'text-red-400'}>
                              {item.is_correct ? '✅ Resolvido' : '❌ Incorreto'}
                            </span>{' '}
                            <span className="text-gray-400">{item.challenges?.title}</span>
                          </p>
                        </div>
                        {item.is_correct && (
                          <span className="text-xs text-cyber-cyan font-mono">+{item.points_awarded} pts</span>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
