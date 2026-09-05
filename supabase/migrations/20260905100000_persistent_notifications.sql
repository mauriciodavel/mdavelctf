CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('writeup_submitted','writeup_approved','writeup_rejected','broadcast','first_blood')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON public.notifications(event_id, created_at DESC);
CREATE POLICY "Users view own or broadcast notifications" ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR recipient_id IS NULL);
CREATE POLICY "Authenticated users mark own notifications read" ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR recipient_id IS NULL)
  WITH CHECK (recipient_id = auth.uid() OR recipient_id IS NULL);
CREATE POLICY "Service role creates notifications" ON public.notifications FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Organizers create event notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (recipient_id IS NULL AND type IN ('broadcast','first_blood'));
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.notify_writeup_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ev uuid; title text; BEGIN
  SELECT e.id, c.title INTO ev, title FROM public.challenges c JOIN public.missions m ON m.id=c.mission_id JOIN public.events e ON e.id=m.event_id WHERE c.id=NEW.challenge_id;
  IF TG_OP='INSERT' THEN INSERT INTO public.notifications(recipient_id,event_id,type,title,message,metadata) SELECT e.created_by,ev,'writeup_submitted','Novo writeup','Um competidor enviou uma writeup para revisão.',jsonb_build_object('writeup_id',NEW.id,'challenge_id',NEW.challenge_id) FROM public.events e WHERE e.id=ev AND e.created_by IS NOT NULL; END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO public.notifications(recipient_id,event_id,type,title,message,metadata) VALUES (NEW.user_id,ev,CASE WHEN NEW.status='approved' THEN 'writeup_approved' ELSE 'writeup_rejected' END,'Writeup revisada',CASE WHEN NEW.status='approved' THEN 'Sua writeup foi aprovada.' ELSE 'Sua writeup foi rejeitada.' END,jsonb_build_object('writeup_id',NEW.id,'challenge_id',NEW.challenge_id)); END IF;
  RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS notify_writeup_change ON public.writeups;
CREATE TRIGGER notify_writeup_change AFTER INSERT OR UPDATE OF status ON public.writeups FOR EACH ROW EXECUTE FUNCTION public.notify_writeup_change();
