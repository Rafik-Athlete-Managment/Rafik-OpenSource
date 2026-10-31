-- Founder-approved breaking beta.3 cleanup before customer adoption.
-- Run with the matching backend/web/APK stopped and a complete database/files backup.
-- Current institution records, opaque documents and exact receipts are not rewritten.
BEGIN;

-- Replace the former pair-based policy before dropping its relationship table.
DROP POLICY profile_read ON public.profiles;
CREATE POLICY profile_read ON public.profiles FOR SELECT TO rafik_user USING(id=identity.actor_id());

CREATE OR REPLACE FUNCTION public.validate_calendar_collision(p_users uuid[],p_start timestamptz,p_end timestamptz,p_event uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM id FROM public.profiles WHERE id=ANY(p_users) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.institution_events e JOIN public.institution_event_people p ON p.event_id=e.id
 JOIN public.institution_members m ON m.id=p.member_id WHERE e.state='scheduled' AND e.id IS DISTINCT FROM p_event
 AND m.user_id=ANY(p_users) AND tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) THEN RAISE EXCEPTION 'time_unavailable'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.account_deletion_ready() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF identity.actor_id() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
 IF EXISTS(SELECT 1 FROM public.institution_members m JOIN public.institutions i ON i.id=m.institution_id
 WHERE m.user_id=identity.actor_id() AND m.active AND 'admin'=ANY(m.roles) AND NOT i.archived
 AND NOT EXISTS(SELECT 1 FROM public.institution_members other WHERE other.institution_id=m.institution_id
 AND other.user_id IS DISTINCT FROM identity.actor_id() AND other.active AND 'admin'=ANY(other.roles)))
 THEN RAISE EXCEPTION 'last_admin'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.delete_my_account(p_confirmation text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_confirmation IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'invalid_confirmation'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(i.id::text,73)) FROM public.institutions i
 WHERE i.id IN(SELECT institution_id FROM public.institution_members WHERE user_id=identity.actor_id()) ORDER BY i.id;
 PERFORM public.account_deletion_ready();
 UPDATE public.institution_members SET trainer_id=NULL,revision=revision+1
 WHERE trainer_id IN(SELECT id FROM public.institution_members WHERE user_id=identity.actor_id());
 UPDATE public.institution_members SET active=false,trainer_id=NULL,name='Former member',revision=revision+1 WHERE user_id=identity.actor_id();
 DELETE FROM identity.users WHERE id=identity.actor_id();
END $$;

-- Support is a current own-account feature, not a historical team workflow.
DROP FUNCTION public.create_support_case(uuid,uuid,text,text);
DROP FUNCTION public.update_support_case(uuid,integer,text,text);
DROP POLICY support_participants ON public.support_cases;
ALTER TABLE public.support_cases DROP COLUMN team_id;
CREATE POLICY support_reporter ON public.support_cases FOR SELECT TO rafik_user USING(reporter_id=identity.actor_id());
CREATE FUNCTION public.create_support_case(p_id uuid,p_subject text,p_detail text) RETURNS public.support_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.support_cases;
BEGIN
 IF identity.actor_id() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
 IF length(trim(coalesce(p_subject,''))) NOT BETWEEN 1 AND 120 OR length(trim(coalesce(p_detail,''))) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'invalid_support'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO c FROM public.support_cases WHERE id=p_id;
 IF FOUND THEN
  IF c.reporter_id<>identity.actor_id() OR c.subject IS DISTINCT FROM trim(p_subject) OR c.detail IS DISTINCT FROM trim(p_detail) THEN RAISE EXCEPTION 'conflict'; END IF;
  RETURN c;
 END IF;
 INSERT INTO public.support_cases(id,reporter_id,subject,detail) VALUES(p_id,identity.actor_id(),trim(p_subject),trim(p_detail)) RETURNING * INTO c;
 RETURN c;
END $$;
CREATE FUNCTION public.update_support_case(p_id uuid,p_revision integer,p_state text) RETURNS public.support_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.support_cases;
BEGIN
 SELECT * INTO c FROM public.support_cases WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.reporter_id IS DISTINCT FROM identity.actor_id() THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_state NOT IN('open','resolved') OR p_state IS NULL THEN RAISE EXCEPTION 'invalid_support'; END IF;
 IF c.state=p_state THEN RETURN c; END IF;
 IF c.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'conflict'; END IF;
 UPDATE public.support_cases SET state=p_state,revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO c;
 RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.create_support_case(uuid,text,text),public.update_support_case(uuid,integer,text) FROM PUBLIC,rafik_guest;
GRANT EXECUTE ON FUNCTION public.create_support_case(uuid,text,text),public.update_support_case(uuid,integer,text) TO rafik_user;
CREATE OR REPLACE FUNCTION public.platform_support_read(p_actor uuid,p_search text,p_offset integer) RETURNS SETOF public.support_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_grants WHERE user_id=p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN QUERY SELECT c.* FROM public.support_cases c WHERE c.subject ILIKE p_search ORDER BY c.updated_at DESC,c.id LIMIT 26 OFFSET greatest(0,least(p_offset,100000));
END $$;
CREATE OR REPLACE FUNCTION public.platform_support_reply(p_actor uuid,p_id uuid,p_revision integer,p_reply text) RETURNS public.support_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_grants WHERE user_id=p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN public.operator_support_reply(p_id,p_revision,p_reply);
END $$;

CREATE OR REPLACE FUNCTION public.capture_domain_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target uuid; peer record; e record;
BEGIN
 IF TG_TABLE_NAME='institution_messages' THEN
  FOR peer IN SELECT m.user_id FROM public.institution_channel_members p JOIN public.institution_members m ON m.id=p.member_id WHERE p.channel_id=NEW.channel_id AND m.active AND m.id<>NEW.sender_id LOOP
   PERFORM public.capture_notification(peer.user_id,'messages','organization_message',NEW.id,NEW.channel_id,'organization-message:'||NEW.id,NEW.institution_id);
  END LOOP;
 ELSIF TG_TABLE_NAME='institution_events' THEN
  IF NEW.revision IS DISTINCT FROM OLD.revision THEN
   FOR peer IN SELECT m.user_id FROM public.institution_event_people p JOIN public.institution_members m ON m.id=p.member_id WHERE p.event_id=NEW.id AND m.active LOOP
    PERFORM public.capture_notification(peer.user_id,'calendar','organization_event',NEW.id,NEW.id,'organization-event:'||NEW.id||':'||NEW.revision,NEW.institution_id,NEW.revision);
   END LOOP;
  END IF;
 ELSIF TG_TABLE_NAME='institution_event_people' THEN
  SELECT * INTO e FROM public.institution_events WHERE id=NEW.event_id;
  SELECT user_id INTO target FROM public.institution_members WHERE id=NEW.member_id AND active;
  PERFORM public.capture_notification(target,'calendar','organization_event',e.id,e.id,'organization-event:'||e.id||':'||e.revision,e.institution_id,e.revision);
 ELSIF TG_TABLE_NAME='assessment_results' THEN
  SELECT user_id INTO target FROM public.institution_members WHERE id=NEW.member_id AND active;
  PERFORM public.capture_notification(target,'feedback','organization_result',NEW.event_id,NEW.event_id,'organization-result:'||NEW.event_id||':'||NEW.member_id||':'||NEW.revision,NEW.institution_id,NEW.revision);
 ELSIF TG_TABLE_NAME='institution_sessions' THEN
  IF NEW.document->>'reviewed_at' IS NOT NULL AND NEW.document->>'reviewed_at' IS DISTINCT FROM OLD.document->>'reviewed_at' THEN
   SELECT user_id INTO target FROM public.institution_members WHERE id=NEW.member_id AND active;
   PERFORM public.capture_notification(target,'feedback','organization_workout',NEW.id,NEW.id,'organization-workout:'||NEW.id||':'||(NEW.document->>'reviewed_at'),NEW.institution_id);
  END IF;
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_notification_reminders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
INSERT INTO public.notification_events(user_id,institution_id,category,source_kind,source_id,source_group,event_key,source_revision) SELECT m.user_id,e.institution_id,'calendar','organization_reminder',e.id,e.id,'organization-reminder:'||e.id||':'||e.revision,e.revision FROM public.institution_events e JOIN public.institution_event_people p ON p.event_id=e.id JOIN public.institution_members m ON m.id=p.member_id JOIN public.institutions w ON w.id=e.institution_id WHERE m.active AND m.user_id IS NOT NULL AND NOT w.archived AND e.state='scheduled' AND e.starts_at>now() AND e.starts_at<=now()+interval '24 hours' AND NOT EXISTS(SELECT 1 FROM public.notification_events n WHERE n.user_id=m.user_id AND n.event_key='organization-reminder:'||e.id||':'||e.revision) ORDER BY e.starts_at,e.id,m.id LIMIT 200 ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_notification_reminders() FROM PUBLIC,rafik_guest,rafik_user;
GRANT EXECUTE ON FUNCTION public.prepare_notification_reminders() TO rafik_api;
-- Remove exclusive historical functions, including definer functions whose SQL
-- bodies would otherwise survive a dropped table and fail only when invoked.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
 AND p.proname <> ALL(ARRAY[
 'account_deletion_ready','delete_my_account','ensure_profile','update_profile',
 'create_support_case','update_support_case','operator_support_reply','platform_support_read','platform_support_reply',
 'availability_preview','capture_notification','capture_domain_notification','prepare_notification_reminders',
 'can_manage_instance_branding','claim_instance_branding','read_instance_branding','read_instance_branding_logo','update_instance_branding',
 'institution_member_today','sync_coaching_links','set_event_training_date',
 'guard_workout_source','validate_workout_position','validate_calendar_collision','validate_nutrients','validate_nutrition_meals',
 'validate_prescription_catalog','snapshot_prescription_catalog','validate_program_draft','validate_program_presentation','validate_session_actuals'
 ]) LOOP EXECUTE 'DROP FUNCTION IF EXISTS '||f.signature||' CASCADE'; END LOOP;
END $$;

-- Approved deletion: standalone assignments are not institution_assignments.
DROP TABLE public.appointment_slots,public.appointments,public.assignments,
 public.business_accounts,public.business_events,public.client_context,public.coach_clients,
 public.coaching_forms,public.coaching_requests,public.conversation_reads,public.invitations,
 public.meal_entries,public.measurements,public.messages,public.nutrition_guidance,
 public.plan_versions,public.plans,public.resource_shares,public.resources,public.saved_foods,
 public.schedule_exceptions,public.session_operations,public.sessions,public.set_entries,
 public.team_activity,public.team_assignments,public.team_clients,public.team_group_members,
 public.team_groups,public.team_invitations,public.team_members,public.team_plans,
 public.team_resource_shares,public.teams,public.plan_deliveries CASCADE;
DROP TABLE file_store.objects,file_store.buckets CASCADE;
DROP SCHEMA file_store;

-- Shared exercise reference content remains supported. Personal exercise copies
-- are retired; institution-owned exercises already have their own model.
DELETE FROM public.exercises WHERE owner_id IS NOT NULL;
DROP POLICY IF EXISTS exercises_read ON public.exercises;
ALTER TABLE public.exercises DROP COLUMN owner_id CASCADE;
ALTER TABLE public.exercises RENAME TO reference_exercises;
REVOKE ALL ON public.reference_exercises FROM PUBLIC,rafik_guest,rafik_user;
GRANT SELECT ON public.reference_exercises TO rafik_api;
CREATE POLICY reference_exercises_read ON public.reference_exercises FOR SELECT TO rafik_api USING(true);

DELETE FROM public.institutions WHERE kind='independent';
ALTER TABLE public.institutions DROP CONSTRAINT institutions_kind_check;
ALTER TABLE public.institutions ADD CONSTRAINT institutions_kind_check CHECK(kind='organization');
-- No old notification may reference a removed standalone domain.
DELETE FROM public.notification_events WHERE source_kind NOT IN('organization_message','organization_event','organization_result','organization_workout','organization_reminder');
COMMIT;
