CREATE OR REPLACE FUNCTION public.notify_writeup_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  ev UUID;
  organizer UUID;
  notification_type TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  SELECT e.id, e.created_by INTO ev, organizer
  FROM public.challenges c
  JOIN public.missions m ON m.id = c.mission_id
  JOIN public.events e ON e.id = m.event_id
  WHERE c.id = NEW.challenge_id;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'pending' AND OLD.status = 'rejected') THEN
    IF organizer IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, event_id, type, title, message, metadata)
      VALUES (organizer, ev, 'writeup_submitted', 'Novo writeup', 'Um competidor enviou uma writeup para revisão.', jsonb_build_object('writeup_id', NEW.id, 'challenge_id', NEW.challenge_id, 'attempt', (SELECT count(*) FROM public.writeup_history WHERE writeup_id = NEW.id)));
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    notification_type := CASE WHEN NEW.status = 'approved' THEN 'writeup_approved' ELSE 'writeup_rejected' END;
    notification_title := CASE WHEN NEW.status = 'approved' THEN 'Writeup aprovada' ELSE 'Writeup rejeitada' END;
    notification_message := CASE WHEN NEW.status = 'approved' THEN 'Sua writeup foi aprovada.' ELSE 'Sua writeup foi rejeitada.' END;
    INSERT INTO public.notifications(recipient_id, event_id, type, title, message, metadata)
      VALUES (NEW.user_id, ev, notification_type, notification_title, notification_message, jsonb_build_object('writeup_id', NEW.id, 'challenge_id', NEW.challenge_id, 'reviewed_at', now()));
    INSERT INTO public.notifications(recipient_id, event_id, type, title, message, metadata)
      SELECT p.id, ev, notification_type, notification_title, notification_message,
             jsonb_build_object('writeup_id', NEW.id, 'challenge_id', NEW.challenge_id, 'competitor_id', NEW.user_id, 'reviewed_at', now())
      FROM public.profiles p
      WHERE p.id <> NEW.user_id AND (p.id = organizer OR p.role IN ('admin', 'super_admin'));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_writeup_change ON public.writeups;
CREATE TRIGGER notify_writeup_change AFTER INSERT OR UPDATE OF status ON public.writeups FOR EACH ROW EXECUTE FUNCTION public.notify_writeup_change();
