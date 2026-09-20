-- Give every existing badge a stable executable criterion and structured parameters.
ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS criteria_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.badges
  DROP CONSTRAINT IF EXISTS badges_criteria_config_object;
ALTER TABLE public.badges
  ADD CONSTRAINT badges_criteria_config_object
  CHECK (jsonb_typeof(criteria_config) = 'object');

-- Demo badges shipped with the application. Match the legacy suffix so this
-- also repairs installations whose seed prefix differs.
UPDATE public.badges SET
  criteria_config = '{"type":"first_blood"}'::jsonb
WHERE criteria_key ~ '(^|_)first_blood$';

UPDATE public.badges SET
  criteria_config = '{"type":"first_challenge","minimum_challenges":1}'::jsonb
WHERE criteria_key ~ '(^|_)(beginner|first_challenge|first_solve|first_flag)$';

UPDATE public.badges SET
  criteria_config = '{"type":"complete_category","event_categories":["Web Exploitation"]}'::jsonb
WHERE criteria_key ~ '(^|_)web_master$';

UPDATE public.badges SET
  criteria_config = '{"type":"complete_category","event_categories":["Cryptography"]}'::jsonb
WHERE criteria_key ~ '(^|_)cryptographer$';

UPDATE public.badges SET
  criteria_config = '{"type":"complete_category","event_categories":["Forensics"]}'::jsonb
WHERE criteria_key ~ '(^|_)forensics_expert$';

UPDATE public.badges SET
  criteria_config = '{"type":"complete_event_without_hints","scope":"any_event"}'::jsonb
WHERE criteria_key ~ '(^|_)no_hints$';

UPDATE public.badges SET
  criteria_config = '{"type":"total_points","minimum_points":1000}'::jsonb
WHERE criteria_key ~ '(^|_)ctf_legend$';

UPDATE public.badges SET
  criteria_config = '{"type":"events_participated","minimum_events":5,"participation":"correct_submission"}'::jsonb
WHERE criteria_key ~ '(^|_)marathon$';

UPDATE public.badges SET
  criteria_config = '{"type":"perfect_event","minimum_challenges":5,"accuracy_percent":100}'::jsonb
WHERE criteria_key ~ '(^|_)precision$';

UPDATE public.badges SET
  criteria_config = '{"type":"team_leader","minimum_members":3,"include_leader":true}'::jsonb
WHERE criteria_key ~ '(^|_)team_leader$';

-- A badge created outside the known catalog remains explicit rather than
-- silently pretending that its free-text description is executable.
UPDATE public.badges
SET criteria_config = jsonb_build_object('type', 'manual', 'legacy_key', criteria_key)
WHERE criteria_config = '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_badges_criteria_type
  ON public.badges ((criteria_config->>'type'));

