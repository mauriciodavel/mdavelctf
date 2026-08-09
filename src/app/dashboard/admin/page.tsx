'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase';
import Modal from '@/components/Modal';
import {
  Shield, Users, Search, Edit2, Trash2, Database, Trash, AlertTriangle,
  ChevronDown, ChevronUp, Rocket, Info, CheckCircle, Loader2,
  Upload, Key, Clock, Activity, UserPlus, X, Download
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================================
// CSV HELPERS
// ============================================================
function parseCSV(text: string): { email: string; display_name: string; password: string; class_id?: string; group_id?: string }[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  }).filter(r => r.email && r.display_name && r.password);
}

function formatActiveTime(seconds: number): string {
  if (!seconds || seconds < 60) return `${seconds || 0}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ============================================================
// SEED DATA — Dados de demonstração
// ============================================================
const SEED_TAG = '__seed_demo__';

async function runSeed(supabase: any, userId: string) {
  const steps: string[] = [];

  try {
    // 1. Criar Ligas
    const { data: league1 } = await supabase.from('leagues').insert({
      name: 'Liga CyberSec Brasil 2026',
      image_url: null,
      event_codes: '',
      created_by: userId,
    }).select().single();
    steps.push('✅ Liga "CyberSec Brasil 2026" criada');

    const { data: league2 } = await supabase.from('leagues').insert({
      name: 'Liga Acadêmica Hacker',
      image_url: null,
      event_codes: '',
      created_by: userId,
    }).select().single();
    steps.push('✅ Liga "Acadêmica Hacker" criada');

    // 2. Criar Turmas
    const { data: class1 } = await supabase.from('classes').insert({
      name: 'Turma SI - 2026/1',
      description: `${SEED_TAG} Turma de Segurança da Informação, 1º semestre 2026`,
      tag: 'Tecnologia da Informação',
      instructor_id: userId,
    }).select().single();
    steps.push('✅ Turma "SI - 2026/1" criada');

    const { data: class2 } = await supabase.from('classes').insert({
      name: 'Turma Redes - 2026/1',
      description: `${SEED_TAG} Turma de Redes de Computadores`,
      tag: 'Tecnologia da Informação',
      instructor_id: userId,
    }).select().single();
    steps.push('✅ Turma "Redes - 2026/1" criada');

    // 3. Criar Eventos
    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 86400000);
    const in10days = new Date(now.getTime() + 10 * 86400000);
    const in30days = new Date(now.getTime() + 30 * 86400000);
    const ago5days = new Date(now.getTime() - 5 * 86400000);

    const { data: event1 } = await supabase.from('events').insert({
      name: 'CTF Iniciante — Web Hacking',
      description: `${SEED_TAG} Evento introdutório de CTF focado em vulnerabilidades web. Ideal para quem está começando no mundo da cibersegurança.`,
      start_date: now.toISOString(),
      end_date: in10days.toISOString(),
      visibility: 'public',
      team_mode: 'event_teams',
      category: 'Web Exploitation',
      shell_reward: 50,
      created_by: userId,
      class_id: class1?.id || null,
    }).select().single();
    steps.push('✅ Evento "CTF Iniciante — Web Hacking" criado (Ao Vivo)');

    const { data: event2 } = await supabase.from('events').insert({
      name: 'Desafio Forense Digital',
      description: `${SEED_TAG} Competição focada em análise forense: imagens de disco, logs, metadados e recuperação de arquivos.`,
      start_date: in3days.toISOString(),
      end_date: in30days.toISOString(),
      visibility: 'public',
      team_mode: 'public_teams',
      category: 'Forensics',
      shell_reward: 75,
      created_by: userId,
    }).select().single();
    steps.push('✅ Evento "Desafio Forense Digital" criado (Agendado)');

    const { data: event3 } = await supabase.from('events').insert({
      name: 'CriptoMaster Challenge',
      description: `${SEED_TAG} Desafios avançados de criptografia: AES, RSA, hashing, esteganografia e criptoanálise.`,
      start_date: ago5days.toISOString(),
      end_date: in10days.toISOString(),
      visibility: 'public',
      team_mode: 'event_teams',
      category: 'Cryptography',
      shell_reward: 100,
      created_by: userId,
      league_code: league1?.code || null,
    }).select().single();
    steps.push('✅ Evento "CriptoMaster Challenge" criado (Ao Vivo)');

    // 4. Vincular eventos a ligas
    if (league1 && event1) {
      await supabase.from('league_events').insert({ league_id: league1.id, event_id: event1.id });
    }
    if (league1 && event3) {
      await supabase.from('league_events').insert({ league_id: league1.id, event_id: event3.id });
    }
    if (league2 && event2) {
      await supabase.from('league_events').insert({ league_id: league2.id, event_id: event2.id });
    }
    steps.push('✅ Eventos vinculados às ligas');

    // 5. Criar Missões para Event 1 (Web Hacking)
    const { data: mission1 } = await supabase.from('missions').insert({
      event_id: event1!.id,
      name: 'Reconhecimento Web',
      description: `${SEED_TAG} Missão focada em técnicas de reconhecimento e enumeração de aplicações web.`,
      difficulty: 'easy',
      author: 'Prof. CyberAdmin',
      sequence: 1,
      conclusions: 'Nesta missão você aprendeu sobre enumeração de diretórios, análise de headers HTTP e identificação de tecnologias.',
    }).select().single();
    steps.push('✅ Missão "Reconhecimento Web" criada');

    const { data: mission2 } = await supabase.from('missions').insert({
      event_id: event1!.id,
      name: 'SQL Injection',
      description: `${SEED_TAG} Explore vulnerabilidades de injeção SQL em formulários de login e busca.`,
      difficulty: 'medium',
      author: 'Prof. CyberAdmin',
      sequence: 2,
      conclusions: 'Você praticou SQL injection em diferentes contextos. Lembre-se de sempre usar prepared statements no código!',
    }).select().single();
    steps.push('✅ Missão "SQL Injection" criada');

    const { data: mission3 } = await supabase.from('missions').insert({
      event_id: event1!.id,
      name: 'Cross-Site Scripting (XSS)',
      description: `${SEED_TAG} Identifique e explore falhas de XSS refletido e armazenado.`,
      difficulty: 'hard',
      author: 'Prof. CyberAdmin',
      sequence: 3,
    }).select().single();
    steps.push('✅ Missão "XSS" criada');

    // Missões para Event 3 (Cripto)
    const { data: mission4 } = await supabase.from('missions').insert({
      event_id: event3!.id,
      name: 'Criptografia Clássica',
      description: `${SEED_TAG} Desafios envolvendo cifras clássicas: César, Vigenère, substituição e transposição.`,
      difficulty: 'easy',
      author: 'Dr. Crypto',
      sequence: 1,
    }).select().single();
    steps.push('✅ Missão "Criptografia Clássica" criada');

    const { data: mission5 } = await supabase.from('missions').insert({
      event_id: event3!.id,
      name: 'Criptografia Moderna',
      description: `${SEED_TAG} RSA, AES, hashing e desafios de criptoanálise moderna.`,
      difficulty: 'expert',
      author: 'Dr. Crypto',
      sequence: 2,
    }).select().single();
    steps.push('✅ Missão "Criptografia Moderna" criada');

    // Missão para Event 2 (Forense)
    const { data: mission6 } = await supabase.from('missions').insert({
      event_id: event2!.id,
      name: 'Análise de Metadados',
      description: `${SEED_TAG} Extraia informações ocultas de imagens, documentos e arquivos.`,
      difficulty: 'medium',
      author: 'Perito Digital',
      sequence: 1,
    }).select().single();
    steps.push('✅ Missão "Análise de Metadados" criada');

    // 6. Criar Desafios
    const challengesData = [
      // Missão 1 - Reconhecimento Web
      { mission_id: mission1!.id, sequence_number: 1, title: 'Header Oculto', description: `${SEED_TAG} Encontre a flag escondida no header HTTP da resposta do servidor.`, points: 10, flag: 'CTF{http_headers_reveal_secrets}', max_attempts: 0 },
      { mission_id: mission1!.id, sequence_number: 2, title: 'Robots.txt', description: `${SEED_TAG} Analise o arquivo robots.txt e encontre o diretório secreto com a flag.`, points: 15, flag: 'CTF{robots_txt_is_not_security}', max_attempts: 5 },
      { mission_id: mission1!.id, sequence_number: 3, title: 'Código Fonte', description: `${SEED_TAG} Inspecione o código fonte da página e localize a flag em um comentário HTML.`, points: 10, flag: 'CTF{view_source_always}', max_attempts: 0 },
      // Missão 2 - SQL Injection
      { mission_id: mission2!.id, sequence_number: 1, title: 'Login Bypass', description: `${SEED_TAG} Bypass do login usando SQL injection clássica. Qual é a flag exibida ao acessar o painel admin?`, points: 25, flag: 'CTF{union_select_1_2_3}', max_attempts: 10 },
      { mission_id: mission2!.id, sequence_number: 2, title: 'Blind SQLi', description: `${SEED_TAG} Use blind SQL injection para extrair o nome do banco de dados. A flag é o nome do database.`, points: 40, flag: 'CTF{blind_sqli_boolean_based}', max_attempts: 0 },
      // Missão 3 - XSS
      { mission_id: mission3!.id, sequence_number: 1, title: 'Reflected XSS', description: `${SEED_TAG} Encontre o campo vulnerável a XSS refletido e capture o cookie de admin.`, points: 30, flag: 'CTF{reflected_xss_cookie_theft}', max_attempts: 5 },
      { mission_id: mission3!.id, sequence_number: 2, title: 'Stored XSS', description: `${SEED_TAG} Injete um script persistente e capture a flag que aparece para o administrador.`, points: 50, flag: 'CTF{stored_xss_is_dangerous}', max_attempts: 3 },
      // Missão 4 - Cripto Clássica
      { mission_id: mission4!.id, sequence_number: 1, title: 'Cifra de César', description: `${SEED_TAG} Decodifique: "HWI{fdhvdu_flskhu_lv_hdvb}" (deslocamento = 3)`, points: 10, flag: 'CTF{caesar_cipher_is_easy}', max_attempts: 0 },
      { mission_id: mission4!.id, sequence_number: 2, title: 'Cifra de Vigenère', description: `${SEED_TAG} Decodifique usando a chave "HACK": "JVY{xikeqetg_yquugo}"`, points: 20, flag: 'CTF{vigenere_cracked}', max_attempts: 0 },
      // Missão 5 - Cripto Moderna
      { mission_id: mission5!.id, sequence_number: 1, title: 'Hash Cracking', description: `${SEED_TAG} Quebre o hash MD5: 5d41402abc4b2a76b9719d911017c592`, points: 15, flag: 'CTF{md5_is_broken}', max_attempts: 0 },
      { mission_id: mission5!.id, sequence_number: 2, title: 'RSA Fraco', description: `${SEED_TAG} N = 3233, e = 17. Descubra a mensagem cifrada c = 2790. A flag é a mensagem descriptografada.`, points: 50, flag: 'CTF{rsa_small_primes}', max_attempts: 5 },
      { mission_id: mission5!.id, sequence_number: 3, title: 'Base64 Aninhado', description: `${SEED_TAG} Decodifique 3 camadas de Base64: Q1RGe2Jhc2U2NF9sYXllcnN9`, points: 10, flag: 'CTF{base64_layers}', max_attempts: 0 },
      // Missão 6 - Forense
      { mission_id: mission6!.id, sequence_number: 1, title: 'EXIF Data', description: `${SEED_TAG} A flag está escondida nos metadados EXIF de uma foto. Qual coordenada GPS contém a flag?`, points: 20, flag: 'CTF{exif_data_leaks}', max_attempts: 0 },
      { mission_id: mission6!.id, sequence_number: 2, title: 'Strings Ocultas', description: `${SEED_TAG} Use o comando "strings" para encontrar a flag escondida em um binário.`, points: 15, flag: 'CTF{strings_command_ftw}', max_attempts: 0 },
    ];

    const { data: challenges } = await supabase.from('challenges').insert(challengesData).select();
    steps.push(`✅ ${challenges?.length || 0} desafios criados`);

    // 7. Criar Dicas (Hints)
    if (challenges && challenges.length > 0) {
      const hintsData = [
        { challenge_id: challenges[0].id, content: `${SEED_TAG} Tente usar o curl com a flag -v para ver os headers completos.`, shell_cost: 5, order_index: 1 },
        { challenge_id: challenges[0].id, content: `${SEED_TAG} O header personalizado começa com "X-Secret-..."`, shell_cost: 10, order_index: 2 },
        { challenge_id: challenges[1].id, content: `${SEED_TAG} Acesse /robots.txt no navegador.`, shell_cost: 5, order_index: 1 },
        { challenge_id: challenges[3].id, content: `${SEED_TAG} Tente ' OR '1'='1 no campo de senha.`, shell_cost: 10, order_index: 1 },
        { challenge_id: challenges[3].id, content: `${SEED_TAG} Use UNION SELECT para combinar resultados.`, shell_cost: 15, order_index: 2 },
        { challenge_id: challenges[5].id, content: `${SEED_TAG} Teste inputs em campos de busca e formulários de contato.`, shell_cost: 10, order_index: 1 },
        { challenge_id: challenges[7].id, content: `${SEED_TAG} Cifra de César desloca cada letra por N posições no alfabeto.`, shell_cost: 5, order_index: 1 },
        { challenge_id: challenges[9].id, content: `${SEED_TAG} Use hashcat ou john the ripper com wordlist rockyou.txt`, shell_cost: 10, order_index: 1 },
        { challenge_id: challenges[10].id, content: `${SEED_TAG} Fatore N para encontrar p e q. São primos pequenos.`, shell_cost: 15, order_index: 1 },
        { challenge_id: challenges[12].id, content: `${SEED_TAG} Use exiftool para extrair todos os metadados.`, shell_cost: 5, order_index: 1 },
      ];
      await supabase.from('hints').insert(hintsData);
      steps.push(`✅ ${hintsData.length} dicas criadas`);
    }

    // 8. Criar Equipes
    const { data: team1 } = await supabase.from('teams').insert({
      name: 'ByteBusters',
      is_public: true,
      created_by: userId,
    }).select().single();

    const { data: team2 } = await supabase.from('teams').insert({
      name: 'NullPointers',
      is_public: true,
      created_by: userId,
    }).select().single();

    const { data: team3 } = await supabase.from('teams').insert({
      name: 'ShellShockers',
      is_public: false,
      created_by: userId,
    }).select().single();

    // Add creator as leader in all teams
    if (team1) await supabase.from('team_members').insert({ team_id: team1.id, user_id: userId, role: 'leader' });
    if (team2) await supabase.from('team_members').insert({ team_id: team2.id, user_id: userId, role: 'leader' });
    if (team3) await supabase.from('team_members').insert({ team_id: team3.id, user_id: userId, role: 'leader' });
    steps.push('✅ 3 equipes criadas (ByteBusters, NullPointers, ShellShockers)');

    // 9. Criar Badges
    const badgesData = [
      { name: 'Primeiro Sangue', criteria_key: `${SEED_TAG}_first_blood`, icon_url: null, rarity: 'epico', reward: 50, description: 'Primeiro a resolver um desafio em um evento.' },
      { name: 'Hacker Iniciante', criteria_key: `${SEED_TAG}_beginner`, icon_url: null, rarity: 'comum', reward: 10, description: 'Resolveu seu primeiro desafio.' },
      { name: 'Mestre Web', criteria_key: `${SEED_TAG}_web_master`, icon_url: null, rarity: 'cru', reward: 25, description: 'Resolveu todos os desafios de Web Exploitation.' },
      { name: 'Criptógrafo', criteria_key: `${SEED_TAG}_cryptographer`, icon_url: null, rarity: 'cru', reward: 25, description: 'Resolveu todos os desafios de criptografia.' },
      { name: 'Perito Forense', criteria_key: `${SEED_TAG}_forensics_expert`, icon_url: null, rarity: 'cru', reward: 25, description: 'Resolveu todos os desafios de forense digital.' },
      { name: 'Sem Dicas', criteria_key: `${SEED_TAG}_no_hints`, icon_url: null, rarity: 'epico', reward: 75, description: 'Completou um evento sem usar nenhuma dica.' },
      { name: 'Lenda do CTF', criteria_key: `${SEED_TAG}_ctf_legend`, icon_url: null, rarity: 'lendario', reward: 200, description: '1000+ pontos acumulados em competições.' },
      { name: 'Maratonista', criteria_key: `${SEED_TAG}_marathon`, icon_url: null, rarity: 'comum', reward: 15, description: 'Participou de 5 ou mais eventos.' },
      { name: 'Precisão Cirúrgica', criteria_key: `${SEED_TAG}_precision`, icon_url: null, rarity: 'epico', reward: 60, description: '100% de precisão em um evento com 5+ desafios.' },
      { name: 'Líder de Equipe', criteria_key: `${SEED_TAG}_team_leader`, icon_url: null, rarity: 'comum', reward: 10, description: 'Criou uma equipe com 3+ membros.' },
    ];
    await supabase.from('badges').insert(badgesData);
    steps.push(`✅ ${badgesData.length} badges criados`);

    // 10. Conceder alguns badges ao admin
    const { data: insertedBadges } = await supabase.from('badges')
      .select('id').in('criteria_key', [`${SEED_TAG}_first_blood`, `${SEED_TAG}_beginner`, `${SEED_TAG}_team_leader`]);
    if (insertedBadges) {
      const userBadges = insertedBadges.map((b: any) => ({ user_id: userId, badge_id: b.id }));
      await supabase.from('user_badges').insert(userBadges);
      steps.push(`✅ ${userBadges.length} badges concedidos ao admin`);
    }

    // 11. Mensagens de chat demo
    if (team1) {
      const chatMsgs = [
        { team_id: team1.id, user_id: userId, message: `${SEED_TAG} 🚀 Bem-vindos ao ByteBusters! Vamos dominar esse CTF!` },
        { team_id: team1.id, user_id: userId, message: `${SEED_TAG} Alguém já começou o desafio de SQL Injection?` },
        { team_id: team1.id, user_id: userId, message: `${SEED_TAG} Dica: comecem pelo reconhecimento web, os desafios são mais fáceis.` },
      ];
      await supabase.from('chat_messages').insert(chatMsgs);
      steps.push('✅ 3 mensagens de chat demo criadas');
    }

    steps.push('');
    steps.push('🎉 SEED COMPLETO!');
    steps.push(`📊 Resumo: 2 ligas, 2 turmas, 3 eventos, 6 missões, ${challenges?.length || 0} desafios, 10 dicas, 3 equipes, 10 badges`);

    return { success: true, steps };
  } catch (err: any) {
    steps.push(`❌ ERRO: ${err.message}`);
    return { success: false, steps };
  }
}

async function runClean(supabase: any) {
  const steps: string[] = [];

  try {
    // Limpar na ordem correta (dependências primeiro)
    // 1. Chat messages com tag
    const { count: chatCount } = await supabase.from('chat_messages')
      .delete({ count: 'exact' }).like('message', `${SEED_TAG}%`);
    steps.push(`🗑️ ${chatCount || 0} mensagens de chat removidas`);

    // 2. User badges vinculados a badges seed
    const { data: seedBadges } = await supabase.from('badges')
      .select('id').like('criteria_key', `${SEED_TAG}%`);
    if (seedBadges?.length) {
      const ids = seedBadges.map((b: any) => b.id);
      const { count: ubCount } = await supabase.from('user_badges')
        .delete({ count: 'exact' }).in('badge_id', ids);
      steps.push(`🗑️ ${ubCount || 0} badges de usuário removidos`);
    }

    // 3. Badges seed
    const { count: badgeCount } = await supabase.from('badges')
      .delete({ count: 'exact' }).like('criteria_key', `${SEED_TAG}%`);
    steps.push(`🗑️ ${badgeCount || 0} badges removidos`);

    // 4. Hints seed (via cascade dos challenges, mas limpamos explicitamente)
    const { count: hintCount } = await supabase.from('hints')
      .delete({ count: 'exact' }).like('content', `${SEED_TAG}%`);
    steps.push(`🗑️ ${hintCount || 0} dicas removidas`);

    // 5. Submissions de challenges seed
    const { data: seedChallenges } = await supabase.from('challenges')
      .select('id').like('description', `${SEED_TAG}%`);
    if (seedChallenges?.length) {
      const ids = seedChallenges.map((c: any) => c.id);
      const { count: subCount } = await supabase.from('submissions')
        .delete({ count: 'exact' }).in('challenge_id', ids);
      steps.push(`🗑️ ${subCount || 0} submissões removidas`);

      const { count: reactCount } = await supabase.from('challenge_reactions')
        .delete({ count: 'exact' }).in('challenge_id', ids);
      steps.push(`🗑️ ${reactCount || 0} reações removidas`);

      // Hint usage
      const { data: seedHints } = await supabase.from('hints')
        .select('id').in('challenge_id', ids);
      if (seedHints?.length) {
        await supabase.from('hint_usage').delete().in('hint_id', seedHints.map((h: any) => h.id));
      }
    }

    // 6. Challenges seed
    const { count: chalCount } = await supabase.from('challenges')
      .delete({ count: 'exact' }).like('description', `${SEED_TAG}%`);
    steps.push(`🗑️ ${chalCount || 0} desafios removidos`);

    // 7. Missions seed
    const { count: misCount } = await supabase.from('missions')
      .delete({ count: 'exact' }).like('description', `${SEED_TAG}%`);
    steps.push(`🗑️ ${misCount || 0} missões removidas`);

    // 8. Events seed (league_events cascade)
    const { count: evtCount } = await supabase.from('events')
      .delete({ count: 'exact' }).like('description', `${SEED_TAG}%`);
    steps.push(`🗑️ ${evtCount || 0} eventos removidos`);

    // 9. Classes seed (class_members cascade)
    const { count: clsCount } = await supabase.from('classes')
      .delete({ count: 'exact' }).like('description', `${SEED_TAG}%`);
    steps.push(`🗑️ ${clsCount || 0} turmas removidas`);

    // 10. Teams named as seed (team_members, chat cascade)
    const seedTeamNames = ['ByteBusters', 'NullPointers', 'ShellShockers'];
    const { count: teamCount } = await supabase.from('teams')
      .delete({ count: 'exact' }).in('name', seedTeamNames);
    steps.push(`🗑️ ${teamCount || 0} equipes removidas`);

    // 11. Leagues (via name match)
    const seedLeagueNames = ['Liga CyberSec Brasil 2026', 'Liga Acadêmica Hacker'];
    const { count: lgCount } = await supabase.from('leagues')
      .delete({ count: 'exact' }).in('name', seedLeagueNames);
    steps.push(`🗑️ ${lgCount || 0} ligas removidas`);

    steps.push('');
    steps.push('🧹 LIMPEZA COMPLETA! Todos os dados de demonstração foram removidos.');

    return { success: true, steps };
  } catch (err: any) {
    steps.push(`❌ ERRO: ${err.message}`);
    return { success: false, steps };
  }
}

// ============================================================
// ADMIN PAGE COMPONENT
// ============================================================
export default function AdminPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const supabase = createClient();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ display_name: '', role: '', shells: 0, xp_points: 0 });

  // Seed state
  const [seedExpanded, setSeedExpanded] = useState(false);
  const [seedRunning, setSeedRunning] = useState(false);
  const [seedLog, setSeedLog] = useState<string[]>([]);

  // Reset password state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // CSV Bulk import state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvClasses, setCsvClasses] = useState<any[]>([]);
  const [csvGroups, setCsvGroups] = useState<any[]>([]);
  const [csvClassId, setCsvClassId] = useState('');
  const [csvGroupId, setCsvGroupId] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvLog, setCsvLog] = useState<string[]>([]);

  // Individual user registration state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', display_name: '', password: '' });
  const [userClasses, setUserClasses] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [userClassId, setUserClassId] = useState('');
  const [userGroupId, setUserGroupId] = useState('');
  const [userLoading, setUserLoading] = useState(false);

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // CSV file input ref
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdmin = profile?.role === 'admin' || isSuperAdmin;

  useEffect(() => {
    if (isAdmin) {
      let cancelled = false;
      const load = async () => {
        try {
          await loadUsers(cancelled);
        } catch (err) {
          console.error('Admin load error:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }
  }, [isAdmin]);

  const loadUsers = async (cancelled = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles')
        .select('*').order('created_at', { ascending: false });
      if (error) console.error('Admin users query error:', error.message);
      if (!cancelled) setUsers(data || []);
    } catch (err) {
      console.error('loadUsers exception:', err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  const openEdit = (user: any) => {
    setSelectedUser(user);
    setEditForm({
      display_name: user.display_name,
      role: user.role,
      shells: user.shells,
      xp_points: user.xp_points,
    });
    setEditModalOpen(true);
  };

  const openResetPassword = (user: any) => {
    setResetUser(user);
    setResetPassword('');
    setResetModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetUser || !resetPassword) return;
    if (resetPassword.length < 8) { toast.error('Senha mínima: 8 caracteres'); return; }
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: resetUser.id, newPassword: resetPassword }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro ao redefinir senha'); return; }
      toast.success(`Senha de ${resetUser.display_name} redefinida!`);
      setResetModalOpen(false);
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setResetLoading(false);
    }
  };

  const openCsvImport = async () => {
    const { data: cls } = await supabase.from('classes').select('id, name');
    setCsvClasses(cls || []);
    setCsvText('');
    setCsvClassId('');
    setCsvGroupId('');
    setCsvLog([]);
    setCsvModalOpen(true);
  };

  const openUserModal = async () => {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    setUserClasses(data || []);
    setUserGroups([]);
    setUserClassId('');
    setUserGroupId('');
    setNewUser({ email: '', display_name: '', password: '' });
    setUserModalOpen(true);
  };

  const handleUserClassChange = async (classId: string) => {
    setUserClassId(classId);
    setUserGroupId('');
    if (!classId) { setUserGroups([]); return; }
    const { data } = await supabase.from('class_groups').select('id, name').eq('class_id', classId).order('name');
    setUserGroups(data || []);
  };

  const handleCreateUser = async () => {
    const email = newUser.email.trim().toLowerCase();
    const display_name = newUser.display_name.trim();
    if (!email || !display_name || !newUser.password) { toast.error('Preencha nome, e-mail e senha'); return; }
    if (newUser.password.length < 8) { toast.error('A senha deve ter pelo menos 8 caracteres'); return; }
    setUserLoading(true);
    try {
      const res = await fetch('/api/auth/bulk-register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: [{ email, display_name, password: newUser.password, class_id: userClassId || undefined, group_id: userGroupId || undefined }] }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Falha ao cadastrar usuário'); return; }
      const result = json.results?.[0];
      if (!result?.success) { toast.error(result?.error || 'Falha ao cadastrar usuário'); return; }
      toast.success('Usuário cadastrado com sucesso');
      setUserModalOpen(false);
      loadUsers();
    } catch { toast.error('Erro de conexão'); }
    finally { setUserLoading(false); }
  };

  const handleCsvClassChange = async (classId: string) => {
    setCsvClassId(classId);
    setCsvGroupId('');
    if (classId) {
      const { data } = await supabase.from('class_groups').select('id, name').eq('class_id', classId);
      setCsvGroups(data || []);
    } else {
      setCsvGroups([]);
    }
  };

  const handleCsvImport = async () => {
    if (!csvText.trim()) { toast.error('Cole o conteúdo CSV'); return; }
    const rows = parseCSV(csvText);
    if (rows.length === 0) { toast.error('Nenhuma linha válida encontrada. Formato: email,display_name,password'); return; }
    setCsvLoading(true);
    setCsvLog([`⏳ Importando ${rows.length} usuário(s)...`]);
    try {
      const payload = rows.map(r => ({
        ...r,
        class_id: csvClassId || r.class_id || undefined,
        group_id: csvGroupId || r.group_id || undefined,
      }));
      const res = await fetch('/api/auth/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: payload }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error); setCsvLoading(false); return; }
      const log: string[] = [];
      (json.results || []).forEach((r: any) => {
        if (r.success) log.push(`✅ ${r.email}`);
        else log.push(`❌ ${r.email} — ${r.error}`);
      });
      log.push(`\n📊 ${json.succeeded} criados, ${json.failed} erros`);
      setCsvLog(log);
      toast.success(`Importação: ${json.succeeded} criados, ${json.failed} erros`);
      loadUsers();
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setCsvLoading(false);
    }
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
    link.setAttribute('download', 'modelo_usuarios.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCsvLoading(true);
      const content = await file.text();
      const rows = parseCSV(content);

      if (rows.length === 0) {
        toast.error('CSV inválido. Use os cabeçalhos: email,display_name,password');
        return;
      }

      setCsvText(content);
      setCsvLog([]);
      toast.success(`${rows.length} linhas carregadas. Clique em "Importar" para continuar.`);
    } catch (err) {
      console.error('CSV file error:', err);
      toast.error('Falha ao processar arquivo CSV');
    } finally {
      setCsvLoading(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    // Only super_admin can change to super_admin or admin roles
    if (!isSuperAdmin && (editForm.role === 'super_admin' || editForm.role === 'admin')) {
      toast.error('Apenas Super Admin pode definir esse papel');
      return;
    }

    const updatePayload: any = {
      display_name: editForm.display_name,
      role: editForm.role,
      shells: editForm.shells,
      xp_points: editForm.xp_points,
      level: Math.max(1, Math.floor(editForm.xp_points / 100) + 1),
      updated_at: new Date().toISOString(),
    };

    const { error, count } = await supabase.from('profiles').update(updatePayload, { count: 'exact' })
      .eq('id', selectedUser.id);

    if (error) { toast.error(error.message); return; }
    if (count === 0) {
      toast.error('Falha ao atualizar: permissão negada ou usuário não encontrado.');
      return;
    }
    toast.success('Usuário atualizado!');
    setEditModalOpen(false);
    await loadUsers();
  };

  const handleDelete = async (userId: string) => {
    if (userId === profile?.id) { toast.error('Não é possível excluir a si mesmo'); return; }
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userToDelete.id }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Falha ao excluir usuário'); return; }
      toast.success('Usuário excluído permanentemente');
      setDeleteModalOpen(false);
      setUserToDelete(null);
      await loadUsers();
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleColors: Record<string, string> = {
    super_admin: 'bg-red-500/20 text-red-400',
    admin: 'bg-orange-500/20 text-orange-400',
    instructor: 'bg-green-500/20 text-green-400',
    competitor: 'bg-blue-500/20 text-blue-400',
  };

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    instructor: 'Instrutor',
    competitor: 'Competidor',
  };

  if (!isAdmin) {
    return (
      <div className="cyber-card text-center py-12">
        <Shield size={48} className="mx-auto text-red-400 mb-4" />
        <p className="text-gray-400">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="text-red-400" size={28} /> {t('nav.admin')}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')} className="cyber-input pl-9 py-2 text-sm w-64" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="cyber-select py-2 text-sm">
            <option value="all">Todos os papéis</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="instructor">Instrutor</option>
            <option value="competitor">Competidor</option>
          </select>
          <button onClick={openCsvImport}
            className="cyber-btn-secondary flex items-center gap-2 text-sm whitespace-nowrap">
            <Upload size={15} /> Importar CSV
          </button>
          <button onClick={openUserModal}
            className="cyber-btn-secondary flex items-center gap-2 text-sm whitespace-nowrap">
            <UserPlus size={15} /> Novo usuário
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(roleLabels).map(([role, label]) => (
          <div key={role} className="cyber-card text-center">
            <p className="text-2xl font-bold text-white">{users.filter(u => u.role === role).length}</p>
            <p className={`text-xs mt-1 ${roleColors[role]?.split(' ')[1]}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* ============================================================ */}
      {/* SEED / DEMO DATA SECTION */}
      {/* ============================================================ */}
      <div className="cyber-card border border-amber-500/20">
        <button onClick={() => setSeedExpanded(!seedExpanded)}
          className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="text-amber-400" size={22} />
            <div className="text-left">
              <h2 className="font-bold text-white text-lg">Dados de Demonstração (Seed)</h2>
              <p className="text-xs text-gray-500">Popule ou limpe o banco de dados com dados fictícios para testes</p>
            </div>
          </div>
          {seedExpanded ? <ChevronUp className="text-gray-500" size={18} /> : <ChevronDown className="text-gray-500" size={18} />}
        </button>

        {seedExpanded && (
          <div className="mt-6 space-y-6 animate-fade-in">
            {/* Explicação detalhada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Botão CRIAR */}
              <div className="border border-cyber-green/20 rounded-xl p-5 bg-cyber-green/5">
                <div className="flex items-center gap-2 mb-3">
                  <Rocket className="text-cyber-green" size={20} />
                  <h3 className="font-bold text-cyber-green">Popular Banco (Seed)</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <p className="flex items-start gap-2">
                    <Info size={14} className="text-gray-600 mt-0.5 shrink-0" />
                    <span>Cria dados fictícios e completos para <strong className="text-gray-300">demonstração e testes</strong> da plataforma.</span>
                  </p>
                  <p className="font-semibold text-gray-300 mt-3 mb-1">O que será criado:</p>
                  <ul className="space-y-1 pl-1">
                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-cyber-green shrink-0" /> <span><strong>2 Ligas</strong> — "CyberSec Brasil 2026" e "Acadêmica Hacker"</span></li>
                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-cyber-green shrink-0" /> <span><strong>2 Turmas</strong> — "SI - 2026/1" e "Redes - 2026/1"</span></li>
                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-cyber-green shrink-0" /> <span><strong>3 Eventos</strong> — Web Hacking (ao vivo), Forense Digital (agendado), CriptoMaster (ao vivo)</span></li>
                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-cyber-green shrink-0" /> <span><strong>6 Missões</strong> — Reconhecimento, SQLi, XSS, Cripto Clássica, Cripto Moderna, Forense</span></li>
                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-cyber-green shrink-0" /> <span><strong>14 Desafios</strong> — Com flags reais, pontuações variadas e limites de tentativas</span></li>
                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-cyber-green shrink-0" /> <span><strong>10 Dicas</strong> — Com custo em Shells (5 a 15 🐚) para desbloquear</span></li>
                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-cyber-green shrink-0" /> <span><strong>3 Equipes</strong> — ByteBusters, NullPointers, ShellShockers (com chat demo)</span></li>
                    <li className="flex items-center gap-2"><CheckCircle size={12} className="text-cyber-green shrink-0" /> <span><strong>10 Badges</strong> — Todas as raridades: Comum, Cru, Épico e Lendário</span></li>
                  </ul>
                  <p className="text-xs text-gray-600 mt-3 border-t border-cyber-border pt-2">
                    ⚠️ Todos os dados ficam marcados internamente com a tag "<code className="text-amber-400">{SEED_TAG}</code>" para que possam ser identificados e removidos pelo botão Limpar.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('Popular o banco de dados com dados de demonstração?')) return;
                    setSeedRunning(true);
                    setSeedLog(['⏳ Executando seed...']);
                    const result = await runSeed(supabase, profile?.id || '');
                    setSeedLog(result.steps);
                    setSeedRunning(false);
                    if (result.success) {
                      toast.success('Seed executado com sucesso!');
                      loadUsers();
                    } else {
                      toast.error('Erro ao executar seed');
                    }
                  }}
                  disabled={seedRunning}
                  className="cyber-btn-success w-full flex items-center justify-center gap-2 py-2.5">
                  {seedRunning ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                  {seedRunning ? 'Executando...' : 'Popular Banco de Dados'}
                </button>
              </div>

              {/* Botão LIMPAR */}
              <div className="border border-red-500/20 rounded-xl p-5 bg-red-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Trash className="text-red-400" size={20} />
                  <h3 className="font-bold text-red-400">Limpar Dados Demo</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <p className="flex items-start gap-2">
                    <Info size={14} className="text-gray-600 mt-0.5 shrink-0" />
                    <span>Remove <strong className="text-gray-300">apenas</strong> os dados criados pelo botão "Popular" acima. <strong className="text-red-400">Não afeta</strong> dados criados manualmente por você ou outros usuários.</span>
                  </p>
                  <p className="font-semibold text-gray-300 mt-3 mb-1">O que será removido:</p>
                  <ul className="space-y-1 pl-1">
                    <li className="flex items-center gap-2"><Trash2 size={12} className="text-red-400 shrink-0" /> <span>Mensagens de chat das equipes demo</span></li>
                    <li className="flex items-center gap-2"><Trash2 size={12} className="text-red-400 shrink-0" /> <span>Badges de demonstração e badges concedidos vinculados</span></li>
                    <li className="flex items-center gap-2"><Trash2 size={12} className="text-red-400 shrink-0" /> <span>Dicas, submissões e reações dos desafios demo</span></li>
                    <li className="flex items-center gap-2"><Trash2 size={12} className="text-red-400 shrink-0" /> <span>Desafios e missões de demonstração</span></li>
                    <li className="flex items-center gap-2"><Trash2 size={12} className="text-red-400 shrink-0" /> <span>Eventos demo e vínculos com ligas</span></li>
                    <li className="flex items-center gap-2"><Trash2 size={12} className="text-red-400 shrink-0" /> <span>Turmas demo e membros vinculados</span></li>
                    <li className="flex items-center gap-2"><Trash2 size={12} className="text-red-400 shrink-0" /> <span>Equipes demo (ByteBusters, NullPointers, ShellShockers)</span></li>
                    <li className="flex items-center gap-2"><Trash2 size={12} className="text-red-400 shrink-0" /> <span>Ligas de demonstração</span></li>
                  </ul>
                  <p className="text-xs text-gray-600 mt-3 border-t border-cyber-border pt-2">
                    🔒 Seus dados reais (perfil, turmas criadas, eventos próprios, etc.) <strong className="text-gray-400">não serão afetados</strong>. A limpeza usa a tag interna para identificar apenas os dados demo.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('⚠️ Remover TODOS os dados de demonstração? Essa ação não pode ser desfeita.')) return;
                    setSeedRunning(true);
                    setSeedLog(['⏳ Limpando dados demo...']);
                    const result = await runClean(supabase);
                    setSeedLog(result.steps);
                    setSeedRunning(false);
                    if (result.success) {
                      toast.success('Dados de demonstração removidos!');
                      loadUsers();
                    } else {
                      toast.error('Erro na limpeza');
                    }
                  }}
                  disabled={seedRunning}
                  className="cyber-btn-danger w-full flex items-center justify-center gap-2 py-2.5">
                  {seedRunning ? <Loader2 size={16} className="animate-spin" /> : <Trash size={16} />}
                  {seedRunning ? 'Limpando...' : 'Limpar Dados de Demonstração'}
                </button>
              </div>
            </div>

            {/* Log de execução */}
            {seedLog.length > 0 && (
              <div className="bg-cyber-darker border border-cyber-border rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs">
                <p className="text-gray-500 mb-2 font-sans text-xs font-semibold">Log de execução:</p>
                {seedLog.map((line, i) => (
                  <p key={i} className={`py-0.5 ${
                    line.startsWith('✅') ? 'text-cyber-green' :
                    line.startsWith('🗑️') ? 'text-orange-400' :
                    line.startsWith('❌') ? 'text-red-400' :
                    line.startsWith('🎉') || line.startsWith('🧹') ? 'text-amber-400 font-bold' :
                    line.startsWith('📊') ? 'text-cyber-cyan' :
                    'text-gray-500'
                  }`}>{line}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="cyber-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-cyber-border text-left">
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Usuário</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">Papel</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">Nível</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">XP</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">Shells</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">
                  <Clock size={12} className="inline mr-1 text-cyber-cyan" />Último Login
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">
                  <Activity size={12} className="inline mr-1 text-cyber-green" />Tempo Ativo
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-500">Nenhum usuário encontrado</td></tr>
              ) : (
                filtered.map((user: any) => (
                  <tr key={user.id} className={`border-b border-cyber-border/50 hover:bg-white/5 transition-colors ${
                    user.id === profile?.id ? 'bg-cyber-cyan/5' : ''
                  }`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center text-xs font-bold text-white">
                          {user.display_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="text-white font-medium text-sm">
                          {user.display_name}
                          {user.id === profile?.id && <span className="text-xs text-cyber-cyan ml-1">(você)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">{user.email}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`cyber-badge ${roleColors[user.role]}`}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-300">{user.level}</td>
                    <td className="py-3 px-4 text-center text-sm text-cyber-cyan">{user.xp_points}</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-300">🐚 {user.shells}</td>
                    <td className="py-3 px-4 text-center text-xs text-gray-500">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-cyber-green font-mono">
                      {formatActiveTime(user.total_active_seconds)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(user)}
                          className="p-1.5 text-gray-500 hover:text-cyber-cyan transition-colors" title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => openResetPassword(user)}
                          className="p-1.5 text-gray-500 hover:text-amber-400 transition-colors" title="Redefinir Senha">
                          <Key size={14} />
                        </button>
                        {user.id !== profile?.id && (
                          <button onClick={() => handleDelete(user.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar Usuário">
        <div className="space-y-4">
          <div>
            <label className="cyber-label">Nome de Exibição</label>
            <input type="text" value={editForm.display_name}
              onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} className="cyber-input" />
          </div>
          <div>
            <label className="cyber-label">Papel</label>
            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="cyber-select">
              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              {isSuperAdmin && <option value="admin">Admin</option>}
              <option value="instructor">Instrutor</option>
              <option value="competitor">Competidor</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">XP</label>
              <input type="number" value={editForm.xp_points}
                onChange={(e) => setEditForm({ ...editForm, xp_points: parseInt(e.target.value) || 0 })} className="cyber-input" min={0} />
            </div>
            <div>
              <label className="cyber-label">Shells 🐚</label>
              <input type="number" value={editForm.shells}
                onChange={(e) => setEditForm({ ...editForm, shells: parseInt(e.target.value) || 0 })} className="cyber-input" min={0} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setEditModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleSave} className="cyber-btn-primary">{t('common.save')}</button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Redefinir Senha">
        <div className="space-y-4">
          {resetUser && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-cyber-border">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center text-xs font-bold">
                {resetUser.display_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{resetUser.display_name}</p>
                <p className="text-xs text-gray-500">{resetUser.email}</p>
              </div>
            </div>
          )}
          <div>
            <label className="cyber-label">Nova Senha</label>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="cyber-input"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle size={12} /> O usuário deverá usar esta senha no próximo login.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setResetModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleResetPassword} disabled={resetLoading}
              className="cyber-btn-primary flex items-center gap-2">
              {resetLoading ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              Redefinir Senha
            </button>
          </div>
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <Modal isOpen={userModalOpen} onClose={() => !userLoading && setUserModalOpen(false)} title="Cadastrar novo usuário" size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">Nome de exibição</label>
              <input className="cyber-input" value={newUser.display_name} onChange={e => setNewUser({ ...newUser, display_name: e.target.value })} placeholder="Nome completo" />
            </div>
            <div>
              <label className="cyber-label">E-mail</label>
              <input type="email" className="cyber-input" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="usuario@exemplo.com" />
            </div>
          </div>
          <div>
            <label className="cyber-label">Senha inicial</label>
            <input type="password" className="cyber-input" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} minLength={8} placeholder="Mínimo de 8 caracteres" />
          </div>
          <div className="border-t border-cyber-border pt-4">
            <p className="text-sm font-semibold text-white mb-3">Vínculo opcional</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="cyber-label">Turma</label>
                <select value={userClassId} onChange={e => handleUserClassChange(e.target.value)} className="cyber-select">
                  <option value="">Nenhuma</option>
                  {userClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="cyber-label">Grupo da turma</label>
                <select value={userGroupId} onChange={e => setUserGroupId(e.target.value)} className="cyber-select" disabled={!userClassId}>
                  <option value="">Nenhum</option>
                  {userGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setUserModalOpen(false)} disabled={userLoading} className="cyber-btn-secondary">Cancelar</button>
            <button onClick={handleCreateUser} disabled={userLoading} className="cyber-btn-primary flex items-center gap-2">
              {userLoading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {userLoading ? 'Cadastrando...' : 'Cadastrar usuário'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={csvModalOpen} onClose={() => setCsvModalOpen(false)} title="Importar Usuários via CSV" size="lg">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-cyber-cyan/5 border border-cyber-cyan/20 text-xs text-gray-400">
            <p className="font-semibold text-cyber-cyan mb-1">Formato do CSV:</p>
            <code className="text-gray-300">email,display_name,password</code>
            <br />
            <code className="text-gray-500">joao@email.com,João Silva,Senha@123</code>
            <p className="mt-2 text-gray-500">Colunas <strong>class_id</strong> e <strong>group_id</strong> são opcionais (use os seletores abaixo para vincular a todos).</p>
          </div>
          <textarea
            className="cyber-textarea font-mono text-sm"
            rows={6}
            placeholder="email,display_name,password&#10;aluno1@escola.com,Aluno Um,Senha@123&#10;aluno2@escola.com,Aluno Dois,Senha@456"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleDownloadCsvTemplate}
              className="cyber-btn-secondary flex items-center gap-2 text-sm"
            >
              <Download size={14} /> Baixar Modelo
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={csvLoading}
              className="cyber-btn-secondary flex items-center gap-2 text-sm"
            >
              <Upload size={14} /> {csvLoading ? 'Carregando...' : 'Anexar Arquivo'}
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvFileSelected}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="cyber-label">Vincular à Turma (opcional)</label>
              <select value={csvClassId} onChange={e => handleCsvClassChange(e.target.value)} className="cyber-select">
                <option value="">Nenhuma</option>
                {csvClasses.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="cyber-label">Vincular ao Grupo (opcional)</label>
              <select value={csvGroupId} onChange={e => setCsvGroupId(e.target.value)} className="cyber-select" disabled={!csvClassId}>
                <option value="">Nenhum</option>
                {csvGroups.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
          {csvLog.length > 0 && (
            <div className="bg-cyber-darker border border-cyber-border rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
              {csvLog.map((line, i) => (
                <p key={i} className={line.startsWith('✅') ? 'text-cyber-green' : line.startsWith('❌') ? 'text-red-400' : 'text-amber-400'}>{line}</p>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setCsvModalOpen(false)} className="cyber-btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleCsvImport} disabled={csvLoading}
              className="cyber-btn-primary flex items-center gap-2">
              {csvLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {csvLoading ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirmar Exclusão">
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex gap-3">
            <AlertTriangle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400 mb-1">Exclusão Permanente</p>
              <p className="text-sm text-gray-400">Esta ação não pode ser desfeita. O usuário será removido do sistema permanentemente.</p>
            </div>
          </div>

          {userToDelete && (
            <div className="p-4 rounded-lg bg-cyber-darker border border-cyber-border space-y-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Usuário</div>
                <div className="text-white font-semibold">{userToDelete.display_name}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Email</div>
                <div className="text-cyber-cyan font-mono text-sm">{userToDelete.email}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Função</div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  userToDelete.role === 'super_admin' ? 'bg-red-500/20 text-red-400' :
                  userToDelete.role === 'admin' ? 'bg-orange-500/20 text-orange-400' :
                  userToDelete.role === 'instructor' ? 'bg-green-500/20 text-green-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {userToDelete.role === 'super_admin' ? 'Super Admin' :
                   userToDelete.role === 'admin' ? 'Admin' :
                   userToDelete.role === 'instructor' ? 'Instrutor' :
                   'Competidor'}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => {
              setDeleteModalOpen(false);
              setUserToDelete(null);
            }} disabled={deleteLoading} className="cyber-btn-secondary">
              Cancelar
            </button>
            <button onClick={confirmDelete} disabled={deleteLoading}
              className="cyber-btn-danger flex items-center gap-2">
              {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {deleteLoading ? 'Excluindo...' : 'Excluir Permanentemente'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
