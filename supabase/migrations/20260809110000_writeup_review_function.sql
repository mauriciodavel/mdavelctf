CREATE OR REPLACE FUNCTION public.review_writeup(p_writeup_id uuid, p_status text)
RETURNS public.writeups LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.writeups; pts integer;
BEGIN
  IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid review status'; END IF;
  SELECT * INTO w FROM public.writeups WHERE id = p_writeup_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.challenges c JOIN public.missions m ON m.id = c.mission_id JOIN public.events e ON e.id = m.event_id
    JOIN public.profiles p ON p.id = auth.uid() WHERE c.id = w.challenge_id AND (e.created_by = auth.uid() OR p.role IN ('admin','super_admin'))
  ) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  pts := CASE WHEN p_status = 'approved' THEN greatest(1, floor((SELECT points FROM public.challenges WHERE id = w.challenge_id) * 0.5)::integer) ELSE 0 END;
  PERFORM set_config('app.writeup_review', 'on', true);
  UPDATE public.writeups SET status = p_status, reviewer_id = auth.uid(), reviewed_at = now(), points_awarded = pts WHERE id = p_writeup_id RETURNING * INTO w;
  IF p_status = 'approved' THEN
    UPDATE public.profiles SET xp_points = xp_points + pts, level = public.calculate_level(xp_points + pts), updated_at = now() WHERE id = w.user_id;
  END IF;
  RETURN w;
END; $$;
GRANT EXECUTE ON FUNCTION public.review_writeup(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_role text;
BEGIN
  IF auth.role() = 'service_role' OR pg_trigger_depth() > 1 OR current_setting('app.writeup_review', true) = 'on' THEN RETURN NEW; END IF;
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role = 'super_admin' THEN RETURN NEW; END IF;
  IF caller_role = 'admin' AND auth.uid() <> OLD.id THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.email IS DISTINCT FROM OLD.email OR NEW.shells IS DISTINCT FROM OLD.shells OR NEW.xp_points IS DISTINCT FROM OLD.xp_points OR NEW.level IS DISTINCT FROM OLD.level OR NEW.total_active_seconds IS DISTINCT FROM OLD.total_active_seconds THEN
    RAISE EXCEPTION 'Privileged profile fields cannot be changed by this user' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
