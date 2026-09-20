-- Block privilege escalation through direct PostgREST PATCH requests.
-- RLS limits rows, so column privileges independently protect authorization data.
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name, legal_name, avatar_url, bio, course, class_group, department, updated_at)
  ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.update_managed_profile(
  p_target_user_id uuid,
  p_display_name text,
  p_role text,
  p_shells integer,
  p_xp_points integer
)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_role text;
  target_role text;
  updated_profile public.profiles;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO target_role FROM public.profiles WHERE id = p_target_user_id FOR UPDATE;
  IF caller_role NOT IN ('admin', 'super_admin') OR target_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('super_admin', 'admin', 'instructor', 'competitor') THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;
  IF p_shells < 0 OR p_xp_points < 0 THEN
    RAISE EXCEPTION 'Shells and XP cannot be negative' USING ERRCODE = '22023';
  END IF;
  IF caller_role = 'admin' AND (
    p_target_user_id = auth.uid() OR target_role IN ('admin', 'super_admin')
    OR p_role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only a super admin can manage privileged accounts' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET display_name = btrim(p_display_name), role = p_role, shells = p_shells,
      xp_points = p_xp_points, level = public.calculate_level(p_xp_points), updated_at = now()
  WHERE id = p_target_user_id RETURNING * INTO updated_profile;
  RETURN updated_profile;
END; $$;
REVOKE ALL ON FUNCTION public.update_managed_profile(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_managed_profile(uuid, text, text, integer, integer) TO authenticated;

-- Hint usage and balance deduction must be one trusted atomic operation.
CREATE OR REPLACE FUNCTION public.unlock_hint(p_hint_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE hint_cost integer; remaining_shells integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT shell_cost INTO hint_cost FROM public.hints WHERE id = p_hint_id;
  IF hint_cost IS NULL THEN RAISE EXCEPTION 'Hint not found' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.hint_usage WHERE hint_id = p_hint_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Hint already unlocked' USING ERRCODE = '23505';
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() AND shells >= hint_cost FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient shells' USING ERRCODE = '22003'; END IF;

  INSERT INTO public.hint_usage (hint_id, user_id) VALUES (p_hint_id, auth.uid());
  PERFORM set_config('app.hint_unlock', 'on', true);
  UPDATE public.profiles SET shells = shells - hint_cost, updated_at = now()
  WHERE id = auth.uid() RETURNING shells INTO remaining_shells;
  RETURN remaining_shells;
END; $$;
REVOKE ALL ON FUNCTION public.unlock_hint(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_hint(uuid) TO authenticated;

-- Retain the trigger as a second barrier for protected fields.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_role text;
BEGIN
  IF auth.role() = 'service_role' OR pg_trigger_depth() > 1
     OR current_setting('app.writeup_review', true) = 'on'
     OR current_setting('app.activity_update', true) = 'on'
     OR current_setting('app.hint_unlock', true) = 'on'
     OR current_setting('app.badge_award', true) = 'on' THEN RETURN NEW; END IF;
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role = 'super_admin' THEN RETURN NEW; END IF;
  IF caller_role = 'admin' AND auth.uid() <> OLD.id THEN
    IF OLD.role IN ('super_admin', 'admin') OR NEW.role IN ('super_admin', 'admin') THEN
      RAISE EXCEPTION 'Only a super admin can manage privileged accounts' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.shells IS DISTINCT FROM OLD.shells OR NEW.xp_points IS DISTINCT FROM OLD.xp_points
     OR NEW.level IS DISTINCT FROM OLD.level OR NEW.total_active_seconds IS DISTINCT FROM OLD.total_active_seconds THEN
    RAISE EXCEPTION 'Privileged profile fields cannot be changed by this user' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
