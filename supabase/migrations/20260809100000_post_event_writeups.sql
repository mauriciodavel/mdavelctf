CREATE TABLE IF NOT EXISTS public.writeups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 20 AND 10000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);
ALTER TABLE public.writeups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Competitors view own writeups" ON public.writeups FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Organizers view event writeups" ON public.writeups FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.challenges c JOIN public.missions m ON m.id = c.mission_id JOIN public.events e ON e.id = m.event_id
  JOIN public.profiles p ON p.id = auth.uid() WHERE c.id = challenge_id AND (e.created_by = auth.uid() OR p.role IN ('admin','super_admin'))
));
CREATE POLICY "Competitors submit writeups" ON public.writeups FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Organizers review writeups" ON public.writeups FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.challenges c JOIN public.missions m ON m.id = c.mission_id JOIN public.events e ON e.id = m.event_id
  JOIN public.profiles p ON p.id = auth.uid() WHERE c.id = challenge_id AND (e.created_by = auth.uid() OR p.role IN ('admin','super_admin'))
)) WITH CHECK (reviewer_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_writeups_challenge ON public.writeups(challenge_id, status);

CREATE OR REPLACE FUNCTION public.review_writeup(p_writeup_id uuid, p_status text)
RETURNS public.writeups LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w public.writeups; pts integer;
BEGIN
  IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid review status'; END IF;
  SELECT * INTO w FROM public.writeups WHERE id = p_writeup_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.challenges c JOIN public.missions m ON m.id=c.mission_id JOIN public.events e ON e.id=m.event_id
    JOIN public.profiles p ON p.id=auth.uid() WHERE c.id=w.challenge_id AND (e.created_by=auth.uid() OR p.role IN ('admin','super_admin'))
  ) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  pts := CASE WHEN p_status='approved' THEN greatest(1, floor((SELECT points FROM public.challenges WHERE id=w.challenge_id) * 0.5)::integer) ELSE 0 END;
  UPDATE public.writeups SET status=p_status, reviewer_id=auth.uid(), reviewed_at=now(), points_awarded=pts WHERE id=p_writeup_id RETURNING * INTO w;
  IF p_status='approved' THEN UPDATE public.profiles SET xp_points=xp_points+pts, level=public.calculate_level(xp_points+pts), updated_at=now() WHERE id=w.user_id; END IF;
  RETURN w;
END; $$;
GRANT EXECUTE ON FUNCTION public.review_writeup(uuid,text) TO authenticated;
