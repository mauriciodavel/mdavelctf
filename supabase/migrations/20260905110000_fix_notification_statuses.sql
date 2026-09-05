CREATE OR REPLACE FUNCTION public.notify_writeup_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ev uuid;
BEGIN
  SELECT e.id INTO ev FROM public.challenges c JOIN public.missions m ON m.id=c.mission_id JOIN public.events e ON e.id=m.event_id WHERE c.id=NEW.challenge_id;
  IF TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.status='pending' AND OLD.status='rejected') THEN
    INSERT INTO public.notifications(recipient_id,event_id,type,title,message,metadata)
    SELECT e.created_by,ev,'writeup_submitted','Novo writeup','Um competidor enviou uma writeup para revisão.',jsonb_build_object('writeup_id',NEW.id,'challenge_id',NEW.challenge_id)
    FROM public.events e WHERE e.id=ev AND e.created_by IS NOT NULL;
  ELSIF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications(recipient_id,event_id,type,title,message,metadata) VALUES (NEW.user_id,ev,CASE WHEN NEW.status='approved' THEN 'writeup_approved' ELSE 'writeup_rejected' END,'Writeup revisada',CASE WHEN NEW.status='approved' THEN 'Sua writeup foi aprovada.' ELSE 'Sua writeup foi rejeitada.' END,jsonb_build_object('writeup_id',NEW.id,'challenge_id',NEW.challenge_id));
  END IF;
  RETURN NEW;
END; $$;
