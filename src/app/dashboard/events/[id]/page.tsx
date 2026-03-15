'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import { DIFFICULTIES, DIFFICULTY_COLORS, CHALLENGE_DIFFICULTIES, CHALLENGE_DIFFICULTY_LABELS, CHALLENGE_DIFFICULTY_COLORS, toDirectImageUrl } from '@/lib/utils';
import Modal from '@/components/Modal';
import confetti from 'canvas-confetti';
import {
  ArrowLeft, Flag, Plus, Edit, Trash2, Target, Clock, Download,
  ChevronRight, Shield, Zap, Star, ThumbsUp, ThumbsDown, Lightbulb, Lock, Unlock, Send, AlertTriangle,
  BookOpen, GraduationCap
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const eventId = params.id as string;

  const [event, setEvent] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [hints, setHints] = useState<any[]>([]);
  const [hintUsage, setHintUsage] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reactions, setReactions] = useState<Record<string, { likes: number; dislikes: number; userReaction?: string }>>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [hintModalOpen, setHintModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<any>(null);
  const [editingChallenge, setEditingChallenge] = useState<any>(null);
  const [editingHint, setEditingHint] = useState<any>(null);

  // Forms
  const [missionForm, setMissionForm] = useState({
    name: '', description: '', image_url: '', download_links: '',
    difficulty: 'medium', time_limit: '', author: '', conclusions: '',
  });
  const [challengeForm, setChallengeForm] = useState({
    sequence_number: 1, title: '', description: '', max_attempts: '',
    points: 10, flag: '', difficulty: 'medio',
    what_i_learned: '', learn_more_url: '',
  });
  const [hintForm, setHintForm] = useState({ content: '', shell_cost: 10, challenge_id: '' });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Confetti modal state
  const [showCongrats, setShowCongrats] = useState(false);

  // Team data for team-mode events
  const [userTeam, setUserTeam] = useState<any>(null);
  const [teamSubmissions, setTeamSubmissions] = useState<any[]>([]);

  // Track last solved challenge points for modal
  const [lastSolvedPoints, setLastSolvedPoints] = useState(0);

  // Confetti canvas ref
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const canManage = ['super_admin', 'admin', 'instructor'].includes(profile?.role || '');

  // Privileged viewer: super_admin, admin, or the instructor who created the event
  const isPrivilegedViewer = profile?.role === 'super_admin' || profile?.role === 'admin'
    || (profile?.role === 'instructor' && event?.created_by === profile?.id);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadEvent(cancelled);
      } catch (err) {
        console.error('Event detail load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [eventId]);

  const loadEvent = async (cancelled = false) => {
    setLoading(true);
    try {
      const { data: ev, error: evErr } = await supabase.from('events').select('*').eq('id', eventId).single();
      if (evErr) console.error('Event query error:', evErr.message);
      if (cancelled) return;
      setEvent(ev);

      const { data: miss, error: missErr } = await supabase.from('missions').select('*')
        .eq('event_id', eventId).order('sequence', { ascending: true });
      if (missErr) console.error('Missions query error:', missErr.message);
      if (!cancelled) setMissions(miss || []);

      // Load user's team for team-mode events
      if (ev && profile?.id) {
        const { data: teamMembership } = await supabase
          .from('team_members')
          .select('team_id, teams(*)')
          .eq('user_id', profile.id);
        if (teamMembership && teamMembership.length > 0) {
          setUserTeam(teamMembership[0].teams);
        }
      }
    } catch (err) {
      console.error('loadEvent exception:', err);
    }
  };

  const loadMissionDetails = async (mission: any) => {
    if (!profile) return;
    setSelectedMission(mission);
    try {

    const { data: challs, error: challErr } = await supabase.from('challenges').select('*')
      .eq('mission_id', mission.id).order('sequence_number', { ascending: true });
    if (challErr) console.error('Challenges query error:', challErr.message);
    setChallenges(challs || []);

    if (challs && challs.length > 0) {
      const challengeIds = challs.map((c: any) => c.id);

      // Load hints
      const { data: h } = await supabase.from('hints').select('*')
        .in('challenge_id', challengeIds).order('order_index');
      setHints(h || []);

      // Load hint usage
      const { data: hu } = await supabase.from('hint_usage').select('hint_id')
        .eq('user_id', profile.id);
      setHintUsage(new Set((hu || []).map((x: any) => x.hint_id)));

      // Load user submissions
      const { data: subs } = await supabase.from('submissions').select('*')
        .in('challenge_id', challengeIds).eq('user_id', profile.id);
      setSubmissions(subs || []);

      // Load team submissions (to check if anyone in the team already solved it)
      if (userTeam) {
        const { data: teamMembers } = await supabase
          .from('team_members').select('user_id').eq('team_id', userTeam.id);
        const teamUserIds = (teamMembers || []).map((m: any) => m.user_id);
        if (teamUserIds.length > 0) {
          const { data: teamSubs } = await supabase.from('submissions').select('*')
            .in('challenge_id', challengeIds)
            .in('user_id', teamUserIds)
            .eq('is_correct', true);
          setTeamSubmissions(teamSubs || []);
        }
      }

      // Load reactions (single batch query instead of N+1)
      const { data: allReactions } = await supabase.from('challenge_reactions').select('*')
        .in('challenge_id', challengeIds);
      const reactionsMap: Record<string, any> = {};
      for (const c of challs) {
        const cReactions = (allReactions || []).filter((r: any) => r.challenge_id === c.id);
        const likeCount = cReactions.filter((r: any) => r.reaction === 'like').length;
        const dislikeCount = cReactions.filter((r: any) => r.reaction === 'dislike').length;
        const userR = cReactions.find((r: any) => r.user_id === profile.id);
        reactionsMap[c.id] = { likes: likeCount, dislikes: dislikeCount, userReaction: userR?.reaction };
      }
      setReactions(reactionsMap);
    }

    } catch (err) {
      console.error('loadMissionDetails exception:', err);
    }
  };

  const handleSaveMission = async () => {
    if (!missionForm.name.trim()) { toast.error('Nome é obrigatório'); return; }

    const links = missionForm.download_links
      .split('\n').map(l => l.trim()).filter(Boolean);

    const payload = {
      event_id: eventId,
      name: missionForm.name,
      description: missionForm.description,
      image_url: missionForm.image_url || null,
      download_links: links,
      difficulty: missionForm.difficulty,
      time_limit: missionForm.time_limit ? parseInt(missionForm.time_limit) : null,
      author: missionForm.author,
      conclusions: missionForm.conclusions,
      sequence: missions.length + 1,
    };

    if (editingMission) {
      const { error } = await supabase.from('missions').update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingMission.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Missão atualizada!');
    } else {
      const { error } = await supabase.from('missions').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Missão criada!');
    }
    setMissionModalOpen(false);
    setEditingMission(null);
    loadEvent();
  };

  const handleSaveChallenge = async () => {
    if (!challengeForm.title.trim() || !challengeForm.flag.trim()) {
      toast.error('Título e Flag são obrigatórios'); return;
    }

    const payload = {
      mission_id: selectedMission.id,
      sequence_number: challengeForm.sequence_number,
      title: challengeForm.title,
      description: challengeForm.description,
      max_attempts: challengeForm.max_attempts ? parseInt(challengeForm.max_attempts) : null,
      points: challengeForm.points,
      flag: challengeForm.flag,
      difficulty: challengeForm.difficulty,
      what_i_learned: challengeForm.what_i_learned || null,
      learn_more_url: challengeForm.learn_more_url || null,
    };

    if (editingChallenge) {
      const { error } = await supabase.from('challenges').update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingChallenge.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Desafio atualizado!');
    } else {
      const { error } = await supabase.from('challenges').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Desafio criado!');
    }
    setChallengeModalOpen(false);
    setEditingChallenge(null);
    loadMissionDetails(selectedMission);
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    const { error } = await supabase.from('missions').delete().eq('id', missionId);
    if (error) { toast.error(error.message); return; }
    toast.success('Missão excluída!');
    setSelectedMission(null);
    loadEvent();
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    const { error } = await supabase.from('challenges').delete().eq('id', challengeId);
    if (error) { toast.error(error.message); return; }
    toast.success('Desafio excluído!');
    loadMissionDetails(selectedMission);
  };

  const handleSaveHint = async () => {
    if (!hintForm.content.trim() || !hintForm.challenge_id) {
      toast.error('Conteúdo e desafio são obrigatórios'); return;
    }

    if (editingHint) {
      const { error } = await supabase.from('hints').update({
        challenge_id: hintForm.challenge_id,
        content: hintForm.content,
        shell_cost: hintForm.shell_cost,
      }).eq('id', editingHint.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Dica atualizada!');
    } else {
      const { error } = await supabase.from('hints').insert({
        challenge_id: hintForm.challenge_id,
        content: hintForm.content,
        shell_cost: hintForm.shell_cost,
        order_index: hints.filter(h => h.challenge_id === hintForm.challenge_id).length,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Dica adicionada!');
    }
    setHintModalOpen(false);
    setEditingHint(null);
    setHintForm({ content: '', shell_cost: 10, challenge_id: '' });
    loadMissionDetails(selectedMission);
  };

  const handleDeleteHint = async (hintId: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    const { error } = await supabase.from('hints').delete().eq('id', hintId);
    if (error) { toast.error(error.message); return; }
    toast.success('Dica excluída!');
    loadMissionDetails(selectedMission);
  };

  const handleUnlockHint = async (hint: any) => {
    if (!profile) return;
    if (profile.shells < hint.shell_cost) {
      toast.error('Shells insuficientes!'); return;
    }
    const { error } = await supabase.from('hint_usage').insert({ hint_id: hint.id, user_id: profile.id });
    if (error) { toast.error(error.message); return; }
    await supabase.from('profiles').update({ shells: profile.shells - hint.shell_cost }).eq('id', profile.id);
    setHintUsage(new Set([...hintUsage, hint.id]));
    toast.success(`Dica desbloqueada! -${hint.shell_cost} Shells 🐚`);
  };

  // Helper: check if event is currently active
  const isEventActive = () => {
    if (!event) return false;
    const now = new Date();
    return now >= new Date(event.start_date) && now <= new Date(event.end_date);
  };

  const getEventStatusLabel = () => {
    if (!event) return '';
    const now = new Date();
    if (now < new Date(event.start_date)) return 'agendado';
    if (now > new Date(event.end_date)) return 'encerrado';
    return 'ativo';
  };

  // Fire confetti effect on a dedicated high z-index canvas
  const fireConfetti = () => {
    // Remove old canvas if exists
    if (confettiCanvasRef.current) {
      confettiCanvasRef.current.remove();
      confettiCanvasRef.current = null;
    }

    // Create a fresh canvas covering the viewport
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
    canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
    canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    document.body.appendChild(canvas);
    confettiCanvasRef.current = canvas;

    const myConfetti = confetti.create(canvas, { resize: true });
    const colors = ['#00f5ff', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#ffffff'];

    // Big initial burst
    myConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors });

    // Continued side cannons
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      myConfetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.65 }, colors });
      myConfetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, colors });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      } else {
        // Clean up after particles settle
        setTimeout(() => {
          canvas.remove();
          if (confettiCanvasRef.current === canvas) confettiCanvasRef.current = null;
        }, 3000);
      }
    })();
  };

  const handleSubmitAnswer = async (challengeId: string) => {
    const answer = answers[challengeId]?.trim();
    if (!answer) return;

    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;

    // Tarefa 2: Block submission if event is not within active period
    if (!isEventActive()) {
      const status = getEventStatusLabel();
      if (status === 'agendado') {
        toast.error('Este evento ainda não começou. Aguarde a data de início.');
      } else {
        toast.error('Este evento já foi encerrado. Não é possível submeter bandeiras.');
      }
      return;
    }

    // Check max attempts
    const userSubs = submissions.filter(s => s.challenge_id === challengeId);
    if (challenge.max_attempts && userSubs.length >= challenge.max_attempts) {
      toast.error('Tentativas esgotadas!'); return;
    }

    // Tarefa 4: Check if a teammate already solved this challenge
    if (userTeam) {
      const teamAlreadySolved = teamSubmissions.some(
        s => s.challenge_id === challengeId && s.is_correct
      );
      if (teamAlreadySolved) {
        toast.error('Um membro da sua equipe já resolveu este desafio!');
        return;
      }
    }

    const isCorrect = answer === challenge.flag;

    // Calculate hint penalty: -10% per unlocked hint
    let finalPoints = challenge.points;
    if (isCorrect) {
      const challengeHints = hints.filter((h: any) => h.challenge_id === challengeId);
      const usedHintCount = challengeHints.filter((h: any) => hintUsage.has(h.id)).length;
      if (usedHintCount > 0) {
        finalPoints = Math.max(1, Math.round(challenge.points * (1 - 0.1 * usedHintCount)));
      }
    }

    // Build submission payload — include team_id if in a team
    const submissionPayload: any = {
      challenge_id: challengeId,
      user_id: profile?.id,
      answer,
      is_correct: isCorrect,
      points_awarded: isCorrect ? finalPoints : 0,
    };
    if (userTeam) {
      submissionPayload.team_id = userTeam.id;
    }

    const { error } = await supabase.from('submissions').insert(submissionPayload);

    if (error) { toast.error(error.message); return; }

    if (isCorrect) {
      // Tarefa 3: Fire confetti and show congratulations modal
      setLastSolvedPoints(finalPoints);
      fireConfetti();
      setShowCongrats(true);
    } else {
      toast.error(t('challenge.incorrect'));
    }

    setAnswers({ ...answers, [challengeId]: '' });
    loadMissionDetails(selectedMission);
  };

  const handleReaction = async (challengeId: string, reaction: 'like' | 'dislike') => {
    if (!profile) return;
    const current = reactions[challengeId]?.userReaction;
    if (current === reaction) {
      await supabase.from('challenge_reactions').delete()
        .eq('challenge_id', challengeId).eq('user_id', profile.id);
    } else if (current) {
      await supabase.from('challenge_reactions').update({ reaction })
        .eq('challenge_id', challengeId).eq('user_id', profile.id);
    } else {
      await supabase.from('challenge_reactions').insert({
        challenge_id: challengeId, user_id: profile.id, reaction,
      });
    }
    loadMissionDetails(selectedMission);
  };

  const difficultyLabel: Record<string, string> = {
    easy: 'Fácil', medium: 'Médio', hard: 'Difícil', expert: 'Especialista', insane: 'Insano',
  };

  if (loading) return <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>;
  if (!event) return <div className="text-center py-12 text-gray-500">Evento não encontrado</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => selectedMission ? setSelectedMission(null) : router.push('/dashboard/events')}
          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm text-gray-500">{event.description}</p>
        </div>
      </div>

      {/* Event period banner */}
      {!isEventActive() && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          getEventStatusLabel() === 'agendado'
            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
        }`}>
          <AlertTriangle size={20} />
          <div>
            <p className="font-semibold">
              {getEventStatusLabel() === 'agendado' ? 'Evento Agendado' : 'Evento Encerrado'}
            </p>
            <p className="text-sm opacity-80">
              {getEventStatusLabel() === 'agendado'
                ? `Este evento inicia em ${new Date(event.start_date).toLocaleDateString('pt-BR')} às ${new Date(event.start_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. As bandeiras não podem ser submetidas até lá.`
                : `Este evento encerrou em ${new Date(event.end_date).toLocaleDateString('pt-BR')} às ${new Date(event.end_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Não é mais possível submeter bandeiras.`
              }
            </p>
          </div>
        </div>
      )}

      {/* Missions List */}
      {!selectedMission && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-cyber-purple flex items-center gap-2">
              <Target size={20} /> {t('nav.missions')}
            </h2>
            {canManage && (
              <button onClick={() => {
                setEditingMission(null);
                setMissionForm({ name: '', description: '', image_url: '', download_links: '', difficulty: 'medium', time_limit: '', author: '', conclusions: '' });
                setMissionModalOpen(true);
              }} className="cyber-btn-primary flex items-center gap-2 text-sm">
                <Plus size={16} /> {t('mission.create')}
              </button>
            )}
          </div>

          {missions.length === 0 ? (
            <div className="cyber-card text-center py-12">
              <Target size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-500">{t('mission.no_missions')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {missions.map((mission) => (
                <div key={mission.id} className="cyber-card-glow cursor-pointer group"
                  onClick={() => loadMissionDetails(mission)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`cyber-badge ${DIFFICULTY_COLORS[mission.difficulty]}`}>
                          {difficultyLabel[mission.difficulty]}
                        </span>
                        {mission.time_limit && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock size={12} /> {mission.time_limit} min
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold">{mission.name}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2 mt-1">{mission.description}</p>
                      {mission.author && <p className="text-xs text-gray-500 mt-2">Autor: {mission.author}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {canManage && (
                        <>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            setEditingMission(mission);
                            setMissionForm({
                              name: mission.name,
                              description: mission.description || '',
                              image_url: mission.image_url || '',
                              download_links: (mission.download_links || []).join('\n'),
                              difficulty: mission.difficulty,
                              time_limit: mission.time_limit?.toString() || '',
                              author: mission.author || '',
                              conclusions: mission.conclusions || '',
                            });
                            setMissionModalOpen(true);
                          }} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-cyber-cyan transition-colors">
                            <Edit size={16} />
                          </button>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMission(mission.id);
                          }} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      <ChevronRight size={20} className="text-gray-600 group-hover:text-cyber-cyan transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mission Detail + Challenges */}
      {selectedMission && (
        <div className="space-y-6">
          {/* Mission Info */}
          <div className="cyber-card">
            <div className="flex flex-col md:flex-row gap-4">
              {selectedMission.image_url && (
                <img src={toDirectImageUrl(selectedMission.image_url)} alt={selectedMission.name}
                  className="w-full md:w-48 h-32 object-cover rounded-lg" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`cyber-badge ${DIFFICULTY_COLORS[selectedMission.difficulty]}`}>
                    {difficultyLabel[selectedMission.difficulty]}
                  </span>
                </div>
                <h2 className="text-xl font-bold">{selectedMission.name}</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedMission.description}</p>
                {selectedMission.conclusions && (
                  <div className="mt-3 p-3 rounded-lg bg-white/5 border border-cyber-border">
                    <h4 className="text-xs font-semibold text-cyber-cyan mb-1">{t('mission.conclusions')}</h4>
                    <p className="text-xs text-gray-400">{selectedMission.conclusions}</p>
                  </div>
                )}
                {selectedMission.download_links?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedMission.download_links.map((link: string, i: number) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-cyber-cyan hover:text-cyber-cyan-light">
                        <Download size={12} /> Download {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Challenges */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-cyber-green flex items-center gap-2">
              <Flag size={20} /> Desafios
            </h3>
            {canManage && (
              <div className="flex gap-2">
                <button onClick={() => {
                  setEditingHint(null);
                  setHintForm({ content: '', shell_cost: 10, challenge_id: '' });
                  setHintModalOpen(true);
                }} className="cyber-btn-secondary flex items-center gap-1 text-sm">
                  <Lightbulb size={14} /> Dica
                </button>
                <button onClick={() => {
                  setEditingChallenge(null);
                  setChallengeForm({ sequence_number: challenges.length + 1, title: '', description: '', max_attempts: '', points: 10, flag: '', difficulty: 'medio', what_i_learned: '', learn_more_url: '' });
                  setChallengeModalOpen(true);
                }} className="cyber-btn-primary flex items-center gap-1 text-sm">
                  <Plus size={14} /> {t('challenge.create')}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {challenges.map((challenge) => {
              const solved = submissions.some(s => s.challenge_id === challenge.id && s.is_correct);
              const teamSolved = userTeam ? teamSubmissions.some(s => s.challenge_id === challenge.id && s.is_correct) : false;
              const effectivelySolved = solved || teamSolved;
              const attemptCount = submissions.filter(s => s.challenge_id === challenge.id).length;
              const challengeHints = hints.filter(h => h.challenge_id === challenge.id);
              const reaction = reactions[challenge.id] || { likes: 0, dislikes: 0 };
              const totalReactions = reaction.likes + reaction.dislikes;
              const satisfactionPct = totalReactions > 0 ? Math.round((reaction.likes / totalReactions) * 100) : 0;
              const eventActive = isEventActive();
              const isLocked = !eventActive && !canManage;

              return (
                <div key={challenge.id} className={`cyber-card border-l-4 ${effectivelySolved ? 'border-l-cyber-green' : isLocked ? 'border-l-amber-500/50' : 'border-l-gray-600'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {isLocked && !effectivelySolved && <Lock size={16} className="text-amber-400" />}
                        <span className="text-xs text-gray-500 font-mono">#{challenge.sequence_number}</span>
                        <h4 className="font-bold text-white">{challenge.title}</h4>
                        <span className={`cyber-badge ${effectivelySolved ? 'bg-green-500/20 text-green-400' : isLocked ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {effectivelySolved
                            ? (teamSolved && !solved ? 'Resolvido (Equipe)' : t('challenge.solved'))
                            : isLocked ? 'Bloqueado' : t('challenge.not_solved')}
                        </span>
                        {challenge.difficulty && (
                          <span className={`cyber-badge ${CHALLENGE_DIFFICULTY_COLORS[challenge.difficulty] || 'bg-gray-500/20 text-gray-400'}`}>
                            {CHALLENGE_DIFFICULTY_LABELS[challenge.difficulty] || challenge.difficulty}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-cyber-cyan">{challenge.points} pts</span>
                      {canManage && (
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => {
                            setEditingHint(null);
                            setHintForm({ content: '', shell_cost: 10, challenge_id: challenge.id });
                            setHintModalOpen(true);
                          }} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-amber-400" title="Adicionar dica">
                            <Lightbulb size={14} />
                          </button>
                          <button onClick={() => {
                            setEditingChallenge(challenge);
                            setChallengeForm({
                              sequence_number: challenge.sequence_number,
                              title: challenge.title,
                              description: challenge.description,
                              max_attempts: challenge.max_attempts?.toString() || '',
                              points: challenge.points,
                              flag: challenge.flag,
                              difficulty: challenge.difficulty || 'medio',
                              what_i_learned: challenge.what_i_learned || '',
                              learn_more_url: challenge.learn_more_url || '',
                            });
                            setChallengeModalOpen(true);
                          }} className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-cyber-cyan">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDeleteChallenge(challenge.id)}
                            className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description — hidden when locked and not solved */}
                  {isLocked && !effectivelySolved ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-sm text-amber-400/70 mb-3">
                      <Lock size={14} />
                      {getEventStatusLabel() === 'agendado'
                        ? 'Conteúdo disponível quando o evento iniciar.'
                        : 'Evento encerrado. Conteúdo bloqueado.'}
                    </div>
                  ) : (
                    <>
                      {challenge.description && (
                        <div className="text-sm text-gray-400 mb-3 whitespace-pre-wrap">
                          {challenge.description.replace(/<[^>]*>/g, '')}
                        </div>
                      )}

                      {/* Attempts info */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        {challenge.max_attempts ? (
                          <span>{t('challenge.attempts_remaining')}: {Math.max(0, challenge.max_attempts - attemptCount)}/{challenge.max_attempts}</span>
                        ) : (
                          <span>{t('challenge.unlimited')}</span>
                        )}
                        <span>{attemptCount} tentativa(s)</span>
                      </div>

                      {/* Hints */}
                      {challengeHints.length > 0 && (
                        <div className="mb-3 space-y-2">
                          <h5 className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                            <Lightbulb size={14} /> {t('challenge.hints')}
                          </h5>
                          {challengeHints.map((hint) => {
                            const isUsed = hintUsage.has(hint.id);
                            const canSeeContent = isPrivilegedViewer || isUsed;
                            return (
                              <div key={hint.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-cyber-border text-sm">
                                {canSeeContent ? (
                                  <>
                                    <Unlock size={14} className="text-amber-400" />
                                    <span className="text-gray-300 flex-1">{hint.content}</span>
                                    {isUsed && (
                                      <span className="cyber-badge bg-green-500/20 text-green-400">{t('challenge.hint_used')}</span>
                                    )}
                                    {isPrivilegedViewer && !isUsed && (
                                      <span className="cyber-badge bg-cyan-500/20 text-cyan-400 text-[10px]">🐚 {hint.shell_cost}</span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <Lock size={14} className="text-gray-500" />
                                    <span className="text-gray-500 flex-1">{t('challenge.hint_locked')}</span>
                                    <button onClick={() => handleUnlockHint(hint)}
                                      className="cyber-btn text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 px-3 py-1">
                                      🐚 {hint.shell_cost} - {t('challenge.unlock_hint')}
                                    </button>
                                  </>
                                )}
                                {canManage && (
                                  <div className="flex gap-1 ml-2">
                                    <button onClick={() => {
                                      setEditingHint(hint);
                                      setHintForm({ content: hint.content, shell_cost: hint.shell_cost, challenge_id: hint.challenge_id });
                                      setHintModalOpen(true);
                                    }} className="p-1 text-cyber-cyan hover:text-white transition-colors" title="Editar dica">
                                      <Edit size={14} />
                                    </button>
                                    <button onClick={() => handleDeleteHint(hint.id)}
                                      className="p-1 text-red-400 hover:text-red-300 transition-colors" title="Excluir dica">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Answer Input */}
                      {!effectivelySolved && eventActive && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={answers[challenge.id] || ''}
                            onChange={(e) => setAnswers({ ...answers, [challenge.id]: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer(challenge.id)}
                            placeholder="flag{...}"
                            className="cyber-input flex-1 py-2 text-sm font-mono"
                            disabled={challenge.max_attempts ? attemptCount >= challenge.max_attempts : false}
                          />
                          <button onClick={() => handleSubmitAnswer(challenge.id)}
                            disabled={challenge.max_attempts ? attemptCount >= challenge.max_attempts : false}
                            className="cyber-btn-primary flex items-center gap-1">
                            <Send size={14} /> {t('challenge.submit')}
                          </button>
                        </div>
                      )}

                      {/* Period blocked message */}
                      {!effectivelySolved && !eventActive && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                          <AlertTriangle size={16} />
                          {getEventStatusLabel() === 'agendado'
                            ? 'Este evento ainda não começou. Aguarde a data de início para submeter bandeiras.'
                            : 'Este evento já foi encerrado. Não é possível submeter bandeiras.'}
                        </div>
                      )}

                      {/* What I Learned & Learn More — visible after solved or for privileged viewers */}
                      {(effectivelySolved || isPrivilegedViewer) && (challenge.what_i_learned || challenge.learn_more_url) && (
                        <div className="mt-3 space-y-2 p-3 rounded-lg bg-cyber-purple/5 border border-cyber-purple/20">
                          {challenge.what_i_learned && (
                            <div className="flex items-start gap-2 text-sm">
                              <GraduationCap size={16} className="text-cyber-purple mt-0.5 shrink-0" />
                              <div>
                                <span className="font-semibold text-cyber-purple">O que aprendi:</span>
                                <p className="text-gray-300 mt-1 whitespace-pre-wrap">{challenge.what_i_learned}</p>
                              </div>
                            </div>
                          )}
                          {challenge.learn_more_url && (
                            <div className="flex items-center gap-2 text-sm">
                              <BookOpen size={16} className="text-cyber-cyan shrink-0" />
                              <span className="font-semibold text-cyber-cyan">Saiba mais:</span>
                              <a href={challenge.learn_more_url} target="_blank" rel="noopener noreferrer"
                                className="text-cyber-cyan hover:text-cyber-cyan-light underline truncate">
                                {challenge.learn_more_url}
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Reactions */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-cyber-border">
                    <button onClick={() => handleReaction(challenge.id, 'like')}
                      className={`flex items-center gap-1 text-sm transition-colors ${
                        reaction.userReaction === 'like' ? 'text-green-400' : 'text-gray-500 hover:text-green-400'
                      }`}>
                      <ThumbsUp size={16} /> {reaction.likes}
                    </button>
                    <button onClick={() => handleReaction(challenge.id, 'dislike')}
                      className={`flex items-center gap-1 text-sm transition-colors ${
                        reaction.userReaction === 'dislike' ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
                      }`}>
                      <ThumbsDown size={16} /> {reaction.dislikes}
                    </button>
                    {totalReactions > 0 && (
                      <span className="text-xs text-gray-500">
                        {satisfactionPct}% satisfação
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mission Modal */}
      <Modal isOpen={missionModalOpen} onClose={() => setMissionModalOpen(false)}
        title={editingMission ? t('mission.edit') : t('mission.create')} size="lg">
        <div className="space-y-4">
          <div>
            <label className="cyber-label">{t('mission.name')} *</label>
            <input type="text" value={missionForm.name} onChange={(e) => setMissionForm({ ...missionForm, name: e.target.value })} className="cyber-input" />
          </div>
          <div>
            <label className="cyber-label">{t('mission.description')}</label>
            <textarea value={missionForm.description} onChange={(e) => setMissionForm({ ...missionForm, description: e.target.value })} className="cyber-textarea" rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">{t('mission.difficulty')}</label>
              <select value={missionForm.difficulty} onChange={(e) => setMissionForm({ ...missionForm, difficulty: e.target.value })} className="cyber-select">
                {DIFFICULTIES.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </div>
            <div>
              <label className="cyber-label">{t('mission.time_limit')}</label>
              <input type="number" value={missionForm.time_limit} onChange={(e) => setMissionForm({ ...missionForm, time_limit: e.target.value })} className="cyber-input" />
            </div>
          </div>
          <div>
            <label className="cyber-label">{t('mission.author')}</label>
            <input type="text" value={missionForm.author} onChange={(e) => setMissionForm({ ...missionForm, author: e.target.value })} className="cyber-input" />
          </div>
          <div>
            <label className="cyber-label">{t('mission.download_links')} (um por linha)</label>
            <textarea value={missionForm.download_links} onChange={(e) => setMissionForm({ ...missionForm, download_links: e.target.value })} className="cyber-textarea" rows={3} placeholder="https://..." />
          </div>
          <div>
            <label className="cyber-label">{t('mission.conclusions')}</label>
            <textarea value={missionForm.conclusions} onChange={(e) => setMissionForm({ ...missionForm, conclusions: e.target.value })} className="cyber-textarea" rows={3} />
          </div>
          <div>
            <label className="cyber-label">{t('common.image_url')} ({t('common.optional')})</label>
            <input type="url" value={missionForm.image_url} onChange={(e) => setMissionForm({ ...missionForm, image_url: e.target.value })} className="cyber-input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setMissionModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleSaveMission} className="cyber-btn-primary">{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      {/* Challenge Modal */}
      <Modal isOpen={challengeModalOpen} onClose={() => setChallengeModalOpen(false)}
        title={editingChallenge ? 'Editar Desafio' : t('challenge.create')} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">{t('challenge.sequence')} *</label>
              <input type="number" value={challengeForm.sequence_number} min={1}
                onChange={(e) => setChallengeForm({ ...challengeForm, sequence_number: parseInt(e.target.value) || 1 })} className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('challenge.points')} *</label>
              <input type="number" value={challengeForm.points} min={1}
                onChange={(e) => setChallengeForm({ ...challengeForm, points: parseInt(e.target.value) || 10 })} className="cyber-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">{t('challenge.title')} *</label>
              <input type="text" value={challengeForm.title}
                onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">Nível de Dificuldade</label>
              <select value={challengeForm.difficulty}
                onChange={(e) => setChallengeForm({ ...challengeForm, difficulty: e.target.value })} className="cyber-select">
                {CHALLENGE_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{CHALLENGE_DIFFICULTY_LABELS[d]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="cyber-label">{t('challenge.description')}</label>
            <textarea value={challengeForm.description}
              onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} className="cyber-textarea" rows={4} />
          </div>
          <div>
            <label className="cyber-label">{t('challenge.max_attempts')} (vazio = {t('challenge.unlimited')})</label>
            <input type="number" value={challengeForm.max_attempts} min={1}
              onChange={(e) => setChallengeForm({ ...challengeForm, max_attempts: e.target.value })} className="cyber-input" />
          </div>
          <div>
            <label className="cyber-label">{t('challenge.flag')} * (resposta correta)</label>
            <input type="text" value={challengeForm.flag}
              onChange={(e) => setChallengeForm({ ...challengeForm, flag: e.target.value })}
              className="cyber-input font-mono" placeholder="flag{...}" />
          </div>
          <div>
            <label className="cyber-label">O que aprendi neste desafio?</label>
            <textarea value={challengeForm.what_i_learned}
              onChange={(e) => setChallengeForm({ ...challengeForm, what_i_learned: e.target.value })}
              className="cyber-textarea" rows={3} placeholder="Ex: Aprendi sobre injeção SQL, como funciona e como prevenir..." />
          </div>
          <div>
            <label className="cyber-label">Onde aprender mais sobre isso?</label>
            <input type="url" value={challengeForm.learn_more_url}
              onChange={(e) => setChallengeForm({ ...challengeForm, learn_more_url: e.target.value })}
              className="cyber-input" placeholder="https://exemplo.com/artigo" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setChallengeModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleSaveChallenge} className="cyber-btn-primary">{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      {/* Hint Modal */}
      <Modal isOpen={hintModalOpen} onClose={() => { setHintModalOpen(false); setEditingHint(null); }} title={editingHint ? 'Editar Dica' : 'Adicionar Dica'}>
        <div className="space-y-4">
          <div>
            <label className="cyber-label">Desafio *</label>
            <select value={hintForm.challenge_id}
              onChange={(e) => setHintForm({ ...hintForm, challenge_id: e.target.value })} className="cyber-select">
              <option value="">Selecione um desafio</option>
              {challenges.map((c) => (
                <option key={c.id} value={c.id}>#{c.sequence_number} - {c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="cyber-label">Conteúdo da Dica *</label>
            <textarea value={hintForm.content}
              onChange={(e) => setHintForm({ ...hintForm, content: e.target.value })} className="cyber-textarea" rows={3} />
          </div>
          <div>
            <label className="cyber-label">{t('challenge.hint_cost')} (Shells 🐚) *</label>
            <input type="number" value={hintForm.shell_cost} min={0}
              onChange={(e) => setHintForm({ ...hintForm, shell_cost: parseInt(e.target.value) || 0 })} className="cyber-input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setHintModalOpen(false); setEditingHint(null); }} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleSaveHint} className="cyber-btn-primary">{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      {/* Congratulations Modal */}
      <Modal isOpen={showCongrats} onClose={() => setShowCongrats(false)} title="">
        <div className="text-center py-6 space-y-6">
          <div className="text-6xl animate-bounce">🏴</div>
          <div>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan via-cyber-purple to-cyber-green mb-2">
              Congratulations!!!
            </h2>
            <p className="text-lg text-gray-300">
              Você encontrou uma flag.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-cyber-green">
            <Flag size={20} />
            <span className="font-bold text-lg">+{lastSolvedPoints} pontos</span>
          </div>
          <button
            onClick={() => setShowCongrats(false)}
            className="cyber-btn-primary px-8 py-3 text-lg font-bold"
          >
            Prosseguir
          </button>
        </div>
      </Modal>
    </div>
  );
}
