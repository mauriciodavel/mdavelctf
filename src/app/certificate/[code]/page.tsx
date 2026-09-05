 'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

export default function CertificateValidationPage({ params }: { params: { code: string } }) {
  const [certificate, setCertificate] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { createClient().from('certificates').select('code, participant_name, participant_legal_name, event_name, challenges_solved, challenges_total, workload_hours, event_start, event_end, issued_at').eq('code', params.code.toUpperCase()).maybeSingle().then(({ data }) => { setCertificate(data); setLoaded(true); }); }, [params.code]);
  const valid = Boolean(certificate);
  return <main className="min-h-screen bg-[#090d1b] text-white flex items-center justify-center p-4">
    <section className="w-full max-w-xl rounded-2xl border border-cyan-400/40 bg-[#101b31] p-8 text-center shadow-[0_0_45px_rgba(39,211,232,.15)]">
      <p className="font-mono text-xs tracking-[.3em] text-cyan-300 uppercase">MDavel CTF // validação pública</p>
      {!loaded ? <p className="mt-8 text-slate-400">Validando certificado...</p> : valid ? <>
        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-300 text-3xl text-emerald-300">✓</div>
        <h1 className="mt-5 text-3xl font-bold">Certificado válido</h1>
        <p className="mt-2 text-slate-400">Este certificado foi emitido pela plataforma MDavel CTF.</p>
        <div className="mt-7 space-y-3 rounded-xl border border-slate-700 bg-black/20 p-5 text-left">
          <p><span className="text-slate-400">Participante:</span> <strong>{certificate.participant_legal_name || certificate.participant_name}</strong></p>
          <p><span className="text-slate-400">Evento:</span> <strong>{certificate.event_name}</strong></p>
          <p><span className="text-slate-400">Desafios resolvidos:</span> <strong>{certificate.challenges_solved}/{certificate.challenges_total}</strong></p>
          <p><span className="text-slate-400">Emitido em:</span> <strong>{new Date(certificate.issued_at).toLocaleDateString('pt-BR')}</strong></p>
          <p><span className="text-slate-400">Carga horária:</span> <strong>{Number(certificate.workload_hours || 0).toFixed(2)}h</strong></p>
          <p><span className="text-slate-400">Código:</span> <strong className="font-mono text-cyan-300">{certificate.code}</strong></p>
        </div>
      </> : <>
        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-400 text-3xl text-red-400">!</div>
        <h1 className="mt-5 text-3xl font-bold">Certificado não encontrado</h1>
        <p className="mt-2 text-slate-400">O código informado não corresponde a um certificado válido.</p>
        <p className="mt-5 rounded-lg bg-black/20 p-3 font-mono text-cyan-300">{params.code.toUpperCase()}</p>
      </>}
      <Link href="/" className="mt-7 inline-block text-sm text-cyan-300 hover:text-cyan-200">Voltar para a plataforma</Link>
    </section>
  </main>;
}
