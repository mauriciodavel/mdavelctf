'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import Modal from '@/components/Modal';
import BadgeDisplay from '@/components/BadgeDisplay';
import { Award, Plus, Edit2, Trash2, Search, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { RARITIES, RARITY_COLORS } from '@/lib/utils';

export default function BadgesPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [badges, setBadges] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<any>(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    name: '', criteria_key: '', icon: '🏆', rarity: 'comum' as string, reward: 0, description: '',
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profile) return;
      try {
        await loadBadges(cancelled);
      } catch (err) {
        console.error('Badges load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const loadBadges = async (cancelled = false) => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('badges').select('*').order('rarity');
      if (error) { console.error('Badges query error:', error.message); }
      if (cancelled) return;
      setBadges(data || []);

      // Load user's earned badges
      const { data: earned, error: earnedErr } = await supabase.from('user_badges')
        .select('badge_id').eq('user_id', profile.id);
      if (earnedErr) { console.error('User badges query error:', earnedErr.message); }
      if (cancelled) return;
      setUserBadges(new Set((earned || []).map((ub: any) => ub.badge_id)));
    } catch (err) {
      console.error('loadBadges exception:', err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }

    if (editingBadge) {
      const { error } = await supabase.from('badges').update(form).eq('id', editingBadge.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Badge atualizado!');
    } else {
      const { error } = await supabase.from('badges').insert(form);
      if (error) { toast.error(error.message); return; }
      toast.success('Badge criado!');
    }
    setModalOpen(false);
    setEditingBadge(null);
    await loadBadges();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este badge?')) return;
    await supabase.from('badges').delete().eq('id', id);
    toast.success('Badge excluído');
    await loadBadges();
  };

  const openEdit = (badge: any) => {
    setEditingBadge(badge);
    setForm({
      name: badge.name, criteria_key: badge.criteria_key || '', icon: badge.icon || '🏆',
      rarity: badge.rarity, reward: badge.reward || 0, description: badge.description || '',
    });
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingBadge(null);
    setForm({ name: '', criteria_key: '', icon: '🏆', rarity: 'comum', reward: 0, description: '' });
    setModalOpen(true);
  };

  const filtered = badges.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const grouped = {
    lendario: filtered.filter(b => b.rarity === 'lendario'),
    epico: filtered.filter(b => b.rarity === 'epico'),
    cru: filtered.filter(b => b.rarity === 'cru'),
    comum: filtered.filter(b => b.rarity === 'comum'),
  };

  const rarityLabels: Record<string, string> = {
    lendario: '🌟 Lendário',
    epico: '💎 Épico',
    cru: '🔷 Cru',
    comum: '⚪ Comum',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Award className="text-amber-400" size={28} /> {t('nav.badges')}
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')} className="cyber-input pl-9 py-2 text-sm" />
          </div>
          {isAdmin && (
            <button onClick={openCreate} className="cyber-btn-primary flex items-center gap-2 text-sm whitespace-nowrap">
              <Plus size={16} /> {t('badge.create')}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="cyber-card bg-gradient-to-r from-amber-500/10 to-orange-500/10">
        <div className="flex items-center gap-4">
          <Star className="text-amber-400" size={24} />
          <div>
            <p className="text-white font-bold">{userBadges.size} / {badges.length} {t('badge.earned')}</p>
            <p className="text-sm text-gray-500">{t('badge.collect_all')}</p>
          </div>
          <div className="ml-auto">
            <div className="w-32 h-2 bg-white/10 rounded-full">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                style={{ width: `${badges.length > 0 ? (userBadges.size / badges.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="cyber-card text-center py-12">
          <Award size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">{t('badge.no_badges')}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([rarity, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={rarity}>
              <h2 className="text-lg font-bold mb-3" style={{ color: RARITY_COLORS[rarity] }}>
                {rarityLabels[rarity]} ({items.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {items.map((badge: any) => {
                  const earned = userBadges.has(badge.id);
                  return (
                    <div key={badge.id} className={`relative ${!earned ? 'opacity-50 grayscale' : ''}`}>
                      <BadgeDisplay badge={badge} />
                      {earned && (
                        <div className="absolute top-2 right-2 bg-cyber-green/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          ✓
                        </div>
                      )}
                      {badge.reward > 0 && (
                        <div className="text-center mt-1">
                          <span className="text-xs text-gray-500">🐚 +{badge.reward}</span>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex justify-center gap-1 mt-1">
                          <button onClick={() => openEdit(badge)} className="text-gray-500 hover:text-cyber-cyan p-1">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => handleDelete(badge.id)} className="text-gray-500 hover:text-red-400 p-1">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingBadge ? t('badge.edit') : t('badge.create')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">{t('badge.name')} *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="cyber-input" />
            </div>
            <div>
              <label className="cyber-label">{t('badge.icon')}</label>
              <input type="text" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="cyber-input text-center text-2xl" />
            </div>
          </div>
          <div>
            <label className="cyber-label">{t('badge.criteria_key')}</label>
            <input type="text" value={form.criteria_key} onChange={(e) => setForm({ ...form, criteria_key: e.target.value })}
              className="cyber-input" placeholder="ex: first_blood, 10_challenges, etc." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">{t('badge.rarity')}</label>
              <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })} className="cyber-select">
                {RARITIES.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="cyber-label">{t('badge.reward')} (Shells 🐚)</label>
              <input type="number" value={form.reward} onChange={(e) => setForm({ ...form, reward: parseInt(e.target.value) || 0 })}
                className="cyber-input" min={0} />
            </div>
          </div>
          <div>
            <label className="cyber-label">{t('badge.description')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="cyber-textarea" rows={3} />
          </div>

          {/* Preview */}
          <div className="border border-cyber-border rounded-lg p-4 bg-cyber-darker/50">
            <p className="text-xs text-gray-500 mb-2">Preview:</p>
            <div className="flex justify-center">
              <BadgeDisplay badge={{ name: form.name, rarity: form.rarity, description: form.description, icon: form.icon }} />
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
