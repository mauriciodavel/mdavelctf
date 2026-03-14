'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import BadgeDisplay from '@/components/BadgeDisplay';
import {
  User, Edit2, Save, X, Trophy, Target, CheckCircle, XCircle, Award, Zap,
  BookOpen, Shield, Calendar, BarChart3, PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { calculateXpProgress, CATEGORIES } from '@/lib/utils';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    course: '',
    class_group: '',
    department: '',
    avatar_url: '',
  });

  const [stats, setStats] = useState({
    totalSubmissions: 0,
    correct: 0,
    wrong: 0,
    totalPoints: 0,
    byCategory: {} as Record<string, { correct: number; total: number }>,
  });
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        course: profile.course || '',
        class_group: profile.class_group || '',
        department: profile.department || '',
        avatar_url: profile.avatar_url || '',
      });
      let cancelled = false;
      const load = async () => {
        try {
          await Promise.all([loadStats(cancelled), loadBadges(cancelled)]);
        } catch (err) {
          console.error('Profile data load error:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }
  }, [profile?.id]);

  const loadStats = async (cancelled = false) => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: submissions, error } = await supabase.from('submissions')
        .select('is_correct, points_awarded, challenges(category)')
        .eq('user_id', profile.id);
      if (error) console.error('Profile stats query error:', error.message);
      if (cancelled) return;

      const s = { totalSubmissions: 0, correct: 0, wrong: 0, totalPoints: 0, byCategory: {} as any };
      (submissions || []).forEach((sub: any) => {
        s.totalSubmissions++;
        if (sub.is_correct) {
          s.correct++;
          s.totalPoints += sub.points_awarded || 0;
        } else {
          s.wrong++;
        }
        const cat = sub.challenges?.category || 'other';
        if (!s.byCategory[cat]) s.byCategory[cat] = { correct: 0, total: 0 };
        s.byCategory[cat].total++;
        if (sub.is_correct) s.byCategory[cat].correct++;
      });
      setStats(s);
    } catch (err) {
      console.error('loadStats exception:', err);
    }
  };

  const loadBadges = async (cancelled = false) => {
    if (!profile) return;
    try {
      const { data, error } = await supabase.from('user_badges')
        .select('*, badges(*)').eq('user_id', profile.id).order('earned_at', { ascending: false });
      if (error) console.error('Profile badges query error:', error.message);
      if (!cancelled) setBadges((data || []).map((ub: any) => ub.badges));
    } catch (err) {
      console.error('loadBadges exception:', err);
    }
  };

  const handleSave = async () => {
    const { error } = await supabase.from('profiles')
      .update({
        display_name: form.display_name,
        bio: form.bio,
        course: form.course,
        class_group: form.class_group,
        department: form.department,
        avatar_url: form.avatar_url,
      }).eq('id', profile?.id);

    if (error) { toast.error(error.message); return; }

    await refreshProfile();
    toast.success(t('profile.updated'));
    setEditing(false);
  };

  if (!profile) return null;

  const xp = calculateXpProgress(profile.xp_points);
  const accuracy = stats.totalSubmissions > 0 ? Math.round((stats.correct / stats.totalSubmissions) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Header */}
      <div className="cyber-card-glow bg-gradient-to-r from-cyber-cyan/10 via-transparent to-cyber-purple/10">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center text-3xl font-bold text-white shrink-0 shadow-lg shadow-cyber-cyan/20">
            {profile.display_name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white truncate">{profile.display_name}</h1>
              <span className="cyber-badge bg-cyber-purple/20 text-cyber-purple shrink-0">
                <Shield size={10} className="mr-1" />
                {profile.role === 'super_admin' ? 'Super Admin' :
                 profile.role === 'admin' ? 'Admin' :
                 profile.role === 'instructor' ? t('common.instructor') : t('common.competitor')}
              </span>
            </div>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <p className="text-xs text-gray-600 mt-1">
              <Calendar size={10} className="inline mr-1" />
              {t('profile.joined')} {new Date(profile.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <button onClick={() => setEditing(!editing)}
            className={`cyber-btn-${editing ? 'danger' : 'secondary'} flex items-center gap-2 text-sm shrink-0`}>
            {editing ? <><X size={14} /> {t('common.cancel')}</> : <><Edit2 size={14} /> {t('profile.edit')}</>}
          </button>
        </div>

        {/* XP Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-cyber-cyan font-semibold flex items-center gap-1">
              <Zap size={14} /> {t('profile.level')} {profile.level}
            </span>
            <span className="text-gray-500">{profile.xp_points} / {xp.needed} XP</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-purple rounded-full transition-all duration-500"
              style={{ width: `${xp.percent}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-600">{xp.percent.toFixed(0)}%</span>
            <span className="text-xs text-gray-600">🐚 {profile.shells} Shells</span>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="cyber-card animate-slide-in space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Edit2 size={18} className="text-cyber-cyan" /> {t('profile.edit')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">{t('profile.display_name')}</label>
              <input type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('profile.avatar_url')}</label>
              <input type="url" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('profile.course')}</label>
              <input type="text" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}
                className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('profile.class_group')}</label>
              <input type="text" value={form.class_group} onChange={(e) => setForm({ ...form, class_group: e.target.value })}
                className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('profile.department')}</label>
              <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="cyber-input" />
            </div>
          </div>
          <div>
            <label className="cyber-label">{t('profile.bio')}</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="cyber-textarea" rows={3} />
          </div>
          <div className="flex justify-end">
            <button onClick={handleSave} className="cyber-btn-primary flex items-center gap-2">
              <Save size={16} /> {t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cyber-card text-center">
          <Target className="mx-auto text-cyber-cyan mb-2" size={24} />
          <p className="text-2xl font-bold text-white">{stats.totalSubmissions}</p>
          <p className="text-xs text-gray-500">{t('profile.total_submissions')}</p>
        </div>
        <div className="cyber-card text-center">
          <CheckCircle className="mx-auto text-cyber-green mb-2" size={24} />
          <p className="text-2xl font-bold text-cyber-green">{stats.correct}</p>
          <p className="text-xs text-gray-500">{t('profile.correct')}</p>
        </div>
        <div className="cyber-card text-center">
          <XCircle className="mx-auto text-red-400 mb-2" size={24} />
          <p className="text-2xl font-bold text-red-400">{stats.wrong}</p>
          <p className="text-xs text-gray-500">{t('profile.wrong')}</p>
        </div>
        <div className="cyber-card text-center">
          <Trophy className="mx-auto text-amber-400 mb-2" size={24} />
          <p className="text-2xl font-bold text-amber-400">{stats.totalPoints}</p>
          <p className="text-xs text-gray-500">{t('profile.points_earned')}</p>
        </div>
      </div>

      {/* Accuracy */}
      <div className="cyber-card">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <PieChart className="text-cyber-purple" size={20} /> {t('profile.accuracy')}
        </h3>
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="url(#grad)" strokeWidth="3"
                strokeDasharray={`${accuracy}, 100`} strokeLinecap="round" />
              <defs>
                <linearGradient id="grad"><stop offset="0%" stopColor="#06b6d4" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">{accuracy}%</span>
          </div>
          <div className="text-sm text-gray-400">
            <p>{stats.correct} {t('profile.correct').toLowerCase()} de {stats.totalSubmissions} {t('profile.total_submissions').toLowerCase()}</p>
          </div>
        </div>
      </div>

      {/* By Category */}
      {Object.keys(stats.byCategory).length > 0 && (
        <div className="cyber-card">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="text-cyber-green" size={20} /> {t('profile.by_category')}
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byCategory).map(([cat, data]) => {
              const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 capitalize">{cat.replace(/_/g, ' ')}</span>
                    <span className="text-gray-500">{data.correct}/{data.total} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full">
                    <div className="h-full bg-gradient-to-r from-cyber-green to-cyber-cyan rounded-full transition-all"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="cyber-card">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Award className="text-amber-400" size={20} /> {t('profile.badges')} ({badges.length})
        </h3>
        {badges.length === 0 ? (
          <p className="text-gray-500 text-center py-4">{t('profile.no_badges')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {badges.map((badge: any) => (
              <BadgeDisplay key={badge.id} badge={badge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
