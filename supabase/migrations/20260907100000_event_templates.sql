CREATE TABLE IF NOT EXISTS public.event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_templates_select ON public.event_templates FOR SELECT TO authenticated USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));
CREATE POLICY event_templates_insert ON public.event_templates FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY event_templates_delete ON public.event_templates FOR DELETE TO authenticated USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));
