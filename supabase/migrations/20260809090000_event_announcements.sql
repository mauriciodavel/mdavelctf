CREATE TABLE IF NOT EXISTS public.event_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_event_announcements_event ON public.event_announcements(event_id, created_at DESC);

CREATE POLICY "Authenticated users can view event announcements"
  ON public.event_announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Event organizers can publish announcements"
  ON public.event_announcements FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE e.id = event_id
        AND (e.created_by = auth.uid() OR p.role IN ('super_admin', 'admin'))
    )
  );

ALTER TABLE public.event_announcements REPLICA IDENTITY FULL;
