# Documento de Requisitos — mdavelCTF

**Projeto:** mdavelCTF — Plataforma Gamificada de Competições Capture the Flag  
**Versão:** 1.0  
**Data:** Junho 2025  
**Stack Tecnológica:** Next.js 14 (App Router) · React 18 · TypeScript 5.7 · Tailwind CSS 3.4 · Supabase (PostgreSQL + Auth + Realtime)

---

## Sumário

1. [Requisitos Funcionais (RF)](#1-requisitos-funcionais-rf)
2. [Requisitos Não Funcionais (RNF)](#2-requisitos-não-funcionais-rnf)
3. [Regras de Negócio (RN)](#3-regras-de-negócio-rn)
4. [Matriz de Rastreabilidade](#4-matriz-de-rastreabilidade)

---

## 1. Requisitos Funcionais (RF)

### 1.1 Autenticação e Sessão

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-001 | O sistema deve permitir login com e-mail e senha via Supabase Auth (PKCE flow). | Alta |
| RF-002 | O sistema deve permitir autocadastro de novos usuários com nome de exibição, e-mail e senha. | Alta |
| RF-003 | O cadastro deve exigir senha com no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial. | Alta |
| RF-004 | O sistema deve validar os requisitos de senha em tempo real na tela de registro, com indicadores visuais (✅/❌). | Média |
| RF-005 | Novos usuários registrados devem receber automaticamente o perfil "competitor" via trigger de banco de dados (`handle_new_user`). | Alta |
| RF-006 | O sistema deve redirecionar usuários não autenticados que acessam `/dashboard/*` para a página de login. | Alta |
| RF-007 | O sistema deve redirecionar usuários autenticados que acessam `/` (login) para `/dashboard`. | Média |
| RF-008 | O middleware deve validar o JWT do usuário no lado do servidor utilizando `getUser()` (não `getSession()`). | Alta |
| RF-009 | O sistema deve deslogar automaticamente o usuário após 1 hora de inatividade (idle timeout). | Média |
| RF-010 | O sistema deve monitorar atividade do usuário (click, keydown, mousemove, scroll, touchstart, pointerdown) para reiniciar o timer de inatividade. | Média |
| RF-011 | Quando a aba do navegador ficar oculta por mais de 5 minutos e retornar visível, o sistema deve renovar o token proativamente. | Média |
| RF-012 | O sistema deve permitir que o usuário realize logout manual. | Alta |
| RF-013 | O sistema deve ter timeout de segurança de 4 segundos na inicialização da autenticação, forçando o fim do estado de carregamento caso a auth não responda. | Baixa |

### 1.2 Perfis de Usuário

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-014 | O sistema deve suportar 4 perfis de usuário: `super_admin`, `admin`, `instructor` e `competitor`. | Alta |
| RF-015 | O perfil do usuário deve conter: nome de exibição, e-mail, papel (role), URL do avatar, BIO, curso, turma/grupo, departamento, XP, shells, nível. | Alta |
| RF-016 | O sistema deve exibir a página de perfil com estatísticas do usuário: total de submissões, acertos, erros, pontos e precisão. | Média |
| RF-017 | A página de perfil deve exibir resoluções agrupadas por categoria de evento. | Baixa |
| RF-018 | A página de perfil deve exibir os badges conquistados pelo usuário. | Média |
| RF-019 | O usuário deve poder editar seu perfil: nome de exibição, BIO, curso, turma/grupo, departamento e URL do avatar. | Média |

### 1.3 Painel (Dashboard)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-020 | O dashboard do **administrador** deve exibir: Total de Eventos, Ao Vivo Agora, Usuários, Submissões, Resoluções, Taxa de Resolução, Dicas Desbloqueadas, Análise de Temporadas (total de ligas e eventos em ligas). | Alta |
| RF-021 | O dashboard do administrador deve exibir um feed de atividades recentes com as últimas 10 submissões (nome do usuário, desafio, status correto/incorreto, horário). | Média |
| RF-022 | O dashboard do **instrutor** deve exibir: Total de Turmas, Total de Alunos e Meus Eventos. | Alta |
| RF-023 | O dashboard do instrutor deve exibir um guia rápido com 3 passos: Criar Turma, Criar Evento, Acompanhar. | Baixa |
| RF-024 | O dashboard do **competidor** deve exibir: XP Total, Level, Shells 🐚 e Pontos para o Próximo Nível. | Alta |
| RF-025 | O dashboard do competidor deve exibir um guia rápido com 4 dicas: Ingressar em Turma, Resolver Desafios, Criar Equipe, Conquiste Badges. | Baixa |
| RF-026 | O dashboard do competidor deve exibir o feed de atividades filtrado para as suas próprias submissões. | Média |

### 1.4 Eventos

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-027 | Administradores e instrutores devem poder criar eventos com: nome, descrição, data início, data fim, visibilidade (público/privado), modo de equipe (event_teams/public_teams), categoria, categoria customizada, código da liga, turma vinculada, URL de imagem e recompensa em shells. | Alta |
| RF-028 | O sistema deve gerar automaticamente um código único de 6 caracteres alfanuméricos para cada evento. | Alta |
| RF-029 | Eventos devem exibir indicadores visuais de status: Agendado, Ao Vivo ou Encerrado, calculados a partir das datas de início e fim. | Média |
| RF-030 | O sistema deve permitir a edição de eventos existentes. | Alta |
| RF-031 | O sistema deve permitir a exclusão de eventos. | Alta |
| RF-032 | A listagem de eventos deve permitir filtro por busca textual (nome ou código). | Média |
| RF-033 | Cada card de evento na listagem deve exibir: nome, categoria, status, número de missões, número de desafios, número de flags capturadas e duração. | Média |
| RF-034 | O usuário deve poder acessar a página de detalhes de um evento ao clicar no card. | Alta |

### 1.5 Missões

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-035 | Dentro de um evento, o gestor deve poder criar missões com: nome, descrição, URL de imagem, links de download, dificuldade (easy/medium/hard/expert/insane), tempo para conclusão (min), autor e conclusões. | Alta |
| RF-036 | Missões devem ter um campo de sequência (order) para ordenação. | Média |
| RF-037 | O gestor deve poder editar missões existentes. | Alta |
| RF-038 | O gestor deve poder excluir missões. | Alta |
| RF-039 | Ao clicar em uma missão, o sistema deve expandir e exibir os desafios (challenges) vinculados. | Alta |

### 1.6 Desafios (Challenges / Bandeiras)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-040 | Dentro de uma missão, o gestor deve poder criar desafios com: número de sequência, título, descrição, máximo de tentativas (ou ilimitado), pontos, flag (bandeira/resposta correta), dificuldade (Fácil/Médio/Difícil/De fritar o cérebro), "O que aprendi" e "Onde aprender mais" (URL). | Alta |
| RF-041 | O gestor deve poder editar desafios existentes. | Alta |
| RF-042 | O gestor deve poder excluir desafios. | Alta |
| RF-043 | O competidor deve poder submeter uma resposta (flag) para um desafio. | Alta |
| RF-044 | O sistema deve verificar se a resposta submetida corresponde à flag do desafio e informar se está correta ou incorreta. | Alta |
| RF-045 | Ao acertar um desafio, o sistema deve exibir confetti e uma modal de parabéns com os pontos ganhos. | Média |
| RF-046 | O sistema deve impedir novas submissões caso o competidor tenha atingido o máximo de tentativas configurado. | Alta |
| RF-047 | Desafios já resolvidos devem exibir indicador visual "Resolvido" (badge verde). | Média |
| RF-048 | O competidor deve poder reagir (like/dislike) a cada desafio. | Baixa |
| RF-049 | O campo "O que aprendi" deve ser visível **somente** para o gestor/criador do evento ou após o competidor resolver o desafio. | Alta |
| RF-050 | O campo "Onde aprender mais" deve seguir a mesma regra de visibilidade de RF-049. | Alta |

### 1.7 Dicas (Hints)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-051 | O gestor deve poder adicionar dicas a cada desafio individualmente, com: conteúdo, custo em shells e índice de ordem. | Alta |
| RF-052 | O gestor deve poder editar dicas existentes. | Alta |
| RF-053 | O gestor deve poder excluir dicas. | Alta |
| RF-054 | As dicas devem ser exibidas por padrão como "Bloqueada" com ícone de cadeado para competidores. | Alta |
| RF-055 | O competidor deve poder desbloquear uma dica gastando a quantidade configurada de shells. | Alta |
| RF-056 | Após desbloquear, o conteúdo da dica deve ser exibido e a dica marcada como "Usada". | Alta |
| RF-057 | O gestor privilegiado (admin ou criador do evento) deve sempre ver o conteúdo completo das dicas sem necessidade de desbloqueio. | Alta |
| RF-058 | O sistema deve registrar o uso de cada dica na tabela `hint_usage` com referência ao hint e ao usuário. | Alta |

### 1.8 Ligas (Leagues / Temporadas)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-059 | Administradores e instrutores devem poder criar ligas com: nome, URL de imagem e códigos de eventos (separados por vírgula). | Alta |
| RF-060 | O sistema deve gerar automaticamente um código único de 6 caracteres para cada liga. | Alta |
| RF-061 | O sistema deve vincular eventos a ligas através da tabela `league_events`. | Alta |
| RF-062 | A página de ligas deve apresentar navegação em 3 níveis: lista de ligas → detalhes da liga → detalhes do evento dentro da liga. | Média |
| RF-063 | Os cards de liga devem exibir: nome, código, total de eventos vinculados, total de desafios e tempo restante (ou status Encerrada/Ativa/Agendada). | Média |
| RF-064 | O tempo restante deve ser exibido no formato `Xd Xh Xm`. | Baixa |
| RF-065 | Na visualização de detalhes da liga, deve ser possível ver todos os eventos vinculados com suas respectivas informações (nome, categoria, datas, status, missões e desafios). | Média |
| RF-066 | Na visualização detalhada de evento dentro da liga, deve ser possível ver as missões e seus desafios com breakdown de flags. | Média |
| RF-067 | Deve haver um botão "Acessar Evento" que navega para a página de detalhes do evento (`/dashboard/events/[id]`). | Média |
| RF-068 | O gestor deve poder editar ligas existentes. | Alta |
| RF-069 | O gestor deve poder excluir ligas. | Alta |

### 1.9 Turmas (Classes)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-070 | Instrutores e administradores devem poder criar turmas com: nome, descrição, URL de imagem, TAG (categoria) e TAG customizada. | Alta |
| RF-071 | O sistema deve gerar automaticamente um código único de 6 caracteres para cada turma. | Alta |
| RF-072 | Competidores devem poder ingressar em turmas usando o código de 6 caracteres fornecido pelo instrutor. | Alta |
| RF-073 | O sistema deve impedir que um competidor ingresse novamente em uma turma em que já é membro (constraint unique). | Média |
| RF-074 | O gestor deve poder visualizar os detalhes da turma: membros (nome, e-mail, status), eventos vinculados e informações gerais. | Média |
| RF-075 | O gestor deve poder inativar ou remover membros de uma turma. | Média |
| RF-076 | O instrutor deve poder regenerar o código de acesso de uma turma via função RPC (`regenerate_class_code`). | Média |
| RF-077 | O gestor deve poder editar turmas existentes. | Alta |
| RF-078 | O gestor deve poder excluir turmas. | Alta |
| RF-079 | Competidores devem visualizar apenas as turmas em que estão inscritos com status "active". | Alta |
| RF-080 | A listagem deve permitir filtro por busca textual (nome ou código). | Média |

### 1.10 Equipes (Teams)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-081 | Qualquer usuário autenticado deve poder criar equipes com: nome, URL de imagem e configuração pública/privada. | Alta |
| RF-082 | O sistema deve gerar automaticamente um código de 6 caracteres para cada equipe. | Alta |
| RF-083 | Usuários devem poder ingressar em equipes usando o código de 6 caracteres. | Alta |
| RF-084 | Equipes públicas devem aparecer na lista para todos os usuários. | Média |
| RF-085 | O criador da equipe deve automaticamente ter o papel "leader". | Alta |
| RF-086 | O líder deve poder gerenciar (promover/remover) membros da equipe. | Média |
| RF-087 | Membros podem sair voluntariamente da equipe. | Média |
| RF-088 | Administradores e super admins podem excluir qualquer equipe. | Média |

### 1.11 Chat de Equipe

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-089 | Membros de uma equipe devem poder trocar mensagens de texto em tempo real via chat integrado. | Alta |
| RF-090 | O chat deve utilizar Supabase Realtime para entrega instantânea de mensagens, com polling de fallback. | Alta |
| RF-091 | O sistema deve exibir as mensagens com nome do remetente e horário de envio. | Média |
| RF-092 | Deve existir um componente de **Mini Chat** global que pode ser fixado e acompanhar a navegação entre páginas do dashboard. | Média |
| RF-093 | O Mini Chat deve poder ser minimizado/expandido e ter controle de fixação (pin/unpin). | Baixa |
| RF-094 | Apenas membros da equipe devem ter acesso às mensagens do chat (RLS enforced). | Alta |

### 1.12 Placar (Scoreboard)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-095 | O sistema deve exibir um placar de ranking com posição, nome, pontuação total, acertos, total de desafios, precisão (%), nível e dicas usadas. | Alta |
| RF-096 | O placar deve permitir filtrar por: modo (Individual/Equipes), evento específico e liga/temporada. | Alta |
| RF-097 | O ranking deve ser ordenado por pontuação decrescente, com empates desfeitos pelo tempo da última resolução. | Média |
| RF-098 | O top 3 do ranking deve receber destaque visual (ouro, prata, bronze). | Baixa |
| RF-099 | O ranking deve considerar apenas submissões corretas (`is_correct = true`). | Alta |

### 1.13 Distintivos (Badges)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-100 | Administradores devem poder criar badges com: nome, chave de critério, ícone, raridade (Comum/Cru/Épico/Lendário), recompensa em shells e descrição. | Alta |
| RF-101 | Administradores devem poder editar e excluir badges. | Alta |
| RF-102 | Administradores devem poder atribuir badges a usuários específicos. | Alta |
| RF-103 | Todos os usuários devem visualizar a galeria de badges disponíveis, com indicação de quais já conquistaram. | Média |
| RF-104 | Cada badge deve exibir visual distinto conforme raridade (cores: cinza/azul/roxo/dourado). | Baixa |

### 1.14 Administração

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-105 | A página de administração deve ser acessível apenas por `super_admin` e `admin`. | Alta |
| RF-106 | Administradores devem poder visualizar e filtrar a lista completa de usuários da plataforma. | Alta |
| RF-107 | Administradores devem poder alterar o papel (role) de qualquer usuário (exceto `super_admin`). | Alta |
| RF-108 | Administradores devem poder excluir usuários. | Alta |
| RF-109 | O sistema deve oferecer funcionalidade de **seed de dados de demonstração** com: 2 ligas, 2 turmas, 3 eventos, 6 missões, 14 desafios, 10 dicas, 3 equipes e 10 badges. | Baixa |
| RF-110 | O sistema deve oferecer funcionalidade de **limpeza** (cleanup) dos dados de demonstração via tag identificador (`__seed_demo__`). | Baixa |

### 1.15 Ajuda

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-111 | O sistema deve fornecer uma página de ajuda com seções expansíveis cobrindo: O que é a mdavelCTF, Perfis de Usuário (4 roles), Ligas, Eventos, Missões, Desafios, Dicas, Equipes, Shells, XP/Níveis, Ranking, Turmas, Badges e Segurança/Sessão. | Média |

### 1.16 Internacionalização (i18n)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-112 | O sistema deve suportar dois idiomas: Português Brasil (pt-BR) como padrão e Inglês (en). | Alta |
| RF-113 | O sistema deve disponibilizar mais de 200 chaves de tradução cobrindo: navegação, autenticação, dashboard, eventos, missões, desafios, ligas, turmas, equipes, chat, placar, perfil, badges, ajuda e comuns. | Alta |
| RF-114 | O usuário deve poder alternar o idioma da interface em tempo de execução. | Média |

### 1.17 Submissões e Gamificação

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-115 | Cada submissão deve registrar: desafio, usuário, equipe (opcional), resposta, flag correta, pontos concedidos e timestamp. | Alta |
| RF-116 | O sistema deve, via trigger (`handle_correct_submission`), ao registrar uma submissão correta, automaticamente: incrementar XP do usuário, recalcular nível e adicionar shells de recompensa do evento. | Alta |
| RF-117 | O nível do usuário deve ser calculado pela fórmula: `FLOOR(xp / 100) + 1`. | Alta |
| RF-118 | A barra de progresso de XP deve exibir a porcentagem do nível atual (`xp % 100`). | Média |

---

## 2. Requisitos Não Funcionais (RNF)

### 2.1 Segurança

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RNF-001 | Toda entrada de HTML fornecida pelo usuário deve ser sanitizada usando DOMPurify com whitelist de tags permitidas (b, i, em, strong, a, p, br, ul, ol, li, h1-h4, code, pre, blockquote) e atributos (href, target, rel). | Alta |
| RNF-002 | Toda entrada de texto plano deve ser sanitizada com escape de caracteres especiais HTML (`&`, `<`, `>`, `"`, `'`). | Alta |
| RNF-003 | Toda URL fornecida pelo usuário deve ser validada para aceitar apenas protocolos `http:` e `https:`. | Alta |
| RNF-004 | O sistema deve utilizar Row Level Security (RLS) no PostgreSQL para todas as 17 tabelas, garantindo que as políticas de acesso sejam enforced no nível do banco de dados. | Alta |
| RNF-005 | O middleware Next.js deve validar o JWT do lado do servidor (via `getUser()`) antes de permitir acesso a rotas protegidas. | Alta |
| RNF-006 | O sistema deve enviar os seguintes headers de segurança HTTP em todas as respostas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`. | Alta |
| RNF-007 | O sistema deve definir uma Content Security Policy (CSP) restritiva que permita apenas: `self`, supabase.co (connect-src), fonts.googleapis.com/gstatic.com (fonts), HTTPS para imagens. | Alta |
| RNF-008 | Todas as tabelas devem ter RLS habilitado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) e políticas explícitas criadas. | Alta |
| RNF-009 | Funções sensíveis do banco devem usar `SECURITY DEFINER` para execução com privilégios elevados de forma controlada (`handle_new_user`, `regenerate_class_code`, `handle_correct_submission`). | Alta |
| RNF-010 | O fluxo de autenticação deve utilizar PKCE (Proof Key for Code Exchange) conforme configurado no Supabase Auth. | Alta |
| RNF-011 | Senhas devem atender ao padrão de complexidade definido em RF-003 (mínimo 8 caracteres, maiúscula, minúscula, número e especial). | Alta |

### 2.2 Desempenho

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RNF-012 | O banco de dados deve possuir índices de performance nas colunas mais consultadas: `profiles.role`, `events.visibility`, `events.created_by`, `events.class_id`, `missions.event_id`, `challenges.mission_id`, `hints.challenge_id`, `submissions.user_id`, `submissions.challenge_id`, `class_members.class_id`, `class_members.user_id`, `team_members.team_id`, `team_members.user_id`, `chat_messages.team_id`, `user_badges.user_id`. | Alta |
| RNF-013 | O dashboard deve carregar dados em paralelo usando `Promise.allSettled` para evitar que a falha de uma query bloqueie as demais. | Média |
| RNF-014 | Carregamento de dados nas páginas deve usar padrão de cancelamento (`cancelled` flag) para evitar atualizações de estado em componentes desmontados. | Média |
| RNF-015 | As funções `calculate_level` e `xp_for_next_level` devem ser marcadas como `IMMUTABLE` para permitir caching pelo PostgreSQL. | Baixa |

### 2.3 Usabilidade

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RNF-016 | A interface deve utilizar tema dark cybernético com cores: background `#0a0e1a`, cyan `#06b6d4`, purple `#8b5cf6`, green `#10b981`. | Alta |
| RNF-017 | Todas as páginas devem utilizar design responsivo (mobile-first) com breakpoints para sm, md e lg. | Alta |
| RNF-018 | O sistema deve utilizar toasts (react-hot-toast) para feedback instantâneo de operações: sucesso (verde), erro (vermelho). | Média |
| RNF-019 | Modais devem ser utilizados para operações de CRUD (criar/editar) com formulários contextualizados. | Média |
| RNF-020 | Ações destrutivas (excluir) devem exigir confirmação via `confirm()`. | Média |
| RNF-021 | Botões de edição/exclusão em cards devem aparecer com opacidade zero e se revelar no hover (progressive disclosure). | Baixa |
| RNF-022 | O sistema deve exibir estados de carregamento (LoadingScreen / texto "Carregando...") durante operações assíncronas. | Média |
| RNF-023 | O sistema deve exibir estados vazios com ícone e mensagem quando não há dados disponíveis. | Baixa |
| RNF-024 | O sistema deve utilizar animações de entrada (`animate-fade-in`) nas transições de página. | Baixa |

### 2.4 Confiabilidade

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RNF-025 | O sistema deve possuir um componente `ErrorBoundary` global para capturar erros de renderização e evitar crash da aplicação inteira. | Alta |
| RNF-026 | Falhas em queries paralelas não devem impactar o carregamento de outras queries (uso de `Promise.allSettled`). | Média |
| RNF-027 | Erros de rede durante renovação de token não devem forçar logout imediato; apenas o timer de inatividade deve deslogar. | Média |

### 2.5 Manutenibilidade

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RNF-028 | Constantes compartilhadas (categorias, dificuldades, raridades, cores) devem ser centralizadas no arquivo `utils.ts`. | Média |
| RNF-029 | Textos da interface devem ser externalizados no sistema de i18n (`i18n.tsx`), não hardcoded nos componentes. | Média |
| RNF-030 | Componentes reutilizáveis devem ser extraídos em `src/components/` (Modal, BadgeDisplay, ErrorBoundary, LoadingScreen, MiniChat, StatsCard). | Média |
| RNF-031 | Lógica de autenticação e perfil deve ser centralizada no `AuthProvider` (`auth.tsx`). | Média |
| RNF-032 | Acesso ao Supabase deve ser centralizado via `supabase.ts` (client) e `supabase-server.ts` (server). | Média |

### 2.6 Escalabilidade

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RNF-033 | A arquitetura deve suportar múltiplas ligas com múltiplos eventos vinculados sem degradação de performance. | Média |
| RNF-034 | O modelo de dados deve suportar equipes competindo em diferentes eventos simultaneamente. | Média |
| RNF-035 | O padrão client-side com Supabase permite escala horizontal do frontend sem modificação do backend. | Baixa |

---

## 3. Regras de Negócio (RN)

### 3.1 Controle de Acesso por Papel

| ID | Regra | Prioridade |
|----|-------|------------|
| RN-001 | **Super Admin** tem acesso geral e irrestrito a toda a plataforma. Não pode ser alterado por nenhum outro usuário. | Alta |
| RN-002 | **Admin** tem acesso a todas funcionalidades exceto alterar Super Admin. Pode criar/gerenciar badges. | Alta |
| RN-003 | **Instrutor** pode criar e gerenciar **suas próprias** turmas, eventos, missões e desafios. Possui dashboard com indicadores. | Alta |
| RN-004 | **Competidor** pode: autocadastrar-se, ingressar em turmas por código, acessar eventos públicos, criar/ingressar em equipes por código, usar chat, resolver desafios, acumular XP/badges. | Alta |

### 3.2 Propriedade e Gestão de Conteúdo

| ID | Regra | Prioridade |
|----|-------|------------|
| RN-005 | Um instrutor pode gerenciar (editar/excluir) um evento **somente se** for o criador desse evento (`created_by = profile.id`). | Alta |
| RN-006 | Administradores e super admins podem gerenciar **qualquer** evento independentemente de quem o criou. | Alta |
| RN-007 | A permissão de gerenciar missões, desafios e dicas de um evento segue a mesma regra de propriedade do evento (RN-005 e RN-006). | Alta |
| RN-008 | Instrutores que **não** criaram uma liga ou evento não podem adicionar desafios, dicas ou missões nele. | Alta |
| RN-009 | Um instrutor pode editar/excluir uma liga **somente se** for o criador dessa liga. | Alta |
| RN-010 | Um instrutor pode editar/excluir uma turma **somente se** for o instrutor vinculado a essa turma (`instructor_id = profile.id`). | Alta |
| RN-011 | Equipes podem ser excluídas pelo criador ou por administradores. | Média |

### 3.3 Gamificação

| ID | Regra | Prioridade |
|----|-------|------------|
| RN-012 | **XP** é concedido automaticamente ao resolver um desafio corretamente. O valor de XP é igual aos pontos do desafio. | Alta |
| RN-013 | **Nível** é calculado pela fórmula: `FLOOR(xp / 100) + 1`, com mínimo de nível 1. | Alta |
| RN-014 | **Shells (🐚)** são a moeda virtual da plataforma. São concedidos ao resolver desafios baseado na `shell_reward` do evento. | Alta |
| RN-015 | Shells podem ser gastos para desbloquear dicas. Cada dica tem um custo em shells configurado pelo gestor. | Alta |
| RN-016 | O desbloqueio de uma dica é irreversível e registrado em `hint_usage`. O competidor não pode desbloquear a mesma dica duas vezes (constraint unique). | Alta |
| RN-017 | Badges possuem 4 níveis de raridade: Comum, Cru, Épico e Lendário, cada um com recompensa em shells associada. | Média |
| RN-018 | Badges são atribuídos manualmente por administradores (não são automáticos). | Média |

### 3.4 Submissões

| ID | Regra | Prioridade |
|----|-------|------------|
| RN-019 | Cada submissão registra o `challenge_id`, `user_id`, `team_id` (opcional), `answer`, `is_correct`, `points_awarded` e `submitted_at`. | Alta |
| RN-020 | Se `max_attempts` do desafio não for nulo, o sistema deve bloquear submissões ao atingir o limite de tentativas. | Alta |
| RN-021 | Submissões corretas não concedem pontos duplicados — após resolver, o campo input é substituído pelo badge "Resolvido". | Alta |
| RN-022 | A trigger `handle_correct_submission` é acionada após INSERT em submissions com `is_correct = true`, atualizando XP, nível e shells do perfil. | Alta |

### 3.5 Visibilidade de Conteúdo

| ID | Regra | Prioridade |
|----|-------|------------|
| RN-023 | **Dicas — Gestor privilegiado** (admin/super_admin ou instrutor criador do evento) sempre vê o conteúdo completo das dicas sem necessidade de desbloqueio. | Alta |
| RN-024 | **Dicas — Competidor** vê dicas como "Bloqueada" por padrão, podendo desbloquear pagando shells. | Alta |
| RN-025 | **"O que aprendi" e "Onde aprender mais"** — Gestor privilegiado sempre vê esses campos. Competidores só veem após resolver o desafio. | Alta |
| RN-026 | Eventos **privados** seguem regras de acesso baseadas em turma vinculada (via `class_id`). Eventos **públicos** são visíveis a todos. | Média |

### 3.6 Turmas e Membros

| ID | Regra | Prioridade |
|----|-------|------------|
| RN-027 | Um competidor pode ingressar em uma turma somente via código de 6 caracteres. Esse código pode ser regenerado pelo instrutor. | Alta |
| RN-028 | Membros de turma podem estar nos status: `active`, `inactive` ou `removed`. Apenas `active` conta para estatísticas. | Média |
| RN-029 | Competidores visualizam apenas turmas com status "active" em sua listagem. | Média |

### 3.7 Equipes e Chat

| ID | Regra | Prioridade |
|----|-------|------------|
| RN-030 | O criador de uma equipe recebe automaticamente o papel `leader`. Demais membros são `member`. | Alta |
| RN-031 | O chat é restrito a membros da equipe. Mensagens são visíveis apenas por quem participa da equipe (enforced por RLS). | Alta |
| RN-032 | O Mini Chat pode ser fixado para acompanhar a navegação entre páginas. | Baixa |

### 3.8 Ligas / Temporadas

| ID | Regra | Prioridade |
|----|-------|------------|
| RN-033 | Ligas agrupam múltiplos eventos. Um evento pode pertencer a múltiplas ligas via tabela `league_events`. | Média |
| RN-034 | O status da liga é derivado das datas dos eventos vinculados: se algum evento está ao vivo → "Ativa"; se todos estão encerrados → "Encerrada"; se todos são futuros → "Agendada". | Média |
| RN-035 | O placar pode ser filtrado por liga, agregando pontuações de todos os eventos vinculados. | Média |

---

## 4. Matriz de Rastreabilidade

### 4.1 Requisitos Funcionais → Artefatos de Código

| Requisito | Artefato(s) Principal(is) |
|-----------|---------------------------|
| RF-001, RF-002, RF-012 | `src/lib/auth.tsx` (AuthProvider, signIn, signUp, signOut) |
| RF-003, RF-004 | `src/lib/utils.ts` (validatePassword), `src/app/register/page.tsx` |
| RF-005 | `supabase/schema.sql` (trigger `handle_new_user`) |
| RF-006, RF-007, RF-008 | `src/middleware.ts` |
| RF-009, RF-010, RF-011, RF-013 | `src/lib/auth.tsx` (IDLE_TIMEOUT, activity tracking, visibility change) |
| RF-014, RF-015 | `supabase/schema.sql` (tabela `profiles`), `src/lib/auth.tsx` (Profile interface) |
| RF-016, RF-017, RF-018, RF-019 | `src/app/dashboard/profile/page.tsx` |
| RF-020, RF-021, RF-022, RF-023, RF-024, RF-025, RF-026 | `src/app/dashboard/page.tsx` |
| RF-027, RF-028, RF-029, RF-030, RF-031, RF-032, RF-033, RF-034 | `src/app/dashboard/events/page.tsx`, `supabase/schema.sql` (tabela `events`) |
| RF-035, RF-036, RF-037, RF-038, RF-039 | `src/app/dashboard/events/[id]/page.tsx`, `supabase/schema.sql` (tabela `missions`) |
| RF-040, RF-041, RF-042, RF-043, RF-044, RF-045, RF-046, RF-047, RF-048, RF-049, RF-050 | `src/app/dashboard/events/[id]/page.tsx`, `supabase/schema.sql` (tabela `challenges`) |
| RF-051, RF-052, RF-053, RF-054, RF-055, RF-056, RF-057, RF-058 | `src/app/dashboard/events/[id]/page.tsx`, `supabase/schema.sql` (tabelas `hints`, `hint_usage`) |
| RF-059, RF-060, RF-061, RF-062, RF-063, RF-064, RF-065, RF-066, RF-067, RF-068, RF-069 | `src/app/dashboard/leagues/page.tsx`, `supabase/schema.sql` (tabelas `leagues`, `league_events`) |
| RF-070, RF-071, RF-072, RF-073, RF-074, RF-075, RF-076, RF-077, RF-078, RF-079, RF-080 | `src/app/dashboard/classes/page.tsx`, `supabase/schema.sql` (tabelas `classes`, `class_members`) |
| RF-081, RF-082, RF-083, RF-084, RF-085, RF-086, RF-087, RF-088 | `src/app/dashboard/teams/page.tsx`, `supabase/schema.sql` (tabelas `teams`, `team_members`) |
| RF-089, RF-090, RF-091, RF-092, RF-093, RF-094 | `src/app/dashboard/teams/page.tsx`, `src/components/MiniChat.tsx`, `supabase/schema.sql` (tabela `chat_messages`) |
| RF-095, RF-096, RF-097, RF-098, RF-099 | `src/app/dashboard/scoreboard/page.tsx` |
| RF-100, RF-101, RF-102, RF-103, RF-104 | `src/app/dashboard/badges/page.tsx`, `src/components/BadgeDisplay.tsx`, `supabase/schema.sql` (tabelas `badges`, `user_badges`) |
| RF-105, RF-106, RF-107, RF-108, RF-109, RF-110 | `src/app/dashboard/admin/page.tsx` |
| RF-111 | `src/app/dashboard/help/page.tsx` |
| RF-112, RF-113, RF-114 | `src/lib/i18n.tsx` |
| RF-115, RF-116, RF-117, RF-118 | `supabase/schema.sql` (tabela `submissions`, triggers `handle_correct_submission`, funções `calculate_level`, `xp_for_next_level`) |

### 4.2 Requisitos Não Funcionais → Artefatos de Código

| Requisito | Artefato(s) Principal(is) |
|-----------|---------------------------|
| RNF-001, RNF-002, RNF-003 | `src/lib/utils.ts` (sanitizeHtml, sanitizeText, sanitizeUrl) |
| RNF-004, RNF-008, RNF-009 | `supabase/schema.sql` (RLS policies em todas as 17 tabelas, SECURITY DEFINER functions) |
| RNF-005 | `src/middleware.ts` |
| RNF-006, RNF-007 | `next.config.js` (headers de segurança, CSP) |
| RNF-010 | `src/lib/auth.tsx` (PKCE flow via Supabase) |
| RNF-011 | `src/lib/utils.ts` (validatePassword), `src/app/register/page.tsx` |
| RNF-012, RNF-015 | `supabase/schema.sql` (CREATE INDEX, IMMUTABLE functions) |
| RNF-013, RNF-014, RNF-026 | `src/app/dashboard/page.tsx`, padrão aplicado em todas as pages |
| RNF-016 | `tailwind.config.ts`, `src/app/globals.css` |
| RNF-017 | Tailwind CSS classes responsivas em todas as pages |
| RNF-018 | `react-hot-toast` utilizado em todas as pages de CRUD |
| RNF-019 | `src/components/Modal.tsx` |
| RNF-020, RNF-021 | Padrão aplicado em todas as pages de CRUD |
| RNF-022, RNF-023, RNF-024 | `src/components/LoadingScreen.tsx`, padrão aplicado em todas as pages |
| RNF-025 | `src/components/ErrorBoundary.tsx` |
| RNF-028 | `src/lib/utils.ts` |
| RNF-029 | `src/lib/i18n.tsx` |
| RNF-030 | `src/components/*` |
| RNF-031 | `src/lib/auth.tsx` |
| RNF-032 | `src/lib/supabase.ts`, `src/lib/supabase-server.ts` |

### 4.3 Regras de Negócio → Artefatos de Código

| Regra | Artefato(s) Principal(is) |
|-------|---------------------------|
| RN-001, RN-002, RN-003, RN-004 | `supabase/schema.sql` (RLS policies), `src/lib/auth.tsx` (UserRole), `src/app/dashboard/help/page.tsx` (documentação de roles) |
| RN-005, RN-006, RN-007, RN-008 | `src/app/dashboard/events/[id]/page.tsx` (variável `canManage`), `supabase/schema.sql` (RLS policies com `created_by`) |
| RN-009 | `src/app/dashboard/leagues/page.tsx` (restrição edit/delete por `created_by`) |
| RN-010 | `src/app/dashboard/classes/page.tsx` (restrição edit/delete por `instructor_id`), `supabase/schema.sql` (RLS policy da tabela `classes`) |
| RN-011 | `supabase/schema.sql` (RLS policy `teams` DELETE) |
| RN-012, RN-013, RN-014, RN-022 | `supabase/schema.sql` (trigger `handle_correct_submission`, funções `calculate_level`, `xp_for_next_level`) |
| RN-015, RN-016 | `src/app/dashboard/events/[id]/page.tsx` (lógica de desbloqueio de hints), `supabase/schema.sql` (tabelas `hints`, `hint_usage`) |
| RN-017, RN-018 | `src/app/dashboard/badges/page.tsx`, `supabase/schema.sql` (tabela `badges` com raridades) |
| RN-019, RN-020, RN-021 | `src/app/dashboard/events/[id]/page.tsx` (lógica de submissão e limite de tentativas) |
| RN-023, RN-024, RN-025 | `src/app/dashboard/events/[id]/page.tsx` (variável `isPrivilegedViewer`, lógica de visibilidade condicional) |
| RN-026 | `supabase/schema.sql` (campo `visibility` na tabela `events`), `src/app/dashboard/events/page.tsx` |
| RN-027, RN-028, RN-029 | `src/app/dashboard/classes/page.tsx`, `supabase/schema.sql` (tabela `class_members` com check constraint de status) |
| RN-030, RN-031, RN-032 | `src/app/dashboard/teams/page.tsx`, `src/components/MiniChat.tsx`, `supabase/schema.sql` (RLS `chat_messages`) |
| RN-033, RN-034, RN-035 | `src/app/dashboard/leagues/page.tsx`, `src/app/dashboard/scoreboard/page.tsx`, `supabase/schema.sql` (tabela `league_events`) |

### 4.4 Tabelas do Banco → Requisitos

| Tabela | Requisitos Funcionais | Regras de Negócio |
|--------|----------------------|-------------------|
| `profiles` | RF-005, RF-014, RF-015, RF-016, RF-019, RF-116 | RN-001 a RN-004, RN-012, RN-013 |
| `leagues` | RF-059, RF-060 | RN-009, RN-033, RN-034 |
| `league_events` | RF-061 | RN-033, RN-035 |
| `classes` | RF-070, RF-071, RF-076 | RN-010, RN-027 |
| `class_members` | RF-072, RF-073, RF-074, RF-075 | RN-028, RN-029 |
| `events` | RF-027, RF-028, RF-029, RF-030, RF-031 | RN-005, RN-006, RN-026 |
| `missions` | RF-035, RF-036, RF-037, RF-038 | RN-007, RN-008 |
| `challenges` | RF-040, RF-041, RF-042, RF-043, RF-044, RF-049, RF-050 | RN-007, RN-008, RN-025 |
| `hints` | RF-051, RF-052, RF-053, RF-054, RF-055, RF-057 | RN-007, RN-015, RN-023, RN-024 |
| `hint_usage` | RF-056, RF-058 | RN-016 |
| `teams` | RF-081, RF-082 | RN-011, RN-030 |
| `team_members` | RF-083, RF-085, RF-086, RF-087 | RN-030 |
| `submissions` | RF-115, RF-116 | RN-019, RN-020, RN-021, RN-022 |
| `challenge_reactions` | RF-048 | — |
| `badges` | RF-100, RF-101 | RN-017, RN-018 |
| `user_badges` | RF-102, RF-103 | RN-018 |
| `chat_messages` | RF-089, RF-091 | RN-031 |

---

> **Nota:** Este documento reflete o estado atual da plataforma mdavelCTF conforme implementado no código-fonte. Deve ser atualizado a cada iteração de desenvolvimento para manter a rastreabilidade entre requisitos e artefatos.
