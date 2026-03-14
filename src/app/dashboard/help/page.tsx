'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  HelpCircle, ChevronDown, ChevronRight, Shield, Trophy, Target, Users, Star,
  Zap, Award, BookOpen, MessageCircle, Globe, Lock, Layers, Flag, Lightbulb
} from 'lucide-react';

interface Section {
  key: string;
  icon: React.ReactNode;
  titlePt: string;
  titleEn: string;
  contentPt: string[];
  contentEn: string[];
}

const sections: Section[] = [
  {
    key: 'what_is',
    icon: <HelpCircle className="text-cyber-cyan" size={20} />,
    titlePt: 'O que é o mdavelCTF?',
    titleEn: 'What is mdavelCTF?',
    contentPt: [
      'O mdavelCTF é uma plataforma gamificada de competição Capture The Flag (CTF) voltada para o aprendizado e prática de cibersegurança.',
      'Os participantes resolvem desafios em diversas categorias como criptografia, forense digital, programação, redes, web e mais, acumulando pontos, XP e Shells.',
      'A plataforma suporta competições individuais e em equipe, com rankings em tempo real, badges de conquista e uma experiência imersiva estilo cyber.',
      'Ao submeter uma flag correta, você é presenteado com uma celebração de confetes na tela e uma mensagem de parabéns! 🎉',
    ],
    contentEn: [
      'mdavelCTF is a gamified Capture The Flag (CTF) competition platform focused on learning and practicing cybersecurity.',
      'Participants solve challenges in various categories such as cryptography, digital forensics, programming, networking, web security and more, earning points, XP and Shells.',
      'The platform supports individual and team competitions with real-time rankings, achievement badges and an immersive cyber-themed experience.',
      'When you submit a correct flag, you are greeted with a confetti celebration and a congratulations message! 🎉',
    ],
  },
  {
    key: 'roles',
    icon: <Shield className="text-cyber-purple" size={20} />,
    titlePt: 'Papéis de Usuário',
    titleEn: 'User Roles',
    contentPt: [
      '🔴 Super Usuário — Acesso total ao sistema. Gerencia todos os usuários, configurações globais, ligas e eventos.',
      '🟠 Administrador — Gerencia eventos, missões, desafios, turmas, ligas e badges. Pode visualizar e moderar todo conteúdo.',
      '🟢 Instrutor — Pode criar e gerenciar eventos, missões e desafios. Organiza turmas e acompanha o progresso dos competidores.',
      '🔵 Competidor — Participa de eventos, resolve desafios, ganha pontos e XP, ingressa em equipes e turmas.',
    ],
    contentEn: [
      '🔴 Super User — Full system access. Manages all users, global settings, leagues and events.',
      '🟠 Administrator — Manages events, missions, challenges, classes, leagues and badges. Can view and moderate all content.',
      '🟢 Instructor — Can create and manage events, missions and challenges. Organizes classes and tracks competitor progress.',
      '🔵 Competitor — Participates in events, solves challenges, earns points and XP, joins teams and classes.',
    ],
  },
  {
    key: 'leagues',
    icon: <Layers className="text-amber-400" size={20} />,
    titlePt: 'Ligas',
    titleEn: 'Leagues',
    contentPt: [
      'Ligas são agrupamentos de eventos. Cada liga possui um código único de 6 caracteres.',
      'Administradores e instrutores podem criar ligas e vincular eventos a elas através da tabela de associação liga-evento.',
      'As ligas permitem organizar temporadas de competição, agrupar resultados e filtrar o placar por liga.',
    ],
    contentEn: [
      'Leagues are groups of events. Each league has a unique 6-character code.',
      'Administrators and instructors can create leagues and link events to them through the league-event association table.',
      'Leagues allow organizing competition seasons, grouping results, and filtering the scoreboard by league.',
    ],
  },
  {
    key: 'events',
    icon: <Trophy className="text-cyber-green" size={20} />,
    titlePt: 'Eventos',
    titleEn: 'Events',
    contentPt: [
      'Eventos são as competições CTF. Cada evento tem datas de início e fim, categoria, visibilidade (público/restrito) e pode ser individual ou em equipe.',
      'Eventos podem ser vinculados a turmas (visibilidade restrita para membros) ou ligas.',
      'Status: 🔵 Agendado (antes do início), 🟢 Ao Vivo (durante), ⚫ Encerrado (após o fim).',
      'Cada evento pode oferecer Shells 🐚 como recompensa ao completá-lo.',
      '⚠️ Importante: Desafios só podem ser resolvidos enquanto o evento estiver "Ao Vivo". Eventos agendados ou encerrados têm os desafios bloqueados com cadeado — competidores não conseguem ver descrições nem submeter bandeiras.',
      'Os cards de eventos na listagem exibem: data/hora de início, data/hora de fim, duração, quantidade de missões, desafios e progresso de flags capturadas (ex: 2/8 Flags).',
    ],
    contentEn: [
      'Events are CTF competitions. Each event has start and end dates, category, visibility (public/restricted) and can be individual or team-based.',
      'Events can be linked to classes (restricted visibility for members) or leagues.',
      'Status: 🔵 Scheduled (before start), 🟢 Live (during), ⚫ Finished (after end).',
      'Each event can offer Shells 🐚 as a reward for completion.',
      '⚠️ Important: Challenges can only be solved while the event is "Live". Scheduled or finished events have challenges locked — competitors cannot see descriptions or submit flags.',
      'Event cards in the listing display: start date/time, end date/time, duration, number of missions, challenges, and captured flags progress (e.g., 2/8 Flags).',
    ],
  },
  {
    key: 'missions',
    icon: <Target className="text-orange-400" size={20} />,
    titlePt: 'Missões',
    titleEn: 'Missions',
    contentPt: [
      'Missões são agrupamentos de desafios dentro de um evento.',
      'Cada missão pode ter: nome, descrição, dificuldade (Fácil / Médio / Difícil / Especialista / Insano), limite de tempo, autor, links para download e conclusões.',
      'As missões ajudam a organizar os desafios em categorias temáticas dentro de cada evento.',
    ],
    contentEn: [
      'Missions are groups of challenges within an event.',
      'Each mission can have: name, description, difficulty (Easy / Medium / Hard / Expert / Insane), time limit, author, download links and conclusions.',
      'Missions help organize challenges into thematic categories within each event.',
    ],
  },
  {
    key: 'challenges',
    icon: <Flag className="text-red-400" size={20} />,
    titlePt: 'Desafios',
    titleEn: 'Challenges',
    contentPt: [
      'Desafios são as questões que os competidores devem resolver. Cada desafio possui uma "flag" (resposta secreta).',
      'Para resolver, o competidor submete sua resposta no campo flag{...}. Se a flag estiver correta, recebe os pontos do desafio, uma celebração com confetes e uma mensagem de parabéns na tela.',
      'Desafios podem ter número limitado de tentativas (max_attempts). Se não definido, tentativas são ilimitadas.',
      'Competidores podem reagir com 👍 (gostei) ou 👎 (não gostei) em cada desafio, contribuindo para a taxa de satisfação.',
      '🔒 Quando o evento não estiver ativo (agendado ou encerrado), os desafios ficam bloqueados com cadeado. Competidores não podem ver descrições, dicas ou campo de submissão.',
    ],
    contentEn: [
      'Challenges are the questions that competitors must solve. Each challenge has a "flag" (secret answer).',
      'To solve, the competitor submits their answer in the flag{...} field. If the flag is correct, they receive the challenge points, a confetti celebration and a congratulations message on screen.',
      'Challenges can have a limited number of attempts (max_attempts). If not set, attempts are unlimited.',
      'Competitors can react with 👍 (like) or 👎 (dislike) on each challenge, contributing to the satisfaction rate.',
      '🔒 When the event is not active (scheduled or finished), challenges are locked. Competitors cannot see descriptions, hints, or the submission field.',
    ],
  },
  {
    key: 'hints',
    icon: <Lightbulb className="text-yellow-400" size={20} />,
    titlePt: 'Dicas (Hints)',
    titleEn: 'Hints',
    contentPt: [
      'Dicas são pistas que ajudam a resolver desafios. Cada dica tem um custo em Shells 🐚.',
      'Para desbloquear uma dica, o competidor gasta Shells. Uma vez desbloqueada, a dica fica permanentemente disponível.',
      'Dicas só estão acessíveis quando o evento estiver ativo (Ao Vivo).',
      'Dicas devem ser usadas estrategicamente, pois os Shells são limitados.',
    ],
    contentEn: [
      'Hints are clues that help solve challenges. Each hint has a cost in Shells 🐚.',
      'To unlock a hint, the competitor spends Shells. Once unlocked, the hint is permanently available.',
      'Hints are only accessible when the event is active (Live).',
      'Hints should be used strategically, as Shells are limited.',
    ],
  },
  {
    key: 'teams',
    icon: <Users className="text-cyber-purple" size={20} />,
    titlePt: 'Equipes',
    titleEn: 'Teams',
    contentPt: [
      'Equipes permitem que competidores joguem juntos em eventos de modo equipe.',
      'Crie uma equipe e compartilhe o código de 6 caracteres para que outros ingressem.',
      'Equipes podem ser públicas (visíveis para todos) ou privadas (acesso apenas por código).',
      'Cada equipe possui um chat em tempo real para comunicação entre membros.',
      'O líder (criador) tem permissões especiais de gerenciamento.',
      '⚠️ Modo Equipe: Quando um membro da equipe resolve um desafio, os pontos vão para a equipe no placar. Outros membros da mesma equipe não podem submeter a mesma flag novamente.',
      'As XP são computadas apenas ao competidor que efetivamente submeteu a flag correta, mesmo em modo equipe.',
    ],
    contentEn: [
      'Teams allow competitors to play together in team mode events.',
      'Create a team and share the 6-character code for others to join.',
      'Teams can be public (visible to everyone) or private (code-only access).',
      'Each team has a real-time chat for member communication.',
      'The leader (creator) has special management permissions.',
      '⚠️ Team Mode: When a team member solves a challenge, points go to the team on the scoreboard. Other members of the same team cannot submit the same flag again.',
      'XP is only awarded to the competitor who actually submitted the correct flag, even in team mode.',
    ],
  },
  {
    key: 'shells',
    icon: <span className="text-2xl">🐚</span>,
    titlePt: 'Shells (Moeda Virtual)',
    titleEn: 'Shells (Virtual Currency)',
    contentPt: [
      'Shells 🐚 são a moeda virtual do mdavelCTF.',
      'Cada novo usuário inicia com 100 Shells.',
      'Shells podem ser ganhos ao completar eventos (cada evento pode definir uma recompensa em Shells) e ao resolver desafios.',
      'Shells são gastos para desbloquear dicas nos desafios.',
      'Gerencie seus Shells com sabedoria para maximizar seu desempenho!',
    ],
    contentEn: [
      'Shells 🐚 are the virtual currency of mdavelCTF.',
      'Each new user starts with 100 Shells.',
      'Shells can be earned by completing events (each event can define a Shell reward) and by solving challenges.',
      'Shells are spent to unlock hints in challenges.',
      'Manage your Shells wisely to maximize your performance!',
    ],
  },
  {
    key: 'xp',
    icon: <Zap className="text-cyber-cyan" size={20} />,
    titlePt: 'XP e Níveis',
    titleEn: 'XP and Levels',
    contentPt: [
      'XP (Pontos de Experiência) são ganhos ao resolver desafios corretamente. A quantidade de XP corresponde aos pontos do desafio resolvido.',
      'Ao acumular XP, o competidor sobe de nível automaticamente.',
      'A fórmula de nível é: Nível = floor(XP / 100) + 1. Ou seja, a cada 100 XP você sobe 1 nível.',
      'Seu progresso de XP é exibido na barra lateral (embaixo) e na página de perfil.',
      'Em modo equipe, as XP são computadas apenas para o competidor que submeteu a flag correta.',
    ],
    contentEn: [
      'XP (Experience Points) are earned by solving challenges correctly. The amount of XP corresponds to the points of the solved challenge.',
      'By accumulating XP, the competitor levels up automatically.',
      'The level formula is: Level = floor(XP / 100) + 1. That is, every 100 XP you go up 1 level.',
      'Your XP progress is displayed in the sidebar (bottom) and profile page.',
      'In team mode, XP is only awarded to the competitor who submitted the correct flag.',
    ],
  },
  {
    key: 'ranking',
    icon: <Trophy className="text-amber-400" size={20} />,
    titlePt: 'Ranking e Placar',
    titleEn: 'Ranking and Scoreboard',
    contentPt: [
      'O placar mostra a classificação dos competidores por pontuação.',
      'Modos disponíveis: Individual ou por Equipe.',
      'Filtros disponíveis: Todos os Eventos, por Evento específico ou por Liga.',
      'A tabela exibe: Posição, Nome, Nível, Progresso (acertos/total), Pontuação e Precisão (%).',
      'Sua posição no ranking aparece destacada na tabela.',
    ],
    contentEn: [
      'The scoreboard shows competitor rankings by score.',
      'Available modes: Individual or by Team.',
      'Available filters: All Events, by specific Event or by League.',
      'The table shows: Position, Name, Level, Progress (correct/total), Score and Accuracy (%).',
      'Your position in the ranking appears highlighted in the table.',
    ],
  },
  {
    key: 'classes',
    icon: <BookOpen className="text-cyber-green" size={20} />,
    titlePt: 'Turmas',
    titleEn: 'Classes',
    contentPt: [
      'Turmas são grupos de competidores gerenciados por instrutores.',
      'Cada turma possui um código de acesso de 6 caracteres que pode ser compartilhado.',
      'Instrutores podem vincular eventos específicos a turmas (visibilidade restrita).',
      'Membros podem ser inativados ou removidos pelo instrutor/admin.',
      'O código da turma pode ser regenerado a qualquer momento.',
    ],
    contentEn: [
      'Classes are groups of competitors managed by instructors.',
      'Each class has a 6-character access code that can be shared.',
      'Instructors can link specific events to classes (restricted visibility).',
      'Members can be deactivated or removed by the instructor/admin.',
      'The class code can be regenerated at any time.',
    ],
  },
  {
    key: 'badges',
    icon: <Award className="text-amber-400" size={20} />,
    titlePt: 'Badges (Conquistas)',
    titleEn: 'Badges (Achievements)',
    contentPt: [
      'Badges são conquistas especiais que reconhecem realizações dos competidores.',
      'Existem 4 raridades: Comum (⚪), Cru (🔷), Épico (💎) e Lendário (🌟).',
      'Badges podem conceder Shells como recompensa ao serem conquistados.',
      'Acesse a página de Badges para ver todas as conquistas disponíveis e seu progresso.',
    ],
    contentEn: [
      'Badges are special achievements that recognize competitor accomplishments.',
      'There are 4 rarities: Common (⚪), Raw (🔷), Epic (💎) and Legendary (🌟).',
      'Badges can grant Shells as a reward when earned.',
      'Visit the Badges page to see all available achievements and your progress.',
    ],
  },
  {
    key: 'security',
    icon: <Lock className="text-red-400" size={20} />,
    titlePt: 'Segurança e Sessão',
    titleEn: 'Security and Session',
    contentPt: [
      'Sua senha deve ter no mínimo 8 caracteres, incluindo: maiúscula, minúscula, número e caractere especial.',
      'Todas as entradas são sanitizadas contra XSS (Cross-Site Scripting).',
      'O banco de dados utiliza Row Level Security (RLS) para proteger seus dados.',
      'Headers de segurança CSP estão configurados para prevenir ataques.',
      'Sua sessão expira automaticamente após 1 hora de inatividade. O timer é reiniciado a cada ação (clique, digitação, navegação).',
      'Nunca compartilhe suas credenciais com ninguém.',
    ],
    contentEn: [
      'Your password must be at least 8 characters, including: uppercase, lowercase, number and special character.',
      'All inputs are sanitized against XSS (Cross-Site Scripting).',
      'The database uses Row Level Security (RLS) to protect your data.',
      'CSP security headers are configured to prevent attacks.',
      'Your session expires automatically after 1 hour of inactivity. The timer resets on every action (click, typing, navigation).',
      'Never share your credentials with anyone.',
    ],
  },
];

export default function HelpPage() {
  const { locale } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['what_is']));

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(sections.map(s => s.key)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HelpCircle className="text-cyber-cyan" size={28} />
          {locale === 'pt-BR' ? 'Central de Ajuda' : 'Help Center'}
        </h1>
        <div className="flex gap-2">
          <button onClick={expandAll} className="cyber-btn-secondary text-xs">
            {locale === 'pt-BR' ? 'Expandir Tudo' : 'Expand All'}
          </button>
          <button onClick={collapseAll} className="cyber-btn-secondary text-xs">
            {locale === 'pt-BR' ? 'Recolher Tudo' : 'Collapse All'}
          </button>
        </div>
      </div>

      <div className="cyber-card bg-gradient-to-r from-cyber-cyan/10 to-cyber-purple/10">
        <p className="text-gray-300 text-sm">
          {locale === 'pt-BR'
            ? '👋 Bem-vindo à Central de Ajuda do mdavelCTF! Aqui você encontra tudo sobre como usar a plataforma. Clique nas seções abaixo para expandir.'
            : '👋 Welcome to the mdavelCTF Help Center! Here you\'ll find everything about how to use the platform. Click the sections below to expand.'}
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = expanded.has(section.key);
          const title = locale === 'pt-BR' ? section.titlePt : section.titleEn;
          const content = locale === 'pt-BR' ? section.contentPt : section.contentEn;

          return (
            <div key={section.key} className={`cyber-card transition-all ${isOpen ? 'ring-1 ring-cyber-cyan/30' : ''}`}>
              <button onClick={() => toggle(section.key)}
                className="w-full flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  {section.icon}
                  <h2 className="font-bold text-white">{title}</h2>
                </div>
                {isOpen ? <ChevronDown className="text-gray-500" size={18} /> : <ChevronRight className="text-gray-500" size={18} />}
              </button>
              {isOpen && (
                <div className="mt-4 space-y-2 pl-8 border-l-2 border-cyber-cyan/20 animate-fade-in">
                  {content.map((line, idx) => (
                    <p key={idx} className="text-sm text-gray-300 leading-relaxed">{line}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="cyber-card text-center">
        <Globe className="mx-auto text-gray-600 mb-2" size={32} />
        <p className="text-sm text-gray-500">
          {locale === 'pt-BR'
            ? 'mdavelCTF — Plataforma de Competição CTF Gamificada'
            : 'mdavelCTF — Gamified CTF Competition Platform'}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {locale === 'pt-BR'
            ? 'Desenvolvido com ❤️ para a comunidade de cibersegurança'
            : 'Built with ❤️ for the cybersecurity community'}
        </p>
      </div>
    </div>
  );
}
