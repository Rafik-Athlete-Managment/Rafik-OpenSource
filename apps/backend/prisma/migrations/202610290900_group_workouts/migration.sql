BEGIN;
CREATE TABLE public.institution_workout_templates (
 id uuid PRIMARY KEY, institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
 created_by uuid NOT NULL, title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 100),
 workout jsonb NOT NULL CHECK(jsonb_typeof(workout)='object'),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(institution_id,id), FOREIGN KEY(institution_id,created_by) REFERENCES public.institution_members(institution_id,id)
);
CREATE INDEX institution_workout_template_library ON public.institution_workout_templates(institution_id,archived,updated_at DESC,id);
REVOKE ALL ON public.institution_workout_templates FROM PUBLIC,rafik_guest,rafik_user;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.institution_workout_templates TO rafik_api;

ALTER TABLE public.institution_sessions ALTER COLUMN assignment_id DROP NOT NULL;
ALTER TABLE public.institution_sessions ADD COLUMN source_kind text NOT NULL DEFAULT 'assignment';
ALTER TABLE public.institution_sessions ADD CONSTRAINT institution_session_source CHECK(
 (source_kind='assignment' AND assignment_id IS NOT NULL)
 OR (source_kind='additional' AND assignment_id IS NULL AND occurrence_id IS NOT NULL AND source_snapshot IS NOT NULL AND recorded_mode='delegated' AND recorded_by IS NOT NULL));
ALTER TABLE public.institution_event_people ADD COLUMN workout_skip_reason text NOT NULL DEFAULT '' CHECK(length(workout_skip_reason)<=2000);

CREATE OR REPLACE FUNCTION public.guard_workout_source() RETURNS trigger LANGUAGE plpgsql
 SET search_path=public,pg_temp AS $$ BEGIN
 IF TG_OP='UPDATE' AND OLD.source_snapshot IS NOT NULL AND
 (NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
 OR NEW.member_id<>OLD.member_id OR NEW.institution_id<>OLD.institution_id OR NEW.day_id<>OLD.day_id
 OR NEW.source_kind<>OLD.source_kind) THEN RAISE EXCEPTION 'immutable_workout_source'; END IF;
 IF NEW.source_kind='assignment' AND NEW.source_snapshot IS NULL THEN
 SELECT jsonb_build_object('assignment_id',NEW.assignment_id,'version_id',a.version_id,
 'day_id',NEW.day_id,'local_date',NEW.local_date,'prescription',NEW.document->'prescription',
 'provenance','legacy_document') INTO NEW.source_snapshot
 FROM public.institution_assignments a WHERE a.id=NEW.assignment_id AND a.institution_id=NEW.institution_id;
 END IF;
 IF NEW.occurrence_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.institution_events
 WHERE id=NEW.occurrence_id AND institution_id=NEW.institution_id AND kind='training') THEN
 RAISE EXCEPTION 'invalid_workout_occurrence'; END IF;
 IF NEW.source_kind='additional' THEN
 IF NOT EXISTS(SELECT 1 FROM public.institution_events e JOIN public.institution_event_people p
 ON p.event_id=e.id AND p.institution_id=e.institution_id
 WHERE e.id=NEW.occurrence_id AND e.institution_id=NEW.institution_id AND p.member_id=NEW.member_id
 AND p.duty='trainee' AND e.workout_snapshot->>'source'='group') THEN RAISE EXCEPTION 'invalid_group_workout_source'; END IF;
 IF TG_OP='UPDATE' AND (NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id
 OR NEW.document->'prescription' IS DISTINCT FROM OLD.document->'prescription') THEN
 RAISE EXCEPTION 'immutable_workout_source'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.guard_group_workout_snapshot() RETURNS trigger LANGUAGE plpgsql
 SET search_path=public,pg_temp AS $$ BEGIN
 IF OLD.workout_snapshot->>'source'='group' AND NEW.workout_snapshot IS DISTINCT FROM OLD.workout_snapshot THEN
 RAISE EXCEPTION 'immutable_workout_source'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER institution_group_workout_snapshot BEFORE UPDATE ON public.institution_events
 FOR EACH ROW EXECUTE FUNCTION public.guard_group_workout_snapshot();
REVOKE ALL ON FUNCTION public.guard_group_workout_snapshot() FROM PUBLIC,rafik_guest,rafik_user;
COMMIT;
