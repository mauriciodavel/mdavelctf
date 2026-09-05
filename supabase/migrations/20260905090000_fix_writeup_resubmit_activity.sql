-- Allow a competitor to resubmit only a previously rejected writeup.
DROP POLICY IF EXISTS "Competitors can resubmit rejected writeups" ON public.writeups;
CREATE POLICY "Competitors can resubmit rejected writeups"
  ON public.writeups FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'rejected')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Mark the trusted activity RPC so its own profile update is not mistaken for
-- a direct client PATCH of privileged fields.
CREATE OR REPLACE FUNCTION public.increment_active_seconds(p_user_id uuid, p_seconds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role() <> 'service_role' AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot update another user' USING ERRCODE = '42501';
  END IF;
  IF p_seconds < 1 OR p_seconds > 300 THEN
    RAISE EXCEPTION 'Invalid activity interval' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.activity_update', 'on', true);
  UPDATE public.profiles
  SET total_active_seconds = total_active_seconds + p_seconds, updated_at = now()
  WHERE id = p_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_role text;
BEGIN
  IF auth.role() = 'service_role' OR pg_trigger_depth() > 1
     OR current_setting('app.writeup_review', true) = 'on'
     OR current_setting('app.activity_update', true) = 'on' THEN RETURN NEW; END IF;
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role = 'super_admin' THEN RETURN NEW; END IF;
  IF caller_role = 'admin' AND auth.uid() <> OLD.id THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.shells IS DISTINCT FROM OLD.shells OR NEW.xp_points IS DISTINCT FROM OLD.xp_points
     OR NEW.level IS DISTINCT FROM OLD.level OR NEW.total_active_seconds IS DISTINCT FROM OLD.total_active_seconds THEN
    RAISE EXCEPTION 'Privileged profile fields cannot be changed by this user' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

GRANT EXECUTE ON FUNCTION public.increment_active_seconds(uuid, integer) TO authenticated, service_role;
