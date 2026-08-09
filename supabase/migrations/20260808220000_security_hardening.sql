-- Security hardening after the privilege-escalation pentest.
-- Apply this migration to the deployed Supabase project before redeploying the app.

-- Never trust signup metadata for authorization.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'competitor'
  );
  RETURN NEW;
END;
$$;

-- RLS limits rows, not columns. This trigger is the final guard against a user
-- PATCHing role/score/balance fields on their own row through PostgREST.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role text;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO caller_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF caller_role = 'admin' AND auth.uid() <> OLD.id THEN
    IF OLD.role IN ('super_admin', 'admin')
       OR NEW.role IN ('super_admin', 'admin') THEN
      RAISE EXCEPTION 'Only a super admin can manage privileged accounts'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.shells IS DISTINCT FROM OLD.shells
     OR NEW.xp_points IS DISTINCT FROM OLD.xp_points
     OR NEW.level IS DISTINCT FROM OLD.level
     OR NEW.total_active_seconds IS DISTINCT FROM OLD.total_active_seconds THEN
    RAISE EXCEPTION 'Privileged profile fields cannot be changed by this user'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- Replace misleading/permissive profile policies. Service role bypasses RLS,
-- but the explicit policy documents and constrains the intended database role.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- SECURITY DEFINER avoids recursive RLS evaluation while checking the caller.
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated, service_role;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own non-privileged fields"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Privileged users can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.current_profile_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.current_profile_role() IN ('super_admin', 'admin'));

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT TO service_role
  WITH CHECK (true);

-- Do not trust is_correct, points_awarded or team_id supplied by the browser.
-- The database derives them from protected records before awarding XP.
CREATE OR REPLACE FUNCTION public.validate_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expected_answer text;
  base_points integer;
  attempt_limit integer;
  event_start timestamptz;
  event_end timestamptz;
  used_hints integer;
BEGIN
  IF auth.role() <> 'service_role' AND NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot submit for another user' USING ERRCODE = '42501';
  END IF;

  SELECT c.flag, c.points, c.max_attempts, e.start_date, e.end_date
    INTO expected_answer, base_points, attempt_limit, event_start, event_end
  FROM public.challenges c
  JOIN public.missions m ON m.id = c.mission_id
  JOIN public.events e ON e.id = m.event_id
  WHERE c.id = NEW.challenge_id;

  IF expected_answer IS NULL THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;
  IF now() < event_start OR now() > event_end THEN
    RAISE EXCEPTION 'Event is not active' USING ERRCODE = '42501';
  END IF;
  IF attempt_limit IS NOT NULL AND attempt_limit > 0 AND
     (SELECT count(*) FROM public.submissions s
      WHERE s.challenge_id = NEW.challenge_id AND s.user_id = NEW.user_id) >= attempt_limit THEN
    RAISE EXCEPTION 'Maximum attempts reached' USING ERRCODE = '23514';
  END IF;

  IF NEW.team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = NEW.team_id AND tm.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this team' USING ERRCODE = '42501';
  END IF;

  NEW.is_correct := NEW.answer = expected_answer;
  NEW.points_awarded := 0;
  IF NEW.is_correct THEN
    IF EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.challenge_id = NEW.challenge_id
        AND s.is_correct
        AND (s.user_id = NEW.user_id OR (NEW.team_id IS NOT NULL AND s.team_id = NEW.team_id))
    ) THEN
      RAISE EXCEPTION 'Challenge was already solved' USING ERRCODE = '23505';
    END IF;
    SELECT count(*) INTO used_hints
    FROM public.hint_usage hu
    JOIN public.hints h ON h.id = hu.hint_id
    WHERE hu.user_id = NEW.user_id AND h.challenge_id = NEW.challenge_id;
    NEW.points_awarded := greatest(1, round(base_points * (1 - 0.1 * used_hints))::integer);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_submission ON public.submissions;
CREATE TRIGGER validate_submission
BEFORE INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.validate_submission();

-- Prevent arbitrary activity inflation through the SECURITY DEFINER RPC.
CREATE OR REPLACE FUNCTION public.increment_active_seconds(p_user_id uuid, p_seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot update another user' USING ERRCODE = '42501';
  END IF;
  IF p_seconds < 1 OR p_seconds > 300 THEN
    RAISE EXCEPTION 'Invalid activity interval' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles
  SET total_active_seconds = total_active_seconds + p_seconds,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_active_seconds(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_active_seconds(uuid, integer) TO authenticated, service_role;
