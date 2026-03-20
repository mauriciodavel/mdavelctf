'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import { Trophy, Medal, Target, Users, Filter, ChevronDown, Crown, Zap, Award, Lightbulb, Clock } from 'lucide-react';

interface ScoreEntry {
  position: number;
  id: string;
  name: string;
  avatar_url?: string;
  score: number;
  correct: number;
  totalChallenges: number;
  accuracy: number;
  level: number;
  hintCount: number;
  lastSolveTime: string | null;
}

export default function ScoreboardPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();

  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);

  const [filterMode, setFilterMode] = useState<'individual' | 'team'>('individual');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [filterLeague, setFilterLeague] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadFilters(cancelled);
      } catch (err) {
        console.error('Scoreboard filters error:', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadScoreboard(cancelled);
      } catch (err) {
        console.error('Scoreboard load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filterMode, filterEvent, filterLeague]);

  const loadFilters = async (cancelled = false) => {
    try {
      const [{ data: evts }, { data: lgs }] = await Promise.all([
        supabase.from('events').select('id, name, start_date, end_date').order('start_date', { ascending: false }),
        supabase.from('leagues').select('id, name')
      ]);
      if (!cancelled) {
        setEvents(evts || []);
        setLeagues(lgs || []);
      }
    } catch (err) {
      console.error('loadFilters exception:', err);
    }
  };

  const getEventStatus = (ev: any) => {
    const now = new Date();
    if (now < new Date(ev.start_date)) return 'scheduled';
    if (now > new Date(ev.end_date)) return 'finished';
    return 'live';
  };

  const loadScoreboard = async (cancelled = false) => {
    setLoading(true);
    try {
      // Step 1: Determine relevant challenges based on filters
      let relevantEventIds: Set<string> | null = null;

      if (filterLeague !== 'all') {
        const { data: leData } = await supabase.from('league_events')
          .select('event_id').eq('league_id', filterLeague);
        relevantEventIds = new Set((leData || []).map((le: any) => le.event_id));
      }

      let challengeQuery;
      if (filterEvent !== 'all') {
        challengeQuery = supabase.from('challenges')
          .select('id, points, mission_id, missions!inner(event_id)')
          .eq('missions.event_id', filterEvent);
      } else {
        challengeQuery = supabase.from('challenges')
          .select('id, points, mission_id, missions(event_id)');
      }

      const { data: challengeData } = await challengeQuery;

      const filteredChallenges = (challengeData || []).filter((c: any) => {
        if (relevantEventIds) {
          const eventId = c.missions?.event_id;
          return eventId && relevantEventIds.has(eventId);
        }
        return true;
      });

      const relevantChallengeIds = filteredChallenges.map((c: any) => c.id);
      const totalChallenges = relevantChallengeIds.length;

      if (relevantChallengeIds.length === 0) {
        if (!cancelled) setEntries([]);
        return;
      }

      // Step 2: Get ALL submissions for those challenges (batched)
      const batchSize = 100;
      let allSubmissions: any[] = [];
      for (let i = 0; i < relevantChallengeIds.length; i += batchSize) {
        const batch = relevantChallengeIds.slice(i, i + batchSize);
        const { data } = await supabase.from('submissions')
          .select('user_id, challenge_id, is_correct, points_awarded, submitted_at, team_id')
          .in('challenge_id', batch);
        allSubmissions = allSubmissions.concat(data || []);
      }

      // Step 3: Get hint usage for ranking (fewer hints = better rank)
      let allHintIds: string[] = [];
      for (let i = 0; i < relevantChallengeIds.length; i += batchSize) {
        const batch = relevantChallengeIds.slice(i, i + batchSize);
        const { data: hintData } = await supabase.from('hints')
          .select('id').in('challenge_id', batch);
        allHintIds = allHintIds.concat((hintData || []).map((h: any) => h.id));
      }

      let allHintUsage: any[] = [];
      if (allHintIds.length > 0) {
        for (let i = 0; i < allHintIds.length; i += batchSize) {
          const batch = allHintIds.slice(i, i + batchSize);
          const { data } = await supabase.from('hint_usage')
            .select('user_id, hint_id').in('hint_id', batch);
          allHintUsage = allHintUsage.concat(data || []);
        }
      }

      const userHintCount: Record<string, number> = {};
      allHintUsage.forEach((hu: any) => {
        userHintCount[hu.user_id] = (userHintCount[hu.user_id] || 0) + 1;
      });

      if (filterMode === 'individual') {
        // Aggregate by user
        const userMap: Record<string, { score: number; correct: number; totalSubs: number; lastSolveTime: string | null }> = {};
        allSubmissions.forEach((s: any) => {
          if (!userMap[s.user_id]) userMap[s.user_id] = { score: 0, correct: 0, totalSubs: 0, lastSolveTime: null };
          userMap[s.user_id].totalSubs++;
          if (s.is_correct) {
            userMap[s.user_id].correct++;
            userMap[s.user_id].score += s.points_awarded || 0;
            const last = userMap[s.user_id].lastSolveTime;
            if (!last || s.submitted_at > last) {
              userMap[s.user_id].lastSolveTime = s.submitted_at;
            }
          }
        });

        const userIds = Object.keys(userMap);
        const profileMap: Record<string, any> = {};
        if (userIds.length > 0) {
          for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);
            const { data: profiles } = await supabase.from('profiles')
              .select('id, display_name, avatar_url, level').in('id', batch);
            (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
          }
        }

        const result: ScoreEntry[] = userIds.map(uid => ({
          position: 0,
          id: uid,
          name: profileMap[uid]?.display_name || 'Desconhecido',
          avatar_url: profileMap[uid]?.avatar_url,
          score: userMap[uid].score,
          correct: userMap[uid].correct,
          totalChallenges,
          accuracy: userMap[uid].totalSubs > 0 ? Math.round((userMap[uid].correct / userMap[uid].totalSubs) * 100) : 0,
          level: profileMap[uid]?.level || 1,
          hintCount: userHintCount[uid] || 0,
          lastSolveTime: userMap[uid].lastSolveTime,
        }));

        // Sort: 1) Score DESC, 2) Hints ASC (less = better), 3) Last solve time ASC (earlier = better)
        result.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.hintCount !== b.hintCount) return a.hintCount - b.hintCount;
          if (a.lastSolveTime && b.lastSolveTime) return a.lastSolveTime.localeCompare(b.lastSolveTime);
          if (a.lastSolveTime) return -1;
          if (b.lastSolveTime) return 1;
          return 0;
        });

        result.forEach((e, i) => { e.position = i + 1; });
        if (!cancelled) setEntries(result);

      } else {
        // Team mode
        const { data: teamMembers } = await supabase.from('team_members')
          .select('team_id, user_id, teams(name, image_url)');

        const teamMap: Record<string, { name: string; users: Set<string> }> = {};
        (teamMembers || []).forEach((tm: any) => {
          if (!teamMap[tm.team_id]) {
            teamMap[tm.team_id] = { name: tm.teams?.name || 'Equipe', users: new Set() };
          }
          teamMap[tm.team_id].users.add(tm.user_id);
        });

        // Aggregate submissions by team
        const teamAgg: Record<string, { score: number; correct: number; totalSubs: number; lastSolveTime: string | null; solved: Set<string> }> = {};
        allSubmissions.forEach((s: any) => {
          let teamId = s.team_id;
          if (!teamId) {
            for (const [tid, tinfo] of Object.entries(teamMap)) {
              if (tinfo.users.has(s.user_id)) { teamId = tid; break; }
            }
          }
          if (!teamId) return;

          if (!teamAgg[teamId]) {
            teamAgg[teamId] = { score: 0, correct: 0, totalSubs: 0, lastSolveTime: null, solved: new Set() };
          }
          teamAgg[teamId].totalSubs++;
          if (s.is_correct && !teamAgg[teamId].solved.has(s.challenge_id)) {
            teamAgg[teamId].solved.add(s.challenge_id);
            teamAgg[teamId].correct++;
            teamAgg[teamId].score += s.points_awarded || 0;
            const last = teamAgg[teamId].lastSolveTime;
            if (!last || s.submitted_at > last) {
              teamAgg[teamId].lastSolveTime = s.submitted_at;
            }
          }
        });

        // Team hint counts = sum of all members' hints
        const teamHintCount: Record<string, number> = {};
        for (const [teamId, tinfo] of Object.entries(teamMap)) {
          let count = 0;
          tinfo.users.forEach(uid => { count += (userHintCount[uid] || 0); });
          teamHintCount[teamId] = count;
        }

        const teamIds = [...new Set([...Object.keys(teamMap), ...Object.keys(teamAgg)])];

        const result: ScoreEntry[] = teamIds
          .filter(tid => teamAgg[tid])
          .map(tid => {
            const ta = teamAgg[tid];
            return {
              position: 0,
              id: tid,
              name: teamMap[tid]?.name || 'Equipe',
              score: ta.score,
              correct: ta.correct,
              totalChallenges,
              accuracy: ta.totalSubs > 0 ? Math.round((ta.correct / ta.totalSubs) * 100) : 0,
              level: 0,
              hintCount: teamHintCount[tid] || 0,
              lastSolveTime: ta.lastSolveTime,
            };
          });

        // Sort: 1) Score DESC, 2) Hints ASC, 3) Last solve time ASC
        result.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.hintCount !== b.hintCount) return a.hintCount - b.hintCount;
          if (a.lastSolveTime && b.lastSolveTime) return a.lastSolveTime.localeCompare(b.lastSolveTime);
          if (a.lastSolveTime) return -1;
          if (b.lastSolveTime) return 1;
          return 0;
        });

        result.forEach((e, i) => { e.position = i + 1; });
        if (!cancelled) setEntries(result);
      }
    } catch (err) {
      console.error('loadScoreboard exception:', err);
    }
  };

  const getPositionStyle = (pos: number) => {
    if (pos === 1) return 'text-amber-400';
    if (pos === 2) return 'text-gray-300';
    if (pos === 3) return 'text-orange-400';
    return 'text-gray-500';
  };

  const getPositionIcon = (pos: number) => {
    if (pos === 1) return <Crown className="text-amber-400" size={20} />;
    if (pos === 2) return <Medal className="text-gray-300" size={20} />;
    if (pos === 3) return <Award className="text-orange-400" size={20} />;
    return <span className="text-gray-500 font-mono text-sm w-5 text-center">{pos}</span>;
  };

  const myEntry = entries.find(e => e.id === profile?.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-amber-400" size={28} /> {t('nav.scoreboard')}
        </h1>
        <button onClick={() => setShowFilters(!showFilters)}
          className="cyber-btn-secondary flex items-center gap-2 text-sm">
          <Filter size={16} /> {t('scoreboard.filters')}
          <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="cyber-card space-y-4 animate-slide-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="cyber-label">{t('scoreboard.mode')}</label>
              <div className="flex gap-2">
                <button onClick={() => setFilterMode('individual')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterMode === 'individual' ? 'bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40' : 'bg-white/5 text-gray-400 border border-cyber-border'
                  }`}>
                  <Target size={14} className="inline mr-1" /> {t('scoreboard.individual')}
                </button>
                <button onClick={() => setFilterMode('team')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterMode === 'team' ? 'bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40' : 'bg-white/5 text-gray-400 border border-cyber-border'
                  }`}>
                  <Users size={14} className="inline mr-1" /> {t('scoreboard.teams')}
                </button>
              </div>
            </div>
            <div>
              <label className="cyber-label">{t('scoreboard.event')}</label>
              <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)} className="cyber-select">
                <option value="all">{t('scoreboard.all_events')}</option>
                {events.map(ev => {
                  const status = getEventStatus(ev);
                  return (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} {status === 'live' ? '🟢' : status === 'scheduled' ? '🔵' : '⚫'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="cyber-label">{t('scoreboard.league')}</label>
              <select value={filterLeague} onChange={(e) => setFilterLeague(e.target.value)} className="cyber-select">
                <option value="all">{t('scoreboard.all_leagues')}</option>
                {leagues.map(lg => (
                  <option key={lg.id} value={lg.id}>{lg.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* My Position highlight */}
      {myEntry && filterMode === 'individual' && (
        <div className="cyber-card-glow bg-gradient-to-r from-cyber-cyan/10 to-cyber-purple/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getPositionIcon(myEntry.position)}
              <div>
                <p className="font-bold text-white">{t('scoreboard.your_position')}</p>
                <p className="text-sm text-gray-400">#{myEntry.position} de {entries.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-cyber-cyan font-bold text-lg">{myEntry.score}</p>
                <p className="text-gray-500 text-xs">{t('scoreboard.score')}</p>
              </div>
              <div className="text-center">
                <p className="text-cyber-green font-bold text-lg">{myEntry.accuracy}%</p>
                <p className="text-gray-500 text-xs">{t('scoreboard.accuracy')}</p>
              </div>
              <div className="text-center">
                <p className="text-yellow-400 font-bold text-lg">{myEntry.hintCount}</p>
                <p className="text-gray-500 text-xs">Dicas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ranking Criteria Info */}
      <div className="cyber-card bg-cyber-darker/50 border-cyber-border/50 py-3 px-4">
        <p className="text-xs text-gray-400 text-center">
          {t('score.ranking_criteria')}
        </p>
      </div>

      {/* Scoreboard Table */}
      <div className="cyber-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cyber-border text-left">
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-16">#</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{filterMode === 'individual' ? t('scoreboard.player') : t('scoreboard.team')}</th>
                {filterMode === 'individual' && <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">Nível</th>}
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">{t('scoreboard.progress')}</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">{t('scoreboard.score')}</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">
                  <Lightbulb size={14} className="inline mr-1 text-yellow-400" />Dicas
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">{t('scoreboard.accuracy')}</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">
                  <Clock size={14} className="inline mr-1 text-cyber-cyan" />{t('score.last_flag')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={filterMode === 'individual' ? 8 : 7} className="text-center py-8 text-gray-500">{t('common.loading')}</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={filterMode === 'individual' ? 8 : 7} className="text-center py-8 text-gray-500">{t('scoreboard.no_data')}</td></tr>
              ) : entries.map((entry) => {
                const isMe = entry.id === profile?.id;
                return (
                  <tr key={entry.id} className={`border-b border-cyber-border/50 transition-colors hover:bg-white/5 ${
                    isMe ? 'bg-cyber-cyan/5' : ''
                  } ${entry.position <= 3 ? 'bg-gradient-to-r from-transparent' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        {getPositionIcon(entry.position)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center text-xs font-bold text-white">
                          {entry.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`font-medium ${isMe ? 'text-cyber-cyan' : 'text-white'}`}>
                          {entry.name} {isMe && <span className="text-xs text-cyber-cyan">(você)</span>}
                        </span>
                      </div>
                    </td>
                    {filterMode === 'individual' && (
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-cyber-purple">
                          <Zap size={12} /> {entry.level}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-4 text-center text-sm text-gray-300">
                      {entry.correct}/{entry.totalChallenges}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-bold ${getPositionStyle(entry.position)} ${entry.position > 3 ? 'text-white' : ''}`}>
                        {entry.score.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-sm font-medium ${entry.hintCount === 0 ? 'text-gray-500' : 'text-yellow-400'}`}>
                        {entry.hintCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-semibold ${
                          entry.accuracy >= 80 ? 'text-cyber-green' :
                          entry.accuracy >= 50 ? 'text-amber-400' : 'text-red-400'
                        }`}>{entry.accuracy}%</span>
                        <div className="w-16 h-1.5 bg-white/10 rounded-full mt-1">
                          <div className={`h-full rounded-full ${
                            entry.accuracy >= 80 ? 'bg-cyber-green' :
                            entry.accuracy >= 50 ? 'bg-amber-400' : 'bg-red-400'
                          }`} style={{ width: `${entry.accuracy}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {entry.lastSolveTime ? (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-300">
                            {new Date(entry.lastSolveTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {new Date(entry.lastSolveTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
