CREATE TABLE IF NOT EXISTS public.writeup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writeup_id UUID NOT NULL REFERENCES public.writeups(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  reviewer_id UUID REFERENCES public.profiles(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempt_number INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE public.writeup_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY writeup_history_select_own ON public.writeup_history FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY writeup_history_select_organizers ON public.writeup_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM challenges c JOIN missions m ON m.id = c.mission_id JOIN events e ON e.id = m.event_id JOIN profiles p ON p.id = auth.uid() WHERE c.id = writeup_history.challenge_id AND (e.created_by = auth.uid() OR p.role IN ('admin','super_admin'))));
CREATE OR REPLACE FUNCTION public.capture_writeup_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n INTEGER;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.content IS DISTINCT FROM OLD.content THEN
    SELECT count(*) + 1 INTO n FROM public.writeup_history WHERE writeup_id = NEW.id;
    INSERT INTO public.writeup_history(writeup_id, challenge_id, user_id, content, status, reviewer_id, occurred_at, attempt_number)
      VALUES (NEW.id, NEW.challenge_id, NEW.user_id, NEW.content, NEW.status, NEW.reviewer_id, now(), n);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS capture_writeup_history ON public.writeups;
CREATE TRIGGER capture_writeup_history AFTER INSERT OR UPDATE OF status, content, reviewer_id ON public.writeups FOR EACH ROW EXECUTE FUNCTION public.capture_writeup_history();
INSERT INTO public.writeup_history(writeup_id, challenge_id, user_id, content, status, reviewer_id, occurred_at, attempt_number)
SELECT w.id, w.challenge_id, w.user_id, w.content, w.status, w.reviewer_id, COALESCE(w.reviewed_at, w.created_at), 1 FROM public.writeups w
WHERE NOT EXISTS (SELECT 1 FROM public.writeup_history h WHERE h.writeup_id = w.id);
