BEGIN;
ALTER TABLE public.institution_events
 ADD COLUMN timing_mode text NOT NULL DEFAULT 'timed',
 ALTER COLUMN starts_at DROP NOT NULL,
 ALTER COLUMN ends_at DROP NOT NULL,
 ADD CONSTRAINT institution_event_timing CHECK (
  (timing_mode='timed' AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at>starts_at)
  OR (timing_mode='day' AND starts_at IS NULL AND ends_at IS NULL AND kind='training' AND workout_snapshot IS NOT NULL));
CREATE OR REPLACE FUNCTION public.set_event_training_date() RETURNS trigger LANGUAGE plpgsql
 SET search_path=public,pg_temp AS $$ BEGIN
 IF NEW.timing_mode='timed' THEN
  NEW.training_date := (NEW.starts_at AT TIME ZONE NEW.timezone)::date;
 END IF;
 RETURN NEW;
END $$;
ALTER TABLE public.institution_workout_recurrences
 ADD COLUMN last_generated_on date,
 ADD COLUMN last_checked_at timestamptz,
 ADD COLUMN issue text;
CREATE UNIQUE INDEX institution_workout_one_active_rule
 ON public.institution_workout_recurrences(assignment_id) WHERE state='active';
CREATE INDEX institution_workout_rule_poll
 ON public.institution_workout_recurrences(last_checked_at ASC NULLS FIRST,id) WHERE state='active';
CREATE INDEX institution_event_day_agenda
 ON public.institution_events(institution_id,training_date,id) WHERE timing_mode='day';
-- A null/null PostgreSQL range is unbounded. Day-only work never occupies a timed slot.
CREATE OR REPLACE FUNCTION public.validate_calendar_collision(p_users uuid[],p_start timestamptz,p_end timestamptz,p_event uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM id FROM public.profiles WHERE id=ANY(p_users) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.institution_events e JOIN public.institution_event_people p ON p.event_id=e.id
 JOIN public.institution_members m ON m.id=p.member_id WHERE e.state='scheduled' AND e.timing_mode='timed' AND e.id IS DISTINCT FROM p_event
 AND m.user_id=ANY(p_users) AND tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) THEN RAISE EXCEPTION 'time_unavailable'; END IF;
END $$;
COMMIT;
