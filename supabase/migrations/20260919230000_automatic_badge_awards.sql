-- Automatically grant supported achievement badges and repair historical gaps.
-- Supported criteria_key suffixes:
--   beginner, first_challenge, first_solve, first_flag,
--   primeiro_desafio, primeira_flag, first_blood, primeiro_sangue.

-- The profile hardening migration may already be installed in production.
-- Add the narrowly scoped internal marker before the historical backfill tries
-- to credit badge rewards. Browser requests cannot set this PostgreSQL setting.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_role text;
BEGIN
  IF auth.role() = 'service_role' OR pg_trigger_depth() > 1
     OR current_setting('app.writeup_review', true) = 'on'
     OR current_setting('app.activity_update', true) = 'on'
     OR current_setting('app.hint_unlock', true) = 'on'
     OR current_setting('app.badge_award', true) = 'on' THEN RETURN NEW; END IF;
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

-- Keep a durable, unique winner for each challenge. The primary key also
-- resolves simultaneous correct submissions without awarding two winners.
CREATE TABLE IF NOT EXISTS public.challenge_first_bloods (
  challenge_id uuid PRIMARY KEY REFERENCES public.challenges(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL UNIQUE REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.challenge_first_bloods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.challenge_first_bloods FROM PUBLIC, anon, authenticated;

INSERT INTO public.challenge_first_bloods (challenge_id, submission_id, user_id, awarded_at)
SELECT DISTINCT ON (s.challenge_id)
  s.challenge_id, s.id, s.user_id, s.submitted_at
FROM public.submissions s
WHERE s.is_correct
ORDER BY s.challenge_id, s.submitted_at, s.id
ON CONFLICT (challenge_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_automatic_badge(p_badge_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  badge_key text;
  awarded_count integer := 0;
BEGIN
  SELECT lower(criteria_key) INTO badge_key FROM public.badges WHERE id = p_badge_id;
  IF badge_key IS NULL THEN RETURN 0; END IF;

  PERFORM set_config('app.badge_award', 'on', true);

  IF badge_key ~ '(^|_)(beginner|first_challenge|first_solve|first_flag|primeiro_desafio|primeira_flag)$' THEN
    WITH eligible AS (
      SELECT DISTINCT s.user_id
      FROM public.submissions s
      WHERE s.is_correct
    ), inserted AS (
      INSERT INTO public.user_badges (user_id, badge_id)
      SELECT e.user_id, p_badge_id FROM eligible e
      ON CONFLICT (user_id, badge_id) DO NOTHING
      RETURNING user_id
    ), rewarded AS (
      UPDATE public.profiles p
      SET shells = p.shells + b.reward, updated_at = now()
      FROM inserted i, public.badges b
      WHERE p.id = i.user_id AND b.id = p_badge_id
      RETURNING p.id
    )
    SELECT count(*) INTO awarded_count FROM rewarded;

  ELSIF badge_key ~ '(^|_)(first_blood|primeiro_sangue)$' THEN
    WITH eligible AS (
      SELECT DISTINCT fb.user_id
      FROM public.challenge_first_bloods fb
    ), inserted AS (
      INSERT INTO public.user_badges (user_id, badge_id)
      SELECT e.user_id, p_badge_id FROM eligible e
      ON CONFLICT (user_id, badge_id) DO NOTHING
      RETURNING user_id
    ), rewarded AS (
      UPDATE public.profiles p
      SET shells = p.shells + b.reward, updated_at = now()
      FROM inserted i, public.badges b
      WHERE p.id = i.user_id AND b.id = p_badge_id
      RETURNING p.id
    )
    SELECT count(*) INTO awarded_count FROM rewarded;
  END IF;

  RETURN awarded_count;
END; $$;
REVOKE ALL ON FUNCTION public.sync_automatic_badge(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_submission_badges()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_first_blood boolean := false;
  first_blood_rows integer := 0;
BEGIN
  IF NOT NEW.is_correct THEN RETURN NEW; END IF;

  INSERT INTO public.challenge_first_bloods (challenge_id, submission_id, user_id, awarded_at)
  VALUES (NEW.challenge_id, NEW.id, NEW.user_id, NEW.submitted_at)
  ON CONFLICT (challenge_id) DO NOTHING;
  GET DIAGNOSTICS first_blood_rows = ROW_COUNT;
  is_first_blood := first_blood_rows = 1;

  PERFORM set_config('app.badge_award', 'on', true);
  WITH eligible_badges AS (
    SELECT b.id, b.reward
    FROM public.badges b
    WHERE lower(b.criteria_key) ~ '(^|_)(beginner|first_challenge|first_solve|first_flag|primeiro_desafio|primeira_flag)$'
       OR (is_first_blood AND lower(b.criteria_key) ~ '(^|_)(first_blood|primeiro_sangue)$')
  ), inserted AS (
    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT NEW.user_id, b.id FROM eligible_badges b
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING badge_id
  ), reward AS (
    SELECT coalesce(sum(b.reward), 0)::integer AS amount
    FROM inserted i JOIN public.badges b ON b.id = i.badge_id
  )
  UPDATE public.profiles p
  SET shells = p.shells + reward.amount, updated_at = now()
  FROM reward
  WHERE p.id = NEW.user_id AND reward.amount > 0;

  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.award_submission_badges() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS award_submission_badges ON public.submissions;
CREATE TRIGGER award_submission_badges
AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.award_submission_badges();

-- When an administrator creates a supported badge later, award it to users
-- who already satisfy its criterion.
CREATE OR REPLACE FUNCTION public.sync_new_automatic_badge()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.sync_automatic_badge(NEW.id);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_new_automatic_badge() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_new_automatic_badge ON public.badges;
CREATE TRIGGER sync_new_automatic_badge
AFTER INSERT OR UPDATE OF criteria_key ON public.badges
FOR EACH ROW EXECUTE FUNCTION public.sync_new_automatic_badge();

-- One-time backfill for existing correct submissions. ON CONFLICT makes this
-- migration idempotent and rewards only newly inserted user_badges rows.
DO $$
DECLARE badge_row record;
BEGIN
  FOR badge_row IN SELECT id FROM public.badges LOOP
    PERFORM public.sync_automatic_badge(badge_row.id);
  END LOOP;
END $$;
