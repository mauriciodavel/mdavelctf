-- Retroactively award every configured badge using current historical data.
-- Existing awards are preserved and rewards are credited only for new rows.
CREATE OR REPLACE FUNCTION public.backfill_configured_badges()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE awarded_count integer := 0;
BEGIN
  PERFORM set_config('app.badge_award', 'on', true);

  WITH correct_submissions AS (
    SELECT s.*, m.event_id
    FROM public.submissions s
    JOIN public.challenges c ON c.id = s.challenge_id
    JOIN public.missions m ON m.id = c.mission_id
    WHERE s.is_correct
  ), eligible AS (
    SELECT b.id AS badge_id, cs.user_id
    FROM public.badges b
    JOIN correct_submissions cs ON true
    WHERE b.criteria_config->>'type' = 'first_challenge'

    UNION
    SELECT b.id, fb.user_id
    FROM public.badges b
    JOIN public.challenge_first_bloods fb ON true
    WHERE b.criteria_config->>'type' = 'first_blood'

    UNION
    SELECT b.id, cs.user_id
    FROM public.badges b
    JOIN correct_submissions cs ON true
    WHERE b.criteria_config->>'type' = 'total_points'
    GROUP BY b.id, cs.user_id, b.criteria_config
    HAVING sum(cs.points_awarded) >= (b.criteria_config->>'minimum_points')::integer

    UNION
    SELECT b.id, cs.user_id
    FROM public.badges b
    JOIN correct_submissions cs ON true
    WHERE b.criteria_config->>'type' = 'events_participated'
    GROUP BY b.id, cs.user_id, b.criteria_config
    HAVING count(DISTINCT cs.event_id) >= (b.criteria_config->>'minimum_events')::integer

    UNION
    SELECT b.id, cs.user_id
    FROM public.badges b
    JOIN correct_submissions cs ON true
    WHERE b.criteria_config->>'type' = 'complete_category'
      AND NOT EXISTS (
        SELECT 1
        FROM public.challenges required_challenge
        JOIN public.missions required_mission ON required_mission.id = required_challenge.mission_id
        JOIN public.events required_event ON required_event.id = required_mission.event_id
        WHERE required_event.category IN (
          SELECT jsonb_array_elements_text(b.criteria_config->'event_categories')
        )
        AND NOT EXISTS (
          SELECT 1 FROM correct_submissions solved
          WHERE solved.user_id = cs.user_id AND solved.challenge_id = required_challenge.id
        )
      )
      AND EXISTS (
        SELECT 1 FROM public.events category_event
        WHERE category_event.category IN (
          SELECT jsonb_array_elements_text(b.criteria_config->'event_categories')
        )
      )

    UNION
    SELECT b.id, cs.user_id
    FROM public.badges b
    JOIN correct_submissions cs ON true
    WHERE b.criteria_config->>'type' = 'complete_event_without_hints'
      AND NOT EXISTS (
        SELECT 1
        FROM public.challenges required_challenge
        JOIN public.missions required_mission ON required_mission.id = required_challenge.mission_id
        WHERE required_mission.event_id = cs.event_id
          AND NOT EXISTS (
            SELECT 1 FROM correct_submissions solved
            WHERE solved.user_id = cs.user_id AND solved.challenge_id = required_challenge.id
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.hint_usage hu
        JOIN public.hints h ON h.id = hu.hint_id
        JOIN public.challenges hinted_challenge ON hinted_challenge.id = h.challenge_id
        JOIN public.missions hinted_mission ON hinted_mission.id = hinted_challenge.mission_id
        WHERE hu.user_id = cs.user_id AND hinted_mission.event_id = cs.event_id
      )

    UNION
    SELECT b.id, cs.user_id
    FROM public.badges b
    JOIN correct_submissions cs ON true
    WHERE b.criteria_config->>'type' = 'perfect_event'
      AND (SELECT count(*) FROM public.challenges ec JOIN public.missions em ON em.id = ec.mission_id WHERE em.event_id = cs.event_id)
          >= (b.criteria_config->>'minimum_challenges')::integer
      AND NOT EXISTS (
        SELECT 1 FROM public.challenges required_challenge
        JOIN public.missions required_mission ON required_mission.id = required_challenge.mission_id
        WHERE required_mission.event_id = cs.event_id
          AND NOT EXISTS (
            SELECT 1 FROM correct_submissions solved
            WHERE solved.user_id = cs.user_id AND solved.challenge_id = required_challenge.id
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.submissions failed
        JOIN public.challenges failed_challenge ON failed_challenge.id = failed.challenge_id
        JOIN public.missions failed_mission ON failed_mission.id = failed_challenge.mission_id
        WHERE failed.user_id = cs.user_id AND failed_mission.event_id = cs.event_id AND NOT failed.is_correct
      )

    UNION
    SELECT b.id, t.created_by
    FROM public.badges b
    JOIN public.teams t ON t.created_by IS NOT NULL
    WHERE b.criteria_config->>'type' = 'team_leader'
      AND (
        SELECT count(DISTINCT member_id)
        FROM (
          SELECT tm.user_id AS member_id FROM public.team_members tm WHERE tm.team_id = t.id
          UNION ALL
          SELECT t.created_by WHERE coalesce((b.criteria_config->>'include_leader')::boolean, false)
        ) members
      ) >= (b.criteria_config->>'minimum_members')::integer
  ), inserted AS (
    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT DISTINCT e.user_id, e.badge_id FROM eligible e
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING user_id, badge_id
  ), rewards AS (
    SELECT i.user_id, sum(b.reward)::integer AS amount
    FROM inserted i JOIN public.badges b ON b.id = i.badge_id
    GROUP BY i.user_id
  ), rewarded AS (
    UPDATE public.profiles p
    SET shells = p.shells + r.amount, updated_at = now()
    FROM rewards r
    WHERE p.id = r.user_id AND r.amount > 0
    RETURNING p.id
  )
  SELECT count(*) INTO awarded_count FROM inserted;

  RETURN awarded_count;
END; $$;

REVOKE ALL ON FUNCTION public.backfill_configured_badges() FROM PUBLIC, anon, authenticated;
SELECT public.backfill_configured_badges();

