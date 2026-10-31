BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('business_accounts','business_events','assignments','sessions','plans','plan_versions','teams','resources')) THEN RAISE EXCEPTION 'retired tables remain'; END IF;
 IF to_regclass('file_store.objects') IS NOT NULL THEN RAISE EXCEPTION 'legacy file metadata remains'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.institution_assignments) THEN RAISE EXCEPTION 'current assignments missing'; END IF;
 IF (SELECT count(*) FROM public.reference_exercises WHERE id LIKE 'dataset-%')<>1324 THEN RAISE EXCEPTION 'reference corpus changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.institutions WHERE kind<>'organization') THEN RAISE EXCEPTION 'independent institution remains'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('save_session','team_workspace','open_business_account','save_plan','register_resource')) THEN RAISE EXCEPTION 'retired functions remain'; END IF;
END $$;
SET LOCAL ROLE rafik_user;
SELECT set_config('rafik.actor','11000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 BEGIN PERFORM public.delete_my_account('DELETE'); RAISE EXCEPTION 'last admin deleted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'last_admin' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
