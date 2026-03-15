-- ============================================================
-- mdavelCTF - Database Schema for Supabase
-- Complete schema with RLS policies for security
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- HELPER: Generate random 6-char alphanumeric code
-- ============================================================
CREATE OR REPLACE FUNCTION generate_code(length INT DEFAULT 6)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'competitor'
    CHECK (role IN ('super_admin', 'admin', 'instructor', 'competitor')),
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  course TEXT DEFAULT '',
  class_group TEXT DEFAULT '',
  department TEXT DEFAULT '',
  xp_points INTEGER NOT NULL DEFAULT 0,
  shells INTEGER NOT NULL DEFAULT 100,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 2. LEAGUES (Ligas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(6) NOT NULL UNIQUE DEFAULT generate_code(6),
  name TEXT NOT NULL,
  image_url TEXT,
  event_codes TEXT DEFAULT '',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leagues viewable by authenticated users"
  ON public.leagues FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins and instructors can manage leagues"
  ON public.leagues FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'instructor')
    )
  );

-- ============================================================
-- 3. CLASSES (Turmas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(6) NOT NULL UNIQUE DEFAULT generate_code(6),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT,
  tag TEXT NOT NULL DEFAULT 'Tecnologia da Informação',
  custom_tag TEXT,
  instructor_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Classes viewable by authenticated users"
  ON public.classes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Instructors can manage own classes"
  ON public.classes FOR ALL
  TO authenticated
  USING (
    instructor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================
-- 4. CLASS MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id, user_id)
);

ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class members viewable by authenticated"
  ON public.class_members FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can join classes"
  ON public.class_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Instructors and admins manage class members"
  ON public.class_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Instructors and admins can delete class members"
  ON public.class_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================
-- 5. EVENTS (Eventos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(6) NOT NULL UNIQUE DEFAULT generate_code(6),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  team_mode TEXT NOT NULL DEFAULT 'event_teams'
    CHECK (team_mode IN ('event_teams', 'public_teams')),
  category TEXT NOT NULL DEFAULT 'Tecnologia da Informação',
  custom_category TEXT,
  league_code TEXT,
  class_id UUID REFERENCES public.classes(id),
  image_url TEXT,
  shell_reward INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public events viewable by all authenticated"
  ON public.events FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Instructors and admins can manage events"
  ON public.events FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================
-- 6. MISSIONS (Missões)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT,
  download_links TEXT[] DEFAULT '{}',
  difficulty TEXT NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert', 'insane')),
  time_limit INTEGER,
  author TEXT DEFAULT '',
  conclusions TEXT DEFAULT '',
  sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Missions viewable by authenticated"
  ON public.missions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Instructors and admins manage missions"
  ON public.missions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND (
        e.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('super_admin', 'admin')
        )
      )
    )
  );

-- ============================================================
-- 7. CHALLENGES (Desafios/Bandeiras)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  max_attempts INTEGER,
  points INTEGER NOT NULL DEFAULT 10,
  flag TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medio',
  what_i_learned TEXT,
  learn_more_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges viewable by authenticated"
  ON public.challenges FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Instructors and admins manage challenges"
  ON public.challenges FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      JOIN public.events e ON e.id = m.event_id
      WHERE m.id = mission_id AND (
        e.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('super_admin', 'admin')
        )
      )
    )
  );

-- ============================================================
-- 8. HINTS (Dicas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  shell_cost INTEGER NOT NULL DEFAULT 10,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.hints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hints viewable by authenticated"
  ON public.hints FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Instructors and admins manage hints"
  ON public.hints FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      JOIN public.missions m ON m.id = c.mission_id
      JOIN public.events e ON e.id = m.event_id
      WHERE c.id = challenge_id AND (
        e.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('super_admin', 'admin')
        )
      )
    )
  );

-- ============================================================
-- 9. HINT USAGE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hint_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hint_id UUID NOT NULL REFERENCES public.hints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hint_id, user_id)
);

ALTER TABLE public.hint_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hint usage viewable by authenticated users"
  ON public.hint_usage FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can use hints"
  ON public.hint_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 10. TEAMS (Equipes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(6) NOT NULL UNIQUE DEFAULT generate_code(6),
  name TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams viewable by authenticated"
  ON public.teams FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Team creators can update"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Team creators and admins can delete"
  ON public.teams FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================
-- 11. TEAM MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members viewable by authenticated"
  ON public.team_members FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can join teams"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Leaders can manage team members"
  ON public.team_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'leader'
    )
  );

CREATE POLICY "Leaders and admins can remove team members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'leader'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================
-- 12. SUBMISSIONS (Submissões)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id),
  answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submissions viewable by authenticated users"
  ON public.submissions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can submit answers"
  ON public.submissions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 13. CHALLENGE REACTIONS (Like/Dislike)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenge_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE public.challenge_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions viewable by authenticated"
  ON public.challenge_reactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can react"
  ON public.challenge_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can change own reaction"
  ON public.challenge_reactions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own reaction"
  ON public.challenge_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 14. BADGES (Distintivos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  criteria_key TEXT NOT NULL UNIQUE,
  icon_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'comum'
    CHECK (rarity IN ('comum', 'cru', 'epico', 'lendario')),
  reward INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges viewable by all authenticated"
  ON public.badges FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only admins can manage badges"
  ON public.badges FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================
-- 15. USER BADGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User badges viewable by all"
  ON public.user_badges FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can award badges"
  ON public.user_badges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- ============================================================
-- 16. CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can see chat"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = chat_messages.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can send messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = chat_messages.team_id
      AND tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- 17. LEAGUE EVENTS (linking table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.league_events (
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  PRIMARY KEY (league_id, event_id)
);

ALTER TABLE public.league_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League events viewable by authenticated"
  ON public.league_events FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins and instructors manage league events"
  ON public.league_events FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'instructor')
    )
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'competitor')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Regenerate class code
CREATE OR REPLACE FUNCTION public.regenerate_class_code(p_class_id UUID)
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
BEGIN
  new_code := generate_code(6);
  UPDATE public.classes SET code = new_code, updated_at = NOW()
  WHERE id = p_class_id;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate user level from XP
CREATE OR REPLACE FUNCTION public.calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, FLOOR(xp / 100.0) + 1)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- XP needed for next level
CREATE OR REPLACE FUNCTION public.xp_for_next_level(current_xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  current_level INTEGER;
BEGIN
  current_level := public.calculate_level(current_xp);
  RETURN (current_level * 100) - current_xp;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update XP and level after correct submission
CREATE OR REPLACE FUNCTION public.handle_correct_submission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_correct = true THEN
    UPDATE public.profiles
    SET
      xp_points = xp_points + NEW.points_awarded,
      level = public.calculate_level(xp_points + NEW.points_awarded),
      shells = shells + (SELECT shell_reward FROM public.events e
        JOIN public.missions m ON m.event_id = e.id
        JOIN public.challenges c ON c.mission_id = m.id
        WHERE c.id = NEW.challenge_id),
      updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_submission_created ON public.submissions;
CREATE TRIGGER on_submission_created
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_correct_submission();

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON public.events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_class_id ON public.events(class_id);
CREATE INDEX IF NOT EXISTS idx_missions_event_id ON public.missions(event_id);
CREATE INDEX IF NOT EXISTS idx_challenges_mission_id ON public.challenges(mission_id);
CREATE INDEX IF NOT EXISTS idx_hints_challenge_id ON public.hints(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON public.submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON public.class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_user_id ON public.class_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_team_id ON public.chat_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
