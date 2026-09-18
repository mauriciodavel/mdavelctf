-- Keep challenge solutions and submitted answers out of ordinary SELECT calls.
-- Column grants work alongside the existing row policies and preserve scoreboard reads.
REVOKE SELECT ON public.challenges FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.submissions FROM PUBLIC, anon, authenticated;

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO cols FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'challenges' AND column_name <> 'flag';
  EXECUTE format('GRANT SELECT (%s) ON public.challenges TO authenticated', cols);

  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
    INTO cols FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name <> 'answer';
  EXECUTE format('GRANT SELECT (%s) ON public.submissions TO authenticated', cols);
END $$;

-- Organizers need the full challenge row to edit flags and save event templates.
CREATE OR REPLACE FUNCTION public.get_managed_challenges(p_mission_ids uuid[])
RETURNS SETOF public.challenges
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.* FROM public.challenges c
  JOIN public.missions m ON m.id = c.mission_id
  JOIN public.events e ON e.id = m.event_id
  WHERE c.mission_id = ANY(p_mission_ids)
    AND auth.uid() IS NOT NULL
    AND (
      e.created_by = auth.uid()
      OR public.current_profile_role() IN ('admin', 'super_admin')
    );
$$;
REVOKE ALL ON FUNCTION public.get_managed_challenges(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_managed_challenges(uuid[]) TO authenticated;

-- Restore the original rule: an admin may manage ordinary accounts, but
-- cannot create or change privileged accounts or change their own privileges.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_role text;
BEGIN
  IF auth.role() = 'service_role' OR pg_trigger_depth() > 1
     OR current_setting('app.writeup_review', true) = 'on'
     OR current_setting('app.activity_update', true) = 'on' THEN RETURN NEW; END IF;
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

-- Apply the class-membership requirement even when callers bypass the app route.
DROP POLICY IF EXISTS "Users can self-enroll in open groups" ON public.class_group_members;
CREATE POLICY "Users can self-enroll in open groups"
  ON public.class_group_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.class_groups cg
      JOIN public.class_members cm ON cm.class_id = cg.class_id
        AND cm.user_id = auth.uid() AND cm.status = 'active'
      WHERE cg.id = group_id AND cg.allow_self_enroll = true
        AND (cg.max_members IS NULL OR
          (SELECT count(*) FROM public.class_group_members cgm WHERE cgm.group_id = cg.id) < cg.max_members)
    )
  );
