'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, ExternalLink, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase';

export default function CertificatesPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const supabase = createClient();
      const { data: events } = profile.role === 'instructor'
        ? await supabase.from('events').select('id, name, created_by').eq('created_by', profile.id)
        : { data: null };
      const eventIds = profile.role === 'instructor' ? (events || []).map(e => e.id) : undefined;
      let query = supabase.from('certificates').select('code, participant_legal_name, participant_name, event_name, challenges_solved, challenges_total, issued_at, event_id').order('issued_at', { ascending: false });
      if (eventIds) query = query.in('event_id', eventIds.length ? eventIds : ['00000000-0000-0000-0000-000000000000']);
      if (!['super_admin', 'admin', 'instructor'].includes(profile.role)) query = query.eq('user_id', profile.id);
      const { data } = await query;
      setRows(data || []);
    };
    load();
  }, [profile?.id, profile?.role]);
  const canManage = ['super_admin', 'admin', 'instructor'].includes(profile?.role || '');
  const deleteCertificate = async (code: string) => {
    if (!canManage || !window.confirm('Excluir este certificado? O participante poderá emiti-lo novamente com os dados atualizados.')) return;
    setDeleting(code);
    const { error } = await createClient().from('certificates').delete().eq('code', code);
    if (!error) setRows(current => current.filter(row => row.code !== code));
    else window.alert(`Não foi possível excluir: ${error.message}`);
    setDeleting(null);
  };
  const filtered = rows.filter(row => `${row.participant_legal_name || row.participant_name} ${row.event_name} ${row.code}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h1 className="text-2xl font-bold flex items-center gap-2"><Award className="text-amber-400" /> Certificados</h1><p className="text-sm text-gray-500 mt-1">{canManage ? 'Gerencie os certificados emitidos nos seus eventos.' : 'Visualize e imprima seus certificados já emitidos. Para emitir outro, acesse a página do evento e clique no botão "Certificado PDF" no card do evento.'}</p></div><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar participante, evento ou código" className="cyber-input pl-9 w-full sm:w-80" /></div></div><div className="cyber-card overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b border-cyber-border text-left"><th className="p-4">Participante</th><th className="p-4">Evento</th><th className="p-4">Progresso</th><th className="p-4">Código</th><th className="p-4">Emissão</th><th className="p-4">Ações</th></tr></thead><tbody>{filtered.map(row => <tr key={row.code} className="border-b border-cyber-border/50"><td className="p-4 text-white">{row.participant_legal_name || row.participant_name}</td><td className="p-4 text-gray-300">{row.event_name}</td><td className="p-4 text-cyber-green">{row.challenges_solved}/{row.challenges_total}</td><td className="p-4 font-mono text-cyber-cyan">{row.code}</td><td className="p-4 text-gray-400">{new Date(row.issued_at).toLocaleDateString('pt-BR')}</td><td className="p-4 flex items-center gap-3"><Link target="_blank" href={`/certificate/${row.code}`} className="text-cyber-cyan hover:text-white" title="Visualizar / imprimir"><ExternalLink size={16} /></Link>{canManage && <button disabled={deleting === row.code} onClick={() => deleteCertificate(row.code)} className="text-red-400 hover:text-red-300 disabled:opacity-40" title="Excluir certificado"><Trash2 size={16} /></button>}</td></tr>)}{filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nenhum certificado encontrado.</td></tr>}</tbody></table></div></div>;
}
