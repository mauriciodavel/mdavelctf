'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Locale = 'pt-BR' | 'en';

type TranslationDict = Record<string, Record<string, string>>;

const translations: TranslationDict = {
  // ── Navigation ──
  'nav.dashboard': { 'pt-BR': 'Painel', 'en': 'Dashboard' },
  'nav.events': { 'pt-BR': 'Eventos', 'en': 'Events' },
  'nav.leagues': { 'pt-BR': 'Ligas', 'en': 'Leagues' },
  'nav.classes': { 'pt-BR': 'Turmas', 'en': 'Classes' },
  'nav.teams': { 'pt-BR': 'Equipes', 'en': 'Teams' },
  'nav.scoreboard': { 'pt-BR': 'Placar', 'en': 'Scoreboard' },
  'nav.profile': { 'pt-BR': 'Perfil', 'en': 'Profile' },
  'nav.badges': { 'pt-BR': 'Distintivos', 'en': 'Badges' },
  'nav.help': { 'pt-BR': 'Ajuda', 'en': 'Help' },
  'nav.admin': { 'pt-BR': 'Administração', 'en': 'Admin' },
  'nav.logout': { 'pt-BR': 'Sair', 'en': 'Logout' },
  'nav.missions': { 'pt-BR': 'Missões', 'en': 'Missions' },

  // ── Auth ──
  'auth.login': { 'pt-BR': 'Entrar', 'en': 'Login' },
  'auth.register': { 'pt-BR': 'Cadastrar', 'en': 'Register' },
  'auth.email': { 'pt-BR': 'E-mail', 'en': 'Email' },
  'auth.password': { 'pt-BR': 'Senha', 'en': 'Password' },
  'auth.confirm_password': { 'pt-BR': 'Confirmar Senha', 'en': 'Confirm Password' },
  'auth.display_name': { 'pt-BR': 'Nome de Exibição', 'en': 'Display Name' },
  'auth.no_account': { 'pt-BR': 'Não tem conta?', 'en': "Don't have an account?" },
  'auth.has_account': { 'pt-BR': 'Já tem conta?', 'en': 'Already have an account?' },
  'auth.register_here': { 'pt-BR': 'Cadastre-se aqui', 'en': 'Register here' },
  'auth.login_here': { 'pt-BR': 'Entre aqui', 'en': 'Login here' },
  'auth.welcome': { 'pt-BR': 'Bem-vindo à', 'en': 'Welcome to' },
  'auth.subtitle': { 'pt-BR': 'Plataforma gamificada de competições Capture the Flag', 'en': 'Gamified Capture the Flag competition platform' },
  'auth.password_requirements': { 'pt-BR': 'Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial', 'en': 'Min 8 chars, with uppercase, lowercase, number and special character' },
  'auth.logging_in': { 'pt-BR': 'Entrando...', 'en': 'Logging in...' },
  'auth.registering': { 'pt-BR': 'Cadastrando...', 'en': 'Registering...' },

  // ── Dashboard ──
  'dash.total_events': { 'pt-BR': 'Total de Eventos', 'en': 'Total Events' },
  'dash.live_now': { 'pt-BR': 'Ao Vivo Agora', 'en': 'Live Now' },
  'dash.users': { 'pt-BR': 'Usuários', 'en': 'Users' },
  'dash.submissions': { 'pt-BR': 'Submissões', 'en': 'Submissions' },
  'dash.resolutions': { 'pt-BR': 'Resoluções', 'en': 'Resolutions' },
  'dash.resolution_rate': { 'pt-BR': 'Taxa de Resolução', 'en': 'Resolution Rate' },
  'dash.hints_unlocked': { 'pt-BR': 'Dicas Desbloqueadas', 'en': 'Hints Unlocked' },
  'dash.activity_feed': { 'pt-BR': 'Feed de Atividades', 'en': 'Activity Feed' },
  'dash.hard_challenges': { 'pt-BR': 'Desafios Difíceis', 'en': 'Hard Challenges' },
  'dash.event_overview': { 'pt-BR': 'Visão Geral dos Eventos', 'en': 'Events Overview' },
  'dash.season_analysis': { 'pt-BR': 'Análise de Temporadas', 'en': 'Season Analysis' },
  'dash.my_classes': { 'pt-BR': 'Minhas Turmas', 'en': 'My Classes' },
  'dash.my_events': { 'pt-BR': 'Meus Eventos', 'en': 'My Events' },
  'dash.total_students': { 'pt-BR': 'Total de Alunos', 'en': 'Total Students' },
  'dash.total_classes': { 'pt-BR': 'Total de Turmas', 'en': 'Total Classes' },
  'dash.welcome_back': { 'pt-BR': 'Bem-vindo de volta', 'en': 'Welcome back' },
  'dash.quick_guide': { 'pt-BR': 'Guia Rápido', 'en': 'Quick Guide' },

  // ── Events ──
  'event.name': { 'pt-BR': 'Nome do Evento', 'en': 'Event Name' },
  'event.description': { 'pt-BR': 'Descrição', 'en': 'Description' },
  'event.start_date': { 'pt-BR': 'Data de Início', 'en': 'Start Date' },
  'event.end_date': { 'pt-BR': 'Data de Fim', 'en': 'End Date' },
  'event.visibility': { 'pt-BR': 'Visibilidade', 'en': 'Visibility' },
  'event.public': { 'pt-BR': 'Público', 'en': 'Public' },
  'event.private': { 'pt-BR': 'Privado', 'en': 'Private' },
  'event.team_mode': { 'pt-BR': 'Modo de Equipe', 'en': 'Team Mode' },
  'event.event_teams': { 'pt-BR': 'Equipes do Evento', 'en': 'Event Teams' },
  'event.public_teams': { 'pt-BR': 'Equipes Públicas', 'en': 'Public Teams' },
  'event.category': { 'pt-BR': 'Categoria', 'en': 'Category' },
  'event.league_code': { 'pt-BR': 'Código da Liga', 'en': 'League Code' },
  'event.class': { 'pt-BR': 'Turma', 'en': 'Class' },
  'event.image': { 'pt-BR': 'Imagem', 'en': 'Image' },
  'event.shell_reward': { 'pt-BR': 'Recompensa em Shells', 'en': 'Shell Reward' },
  'event.create': { 'pt-BR': 'Criar Evento', 'en': 'Create Event' },
  'event.edit': { 'pt-BR': 'Editar Evento', 'en': 'Edit Event' },
  'event.delete': { 'pt-BR': 'Excluir Evento', 'en': 'Delete Event' },
  'event.no_events': { 'pt-BR': 'Nenhum evento encontrado', 'en': 'No events found' },
  'event.none_linked': { 'pt-BR': 'Nenhuma', 'en': 'None' },
  'event.code': { 'pt-BR': 'Código do Evento', 'en': 'Event Code' },

  // ── Missions ──
  'mission.name': { 'pt-BR': 'Nome da Missão', 'en': 'Mission Name' },
  'mission.description': { 'pt-BR': 'Descrição', 'en': 'Description' },
  'mission.difficulty': { 'pt-BR': 'Dificuldade', 'en': 'Difficulty' },
  'mission.easy': { 'pt-BR': 'Fácil', 'en': 'Easy' },
  'mission.medium': { 'pt-BR': 'Médio', 'en': 'Medium' },
  'mission.hard': { 'pt-BR': 'Difícil', 'en': 'Hard' },
  'mission.expert': { 'pt-BR': 'Especialista', 'en': 'Expert' },
  'mission.insane': { 'pt-BR': 'Insano', 'en': 'Insane' },
  'mission.time_limit': { 'pt-BR': 'Tempo para Conclusão (min)', 'en': 'Time Limit (min)' },
  'mission.author': { 'pt-BR': 'Autor', 'en': 'Author' },
  'mission.conclusions': { 'pt-BR': 'Principais Conclusões', 'en': 'Key Conclusions' },
  'mission.download_links': { 'pt-BR': 'Links para Download', 'en': 'Download Links' },
  'mission.create': { 'pt-BR': 'Criar Missão', 'en': 'Create Mission' },
  'mission.edit': { 'pt-BR': 'Editar Missão', 'en': 'Edit Mission' },
  'mission.no_missions': { 'pt-BR': 'Nenhuma missão encontrada', 'en': 'No missions found' },

  // ── Challenges ──
  'challenge.title': { 'pt-BR': 'Título', 'en': 'Title' },
  'challenge.description': { 'pt-BR': 'Descrição', 'en': 'Description' },
  'challenge.points': { 'pt-BR': 'Pontos', 'en': 'Points' },
  'challenge.max_attempts': { 'pt-BR': 'Máximo de Tentativas', 'en': 'Max Attempts' },
  'challenge.unlimited': { 'pt-BR': 'Ilimitado', 'en': 'Unlimited' },
  'challenge.flag': { 'pt-BR': 'Bandeira (Flag)', 'en': 'Flag' },
  'challenge.submit': { 'pt-BR': 'Enviar Resposta', 'en': 'Submit Answer' },
  'challenge.correct': { 'pt-BR': 'Correto! 🎉', 'en': 'Correct! 🎉' },
  'challenge.incorrect': { 'pt-BR': 'Incorreto. Tente novamente.', 'en': 'Incorrect. Try again.' },
  'challenge.solved': { 'pt-BR': 'Resolvido', 'en': 'Solved' },
  'challenge.not_solved': { 'pt-BR': 'Não Resolvido', 'en': 'Not Solved' },
  'challenge.hints': { 'pt-BR': 'Dicas', 'en': 'Hints' },
  'challenge.hint_cost': { 'pt-BR': 'Custo', 'en': 'Cost' },
  'challenge.hint_used': { 'pt-BR': 'Usada', 'en': 'Used' },
  'challenge.hint_locked': { 'pt-BR': 'Bloqueada', 'en': 'Locked' },
  'challenge.unlock_hint': { 'pt-BR': 'Desbloquear Dica', 'en': 'Unlock Hint' },
  'challenge.sequence': { 'pt-BR': 'Sequência', 'en': 'Sequence' },
  'challenge.create': { 'pt-BR': 'Criar Desafio', 'en': 'Create Challenge' },
  'challenge.attempts_remaining': { 'pt-BR': 'Tentativas restantes', 'en': 'Attempts remaining' },

  // ── Leagues ──
  'league.name': { 'pt-BR': 'Nome da Liga', 'en': 'League Name' },
  'league.code': { 'pt-BR': 'Código da Liga', 'en': 'League Code' },
  'league.image': { 'pt-BR': 'Imagem', 'en': 'Image' },
  'league.event_codes': { 'pt-BR': 'Códigos dos Eventos (separados por vírgula)', 'en': 'Event Codes (comma separated)' },
  'league.create': { 'pt-BR': 'Criar Liga', 'en': 'Create League' },
  'league.edit': { 'pt-BR': 'Editar Liga', 'en': 'Edit League' },
  'league.delete': { 'pt-BR': 'Excluir Liga', 'en': 'Delete League' },
  'league.no_leagues': { 'pt-BR': 'Nenhuma liga encontrada', 'en': 'No leagues found' },

  // ── Classes (Turmas) ──
  'class.name': { 'pt-BR': 'Nome da Turma', 'en': 'Class Name' },
  'class.description': { 'pt-BR': 'Descrição', 'en': 'Description' },
  'class.code': { 'pt-BR': 'Código da Turma', 'en': 'Class Code' },
  'class.tag': { 'pt-BR': 'TAG', 'en': 'Tag' },
  'class.create': { 'pt-BR': 'Criar Turma', 'en': 'Create Class' },
  'class.edit': { 'pt-BR': 'Editar Turma', 'en': 'Edit Class' },
  'class.delete': { 'pt-BR': 'Excluir Turma', 'en': 'Delete Class' },
  'class.members': { 'pt-BR': 'Membros', 'en': 'Members' },
  'class.join': { 'pt-BR': 'Ingressar na Turma', 'en': 'Join Class' },
  'class.join_code': { 'pt-BR': 'Código de Ingresso', 'en': 'Join Code' },
  'class.regenerate_code': { 'pt-BR': 'Regerar Código', 'en': 'Regenerate Code' },
  'class.no_classes': { 'pt-BR': 'Nenhuma turma encontrada', 'en': 'No classes found' },
  'class.inactivate': { 'pt-BR': 'Inativar', 'en': 'Inactivate' },
  'class.remove': { 'pt-BR': 'Remover', 'en': 'Remove' },
  'class.events': { 'pt-BR': 'Eventos da Turma', 'en': 'Class Events' },
  'class.details': { 'pt-BR': 'Detalhes da Turma', 'en': 'Class Details' },

  // ── Teams ──
  'team.name': { 'pt-BR': 'Nome da Equipe', 'en': 'Team Name' },
  'team.code': { 'pt-BR': 'Código da Equipe', 'en': 'Team Code' },
  'team.public': { 'pt-BR': 'Pública', 'en': 'Public' },
  'team.private': { 'pt-BR': 'Privada', 'en': 'Private' },
  'team.create': { 'pt-BR': 'Criar Equipe', 'en': 'Create Team' },
  'team.join': { 'pt-BR': 'Ingressar na Equipe', 'en': 'Join Team' },
  'team.leave': { 'pt-BR': 'Sair da Equipe', 'en': 'Leave Team' },
  'team.chat': { 'pt-BR': 'Chat da Equipe', 'en': 'Team Chat' },
  'team.members': { 'pt-BR': 'Membros', 'en': 'Members' },
  'team.no_teams': { 'pt-BR': 'Nenhuma equipe encontrada', 'en': 'No teams found' },
  'team.send_message': { 'pt-BR': 'Enviar mensagem...', 'en': 'Send message...' },

  // ── Mini Chat ──
  'chat.mini_chat': { 'pt-BR': 'Mini Chat', 'en': 'Mini Chat' },
  'chat.enable_mini': { 'pt-BR': 'Fixar mini-chat', 'en': 'Pin mini-chat' },
  'chat.disable_mini': { 'pt-BR': 'Desafixar mini-chat', 'en': 'Unpin mini-chat' },
  'chat.minimize': { 'pt-BR': 'Minimizar', 'en': 'Minimize' },
  'chat.no_messages': { 'pt-BR': 'Nenhuma mensagem ainda. Comece a conversa!', 'en': 'No messages yet. Start the conversation!' },
  'chat.mini_enabled': { 'pt-BR': 'Mini-chat ativado! Visível em todas as páginas.', 'en': 'Mini-chat enabled! Visible on all pages.' },
  'chat.mini_disabled': { 'pt-BR': 'Mini-chat desativado.', 'en': 'Mini-chat disabled.' },

  // ── Scoreboard ──
  'score.position': { 'pt-BR': 'Posição', 'en': 'Position' },
  'score.player': { 'pt-BR': 'Jogador', 'en': 'Player' },
  'score.progress': { 'pt-BR': 'Progresso', 'en': 'Progress' },
  'score.score': { 'pt-BR': 'Pontuação', 'en': 'Score' },
  'score.accuracy': { 'pt-BR': '% de Acertos', 'en': 'Accuracy %' },
  'score.filter_event': { 'pt-BR': 'Evento', 'en': 'Event' },
  'score.filter_season': { 'pt-BR': 'Temporada', 'en': 'Season' },
  'score.filter_individual': { 'pt-BR': 'Individual', 'en': 'Individual' },
  'score.filter_teams': { 'pt-BR': 'Equipes', 'en': 'Teams' },
  'score.all_challenges': { 'pt-BR': 'Todos os Desafios', 'en': 'All Challenges' },
  'score.general_ranking': { 'pt-BR': 'Ranking Geral', 'en': 'General Ranking' },

  // ── Profile ──
  'profile.title': { 'pt-BR': 'Meu Perfil', 'en': 'My Profile' },
  'profile.edit': { 'pt-BR': 'Editar Perfil', 'en': 'Edit Profile' },
  'profile.display_name': { 'pt-BR': 'Nome de Exibição', 'en': 'Display Name' },
  'profile.course': { 'pt-BR': 'Curso/Programa', 'en': 'Course/Program' },
  'profile.class_group': { 'pt-BR': 'Turma/Grupo', 'en': 'Class/Group' },
  'profile.department': { 'pt-BR': 'Unidade/Departamento', 'en': 'Unit/Department' },
  'profile.bio': { 'pt-BR': 'BIO', 'en': 'BIO' },
  'profile.joined': { 'pt-BR': 'Ingressou em', 'en': 'Joined on' },
  'profile.xp_level': { 'pt-BR': 'Nível de XP', 'en': 'XP Level' },
  'profile.points': { 'pt-BR': 'Pontos Conquistados', 'en': 'Points Earned' },
  'profile.next_level': { 'pt-BR': 'Pontos para o próximo nível', 'en': 'Points to next level' },
  'profile.total_resolutions': { 'pt-BR': 'Total de Resoluções', 'en': 'Total Resolutions' },
  'profile.correct_submissions': { 'pt-BR': 'Submissões Corretas', 'en': 'Correct Submissions' },
  'profile.wrong_submissions': { 'pt-BR': 'Submissões Erradas', 'en': 'Wrong Submissions' },
  'profile.badges': { 'pt-BR': 'Medalhas de Conquistas', 'en': 'Achievement Badges' },
  'profile.resolutions_by_category': { 'pt-BR': 'Resoluções por Categoria', 'en': 'Resolutions by Category' },
  'profile.save': { 'pt-BR': 'Salvar Alterações', 'en': 'Save Changes' },
  'profile.role': { 'pt-BR': 'Perfil', 'en': 'Role' },

  // ── Badges ──
  'badge.name': { 'pt-BR': 'Nome do Badge', 'en': 'Badge Name' },
  'badge.criteria': { 'pt-BR': 'Chave de Critério', 'en': 'Criteria Key' },
  'badge.icon': { 'pt-BR': 'Ícone', 'en': 'Icon' },
  'badge.rarity': { 'pt-BR': 'Raridade', 'en': 'Rarity' },
  'badge.comum': { 'pt-BR': 'Comum', 'en': 'Common' },
  'badge.cru': { 'pt-BR': 'Cru', 'en': 'Raw' },
  'badge.epico': { 'pt-BR': 'Épico', 'en': 'Epic' },
  'badge.lendario': { 'pt-BR': 'Lendário', 'en': 'Legendary' },
  'badge.reward': { 'pt-BR': 'Recompensa', 'en': 'Reward' },
  'badge.description': { 'pt-BR': 'Descrição', 'en': 'Description' },
  'badge.create': { 'pt-BR': 'Criar Distintivo', 'en': 'Create Badge' },
  'badge.no_badges': { 'pt-BR': 'Nenhum distintivo encontrado', 'en': 'No badges found' },

  // ── Help ──
  'help.title': { 'pt-BR': 'Central de Ajuda', 'en': 'Help Center' },
  'help.what_is': { 'pt-BR': 'O que é a mdavelCTF?', 'en': 'What is mdavelCTF?' },
  'help.what_is_desc': { 'pt-BR': 'A mdavelCTF é uma plataforma gamificada de competições estilo Capture the Flag (CTF). Aqui, estudantes e profissionais podem participar de desafios de segurança cibernética, programação e tecnologia em um ambiente competitivo e educacional. A plataforma permite que instrutores criem eventos, missões e desafios enquanto competidores resolvem problemas para acumular pontos, subir no ranking e conquistar medalhas.', 'en': 'mdavelCTF is a gamified Capture the Flag (CTF) competition platform. Here, students and professionals can participate in cybersecurity, programming, and technology challenges in a competitive and educational environment. The platform allows instructors to create events, missions, and challenges while competitors solve problems to accumulate points, climb rankings, and earn badges.' },
  'help.roles_title': { 'pt-BR': 'Perfis de Usuário', 'en': 'User Roles' },
  'help.super_admin': { 'pt-BR': 'Super Usuário', 'en': 'Super Admin' },
  'help.super_admin_desc': { 'pt-BR': 'Tem acesso geral e irrestrito a toda a plataforma. Pode gerenciar todos os usuários, eventos, ligas, turmas e configurações do sistema. Não pode ser alterado por nenhum outro usuário.', 'en': 'Has full and unrestricted access to the entire platform. Can manage all users, events, leagues, classes, and system settings. Cannot be modified by any other user.' },
  'help.admin': { 'pt-BR': 'Administrador', 'en': 'Administrator' },
  'help.admin_desc': { 'pt-BR': 'Tem acesso a todas as funcionalidades da plataforma, incluindo gerenciamento de eventos, ligas, turmas, distintivos e usuários. Não pode alterar as configurações do Super Usuário. Pode criar e gerenciar Distintivos (Badges).', 'en': 'Has access to all platform features, including management of events, leagues, classes, badges, and users. Cannot modify Super Admin settings. Can create and manage Badges.' },
  'help.instructor': { 'pt-BR': 'Instrutor', 'en': 'Instructor' },
  'help.instructor_desc': { 'pt-BR': 'Pode criar, editar e excluir suas próprias Turmas. Pode criar e gerenciar Eventos, Missões e Desafios. Possui um painel com indicadores de Total de Turmas, Alunos e Eventos. Pode vincular eventos a turmas e gerar/regerar códigos de acesso para turmas.', 'en': 'Can create, edit, and delete their own Classes. Can create and manage Events, Missions, and Challenges. Has a dashboard with indicators for Total Classes, Students, and Events. Can link events to classes and generate/regenerate access codes for classes.' },
  'help.competitor': { 'pt-BR': 'Competidor', 'en': 'Competitor' },
  'help.competitor_desc': { 'pt-BR': 'Pode se auto cadastrar na plataforma. Pode ingressar em turmas usando o código fornecido pelo instrutor. Acessa eventos públicos ou vinculados à sua turma. Pode criar ou ingressar em equipes usando códigos. Troca mensagens via chat com membros da equipe. Acumula badges de conquistas e posição no Ranking Geral.', 'en': 'Can self-register on the platform. Can join classes using the code provided by the instructor. Accesses public events or events linked to their class. Can create or join teams using codes. Exchanges messages via chat with team members. Accumulates achievement badges and position in the General Ranking.' },
  'help.how_events': { 'pt-BR': 'Como funcionam os Eventos?', 'en': 'How do Events work?' },
  'help.how_events_desc': { 'pt-BR': 'Eventos são competições com data de início e fim. Cada evento contém Missões, e cada Missão contém Desafios (flags/bandeiras). Os participantes resolvem desafios submetendo a bandeira correta para ganhar pontos. Eventos podem ser públicos ou privados, e vinculados a turmas específicas.', 'en': 'Events are competitions with start and end dates. Each event contains Missions, and each Mission contains Challenges (flags). Participants solve challenges by submitting the correct flag to earn points. Events can be public or private, and linked to specific classes.' },
  'help.how_missions': { 'pt-BR': 'Como funcionam as Missões?', 'en': 'How do Missions work?' },
  'help.how_missions_desc': { 'pt-BR': 'Missões são conjuntos de desafios dentro de um evento. Cada missão possui um nível de dificuldade, tempo para conclusão e arquivos de apoio. Complete todos os desafios da missão para maximizar sua pontuação.', 'en': 'Missions are sets of challenges within an event. Each mission has a difficulty level, completion time, and support files. Complete all challenges in the mission to maximize your score.' },
  'help.how_shells': { 'pt-BR': 'O que são Shells? 🐚', 'en': 'What are Shells? 🐚' },
  'help.how_shells_desc': { 'pt-BR': 'Shells (🐚) são a moeda virtual da plataforma mdavelCTF. Você ganha Shells ao completar desafios e eventos. Shells podem ser gastos para desbloquear dicas (hints) que ajudam a resolver desafios mais difíceis. Gerencie seus Shells com sabedoria!', 'en': 'Shells (🐚) are the virtual currency of the mdavelCTF platform. You earn Shells by completing challenges and events. Shells can be spent to unlock hints that help solve harder challenges. Manage your Shells wisely!' },
  'help.how_ranking': { 'pt-BR': 'Como funciona o Ranking?', 'en': 'How does the Ranking work?' },
  'help.how_ranking_desc': { 'pt-BR': 'O ranking é calculado com base nos pontos acumulados em desafios. Você pode filtrar por evento, temporada, individual ou por equipes. Quanto mais desafios você resolver corretamente, maior será sua posição no ranking. Competidores acumulam XP que determina seu nível na plataforma.', 'en': 'The ranking is calculated based on accumulated points from challenges. You can filter by event, season, individual, or by teams. The more challenges you solve correctly, the higher your ranking position. Competitors accumulate XP that determines their platform level.' },
  'help.how_badges': { 'pt-BR': 'Como funcionam os Distintivos?', 'en': 'How do Badges work?' },
  'help.how_badges_desc': { 'pt-BR': 'Distintivos (Badges) são conquistas especiais concedidas por realizações na plataforma. Existem 4 níveis de raridade: Comum, Cru, Épico e Lendário. Cada badge concede uma recompensa em Shells. Distintivos são criados e atribuídos pelos administradores.', 'en': 'Badges are special achievements awarded for accomplishments on the platform. There are 4 rarity levels: Common, Raw, Epic, and Legendary. Each badge grants a Shell reward. Badges are created and awarded by administrators.' },

  // ── Common ──
  'common.save': { 'pt-BR': 'Salvar', 'en': 'Save' },
  'common.cancel': { 'pt-BR': 'Cancelar', 'en': 'Cancel' },
  'common.delete': { 'pt-BR': 'Excluir', 'en': 'Delete' },
  'common.edit': { 'pt-BR': 'Editar', 'en': 'Edit' },
  'common.create': { 'pt-BR': 'Criar', 'en': 'Create' },
  'common.search': { 'pt-BR': 'Buscar...', 'en': 'Search...' },
  'common.loading': { 'pt-BR': 'Carregando...', 'en': 'Loading...' },
  'common.confirm_delete': { 'pt-BR': 'Tem certeza que deseja excluir?', 'en': 'Are you sure you want to delete?' },
  'common.yes': { 'pt-BR': 'Sim', 'en': 'Yes' },
  'common.no': { 'pt-BR': 'Não', 'en': 'No' },
  'common.actions': { 'pt-BR': 'Ações', 'en': 'Actions' },
  'common.status': { 'pt-BR': 'Status', 'en': 'Status' },
  'common.active': { 'pt-BR': 'Ativo', 'en': 'Active' },
  'common.inactive': { 'pt-BR': 'Inativo', 'en': 'Inactive' },
  'common.back': { 'pt-BR': 'Voltar', 'en': 'Back' },
  'common.view': { 'pt-BR': 'Ver', 'en': 'View' },
  'common.optional': { 'pt-BR': 'Opcional', 'en': 'Optional' },
  'common.none': { 'pt-BR': 'Nenhuma', 'en': 'None' },
  'common.all': { 'pt-BR': 'Todos', 'en': 'All' },
  'common.close': { 'pt-BR': 'Fechar', 'en': 'Close' },
  'common.copy': { 'pt-BR': 'Copiar', 'en': 'Copy' },
  'common.copied': { 'pt-BR': 'Copiado!', 'en': 'Copied!' },
  'common.image_url': { 'pt-BR': 'URL da Imagem', 'en': 'Image URL' },
  'common.shells': { 'pt-BR': 'Shells 🐚', 'en': 'Shells 🐚' },

  // ── Categories ──
  'cat.ti': { 'pt-BR': 'Tecnologia da Informação', 'en': 'Information Technology' },
  'cat.admin': { 'pt-BR': 'Administração', 'en': 'Administration' },
  'cat.mecanic': { 'pt-BR': 'Mecânica', 'en': 'Mechanics' },
  'cat.robotics': { 'pt-BR': 'Robótica', 'en': 'Robotics' },
  'cat.networks': { 'pt-BR': 'Redes de Computadores', 'en': 'Computer Networks' },
  'cat.security': { 'pt-BR': 'Segurança da Informação', 'en': 'Information Security' },
  'cat.multimedia': { 'pt-BR': 'Multimídia', 'en': 'Multimedia' },
  'cat.games': { 'pt-BR': 'Jogos Digitais', 'en': 'Digital Games' },
  'cat.other': { 'pt-BR': 'Outros', 'en': 'Other' },
  'cat.custom': { 'pt-BR': 'Customizar Tipo', 'en': 'Custom Type' },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('pt-BR');

  const t = useCallback(
    (key: string): string => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[locale] || entry['pt-BR'] || key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
