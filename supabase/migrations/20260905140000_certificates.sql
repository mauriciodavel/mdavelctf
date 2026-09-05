CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  challenges_solved INTEGER NOT NULL DEFAULT 0,
  challenges_total INTEGER NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS certificates_insert_own ON public.certificates;
CREATE POLICY certificates_insert_own ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS certificates_select_public ON public.certificates;
CREATE POLICY certificates_select_public ON public.certificates FOR SELECT TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON public.certificates(code);
