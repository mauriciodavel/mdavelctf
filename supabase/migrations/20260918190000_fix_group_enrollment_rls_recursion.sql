-- RLS policies cannot count rows from the table they protect: doing so
-- recursively evaluates the same policy. Keep the check in a definer function.
CREATE OR REPLACE FUNCTION public.can_self_enroll_group(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() = p_user_id AND EXISTS (
    SELECT 1
    FROM public.class_groups cg
    JOIN public.class_members cm ON cm.class_id = cg.class_id
      AND cm.user_id = p_user_id AND cm.status = 'active'
    WHERE cg.id = p_group_id
      AND cg.allow_self_enroll = true
      AND (
        cg.max_members IS NULL
        OR (SELECT count(*) FROM public.class_group_members cgm
            WHERE cgm.group_id = cg.id) < cg.max_members
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_self_enroll_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_self_enroll_group(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can self-enroll in open groups" ON public.class_group_members;
CREATE POLICY "Users can self-enroll in open groups"
  ON public.class_group_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_self_enroll_group(group_id, user_id)
  );
