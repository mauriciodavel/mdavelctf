'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import { CATEGORIES, toDirectImageUrl } from '@/lib/utils';
import Modal from '@/components/Modal';
import {
  GraduationCap, Plus, Edit, Trash2, Copy, Search, Users, RefreshCw,
  Flag, UserCheck, Eye, Layers, Lock, Unlock, UserPlus, Check, Upload, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface CsvImportRow {
  email: string;
  display_name: string;
  password: string;
}

function parseCsvRows(content: string): CsvImportRow[] {
  const normalized = content.replace(/\uFEFF/g, '').trim();
  if (!normalized) return [];

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
  const emailIdx = headers.indexOf('email');
  const nameIdx = headers.indexOf('display_name');
  const passwordIdx = headers.indexOf('password');

  if (emailIdx < 0 || nameIdx < 0 || passwordIdx < 0) return [];

  const rows: CsvImportRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(delimiter).map((c) => c.trim());
    const email = cols[emailIdx] || '';
    const displayName = cols[nameIdx] || '';
    const password = cols[passwordIdx] || '';
    if (!email || !displayName || !password) continue;
    rows.push({ email, display_name: displayName, password });
  }

  return rows;
}

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

  // Groups state
  const [groups, setGroups] = useState<any[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', max_members: '', allow_self_enroll: true });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignGroup, setAssignGroup] = useState<any>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [openedGroup, setOpenedGroup] = useState<any>(null);
  const [openedGroupMembers, setOpenedGroupMembers] = useState<any[]>([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);

  // Multi-select enrollment
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [enrollSelected, setEnrollSelected] = useState<Set<string>>(new Set());
  const [enrollSearch, setEnrollSearch] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const emptyForm = { name: '', description: '', image_url: '', tag: 'Tecnologia da Informação', custom_tag: '' };
  const [form, setForm] = useState(emptyForm);

  const canCreate = ['super_admin', 'admin', 'instructor'].includes(profile?.role || '');
  const isCompetitor = profile?.role === 'competitor';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profile) return;
      try { await loadClasses(cancelled); }
      catch (err) { console.error('Classes load error:', err); }
      finally { if (!cancelled) setLoading(false); }
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
          const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false });
          if (!cancelled) setClasses(data || []);
        } else {
          const { data } = await supabase.from('classes').select('*')
            .eq('instructor_id', profile.id).order('created_at', { ascending: false });
          if (!cancelled) setClasses(data || []);
        }
      } else {
        const { data: memberData } = await supabase.from('class_members')
          .select('class_id, classes(*)').eq('user_id', profile.id).eq('status', 'active');
        if (!cancelled) setClasses((memberData || []).map((m: any) => m.classes).filter(Boolean));
      }
    } catch (err) { console.error('loadClasses exception:', err); }
    finally { if (!cancelled) setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    const payload = {
      name: form.name, description: form.description,
      image_url: form.image_url || null, tag: form.tag,
      custom_tag: form.tag === 'Customizar Tipo' ? form.custom_tag : null,
      updated_at: new Date().toISOString(),
    };
    if (editingClass) {
      const { error } = await supabase.from('classes').update(payload).eq('id', editingClass.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Turma atualizada!');
    } else {
      const { error } = await supabase.from('classes').insert({ ...payload, instructor_id: profile?.id });
      if (error) { toast.error(error.message); return; }
      toast.success('Turma criada!');
    }
    setModalOpen(false); setEditingClass(null); setForm(emptyForm);
    await loadClasses();
  };

  const handleJoinClass = async () => {
    if (!joinCode.trim()) { toast.error('Informe o código da turma'); return; }
    const { data: cls } = await supabase.from('classes').select('id').eq('code', joinCode.toUpperCase()).single();
    if (!cls) { toast.error('Turma não encontrada'); return; }
    const { error } = await supabase.from('class_members').insert({ class_id: cls.id, user_id: profile?.id });
    if (error) {
      if (error.code === '23505') toast.error('Você já está nesta turma');
      else toast.error(error.message);
      return;
    }
    toast.success('Ingressou na turma!');
    setJoinModalOpen(false); setJoinCode('');
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
      .select('*, profiles(id, display_name, email, role)').eq('class_id', classId).order('joined_at');
    setMembers(mems || []);
    const { data: evts } = await supabase.from('events').select('*').eq('class_id', classId);
    setClassEvents(evts || []);
    await loadGroups(classId);
  };

  const loadGroups = async (classId: string) => {
    const { data } = await supabase.from('class_groups')
      .select('*, class_group_members(count)').eq('class_id', classId).order('created_at');
    const list = data || [];
    setGroups(list);

    if (profile?.id && list.length > 0) {
      const groupIds = list.map((g: any) => g.id);
      const { data: myRows } = await supabase
        .from('class_group_members')
        .select('group_id')
        .eq('user_id', profile.id)
        .in('group_id', groupIds);
      setMyGroupIds(new Set((myRows || []).map((r: any) => r.group_id)));
    } else {
      setMyGroupIds(new Set());
    }

    if (openedGroup) {
      const refreshed = list.find((g: any) => g.id === openedGroup.id);
      if (refreshed) setOpenedGroup(refreshed);
      else {
        setOpenedGroup(null);
        setOpenedGroupMembers([]);
      }
    }
  };

  const loadOpenedGroupMembers = async (groupId: string) => {
    setGroupMembersLoading(true);
    try {
      console.log(`Carregando membros do grupo ${groupId}`);
      const { data, error } = await supabase
        .from('class_group_members')
        .select('id, user_id, joined_at, profiles(id, display_name, email)')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar membros:', error);
        toast.error('Erro ao carregar membros: ' + error.message);
        setOpenedGroupMembers([]);
      } else {
        console.log(`Carregados ${(data || []).length} membros do grupo`);
        setOpenedGroupMembers(data || []);
      }
    } catch (err: any) {
      console.error('Exception ao carregar membros:', err);
      toast.error('Erro ao carregar membros do grupo');
      setOpenedGroupMembers([]);
    } finally {
      setGroupMembersLoading(false);
    }
  };

  const openGroupAccess = async (group: any) => {
    try {
      const canManage = isInstructorOfClass(detailClass);
      const canAccess = canManage || myGroupIds.has(group.id);
      
      if (!group?.id) {
        console.error('Grupo sem ID:', group);
        toast.error('Erro: Grupo não identificado');
        return;
      }
      
      if (!canAccess) {
        console.warn(`Acesso negado ao grupo ${group.id} para user ${profile?.id}`);
        toast.error('Você não participa deste grupo');
        return;
      }
      
      console.log(`Acessando grupo ${group.id}:`, group);
      setOpenedGroup(group);
      await loadOpenedGroupMembers(group.id);
      
      // Scroll to group panel after short delay to ensure it's rendered
      setTimeout(() => {
        const groupElement = document.getElementById(`group-panel-${group.id}`);
        if (groupElement) {
          groupElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          console.log('Grupo painel scrolled into view');
        }
      }, 100);
      
      toast.success(`Grupo ${group.name} aberto! Veja a tabela abaixo.`);
    } catch (err: any) {
      console.error('Erro ao acessar grupo:', err);
      toast.error('Erro ao acessar o grupo: ' + (err?.message || 'erro desconhecido'));
    }
  };

  const handleRemoveFromOpenedGroup = async (userId: string) => {
    if (!openedGroup) return;
    if (!isInstructorOfClass(detailClass)) {
      toast.error('Sem permissão para remover membros');
      return;
    }

    try {
      const remainingUserIds = openedGroupMembers
        .map((m: any) => m.user_id)
        .filter((id: string) => id !== userId);

      const res = await fetch('/api/classes/groups/assign-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: openedGroup.id, userIds: remainingUserIds }),
      });

      const json = await res.json();
      
      if (!res.ok) {
        console.error('Remove member error response:', json);
        toast.error(json.error || 'Falha ao remover membro do grupo');
        return;
      }

      toast.success('Membro removido do grupo!');
      
      // Reload data after a slight delay to ensure DB sync
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadOpenedGroupMembers(openedGroup.id);
      await loadGroups(detailClass.id);
    } catch (err: any) {
      console.error('Exception removing member:', err);
      toast.error('Erro ao remover membro');
    }
  };

  const handleMemberAction = async (memberId: string, action: 'inactive' | 'removed') => {
    const { error } = await supabase.from('class_members')
      .update({ status: action === 'removed' ? 'removed' : 'inactive' }).eq('id', memberId);
    if (error) { toast.error(error.message); return; }
    toast.success(action === 'removed' ? 'Membro removido!' : 'Membro inativado!');
    loadClassDetails(detailClass.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirm_delete'))) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Turma excluída!'); await loadClasses();
  };

  // ── Multi-select enrollment ────────────────────────────────────
  const openEnrollModal = async () => {
    if (!detailClass) return;
    // Only filter out active and inactive members, allow re-adding 'removed' members
    const alreadyIn = new Set(members
      .filter((m: any) => m.status === 'active' || m.status === 'inactive')
      .map((m: any) => m.profiles?.id)
      .filter(Boolean));
    const { data } = await supabase.from('profiles')
      .select('id, display_name, email').eq('role', 'competitor').order('display_name');
    setAllUsers((data || []).filter((u: any) => !alreadyIn.has(u.id)));
    setEnrollSelected(new Set()); setEnrollSearch(''); setEnrollModalOpen(true);
  };

  const toggleEnrollStudent = (id: string) => {
    setEnrollSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleBulkEnroll = async () => {
    if (enrollSelected.size === 0) { toast.error('Selecione pelo menos um aluno'); return; }
    const selectedIds = Array.from(enrollSelected);

    // Re-activate existing removed/inactive members to avoid RLS issues on INSERT.
    const { data: existingRows, error: existingErr } = await supabase
      .from('class_members')
      .select('id, user_id, status')
      .eq('class_id', detailClass.id)
      .in('user_id', selectedIds);

    if (existingErr) { toast.error(existingErr.message); return; }

    const existingByUser = new Map((existingRows || []).map((r: any) => [r.user_id, r]));
    const toReactivate = selectedIds.filter(uid => {
      const row = existingByUser.get(uid);
      return row && row.status !== 'active';
    });
    const toInsert = selectedIds.filter(uid => !existingByUser.has(uid));

    if (toReactivate.length > 0) {
      const { error: reactivateErr } = await supabase
        .from('class_members')
        .update({ status: 'active' })
        .eq('class_id', detailClass.id)
        .in('user_id', toReactivate);
      if (reactivateErr) { toast.error(reactivateErr.message); return; }
    }

    if (toInsert.length > 0) {
      const inserts = toInsert.map(uid => ({ class_id: detailClass.id, user_id: uid, status: 'active' }));
      const { error: insertErr } = await supabase.from('class_members').insert(inserts);
      if (insertErr) { toast.error(insertErr.message); return; }
    }

    toast.success(`${selectedIds.length} aluno(s) vinculado(s)!`);
    setEnrollModalOpen(false); loadClassDetails(detailClass.id);
  };

  const handleDownloadCsvTemplate = () => {
    const csvTemplate = [
      'email,display_name,password',
      'aluno1@escola.com,Aluno Um,Senha@123',
      'aluno2@escola.com,Aluno Dois,Senha@123',
    ].join('\n');

    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_cadastro_alunos.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !detailClass) return;

    try {
      setCsvImporting(true);
      const content = await file.text();
      const users = parseCsvRows(content);

      if (users.length === 0) {
        toast.error('CSV inválido. Use os cabeçalhos: email,display_name,password');
        return;
      }

      const usersWithClass = users.map((u) => ({ ...u, class_id: detailClass.id }));

      const res = await fetch('/api/auth/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: usersWithClass }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erro ao importar CSV');
        return;
      }

      toast.success(`Importação concluída: ${json.succeeded} criado(s), ${json.failed} com erro`);
      await loadClassDetails(detailClass.id);
    } catch (err) {
      console.error('CSV import error:', err);
      toast.error('Falha ao processar arquivo CSV');
    } finally {
      setCsvImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  // ── Groups CRUD ────────────────────────────────────────────────
  const openGroupModal = (group?: any) => {
    setEditingGroup(group || null);
    setGroupForm({
      name: group?.name || '', description: group?.description || '',
      max_members: group?.max_members != null ? String(group.max_members) : '',
      allow_self_enroll: group?.allow_self_enroll ?? true,
    });
    setGroupModalOpen(true);
  };

  const handleGroupSave = async () => {
    if (!groupForm.name.trim()) { toast.error('Nome do grupo é obrigatório'); return; }
    const payload = {
      class_id: detailClass.id, name: groupForm.name, description: groupForm.description,
      max_members: groupForm.max_members !== '' ? parseInt(groupForm.max_members) : null,
      allow_self_enroll: groupForm.allow_self_enroll, updated_at: new Date().toISOString(),
    };
    if (editingGroup) {
      const { error } = await supabase.from('class_groups').update(payload).eq('id', editingGroup.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Grupo atualizado!');
    } else {
      const { error } = await supabase.from('class_groups').insert({ ...payload, created_by: profile?.id });
      if (error) { toast.error(error.message); return; }
      toast.success('Grupo criado!');
    }
    setGroupModalOpen(false); setEditingGroup(null); loadGroups(detailClass.id);
  };

  const handleGroupDelete = async (groupId: string) => {
    if (!confirm('Excluir este grupo e todos os membros?')) return;
    const { error } = await supabase.from('class_groups').delete().eq('id', groupId);
    if (error) { toast.error(error.message); return; }
    toast.success('Grupo excluído!'); loadGroups(detailClass.id);
  };

  // ── Assign students to group (instructor) ──────────────────────
  const openAssignModal = async (group: any) => {
    setAssignGroup(group);
    const { data: gm } = await supabase.from('class_group_members')
      .select('user_id').eq('group_id', group.id);
    setSelectedStudents(new Set((gm || []).map((m: any) => m.user_id)));
    setAssignModalOpen(true);
  };

  const toggleAssignStudent = (id: string) => {
    setSelectedStudents(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleAssignSave = async () => {
    if (!assignGroup) return;
    
    try {
      const res = await fetch('/api/classes/groups/assign-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: assignGroup.id,
          userIds: Array.from(selectedStudents),
        }),
      });

      const json = await res.json();
      
      if (!res.ok) {
        console.error('Assign members error response:', json);
        toast.error(json.error || 'Falha ao atualizar membros do grupo');
        return;
      }

      toast.success('Membros do grupo atualizados!');
      setAssignModalOpen(false);
      
      // Reload data after a slight delay to ensure DB sync
      await new Promise(resolve => setTimeout(resolve, 500));
      loadGroups(detailClass.id);
    } catch (err: any) {
      console.error('Exception assigning members:', err);
      toast.error('Erro ao atualizar membros do grupo');
    }
  };

  // ── Student self-enroll ────────────────────────────────────────
  const handleSelfEnrollGroup = async (group: any) => {
    if (!profile) return;
    
    try {
      // Check current membership to determine action
      const { data: already } = await supabase.from('class_group_members')
        .select('id').eq('group_id', group.id).eq('user_id', profile.id).maybeSingle();

      const action = already ? 'leave' : 'join';

      // Call server endpoint for enroll/leave
      const enrollRes = await fetch('/api/classes/groups/self-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.id, action }),
      });

      const enrollJson = await enrollRes.json();

      if (!enrollRes.ok) {
        toast.error(enrollJson.error || `Falha ao ${action === 'join' ? 'ingressar no' : 'sair do'} grupo`);
        return;
      }

      toast.success(enrollJson.message);

      // Sync team if joining
      if (action === 'join') {
        const syncRes = await fetch('/api/classes/groups/sync-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: group.id }),
        });

        if (!syncRes.ok) {
          const syncJson = await syncRes.json();
          toast.error(syncJson.error || 'Falha ao sincronizar equipe do grupo');
        }
      }

      loadGroups(detailClass.id);
    } catch (err: any) {
      console.error('Error in handleSelfEnrollGroup:', err);
      toast.error('Erro ao processar ação no grupo');
    }
  };

  const getGroupMemberCount = (group: any): number => group.class_group_members?.[0]?.count ?? 0;
  const isGroupFull = (group: any): boolean => group.max_members != null && getGroupMemberCount(group) >= group.max_members;
  const isInstructorOfClass = (cls: any): boolean =>
    !cls ? false : profile?.role === 'super_admin' || profile?.role === 'admin' || cls.instructor_id === profile?.id;

  const filtered = classes.filter(c => c &&
    (c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase())));

  // ── Group card renderer ────────────────────────────────────────
  const renderGroupCard = (group: any) => {
    const count = getGroupMemberCount(group);
    const full = isGroupFull(group);
    const canManage = isInstructorOfClass(detailClass);
    const isMyGroup = myGroupIds.has(group.id);
    const canAccess = canManage || myGroupIds.has(group.id);
    return (
      <div key={group.id}
        className={`p-4 rounded-xl border transition-all ${full && !canManage ? 'border-red-500/30 bg-red-500/5' : 'border-cyber-border bg-white/5 hover:border-cyber-cyan/30'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-white">{group.name}</h4>
              {isMyGroup && <span className="cyber-badge bg-cyber-cyan/20 text-cyber-cyan text-xs">Seu grupo</span>}
              {full && <span className="cyber-badge bg-red-500/20 text-red-400 text-xs flex items-center gap-1"><Lock size={10} /> Vagas esgotadas</span>}
              {!full && group.allow_self_enroll && <span className="cyber-badge bg-green-500/20 text-green-400 text-xs flex items-center gap-1"><Unlock size={10} /> Inscrição aberta</span>}
              {!group.allow_self_enroll && <span className="cyber-badge bg-gray-500/20 text-gray-400 text-xs flex items-center gap-1"><Lock size={10} /> Somente instrutor</span>}
            </div>
            {group.description && <p className="text-xs text-gray-500 mt-1">{group.description}</p>}
            <p className="text-xs text-gray-400 mt-1">
              <Users size={10} className="inline mr-1" />
              {count}{group.max_members != null ? ` / ${group.max_members}` : ''} membros
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canManage && (
              <>
                <button onClick={() => openGroupAccess(group)} className="p-1.5 rounded text-gray-400 hover:text-cyber-cyan hover:bg-white/10 transition-colors" title="Acessar grupo"><Eye size={14} /></button>
                <button onClick={() => openAssignModal(group)} className="p-1.5 rounded text-gray-400 hover:text-cyber-cyan hover:bg-white/10 transition-colors" title="Atribuir alunos"><UserPlus size={14} /></button>
                <button onClick={() => openGroupModal(group)} className="p-1.5 rounded text-gray-400 hover:text-cyber-cyan hover:bg-white/10 transition-colors" title="Editar"><Edit size={14} /></button>
                <button onClick={() => handleGroupDelete(group.id)} className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-white/10 transition-colors" title="Excluir"><Trash2 size={14} /></button>
              </>
            )}
            {!canManage && (
              <>
                {canAccess && (
                  <button onClick={() => openGroupAccess(group)} className="cyber-btn text-xs px-3 py-1 bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/20">
                    Acessar
                  </button>
                )}
                {!isMyGroup && group.allow_self_enroll && (
                  <button onClick={() => handleSelfEnrollGroup(group)} disabled={full}
                    className={`cyber-btn text-xs px-3 py-1 ${full ? 'opacity-40 cursor-not-allowed bg-gray-500/10 border-gray-500/30 text-gray-500' : 'bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/20'}`}>
                    {full ? 'Cheio' : 'Entrar'}
                  </button>
                )}
                {isMyGroup && (
                  <button onClick={() => handleSelfEnrollGroup(group)}
                    className="cyber-btn text-xs px-3 py-1 bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20">
                    Sair
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Detail view ────────────────────────────────────────────────
  if (detailClass) {
    const canManage = isInstructorOfClass(detailClass);
    const activeMembers = members.filter(m => m.status === 'active');
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setDetailClass(null)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white">
            <GraduationCap size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{detailClass.name}</h1>
            <p className="text-sm text-gray-500">{detailClass.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canManage && (
              <button onClick={openEnrollModal} className="cyber-btn-primary flex items-center gap-1 text-sm">
                <UserPlus size={14} /> Vincular Alunos
              </button>
            )}
            {canManage && (
              <>
                <button
                  onClick={handleDownloadCsvTemplate}
                  className="cyber-btn-secondary flex items-center gap-1 text-sm"
                >
                  <Download size={14} /> Baixar Modelo CSV
                </button>
                <button
                  onClick={() => csvInputRef.current?.click()}
                  disabled={csvImporting}
                  className="cyber-btn-secondary flex items-center gap-1 text-sm"
                >
                  <Upload size={14} /> {csvImporting ? 'Importando...' : 'Importar CSV'}
                </button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCsvFileSelected}
                />
              </>
            )}
            <button onClick={() => { navigator.clipboard.writeText(detailClass.code); toast.success(t('common.copied')); }}
              className="flex items-center gap-1 text-sm font-mono text-cyber-cyan cyber-btn-secondary">
              <Copy size={14} /> {detailClass.code}
            </button>
            {canManage && (
              <button onClick={() => handleRegenerateCode(detailClass.id)} className="cyber-btn-secondary flex items-center gap-1 text-sm">
                <RefreshCw size={14} /> {t('class.regenerate_code')}
              </button>
            )}
          </div>
        </div>

        <div className="cyber-card">
          <h3 className="font-bold text-cyber-cyan mb-3">{t('class.details')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">TAG:</span> <span className="text-gray-300">{detailClass.tag}</span></div>
            <div><span className="text-gray-500">Código:</span> <span className="text-cyber-cyan font-mono">{detailClass.code}</span></div>
            <div><span className="text-gray-500">Membros:</span> <span className="text-gray-300">{activeMembers.length}</span></div>
            <div><span className="text-gray-500">Grupos:</span> <span className="text-gray-300">{groups.length}</span></div>
          </div>
        </div>

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
                  {canManage && <th className="pb-3">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.id} className="border-b border-cyber-border/50 hover:bg-white/5">
                    <td className="py-3 text-gray-200">{m.profiles?.display_name}</td>
                    <td className="py-3 text-gray-400">{m.profiles?.email}</td>
                    <td className="py-3">
                      <span className={`cyber-badge ${m.status === 'active' ? 'bg-green-500/20 text-green-400' : m.status === 'inactive' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                        {m.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-3">
                        {m.status === 'active' && (
                          <div className="flex gap-1">
                            <button onClick={() => handleMemberAction(m.id, 'inactive')} className="cyber-btn text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-2 py-1">{t('class.inactivate')}</button>
                            <button onClick={() => handleMemberAction(m.id, 'removed')} className="cyber-btn text-xs bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-1">{t('class.remove')}</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="cyber-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-cyber-cyan flex items-center gap-2">
              <Layers size={18} /> Grupos ({groups.length})
            </h3>
            {canManage && (
              <button onClick={() => openGroupModal()} className="cyber-btn-primary text-xs flex items-center gap-1">
                <Plus size={14} /> Novo Grupo
              </button>
            )}
          </div>
          {groups.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              {canManage ? 'Nenhum grupo criado. Clique em "Novo Grupo" para começar.' : 'Nenhum grupo disponível nesta turma.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{groups.map(renderGroupCard)}</div>
          )}
        </div>

        {openedGroup && (
          <div id={`group-panel-${openedGroup.id}`} className="cyber-card border-2 border-cyber-cyan/50 bg-cyber-cyan/5 animate-pulse">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h3 className="font-bold text-cyber-cyan flex items-center gap-2">
                <Users size={18} /> Grupo: {openedGroup.name}
              </h3>
              <button onClick={() => { setOpenedGroup(null); setOpenedGroupMembers([]); }} className="cyber-btn-secondary text-xs">
                Fechar grupo
              </button>
            </div>

            {!isInstructorOfClass(detailClass) && (
              <p className="text-xs text-gray-500 mb-3">Você pode visualizar os membros do seu grupo, mas não pode editar.</p>
            )}

            {groupMembersLoading ? (
              <p className="text-sm text-gray-500">Carregando membros do grupo...</p>
            ) : openedGroupMembers.length === 0 ? (
              <p className="text-sm text-gray-500">Este grupo ainda não possui membros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-cyber-border">
                      <th className="pb-3">Nome</th>
                      <th className="pb-3">E-mail</th>
                      <th className="pb-3">Entrada no grupo</th>
                      {isInstructorOfClass(detailClass) && <th className="pb-3">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {openedGroupMembers.map((gm: any) => (
                      <tr key={gm.id} className="border-b border-cyber-border/50 hover:bg-white/5">
                        <td className="py-3 text-gray-200">{gm.profiles?.display_name || '-'}</td>
                        <td className="py-3 text-gray-400">{gm.profiles?.email || '-'}</td>
                        <td className="py-3 text-gray-400">{new Date(gm.joined_at).toLocaleDateString('pt-BR')}</td>
                        {isInstructorOfClass(detailClass) && (
                          <td className="py-3">
                            <button
                              onClick={() => handleRemoveFromOpenedGroup(gm.user_id)}
                              className="cyber-btn text-xs bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-1"
                            >
                              Remover
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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

        {/* Multi-select enrollment Modal */}
        <Modal isOpen={enrollModalOpen} onClose={() => setEnrollModalOpen(false)} title="Vincular Alunos à Turma" size="lg">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" value={enrollSearch} onChange={e => setEnrollSearch(e.target.value)}
                placeholder="Buscar aluno..." className="cyber-input pl-9 py-2 text-sm" />
            </div>
            <p className="text-xs text-gray-500">{enrollSelected.size} selecionado(s)</p>
            <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg border border-cyber-border p-2">
              {allUsers.filter(u =>
                u.display_name?.toLowerCase().includes(enrollSearch.toLowerCase()) ||
                u.email?.toLowerCase().includes(enrollSearch.toLowerCase())
              ).map((u: any) => {
                const sel = enrollSelected.has(u.id);
                return (
                  <div key={u.id} onClick={() => toggleEnrollStudent(u.id)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-cyber-cyan/10 border border-cyber-cyan/30' : 'hover:bg-white/5'}`}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-cyber-cyan border-cyber-cyan' : 'border-gray-500'}`}>
                      {sel && <Check size={12} className="text-black" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{u.display_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEnrollModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleBulkEnroll} className="cyber-btn-primary flex items-center gap-2">
                <UserPlus size={14} /> Adicionar{enrollSelected.size > 0 ? ` (${enrollSelected.size})` : ''}
              </button>
            </div>
          </div>
        </Modal>

        {/* Group Create/Edit Modal */}
        <Modal isOpen={groupModalOpen} onClose={() => setGroupModalOpen(false)} title={editingGroup ? 'Editar Grupo' : 'Novo Grupo'}>
          <div className="space-y-4">
            <div>
              <label className="cyber-label">Nome do Grupo *</label>
              <input type="text" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                className="cyber-input" placeholder="Ex: Grupo A" />
            </div>
            <div>
              <label className="cyber-label">Descrição</label>
              <textarea value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })}
                className="cyber-textarea" rows={2} />
            </div>
            <div>
              <label className="cyber-label">Limite máximo de membros (vazio = ilimitado)</label>
              <input type="number" value={groupForm.max_members}
                onChange={e => setGroupForm({ ...groupForm, max_members: e.target.value })}
                className="cyber-input" min={1} placeholder="Ilimitado" />
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={groupForm.allow_self_enroll}
                  onChange={e => setGroupForm({ ...groupForm, allow_self_enroll: e.target.checked })} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-600 rounded-full peer peer-checked:bg-cyber-cyan transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
              </label>
              <span className="text-sm text-gray-300">Alunos podem se inscrever automaticamente</span>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setGroupModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleGroupSave} className="cyber-btn-primary">{t('common.save')}</button>
            </div>
          </div>
        </Modal>

        {/* Assign Students Modal */}
        <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)}
          title={`Atribuir Alunos - ${assignGroup?.name || ''}`} size="lg">
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Selecione os alunos da turma para este grupo. Alunos desmarcados serão removidos.</p>
            <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg border border-cyber-border p-2">
              {members.filter(m => m.status === 'active').map((m: any) => {
                const uid = m.profiles?.id;
                const sel = selectedStudents.has(uid);
                return (
                  <div key={m.id} onClick={() => uid && toggleAssignStudent(uid)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-cyber-cyan/10 border border-cyber-cyan/30' : 'hover:bg-white/5'}`}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-cyber-cyan border-cyber-cyan' : 'border-gray-500'}`}>
                      {sel && <Check size={12} className="text-black" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{m.profiles?.display_name}</p>
                      <p className="text-xs text-gray-500">{m.profiles?.email}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setAssignModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleAssignSave} className="cyber-btn-primary flex items-center gap-2">
                <UserCheck size={14} /> Salvar Atribuições
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────
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
            <button onClick={() => setJoinModalOpen(true)} className="cyber-btn-success flex items-center gap-2 whitespace-nowrap">
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
                    }} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-cyber-cyan"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(cls.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => { navigator.clipboard.writeText(cls.code); toast.success(t('common.copied')); }}
                  className="flex items-center gap-1 text-sm text-cyber-cyan hover:text-cyber-cyan-light font-mono">
                  <Copy size={14} /> {cls.code}
                </button>
                <button onClick={() => loadClassDetails(cls.id)} className="cyber-btn-secondary text-xs flex items-center gap-1">
                  <Eye size={14} /> {t('common.view')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingClass ? t('class.edit') : t('class.create')}>
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