# 🛡️ mdavelCTF — Plataforma Gamificada de Competições CTF

Plataforma web gamificada estilo **Capture the Flag (CTF)** voltada para ambientes educacionais. Permite que instrutores criem eventos, missões e desafios, enquanto competidores resolvem flags, ganham XP, Shells e sobem no ranking.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Tech Stack](#tech-stack)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Banco de Dados (Supabase)](#banco-de-dados-supabase)
- [Sistema de Autenticação](#sistema-de-autenticação)
- [Páginas e Funcionalidades](#páginas-e-funcionalidades)
- [Sistema de Componentes](#sistema-de-componentes)
- [Internacionalização (i18n)](#internacionalização-i18n)
- [Estilização (Tema Cyber)](#estilização-tema-cyber)
- [Segurança](#segurança)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Como Rodar](#como-rodar)
- [Status Atual do Projeto](#status-atual-do-projeto)

---

## Visão Geral

**mdavelCTF** é uma plataforma completa para competições CTF com:

- **4 tipos de usuários**: Super Admin, Admin, Instrutor, Competidor
- **Eventos** com missões e desafios (flags)
- **Ligas** para agrupar eventos em temporadas
- **Turmas** gerenciadas por instrutores com códigos de acesso
- **Equipes** com chat em tempo real
- **Gamificação**: XP, níveis, Shells (moeda virtual), badges
- **Scoreboard** individual e por equipes
- **Bilíngue**: Português (BR) e Inglês

---

## Tech Stack

| Tecnologia | Versão | Uso |
|---|---|---|
| **Next.js** | 14.2.21 | Framework React (App Router) |
| **React** | 18.3.x | UI Library |
| **TypeScript** | 5.7.x | Tipagem estática |
| **Tailwind CSS** | 3.4.x | Estilização utility-first |
| **Supabase** | 2.47.x | Backend (PostgreSQL, Auth, Realtime, RLS) |
| **@supabase/ssr** | 0.5.x | SSR/Middleware auth cookies |
| **Lucide React** | 0.468.x | Ícones |
| **React Hot Toast** | 2.4.x | Notificações toast |
| **Canvas Confetti** | 1.9.x | Efeitos de confetti ao acertar flag |
| **DOMPurify** | 3.2.x | Sanitização HTML (anti-XSS) |
| **Zod** | 3.24.x | Validação de schemas |
| **date-fns** | 4.1.x | Manipulação de datas |

---

## Estrutura do Projeto

```
newmdavelctf/
├── public/                          # Assets estáticos (logo, favicon)
├── supabase/
│   └── schema.sql                   # Schema completo do banco (17 tabelas + RLS + triggers)
├── src/
│   ├── middleware.ts                 # Auth middleware (protege /dashboard, redireciona rotas)
│   ├── app/
│   │   ├── globals.css              # Estilos globais (tema cyber, componentes CSS)
│   │   ├── layout.tsx               # Root layout (Providers, metadata, dark theme)
│   │   ├── page.tsx                 # Página de Login
│   │   ├── register/
│   │   │   └── page.tsx             # Página de Cadastro
│   │   └── dashboard/
│   │       ├── layout.tsx           # Layout do dashboard (sidebar, navbar, chat)
│   │       ├── page.tsx             # Dashboard principal (stats, feed)
│   │       ├── admin/
│   │       │   └── page.tsx         # Painel administrativo
│   │       ├── events/
│   │       │   ├── page.tsx         # Lista de eventos (CRUD)
│   │       │   └── [id]/
│   │       │       └── page.tsx     # Detalhes do evento (missões, desafios, flags)
│   │       ├── leagues/
│   │       │   └── page.tsx         # Gerenciamento de ligas
│   │       ├── classes/
│   │       │   └── page.tsx         # Gerenciamento de turmas
│   │       ├── teams/
│   │       │   └── page.tsx         # Equipes + chat em tempo real
│   │       ├── scoreboard/
│   │       │   └── page.tsx         # Placar (individual/equipes)
│   │       ├── badges/
│   │       │   └── page.tsx         # Coleção de badges
│   │       ├── profile/
│   │       │   └── page.tsx         # Perfil do usuário
│   │       └── help/
│   │           └── page.tsx         # FAQ e ajuda
│   ├── components/
│   │   ├── BadgeDisplay.tsx         # Exibição de badge com raridade e glow
│   │   ├── ErrorBoundary.tsx        # Tratamento de erros React
│   │   ├── LoadingScreen.tsx        # Tela de carregamento
│   │   ├── MiniChat.tsx             # Widget de mini-chat flutuante
│   │   ├── Modal.tsx                # Modal genérico (sm/md/lg/xl)
│   │   ├── Providers.tsx            # Wrapper (I18nProvider + AuthProvider + Toaster)
│   │   └── StatsCard.tsx            # Card animado de estatísticas
│   └── lib/
│       ├── auth.tsx                 # AuthContext (login, signup, sessão, timeout)
│       ├── i18n.tsx                 # Internacionalização (200+ chaves pt-BR/en)
│       ├── supabase.ts              # Cliente Supabase browser (singleton, PKCE)
│       ├── supabase-server.ts       # Cliente Supabase server (cookies, service role)
│       └── utils.ts                 # Sanitização, validação, constantes
├── next.config.js                   # Config Next.js (imagens, CSP headers, segurança)
├── tailwind.config.ts               # Tema cyber customizado
├── tsconfig.json
├── postcss.config.js
└── package.json
```

---

## Banco de Dados (Supabase)

### 17 Tabelas

| # | Tabela | Descrição |
|---|---|---|
| 1 | `profiles` | Usuários (role, XP, Shells, level, bio, curso) |
| 2 | `leagues` | Ligas — agrupam eventos em temporadas (código 6 chars) |
| 3 | `classes` | Turmas gerenciadas por instrutores (código 6 chars) |
| 4 | `class_members` | Membros de turmas (status: active/inactive/removed) |
| 5 | `events` | Eventos CTF (datas, visibilidade, team_mode, categoria) |
| 6 | `missions` | Missões dentro de eventos (dificuldade, download_links) |
| 7 | `challenges` | Desafios/flags (pontos, max_attempts, flag secreta, dificuldade, aprendizado, link) |
| 8 | `hints` | Dicas com custo em Shells |
| 9 | `hint_usage` | Registro de dicas desbloqueadas por usuário |
| 10 | `teams` | Equipes (código 6 chars, pública/privada) |
| 11 | `team_members` | Membros de equipes (role: leader/member) |
| 12 | `submissions` | Submissões de respostas (is_correct, points_awarded) |
| 13 | `challenge_reactions` | Reações like/dislike em desafios |
| 14 | `badges` | Distintivos (raridade: comum/cru/épico/lendário) |
| 15 | `user_badges` | Badges concedidos aos usuários |
| 16 | `chat_messages` | Mensagens do chat por equipe (tempo real) |
| 17 | `league_events` | Tabela de ligação liga ↔ evento |

### Triggers e Functions

- **`handle_new_user()`** — Cria perfil automaticamente ao registrar via Supabase Auth
- **`handle_correct_submission()`** — Ao acertar flag: soma XP, recalcula nível, adiciona Shells
- **`calculate_level(xp)`** — Fórmula: `FLOOR(xp / 100) + 1`
- **`xp_for_next_level(xp)`** — Calcula XP restante para o próximo nível
- **`regenerate_class_code(class_id)`** — Gera novo código de 6 chars para turma
- **`generate_code(length)`** — Gera código alfanumérico aleatório

### Row Level Security (RLS)

Todas as 17 tabelas possuem RLS habilitado com políticas baseadas em:
- **Perfis**: leitura pública, edição própria, admins editam qualquer
- **Eventos/Missões/Desafios**: leitura para autenticados, CRUD para criador ou admins
- **Equipes/Chat**: membros da equipe podem ler/enviar mensagens
- **Badges**: apenas admins gerenciam, todos podem visualizar

### Indexes de Performance

Indexes criados para: `profiles(role)`, `events(visibility, created_by, class_id)`, `missions(event_id)`, `challenges(mission_id)`, `hints(challenge_id)`, `submissions(user_id, challenge_id)`, `class_members(class_id, user_id)`, `team_members(team_id, user_id)`, `chat_messages(team_id)`, `user_badges(user_id)`.

---

## Sistema de Autenticação

**Arquivo**: `src/lib/auth.tsx`

- **Login/Registro** via email e senha (Supabase Auth)
- **Fluxo PKCE** para segurança no browser
- **Middleware** (`src/middleware.ts`):
  - Protege todas as rotas `/dashboard/*` — redireciona para `/` se não autenticado
  - Redireciona `/` para `/dashboard` se autenticado
  - Valida JWT server-side via `getUser()` (não apenas `getSession()`)
- **Sessão**:
  - Timeout de 1 hora por inatividade
  - Rastreamento de atividade: click, keydown, mousemove, scroll, touchstart, pointerdown
  - Refresh proativo de token ao voltar para a aba
- **Validação de senha**: mínimo 8 chars, maiúscula, minúscula, número, caractere especial
- **Roles**: `super_admin`, `admin`, `instructor`, `competitor`

---

## Páginas e Funcionalidades

### 🔐 Login (`/`)
- Formulário com email e senha
- Layout split: hero com logo à esquerda, form à direita
- Responsivo (mobile mostra apenas form)
- Link para cadastro

### 📝 Cadastro (`/register`)
- Nome de exibição, email, senha com confirmação
- Validação de força de senha em tempo real
- Criação automática de perfil via trigger

### 📊 Dashboard (`/dashboard`)
- **Admin/Instrutor**: Stats globais — total de eventos, usuários, submissões, taxa de resolução
- **Análise de Temporadas**: Total de ligas e eventos vinculados a ligas (dados reais)
- **Competidor**: Stats pessoais, eventos ativos, guia rápido
- Feed de atividades recentes
- Cards animados com cores temáticas

### 🎯 Eventos (`/dashboard/events`)
- Listagem com filtro e busca
- CRUD completo (admin/instrutor)
- Status automático: Agendado / Ao Vivo / Finalizado
- Cards com imagem, badges de status, visibilidade, duração

### 🏁 Detalhes do Evento (`/dashboard/events/[id]`)
- Lista de missões com seleção
- Desafios por missão com envio de flag
- **Campos do desafio**: sequência, título, descrição, pontos, flag, tentativas máximas
  - **Nível de Dificuldade do desafio**: Fácil, Médio, Difícil, De fritar o cérebro
  - **O que aprendi neste desafio?**: campo de texto preenchido pelo criador
  - **Onde aprender mais sobre isso?**: URL de referência externa
- Sistema de dicas com custo em Shells — CRUD completo (adicionar, editar, excluir)
  - **Botão de dica inline**: cada card de desafio tem botão de adicionar dica direto, sem precisar subir ao topo
- **Visibilidade inteligente** de conteúdo sensível:
  - **Super Admin / Admin**: veem dicas, "O que aprendi" e "Saiba mais" de todos os desafios
  - **Instrutor autor do evento**: mesma visibilidade que admin
  - **Competidores e instrutores não-autores**: dicas bloqueadas (desbloqueio via Shells); "O que aprendi" e "Saiba mais" visíveis apenas após capturar a flag
- Reações like/dislike nos desafios
- Confetti ao acertar flag 🎉
- Bloqueio de desafios quando evento não está ativo
- Suporte a modo equipe (submissões compartilhadas)

### 🏆 Ligas (`/dashboard/leagues`)
- Criar/editar/excluir ligas
- Vincular eventos via códigos
- Códigos únicos de 6 caracteres
- **Cards enriquecidos**: data de início/fim (derivada dos eventos), total de eventos, total de flags, tempo restante em **dias:horas:minutos** (ex: `3d 05h 42m`)
- **Breakdown por evento** no card: exibe quantidade de flags por evento
- **Status da liga**: Agendada / Ativa / Encerrada (calculado a partir das datas dos eventos)
- **Detalhe da liga**: ao clicar no card, exibe informações completas com lista de eventos vinculados
  - Cada evento mostra: nome, status, datas, missões, desafios
  - Ao clicar num evento, abre a visão detalhada com missões e desafios
- **Detalhe do evento na liga**: lista missões com dificuldade e todos os desafios (título, pontos, tentativas)
  - Botão **"Acessar Evento"** ao lado da dificuldade de cada missão — redireciona para a página completa do evento (`/dashboard/events/{id}`)

### 🎓 Turmas (`/dashboard/classes`)
- Instrutor cria turmas com código de acesso
- Alunos ingressam via código
- Gerenciamento de membros (ativar/inativar/remover)
- Regenerar código de acesso
- Vincular eventos à turma (visibilidade privada)

### 👥 Equipes (`/dashboard/teams`)
- Criar equipes públicas ou privadas
- Ingressar via código de 6 caracteres
- Hierarquia líder/membro
- **Contagem de membros** exibida nos cards de equipes (minhas e públicas)
- **Chat em tempo real** (Supabase Realtime + polling fallback)
- **Painel de membros** expansível no chat: nome de exibição, e-mail e data/hora de ingresso
- **Sistema de @menção**: autocomplete ao digitar `@`, sugestões por teclado (↑↓/Tab/Enter/Esc)
  - Menções destacadas em ciano nas mensagens; menções a você em dourado
  - Notificação diferenciada para @menções: som de 3 notas (acorde C6→E6→G6), 3.5x mais alto que o normal
  - Toast com borda dourada, ícone âmbar, texto "mencionou você" e duração estendida (8s)
- Notificações toast + som (880Hz) para novas mensagens
- Contador de mensagens não lidas na sidebar
- **MiniChat** flutuante fixável em qualquer página (com suporte a @menção)

### 🏅 Scoreboard (`/dashboard/scoreboard`)
- Modo individual e por equipes
- Filtro por evento ou liga
- **Filtro de liga corrigido**: usa `event_codes` e `league_code` (mesmo mecanismo da página de ligas)
- Ranking por pontos → dicas usadas → hora da última flag (mais cedo = melhor)
- **Coluna "Última Flag"**: exibe data e hora da captura da última bandeira
- **Banner de critérios de ranking**: explicação dos critérios visível ao usuário
- Progresso (desafios resolvidos / total)
- Porcentagem de acerto
- Posição do usuário destacada

### 🎖️ Badges (`/dashboard/badges`)
- 4 raridades: Comum (cinza), Cru (azul), Épico (roxo), Lendário (dourado + glow)
- Recompensas em Shells
- Ícones customizáveis

### 👤 Perfil (`/dashboard/profile`)
- Nível e barra de XP
- Saldo de Shells
- Estatísticas de submissões (corretas/erradas)
- Coleção de badges
- Campos editáveis: nome, curso, turma, departamento, bio

### ⚙️ Admin (`/dashboard/admin`)
- Painel administrativo (visível apenas para super_admin/admin)

### ❓ Ajuda (`/dashboard/help`)
- FAQ completo em PT-BR e inglês
- Seções expansíveis sobre cada funcionalidade
- Explicação de roles, XP, Shells, ranking, badges
- Botões expandir/recolher tudo

---

## Sistema de Componentes

| Componente | Descrição |
|---|---|
| `BadgeDisplay` | Renderiza badge com estilo por raridade, glow em lendários, suporte a ícones |
| `ErrorBoundary` | Class component que captura erros React com botão de retry |
| `LoadingScreen` | Spinner animado com mensagem "Carregando..." |
| `MiniChat` | Widget flutuante de chat da equipe, fixável e minimizável |
| `Modal` | Dialog genérico com tamanhos sm/md/lg/xl, backdrop e close |
| `Providers` | Wrapper de contextos: I18nProvider → AuthProvider → Toaster |
| `StatsCard` | Card de estatística com animação de contagem e cores temáticas |

---

## Internacionalização (i18n)

**Arquivo**: `src/lib/i18n.tsx`

- **Locales**: `pt-BR` (padrão) e `en`
- **200+ chaves de tradução** organizadas por seção:
  - `nav.*` — Navegação
  - `auth.*` — Autenticação
  - `dash.*` — Dashboard
  - `event.*` — Eventos
  - `mission.*` — Missões
  - `challenge.*` — Desafios
  - `league.*` — Ligas
  - `class.*` — Turmas
  - `team.*` — Equipes
  - `chat.*` — Chat
  - `score.*` — Scoreboard
  - `profile.*` — Perfil
  - `common.*` — Termos comuns
- **Toggle de idioma**: ícone de globo na navbar superior
- **Hook**: `useI18n()` retorna `{ t, locale, setLocale }`

---

## Estilização (Tema Cyber)

### Paleta de Cores

| Token | Cor | Hex |
|---|---|---|
| `cyber-bg` | Background principal | `#0a0e1a` |
| `cyber-darker` | Background mais escuro | `#060910` |
| `cyber-card` | Cards | `#111827` |
| `cyber-border` | Bordas | `#1e293b` |
| `cyber-cyan` | Ciano primário | `#06b6d4` |
| `cyber-purple` | Roxo secundário | `#8b5cf6` |
| `cyber-green` | Verde sucesso | `#10b981` |
| `cyber-orange` | Laranja alerta | `#f59e0b` |
| `cyber-red` | Vermelho erro | `#ef4444` |
| `cyber-pink` | Rosa destaque | `#ec4899` |

### Classes Utilitárias Customizadas

- `.cyber-card` / `.cyber-card-glow` — Cards com backdrop-blur e neon hover
- `.cyber-btn-primary` / `secondary` / `danger` / `success` — Botões temáticos
- `.cyber-input` / `.cyber-select` / `.cyber-textarea` — Inputs estilizados
- `.neon-text-cyan` / `purple` / `green` — Texto com glow neon
- `.grid-bg` — Background com grid sutil de linhas cyan
- `.animate-gradient` — Gradiente animado

### Fontes

- **Inter** (300–900) — Corpo do texto
- **JetBrains Mono** (400–700) — Código e elementos mono

---

## Segurança

- **Row Level Security (RLS)** em todas as tabelas
- **CSP Headers** configurados no `next.config.js`:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co`
  - `img-src 'self' data: https:`
  - `font-src 'self' data: https://fonts.gstatic.com`
- **Headers de segurança**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`
- **Sanitização XSS**: DOMPurify para HTML, sanitização manual para texto, validação de URLs
- **Validação de senha**: 8+ chars, maiúscula, minúscula, número, caractere especial
- **JWT validado server-side** no middleware via `getUser()` (não apenas `getSession()`)
- **Timeout de sessão**: 1 hora de inatividade
- **PKCE flow** para autenticação no browser

---

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

---

## Como Rodar

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Iniciar produção
npm start
```

### Setup do Banco

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o arquivo `supabase/schema.sql` no SQL Editor do Supabase
3. Configure as variáveis de ambiente no `.env.local`
4. Habilite Realtime para a tabela `chat_messages` no painel do Supabase

---

## Status Atual do Projeto

### ✅ Implementado

- [x] Sistema de autenticação completo (login, registro, sessão, middleware)
- [x] Layout do dashboard com sidebar responsiva e navbar
- [x] Sistema de navegação por roles
- [x] Dashboard principal com estatísticas
- [x] CRUD completo de Eventos
- [x] Detalhes de evento com missões, desafios e submissão de flags
- [x] Campos enriquecidos no desafio: dificuldade (Fácil/Médio/Difícil/De fritar o cérebro), "O que aprendi", "Saiba mais"
- [x] Sistema de dicas com custo em Shells — CRUD completo (adicionar, editar, excluir)
- [x] Botão de adicionar dica inline em cada desafio
- [x] Visibilidade inteligente: dicas/aprendizado visíveis por role e autoria do evento
- [x] Reações (like/dislike) em desafios
- [x] Confetti ao acertar flag
- [x] CRUD completo de Ligas
- [x] Ligas com tempo restante em dias:horas:minutos e botão "Acessar Evento"
- [x] CRUD completo de Turmas com código de acesso
- [x] Gerenciamento de membros de turma
- [x] Equipes com código de acesso e hierarquia líder/membro
- [x] Chat em tempo real por equipe (Realtime + polling)
- [x] MiniChat flutuante fixável
- [x] Notificações de chat (toast + som + contador)
- [x] Sistema de @menção no chat com autocomplete, destaque e som diferenciado
- [x] Painel de membros expansível no chat (nome, e-mail, data de ingresso)
- [x] Contagem de participantes exibida nos cards de equipes
- [x] Scoreboard com coluna "Última Flag" (data/hora da captura) e critérios de ranking visíveis
- [x] Filtro de liga no scoreboard corrigido (event_codes + league_code)
- [x] Scoreboard individual e por equipes
- [x] Sistema de badges com 4 raridades
- [x] Perfil do usuário com XP, nível, Shells, stats
- [x] Página de ajuda/FAQ completa
- [x] Painel administrativo
- [x] Internacionalização PT-BR / EN
- [x] Tema cyber dark completo
- [x] Schema SQL com 17 tabelas, RLS, triggers e indexes
- [x] Segurança: CSP headers, XSS sanitization, PKCE, JWT server-side

### 🔜 Possíveis Próximos Passos

- [ ] Testes automatizados (unit, integration, e2e)
- [ ] Upload de imagens para Supabase Storage (eventos, turmas, perfil)
- [ ] Notificações push / email
- [ ] Sistema de conquistas automáticas (badge triggers)
- [ ] Exportação de resultados (CSV/PDF)
- [ ] Deploy (Vercel + Supabase Production)
- [ ] PWA (Progressive Web App)
- [ ] Dark/Light mode toggle

---

> **Este README serve como referência central do projeto.** Atualize-o conforme novas funcionalidades forem implementadas para manter o registro de progresso.
