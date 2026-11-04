-- Additive foundation only. Existing calendar timestamps, assignment-backed writes
-- and operation receipts retain their current meaning until the API cutover.
BEGIN;
ALTER TABLE public.organization_assignments
 ADD COLUMN sequence_cursor integer NOT NULL DEFAULT 0 CHECK(sequence_cursor >= 0);

ALTER TABLE public.organization_events
 ADD COLUMN training_date date,
 ADD COLUMN workout_snapshot jsonb,
 ADD CONSTRAINT organization_event_workout_kind CHECK (
   workout_snapshot IS NULL OR (kind='training' AND jsonb_typeof(workout_snapshot)='object'));
UPDATE public.organization_events SET training_date=(starts_at AT TIME ZONE timezone)::date;
ALTER TABLE public.organization_events ALTER COLUMN training_date SET NOT NULL;
-- Default keeps ORM insert inputs additive; the trigger below always replaces it
-- with the actual event-local date before constraints are checked.
ALTER TABLE public.organization_events ALTER COLUMN training_date SET DEFAULT CURRENT_DATE;
CREATE FUNCTION public.set_event_training_date() RETURNS trigger LANGUAGE plpgsql
 SET search_path=public,pg_temp AS $$ BEGIN
 -- Old clients do not send this column. Timed dates always follow event timezone.
 NEW.training_date := (NEW.starts_at AT TIME ZONE NEW.timezone)::date;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_event_training_date BEFORE INSERT OR UPDATE ON public.organization_events
 FOR EACH ROW EXECUTE FUNCTION public.set_event_training_date();
REVOKE ALL ON FUNCTION public.set_event_training_date() FROM PUBLIC,rafik_guest,rafik_user;

ALTER TABLE public.organization_sessions
 ADD COLUMN occurrence_id uuid,
 ADD COLUMN source_snapshot jsonb,
 ADD CONSTRAINT organization_workout_participant FOREIGN KEY(workspace_id,member_id,occurrence_id)
 REFERENCES public.organization_event_people(workspace_id,member_id,event_id),
 ADD CONSTRAINT organization_workout_snapshot_object CHECK(source_snapshot IS NULL OR jsonb_typeof(source_snapshot)='object');
CREATE UNIQUE INDEX organization_workout_occurrence_subject
 ON public.organization_sessions(occurrence_id,member_id) WHERE occurrence_id IS NOT NULL;
ALTER TABLE public.organization_sessions ADD CONSTRAINT organization_workout_scoped_participant UNIQUE(workspace_id,member_id,occurrence_id);
-- The document is authoritative historical evidence; never replace it with today's template.
UPDATE public.organization_sessions s SET source_snapshot=jsonb_build_object(
 'assignment_id',s.assignment_id,'version_id',a.version_id,'day_id',s.day_id,
 'local_date',s.local_date,'prescription',s.document->'prescription','provenance','legacy_document')
 FROM public.organization_assignments a WHERE a.id=s.assignment_id AND a.workspace_id=s.workspace_id;
CREATE FUNCTION public.guard_workout_source() RETURNS trigger LANGUAGE plpgsql
 SET search_path=public,pg_temp AS $$ BEGIN
 IF TG_OP='UPDATE' AND OLD.source_snapshot IS NOT NULL AND
 (NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot OR NEW.assignment_id<>OLD.assignment_id
 OR NEW.member_id<>OLD.member_id OR NEW.workspace_id<>OLD.workspace_id OR NEW.day_id<>OLD.day_id) THEN
 RAISE EXCEPTION 'immutable_workout_source'; END IF;
 IF NEW.source_snapshot IS NULL THEN
 SELECT jsonb_build_object('assignment_id',NEW.assignment_id,'version_id',a.version_id,
 'day_id',NEW.day_id,'local_date',NEW.local_date,'prescription',NEW.document->'prescription',
 'provenance','legacy_document') INTO NEW.source_snapshot
 FROM public.organization_assignments a WHERE a.id=NEW.assignment_id AND a.workspace_id=NEW.workspace_id;
 END IF;
 IF NEW.occurrence_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organization_events
 WHERE id=NEW.occurrence_id AND workspace_id=NEW.workspace_id AND kind='training') THEN
 RAISE EXCEPTION 'invalid_workout_occurrence'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_workout_source_guard BEFORE INSERT OR UPDATE ON public.organization_sessions
 FOR EACH ROW EXECUTE FUNCTION public.guard_workout_source();
REVOKE ALL ON FUNCTION public.guard_workout_source() FROM PUBLIC,rafik_guest,rafik_user;

CREATE TABLE public.organization_workout_recurrences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
 assignment_id uuid NOT NULL, created_by uuid NOT NULL,
 starts_on date NOT NULL, ends_on date NOT NULL,
 weekdays smallint[] NOT NULL, timezone text NOT NULL,
 local_time time, duration_minutes integer,
 state text NOT NULL DEFAULT 'active' CHECK(state IN('active','cancelled')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 CHECK(ends_on>=starts_on AND ends_on<=starts_on+366),
 CHECK(cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[] AND array_position(weekdays,NULL) IS NULL),
 CHECK((local_time IS NULL AND duration_minutes IS NULL) OR (local_time IS NOT NULL AND duration_minutes IS NOT NULL AND duration_minutes BETWEEN 1 AND 480)),
 UNIQUE(workspace_id,id),
 FOREIGN KEY(workspace_id,assignment_id) REFERENCES public.organization_assignments(workspace_id,id),
 FOREIGN KEY(workspace_id,created_by) REFERENCES public.workspace_members(workspace_id,id)
);
CREATE INDEX organization_workout_recurrence_assignment ON public.organization_workout_recurrences(workspace_id,assignment_id);

CREATE TABLE public.organization_workout_positions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL,
 assignment_id uuid NOT NULL, position integer NOT NULL CHECK(position>=0),
 cycle integer NOT NULL CHECK(cycle>=0), day_id text NOT NULL CHECK(length(day_id)>0),
 occurrence_id uuid NOT NULL, session_id uuid,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','completed','skipped','cancelled','paused')),
 resolved_by uuid, resolved_at timestamptz, reason text,
 UNIQUE(assignment_id,position), UNIQUE(occurrence_id), UNIQUE(session_id),
 UNIQUE(workspace_id,occurrence_id), UNIQUE(workspace_id,session_id),
 FOREIGN KEY(workspace_id,assignment_id) REFERENCES public.organization_assignments(workspace_id,id),
 FOREIGN KEY(workspace_id,occurrence_id) REFERENCES public.organization_events(workspace_id,id),
 FOREIGN KEY(workspace_id,session_id) REFERENCES public.organization_sessions(workspace_id,id),
 FOREIGN KEY(workspace_id,resolved_by) REFERENCES public.workspace_members(workspace_id,id),
 CHECK((state IN('completed','skipped') AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
 OR (state NOT IN('completed','skipped') AND resolved_at IS NULL AND resolved_by IS NULL)),
 CHECK(state<>'skipped' OR (reason IS NOT NULL AND length(btrim(reason))>0))
);
CREATE UNIQUE INDEX organization_workout_one_unresolved ON public.organization_workout_positions(assignment_id)
 WHERE state IN('pending','paused');
CREATE FUNCTION public.validate_workout_position() RETURNS trigger LANGUAGE plpgsql
 SET search_path=public,pg_temp AS $$ DECLARE subject uuid; BEGIN
 IF TG_OP='UPDATE' AND (NEW.assignment_id<>OLD.assignment_id OR NEW.workspace_id<>OLD.workspace_id
 OR NEW.position<>OLD.position OR NEW.cycle<>OLD.cycle OR NEW.day_id<>OLD.day_id
 OR NEW.occurrence_id<>OLD.occurrence_id) THEN RAISE EXCEPTION 'immutable_workout_position'; END IF;
 IF TG_OP='UPDATE' AND OLD.state IN('completed','skipped') AND
 (NEW.state<>OLD.state OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
 OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by OR NEW.reason IS DISTINCT FROM OLD.reason) THEN
 RAISE EXCEPTION 'immutable_workout_resolution'; END IF;
 SELECT member_id INTO subject FROM public.organization_assignments
 WHERE workspace_id=NEW.workspace_id AND id=NEW.assignment_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.organization_events e
 JOIN public.organization_event_people p ON p.event_id=e.id AND p.workspace_id=e.workspace_id
 WHERE e.id=NEW.occurrence_id AND e.workspace_id=NEW.workspace_id
 AND e.kind='training' AND p.member_id=subject AND p.duty='trainee') THEN
 RAISE EXCEPTION 'invalid_workout_position_participant'; END IF;
 IF NEW.session_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organization_sessions s
 WHERE s.id=NEW.session_id AND s.workspace_id=NEW.workspace_id AND s.member_id=subject
 AND s.assignment_id=NEW.assignment_id AND s.occurrence_id=NEW.occurrence_id AND s.day_id=NEW.day_id) THEN
 RAISE EXCEPTION 'invalid_workout_position_session'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER organization_workout_position_guard BEFORE INSERT OR UPDATE ON public.organization_workout_positions
 FOR EACH ROW EXECUTE FUNCTION public.validate_workout_position();
REVOKE ALL ON FUNCTION public.validate_workout_position() FROM PUBLIC,rafik_guest,rafik_user;
-- These are server-owned foundations, not new generic query/command endpoints.
REVOKE ALL ON public.organization_workout_recurrences,public.organization_workout_positions FROM PUBLIC,rafik_guest,rafik_user;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.organization_workout_recurrences,public.organization_workout_positions TO rafik_api;
COMMIT;
