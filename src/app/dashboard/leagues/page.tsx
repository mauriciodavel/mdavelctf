'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { toDirectImageUrl } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import Modal from '@/components/Modal';
import { Trophy, Plus, Edit, Trash2, Copy, Search } from 'lucide-react';
import toast from 'react-hot-toast';

interface League {
  id: string;
  code: string;
  name: string;
  image_url: string | null;
  event_codes: string;
  created_by: string;
  created_at: string;
}

export default function LeaguesPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({ name: '', image_url: '', event_codes: '' });

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

  const loadLeagues = async (cancelled = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('leagues').select('*').order('created_at', { ascending: false });
      if (error) console.error('Leagues query error:', error.message);
      if (!cancelled) setLeagues(data || []);
    } catch (err) {
      console.error('loadLeagues exception:', err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

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

  const handleEdit = (league: League) => {
    setEditingLeague(league);
    setForm({ name: league.name, image_url: league.image_url || '', event_codes: league.event_codes || '' });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    const { error } = await supabase.from('leagues').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Liga excluída!');
    await loadLeagues();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t('common.copied'));
  };

  const filtered = leagues.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  );

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
          {filtered.map((league) => (
            <div key={league.id} className="cyber-card-glow group">
              {league.image_url && (
                <img src={toDirectImageUrl(league.image_url)} alt={league.name}
                  className="w-full h-32 object-cover rounded-lg mb-4" />
              )}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{league.name}</h3>
                  <button onClick={() => copyCode(league.code)}
                    className="flex items-center gap-1 mt-1 text-sm text-cyber-cyan hover:text-cyber-cyan-light font-mono">
                    <Copy size={14} /> {league.code}
                  </button>
                </div>
                {canManage && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(league)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-cyber-cyan">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(league.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              {league.event_codes && (
                <p className="text-xs text-gray-500 mt-2">
                  Eventos: <span className="text-gray-400 font-mono">{league.event_codes}</span>
                </p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                {new Date(league.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}

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
