'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import { CATEGORIES, toDirectImageUrl } from '@/lib/utils';
import Modal from '@/components/Modal';
import {
  GraduationCap, Plus, Edit, Trash2, Copy, Search, Users, RefreshCw,
  Flag, ArrowRight, UserX, UserCheck, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ClassesPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [detailClass, setDetailClass] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [classEvents, setClassEvents] = useState<any[]>([]);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const emptyForm = { name: '', description: '', image_url: '', tag: 'Tecnologia da Informação', custom_tag: '' };
  const [form, setForm] = useState(emptyForm);

  const canCreate = ['super_admin', 'admin', 'instructor'].includes(profile?.role || '');
  const isCompetitor = profile?.role === 'competitor';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profile) return;
      try {
        await loadClasses(cancelled);
      } catch (err) {
        console.error('Classes load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const loadClasses = async (cancelled = false) => {
    if (!profile) return;
    setLoading(true);
    try {
      if (canCreate) {
        if (profile.role === 'super_admin' || profile.role === 'admin') {
          const { data: allClasses, error } = await supabase.from('classes').select('*').order('created_at', { ascending: false });
          if (error) console.error('Classes query error:', error.message);
          if (!cancelled) setClasses(allClasses || []);
        } else {
          const { data, error } = await supabase.from('classes').select('*')
            .or(`instructor_id.eq.${profile.id}`)
            .order('created_at', { ascending: false });
          if (error) console.error('Classes query error:', error.message);
          if (!cancelled) setClasses(data || []);
        }
      } else {
        // Competitor: show enrolled classes
        const { data: memberData, error } = await supabase.from('class_members')
          .select('class_id, classes(*)').eq('user_id', profile.id).eq('status', 'active');
        if (error) console.error('Class members query error:', error.message);
        if (!cancelled) setClasses((memberData || []).map((m: any) => m.classes));
      }
    } catch (err) {
      console.error('loadClasses exception:', err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }

    const payload = {
      name: form.name,
      description: form.description,
      image_url: form.image_url || null,
      tag: form.tag,
      custom_tag: form.tag === 'Customizar Tipo' ? form.custom_tag : null,
      updated_at: new Date().toISOString(),
    };

    if (editingClass) {
      const { error } = await supabase.from('classes').update(payload).eq('id', editingClass.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Turma atualizada!');
    } else {
      const { error } = await supabase.from('classes')
        .insert({ ...payload, instructor_id: profile?.id });
      if (error) { toast.error(error.message); return; }
      toast.success('Turma criada!');
    }
    setModalOpen(false);
    setEditingClass(null);
    setForm(emptyForm);
    await loadClasses();
  };

  const handleJoinClass = async () => {
    if (!joinCode.trim()) { toast.error('Informe o código da turma'); return; }
    const { data: cls } = await supabase.from('classes').select('id').eq('code', joinCode.toUpperCase()).single();
    if (!cls) { toast.error('Turma não encontrada'); return; }

    const { error } = await supabase.from('class_members')
      .insert({ class_id: cls.id, user_id: profile?.id });
    if (error) {
      if (error.code === '23505') toast.error('Você já está nesta turma');
      else toast.error(error.message);
      return;
    }
    toast.success('Ingressou na turma!');
    setJoinModalOpen(false);
    setJoinCode('');
    await loadClasses();
  };

  const handleRegenerateCode = async (classId: string) => {
    const { data, error } = await supabase.rpc('regenerate_class_code', { p_class_id: classId });
    if (error) { toast.error(error.message); return; }
    toast.success(`Novo código: ${data}`);
    await loadClasses();
    if (detailClass?.id === classId) loadClassDetails(classId);
  };

  const loadClassDetails = async (classId: string) => {
    const { data: cls } = await supabase.from('classes').select('*').eq('id', classId).single();
    setDetailClass(cls);

    const { data: mems } = await supabase.from('class_members')
      .select('*, profiles(display_name, email, role)').eq('class_id', classId).order('joined_at');
    setMembers(mems || []);

    const { data: evts } = await supabase.from('events').select('*').eq('class_id', classId);
    setClassEvents(evts || []);
  };

  const handleMemberAction = async (memberId: string, action: 'inactive' | 'removed') => {
    const { error } = await supabase.from('class_members')
      .update({ status: action === 'removed' ? 'removed' : 'inactive' })
      .eq('id', memberId);
    if (error) { toast.error(error.message); return; }
    toast.success(action === 'removed' ? 'Membro removido!' : 'Membro inativado!');
    loadClassDetails(detailClass.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Turma excluída!');
    await loadClasses();
  };

  const filtered = classes.filter(c => c &&
    (c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase()))
  );

  // Detail view
  if (detailClass) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => setDetailClass(null)}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white">
            <GraduationCap size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{detailClass.name}</h1>
            <p className="text-sm text-gray-500">{detailClass.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { navigator.clipboard.writeText(detailClass.code); toast.success(t('common.copied')); }}
              className="flex items-center gap-1 text-sm font-mono text-cyber-cyan cyber-btn-secondary">
              <Copy size={14} /> {detailClass.code}
            </button>
            {canCreate && (
              <button onClick={() => handleRegenerateCode(detailClass.id)}
                className="cyber-btn-secondary flex items-center gap-1 text-sm">
                <RefreshCw size={14} /> {t('class.regenerate_code')}
              </button>
            )}
          </div>
        </div>

        {/* Class Details */}
        <div className="cyber-card">
          <h3 className="font-bold text-cyber-cyan mb-3">{t('class.details')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">TAG:</span> <span className="text-gray-300">{detailClass.tag}</span></div>
            <div><span className="text-gray-500">Código:</span> <span className="text-cyber-cyan font-mono">{detailClass.code}</span></div>
            <div><span className="text-gray-500">Membros:</span> <span className="text-gray-300">{members.filter(m => m.status === 'active').length}</span></div>
            <div><span className="text-gray-500">Eventos:</span> <span className="text-gray-300">{classEvents.length}</span></div>
          </div>
        </div>

        {/* Members */}
        <div className="cyber-card">
          <h3 className="font-bold text-cyber-purple mb-4 flex items-center gap-2">
            <Users size={18} /> {t('class.members')} ({members.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-cyber-border">
                  <th className="pb-3">Nome</th>
                  <th className="pb-3">E-mail</th>
                  <th className="pb-3">{t('common.status')}</th>
                  <th className="pb-3">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.id} className="border-b border-cyber-border/50 hover:bg-white/5">
                    <td className="py-3 text-gray-200">{m.profiles?.display_name}</td>
                    <td className="py-3 text-gray-400">{m.profiles?.email}</td>
                    <td className="py-3">
                      <span className={`cyber-badge ${
                        m.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        m.status === 'inactive' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {canCreate && m.status === 'active' && (
                        <div className="flex gap-1">
                          <button onClick={() => handleMemberAction(m.id, 'inactive')}
                            className="cyber-btn text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2 py-1">
                            {t('class.inactivate')}
                          </button>
                          <button onClick={() => handleMemberAction(m.id, 'removed')}
                            className="cyber-btn text-xs bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-1">
                            {t('class.remove')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Class Events */}
        <div className="cyber-card">
          <h3 className="font-bold text-cyber-green mb-4 flex items-center gap-2">
            <Flag size={18} /> {t('class.events')} ({classEvents.length})
          </h3>
          {classEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum evento vinculado a esta turma.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {classEvents.map((event: any) => (
                <Link key={event.id} href={`/dashboard/events/${event.id}`}
                  className="p-4 rounded-lg bg-white/5 border border-cyber-border hover:border-cyber-cyan/30 transition-colors">
                  <h4 className="font-semibold text-gray-200">{event.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{event.category}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="text-cyber-cyan" size={28} /> {t('nav.classes')}
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')} className="cyber-input pl-9 py-2 text-sm" />
          </div>
          {isCompetitor && (
            <button onClick={() => setJoinModalOpen(true)}
              className="cyber-btn-success flex items-center gap-2 whitespace-nowrap">
              <UserCheck size={16} /> {t('class.join')}
            </button>
          )}
          {canCreate && (
            <button onClick={() => { setEditingClass(null); setForm(emptyForm); setModalOpen(true); }}
              className="cyber-btn-primary flex items-center gap-2 whitespace-nowrap">
              <Plus size={16} /> {t('class.create')}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="cyber-card text-center py-12">
          <GraduationCap size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">{t('class.no_classes')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cls: any) => (
            <div key={cls.id} className="cyber-card-glow group">
              {cls.image_url && (
                <img src={toDirectImageUrl(cls.image_url)} alt={cls.name} className="w-full h-32 object-cover rounded-lg mb-4" />
              )}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <span className="cyber-badge bg-cyber-purple/20 text-cyber-purple-light text-xs mb-1">{cls.tag}</span>
                  <h3 className="text-lg font-bold text-white truncate">{cls.name}</h3>
                  <p className="text-sm text-gray-400 line-clamp-2 mt-1">{cls.description}</p>
                </div>
                {canCreate && cls.instructor_id === profile?.id && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => {
                      setEditingClass(cls);
                      setForm({ name: cls.name, description: cls.description || '', image_url: cls.image_url || '', tag: cls.tag, custom_tag: cls.custom_tag || '' });
                      setModalOpen(true);
                    }} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-cyber-cyan">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(cls.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => { navigator.clipboard.writeText(cls.code); toast.success(t('common.copied')); }}
                  className="flex items-center gap-1 text-sm text-cyber-cyan hover:text-cyber-cyan-light font-mono">
                  <Copy size={14} /> {cls.code}
                </button>
                <button onClick={() => loadClassDetails(cls.id)}
                  className="cyber-btn-secondary text-xs flex items-center gap-1">
                  <Eye size={14} /> {t('common.view')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Class Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editingClass ? t('class.edit') : t('class.create')}>
        <div className="space-y-4">
          <div>
            <label className="cyber-label">{t('class.name')} *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="cyber-input" />
          </div>
          <div>
            <label className="cyber-label">{t('class.description')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="cyber-textarea" rows={3} />
          </div>
          <div>
            <label className="cyber-label">{t('class.tag')}</label>
            <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} className="cyber-select">
              {CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
          </div>
          {form.tag === 'Customizar Tipo' && (
            <div>
              <label className="cyber-label">Tipo Customizado</label>
              <input type="text" value={form.custom_tag} onChange={(e) => setForm({ ...form, custom_tag: e.target.value })} className="cyber-input" />
            </div>
          )}
          <div>
            <label className="cyber-label">{t('common.image_url')} ({t('common.optional')})</label>
            <input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="cyber-input" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleSave} className="cyber-btn-primary">{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      {/* Join Class Modal */}
      <Modal isOpen={joinModalOpen} onClose={() => setJoinModalOpen(false)} title={t('class.join')}>
        <div className="space-y-4">
          <div>
            <label className="cyber-label">{t('class.join_code')}</label>
            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="cyber-input font-mono text-center text-2xl tracking-widest" maxLength={6} placeholder="ABC123" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setJoinModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleJoinClass} className="cyber-btn-primary">{t('class.join')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
