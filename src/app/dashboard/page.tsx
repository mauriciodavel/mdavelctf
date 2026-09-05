'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import StatsCard from '@/components/StatsCard';
import {
  Flag, Users, Trophy, BarChart3, Zap, Lightbulb, Clock, Target,
  GraduationCap, BookOpen, Activity, TrendingUp, Eye, CheckCircle2,
  ChevronDown, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { profile } = useAuth();
  const { t, locale } = useI18n();
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
    totalLeagues: 0,
    leagueEventsCount: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingWriteups, setPendingWriteups] = useState<any[]>([]);
  const [writeupFilter, setWriteupFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [expandedInstructorGuide, setExpandedInstructorGuide] = useState<Set<string>>(new Set(['instr_flow_order']));
  const [expandedCompetitorGuide, setExpandedCompetitorGuide] = useState<Set<string>>(new Set(['comp_start_here']));

  const toggleGuideSection = (key: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel(`dashboard-writeups-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'writeups' }, () => loadDashboardData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadDashboardData(false))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      supabase.from('leagues').select('*', { count: 'exact', head: true }),
      supabase.from('league_events').select('*', { count: 'exact', head: true }),
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
    const totalLeagues = val(6);
    const leagueEventsCount = val(7);

    // Instructor-specific stats
    let myClasses = 0, myStudents = 0, myEvents = 0;
    const role = String(profile.role || '').trim().toLowerCase();
    if (role === 'instructor') {
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
      totalLeagues, leagueEventsCount,
    });

    // Recent submissions
    try {
      const { data: recent } = await supabase
        .from('submissions')
        .select('*, profiles(display_name), challenges(title, mission_id)')
        .order('submitted_at', { ascending: false })
        .limit(10);
      let activity = recent || [];
      const missionIds = [...new Set(activity.map((s: any) => s.challenges?.mission_id).filter(Boolean))];
      const { data: feedMissions } = missionIds.length ? await supabase.from('missions').select('id,event_id').in('id', missionIds) : { data: [] };
      const feedMissionMap = Object.fromEntries((feedMissions || []).map((m: any) => [m.id, m.event_id]));
      let visibleEventIds: string[] | null = null;
      let visibleTeamIds: string[] = [];
      if (role === 'instructor') {
        const { data } = await supabase.from('events').select('id').eq('created_by', profile.id); visibleEventIds = (data || []).map((e: any) => e.id);
      } else if (role === 'competitor') {
        const { data: teamMemberships } = await supabase.from('team_members').select('team_id').eq('user_id', profile.id);
        visibleTeamIds = (teamMemberships || []).map((m: any) => m.team_id);
        const { data: memberships } = await supabase.from('class_members').select('class_id').eq('user_id', profile.id).eq('status', 'active');
        const classIds = (memberships || []).map((m: any) => m.class_id);
        const { data: linked } = classIds.length ? await supabase.from('event_classes').select('event_id').in('class_id', classIds) : { data: [] };
        const { data: publicEvents } = await supabase.from('events').select('id').eq('visibility', 'public');
        visibleEventIds = [...new Set([...(linked || []).map((e: any) => e.event_id), ...(publicEvents || []).map((e: any) => e.id)])];
      }
      if (visibleEventIds) activity = activity.filter((s: any) => visibleEventIds!.includes(feedMissionMap[s.challenges?.mission_id]) && (role !== 'competitor' || s.user_id === profile.id || (s.team_id && visibleTeamIds.includes(s.team_id))));
      if (role === 'competitor') {
        const { data: ownWriteups } = await supabase.from('writeups').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20);
        const ids = [...new Set((ownWriteups || []).map((w: any) => w.challenge_id))];
        const { data: cs } = ids.length ? await supabase.from('challenges').select('id,title,sequence_number,mission_id').in('id', ids) : { data: [] };
        const { data: ms } = cs?.length ? await supabase.from('missions').select('id,name,event_id').in('id', cs.map((c: any) => c.mission_id)) : { data: [] };
        const { data: es } = ms?.length ? await supabase.from('events').select('id,name').in('id', ms.map((m: any) => m.event_id)) : { data: [] };
        const cm = Object.fromEntries((cs || []).map((c: any) => [c.id, c])); const mm = Object.fromEntries((ms || []).map((m: any) => [m.id, m])); const em = Object.fromEntries((es || []).map((e: any) => [e.id, e]));
        activity = [...(ownWriteups || []).map((w: any) => ({ ...w, challenges: cm[w.challenge_id], missions: mm[cm[w.challenge_id]?.mission_id], events: em[mm[cm[w.challenge_id]?.mission_id]?.event_id], id: `writeup-${w.id}-${w.status}`, is_writeup: true, submitted_at: w.created_at, writeup_status: w.status })), ...activity].slice(0, 20);
      }
      if (role === 'instructor' || role === 'admin' || role === 'super_admin') {
        let writeupQuery = supabase.from('writeups').select('*').order('created_at', { ascending: false }).limit(50);
        if (role === 'instructor') {
          const { data: ownEvents } = await supabase.from('events').select('id').eq('created_by', profile.id);
          const { data: ownMissions } = ownEvents?.length ? await supabase.from('missions').select('id').in('event_id', ownEvents.map((e: any) => e.id)) : { data: [] };
          const { data: ownChallenges } = ownMissions?.length ? await supabase.from('challenges').select('id').in('mission_id', ownMissions.map((m: any) => m.id)) : { data: [] };
          writeupQuery = ownChallenges?.length ? writeupQuery.in('challenge_id', ownChallenges.map((c: any) => c.id)) : writeupQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
        const { data: writeups, error: writeupsError } = await writeupQuery;
        if (writeupsError) console.error('Pending writeups query error:', writeupsError.message);
        const writerIds = [...new Set((writeups || []).map((w: any) => w.user_id))];
        const { data: writers } = writerIds.length ? await supabase.from('profiles').select('id,display_name').in('id', writerIds) : { data: [] };
        const challengeIdsForWriteups = [...new Set((writeups || []).map((w: any) => w.challenge_id))];
        const { data: challengeRows } = challengeIdsForWriteups.length ? await supabase.from('challenges').select('id,sequence_number,title').in('id', challengeIdsForWriteups) : { data: [] };
        const challengeMap = Object.fromEntries((challengeRows || []).map((c: any) => [c.id, c]));
        const writerMap = Object.fromEntries((writers || []).map((p: any) => [p.id, p.display_name]));
        const enriched = (writeups || []).map((w: any) => ({ ...w, profiles: { display_name: writerMap[w.user_id] || 'Usuário' }, challenges: challengeMap[w.challenge_id], id: `writeup-${w.id}-${w.status}`, writeup_id: w.id, is_writeup: true, submitted_at: w.created_at, writeup_status: w.status }));
        if (!cancelled) setPendingWriteups(enriched);
        activity = [...enriched, ...activity].slice(0, 20);
      }
      if (!cancelled) setRecentActivity(activity);
    } catch (err) {
      console.error('Recent activity error:', err);
    }
  };

  const normalizedRole = String(profile?.role || '').trim().toLowerCase();
  const isAdmin = normalizedRole === 'super_admin' || normalizedRole === 'admin' || normalizedRole === 'instructor';
  const isInstructor = normalizedRole === 'instructor';

  const isPtBr = locale === 'pt-BR';

  const reviewWriteup = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.rpc('review_writeup', { p_writeup_id: id, p_status: status });
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved' ? 'Writeup aprovado e pontuação concedida' : 'Writeup rejeitado');
    await loadDashboardData(false);
  };

  const instructorGuideSections = [
    {
      key: 'instr_certificates',
      title: isPtBr ? 'Gerenciamento de certificados' : 'Certificate management',
      lines: isPtBr ? ['Na pÃ¡gina Certificados, consulte os documentos emitidos nos seus eventos.', 'Exclua um certificado para permitir que o participante gere uma nova versÃ£o atualizada.', 'A validaÃ§Ã£o pÃºblica usa o cÃ³digo de 8 caracteres e o link impresso no certificado.'] : ['On the Certificates page, review documents issued for your events.', 'Delete a certificate so the participant can generate an updated version.', 'Public validation uses the 8-character code and link printed on the certificate.'],
    },
    {
      key: 'instr_flow_order',
      title: isPtBr ? 'Fluxo principal (ordem recomendada)' : 'Main flow (recommended order)',
      lines: isPtBr
        ? [
            '1) Crie a Turma e gere o código de acesso.',
            '2) (Opcional) Crie Grupos na turma para organizar equipes/perfis.',
            '3) (Opcional) Crie uma Liga para agrupar eventos da temporada.',
            '4) Crie o Evento e vincule à turma (se restrito) e à liga (se houver).',
            '5) Cadastre Missões e, depois, os Desafios de cada missão.',
            '6) Defina Requisito de conclusão quando quiser progressão por etapa.',
            '7) Revise datas/status e publique quando tudo estiver validado.',
          ]
        : [
            '1) Create the Class and generate the access code.',
            '2) (Optional) Create Class Groups to organize teams/profiles.',
            '3) (Optional) Create a League to group season events.',
            '4) Create the Event and link it to class (if restricted) and league (if used).',
            '5) Add Missions and then Challenges inside each mission.',
            '6) Set Completion Requirement when you want progression by stages.',
            '7) Review dates/status and publish only after final validation.',
          ],
    },
    {
      key: 'instr_alt_league',
      title: isPtBr ? 'Com liga vs sem liga' : 'With league vs without league',
      lines: isPtBr
        ? [
            'Com liga: use para temporada contínua e análise de múltiplos eventos.',
            'Sem liga: use para atividade pontual, hackathon interno ou prova única.',
          ]
        : [
            'With league: use for ongoing seasons and multi-event analysis.',
            'Without league: use for one-off activity, internal hackathon, or single assessment.',
          ],
    },
    {
      key: 'instr_alt_groups',
      title: isPtBr ? 'Turma com grupos vs sem grupos' : 'Class with groups vs without groups',
      lines: isPtBr
        ? [
            'Com grupos: melhor para divisão de sala, rodízio e equipes fixas.',
            'Sem grupos: ideal para turmas menores ou quando não há segmentação.',
          ]
        : [
            'With groups: better for class split, rotations, and fixed teams.',
            'Without groups: ideal for smaller classes or when segmentation is unnecessary.',
          ],
    },
    {
      key: 'instr_csv',
      title: isPtBr ? 'Cadastro em massa via CSV' : 'Bulk enrollment via CSV',
      lines: isPtBr
        ? [
            'Use o upload CSV para cadastrar competidores em lote.',
            'Fluxo sugerido: criar turma -> criar grupos -> importar CSV -> revisar vínculos.',
            'Confirme status ativo e associação correta antes de iniciar o evento.',
          ]
        : [
            'Use CSV upload to register competitors in batches.',
            'Suggested flow: create class -> create groups -> import CSV -> review links.',
            'Confirm active status and correct associations before event start.',
          ],
    },
    {
      key: 'instr_prereq',
      title: isPtBr ? 'Desafios com/sem bloqueio por requisito' : 'Challenges with/without prerequisite lock',
      lines: isPtBr
        ? [
            'Sem requisito: competidor acessa o desafio assim que a missão estiver disponível.',
            'Com requisito: selecione um desafio anterior como pré-condição de acesso.',
            'Se necessário, use Liberação manual no card para abrir acesso sem requisito concluído.',
          ]
        : [
            'Without prerequisite: competitor can access challenge as soon as mission is available.',
            'With prerequisite: select a previous challenge as access condition.',
            'If needed, use Manual unlock on the card to grant access without solved prerequisite.',
          ],
    },
    {
      key: 'instr_writeups',
      title: isPtBr ? 'Writeups pós-evento e anúncios' : 'Post-event writeups and announcements',
      lines: isPtBr ? ['Após o encerramento, revise writeups pendentes no dashboard.', 'Aprovação concede 50% dos pontos; rejeição permite novo envio.', 'Use o campo de anúncio no evento para enviar broadcasts aos competidores.'] : ['After an event ends, review pending writeups in the dashboard.', 'Approval grants 50% of the points; rejection allows a new submission.', 'Use the event announcement field to broadcast messages to competitors.'],
    },
  ];

  const competitorGuideSections = [
    {
      key: 'comp_certificates',
      title: isPtBr ? 'Certificados de participaÃ§Ã£o' : 'Participation certificates',
      lines: isPtBr ? ['Visualize e imprima certificados jÃ¡ emitidos na pÃ¡gina Certificados.', 'Para emitir outro certificado, acesse o evento encerrado.', 'Preencha o nome completo no perfil: ele serÃ¡ usado no certificado e hÃ¡ um cÃ³digo/link pÃºblico para validaÃ§Ã£o.'] : ['View and print issued certificates on the Certificates page.', 'To issue another certificate, open the finished event.', 'Fill in your full name in Profile: it is used on the certificate, which includes a public validation code/link.'],
    },
    {
      key: 'comp_start_here',
      title: isPtBr ? 'Comece por aqui' : 'Start here',
      lines: isPtBr
        ? [
            '1) Entre em uma turma pelo código do instrutor (se o evento for restrito).',
            '2) Verifique se o evento está Ao Vivo antes de tentar enviar flag.',
            '3) Escolha a missão e avance pelos desafios da sequência definida.',
          ]
        : [
            '1) Join a class with the instructor code (if event is restricted).',
            '2) Check if the event is Live before attempting flag submission.',
            '3) Pick a mission and move through challenges in the defined sequence.',
          ],
    },
    {
      key: 'comp_with_without_group',
      title: isPtBr ? 'Com grupo/equipe vs individual' : 'With team/group vs individual',
      lines: isPtBr
        ? [
            'Em equipe: se um membro resolver, os demais não submetem a mesma flag.',
            'Individual: todo progresso e pontuação ficam 100% no seu usuário.',
          ]
        : [
            'Team mode: if one member solves it, others cannot submit the same flag.',
            'Individual mode: all progress and score remain fully on your user account.',
          ],
    },
    {
      key: 'comp_prereq_flow',
      title: isPtBr ? 'Desafios bloqueados por requisito' : 'Prerequisite-locked challenges',
      lines: isPtBr
        ? [
            'Alguns desafios exigem resolver um desafio anterior primeiro.',
            'Enquanto bloqueado, você verá apenas informações mínimas do card.',
            'O instrutor pode liberar manualmente o acesso em casos específicos.',
          ]
        : [
            'Some challenges require solving a previous challenge first.',
            'While locked, you see only minimal card information.',
            'Instructor can manually unlock access in specific cases.',
          ],
    },
    {
      key: 'comp_hints',
      title: isPtBr ? 'Uso estratégico de dicas' : 'Strategic hint usage',
      lines: isPtBr
        ? [
            'Use Shells para desbloquear dicas apenas quando necessário.',
            'Planeje as tentativas para não esgotar o limite em desafios críticos.',
          ]
        : [
            'Spend Shells on hints only when necessary.',
            'Plan attempts carefully to avoid exhausting limits on critical challenges.',
          ],
    },
    {
      key: 'comp_progress_writeups',
      title: isPtBr ? 'Progresso, notificações e writeups' : 'Progress, notifications and writeups',
      lines: isPtBr ? ['Acompanhe o progresso da missão e do evento nas barras e roadmaps de flags.', 'O sino mostra anúncios, First Blood e decisões sobre suas writeups.', 'Após o evento, envie uma solução detalhada; writeups aprovadas valem 50% dos pontos.'] : ['Track mission and event progress with flag bars and roadmaps.', 'The bell shows announcements, First Blood events and writeup decisions.', 'After the event, submit a detailed solution; approved writeups award 50% of the points.'],
    },
  ];

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
                      <div className={`w-2 h-2 rounded-full ${item.is_writeup ? 'bg-cyber-purple' : item.is_correct ? 'bg-cyber-green' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium text-gray-200">
                            {item.profiles?.display_name}
                          </span>{' '}
                          <span className={item.is_writeup ? 'text-cyber-purple' : item.is_correct ? 'text-cyber-green' : 'text-red-400'}>
                            {item.is_writeup ? (item.writeup_status === 'pending' ? 'enviou writeup para aprovação' : `writeup ${item.writeup_status === 'approved' ? 'aprovado' : 'rejeitado'}`) : item.is_correct ? 'resolveu' : 'tentou'}
                          </span>{' '}
                          <span className="text-gray-400">Desafio #{item.challenges?.sequence_number || '—'} {item.challenges?.title || ''}</span>
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
                  <h4 className="text-sm font-medium text-gray-400 mb-3">{t('dash.season_analysis')}</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-amber-400">{stats.totalLeagues}</p>
                      <p className="text-xs text-gray-500">{t('dash.total_leagues')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-300">{stats.leagueEventsCount}</p>
                      <p className="text-xs text-gray-500">{t('dash.league_events')}</p>
                    </div>
                    <TrendingUp size={24} className="text-amber-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cyber-card mt-6">
            <h3 className="text-lg font-bold text-cyber-purple mb-4 flex items-center gap-2">
              <BookOpen size={20} /> Writeups recebidas ({pendingWriteups.length})
            </h3>
            <div className="flex gap-2 mb-4">
              {(['pending', 'approved', 'rejected'] as const).map(filter => <button key={filter} onClick={() => setWriteupFilter(filter)} className={`px-3 py-1 rounded text-xs ${writeupFilter === filter ? 'bg-cyber-purple/30 text-cyber-purple-light' : 'bg-white/5 text-gray-500'}`}>{filter === 'pending' ? 'Pendentes' : filter === 'approved' ? 'Aprovadas' : 'Rejeitadas'}</button>)}
            </div>
            {pendingWriteups.filter((w: any) => w.status === writeupFilter).length === 0 ? <p className="text-gray-500 text-sm">Nenhum writeup neste filtro.</p> : (
              <div className="space-y-3">
                {pendingWriteups.filter((w: any) => w.status === writeupFilter).map((writeup: any) => (
                  <div key={writeup.id} className="rounded-lg bg-white/5 border border-cyber-border p-3">
                    <p className="text-xs text-gray-500 mb-2">{writeup.profiles?.display_name || 'Usuário'} · Desafio #{writeup.challenges?.sequence_number || '—'} {writeup.challenges?.title || ''} · Enviado em {new Date(writeup.created_at).toLocaleString('pt-BR')}</p>
                    <p className="text-sm text-gray-300 whitespace-pre-line max-h-24 overflow-y-auto">{writeup.content}</p>
                    {writeup.status === 'pending' && <div className="flex justify-end gap-2 mt-3"><button onClick={() => reviewWriteup(writeup.writeup_id, 'rejected')} className="cyber-btn-secondary text-xs">Rejeitar</button><button onClick={() => reviewWriteup(writeup.writeup_id, 'approved')} className="cyber-btn-primary text-xs">Aprovar (50%)</button></div>}
                  </div>
                ))}
              </div>
            )}
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
            <div className="space-y-3">
              {instructorGuideSections.map((section) => {
                const isOpen = expandedInstructorGuide.has(section.key);
                return (
                  <div key={section.key} className="rounded-lg bg-white/5 border border-cyber-border p-3">
                    <button
                      type="button"
                      onClick={() => toggleGuideSection(section.key, setExpandedInstructorGuide)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h4 className="font-semibold text-cyber-cyan text-sm">{section.title}</h4>
                      {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                    </button>
                    {isOpen && (
                      <div className="mt-2 space-y-1.5 pl-3 border-l border-cyber-cyan/30">
                        {section.lines.map((line, idx) => (
                          <p key={idx} className="text-xs text-gray-300">{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
                {competitorGuideSections.map((section) => {
                  const isOpen = expandedCompetitorGuide.has(section.key);
                  return (
                    <div key={section.key} className="p-3 rounded-lg bg-white/5 border border-cyber-border">
                      <button
                        type="button"
                        onClick={() => toggleGuideSection(section.key, setExpandedCompetitorGuide)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <h4 className="font-semibold text-cyber-cyan text-sm">{section.title}</h4>
                        {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                      </button>
                      {isOpen && (
                        <div className="mt-2 space-y-1.5 pl-3 border-l border-cyber-cyan/30">
                          {section.lines.map((line, idx) => (
                            <p key={idx} className="text-xs text-gray-300">{line}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                        <div className={`w-2 h-2 rounded-full ${item.is_writeup ? item.writeup_status === 'approved' ? 'bg-cyber-green' : item.writeup_status === 'rejected' ? 'bg-red-400' : 'bg-cyber-purple' : item.is_correct ? 'bg-cyber-green' : 'bg-red-400'}`} />
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className={item.is_writeup ? item.writeup_status === 'approved' ? 'text-cyber-green' : item.writeup_status === 'rejected' ? 'text-red-400' : 'text-cyber-purple' : item.is_correct ? 'text-cyber-green' : 'text-red-400'}>
                              {item.is_writeup ? `✍️ Writeup ${item.writeup_status === 'approved' ? 'aprovado' : item.writeup_status === 'rejected' ? 'rejeitado' : 'enviado'}` : item.is_correct ? '✅ Resolvido' : '❌ Incorreto'}
                            </span>{' '}
                            {item.is_writeup ? <span className="text-gray-400">Evento: {item.events?.name || '—'} · Missão: {item.missions?.name || '—'} · Flag #{item.challenges?.sequence_number || '—'}: {item.challenges?.title || '—'}</span> : <span className="text-gray-400">{item.challenges?.title}</span>}
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
