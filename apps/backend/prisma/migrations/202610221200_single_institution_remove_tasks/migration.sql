BEGIN;
LOCK TABLE public.workspaces IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.workspaces WHERE kind='organization') > 1 THEN
  RAISE EXCEPTION 'Rafik now supports one institution per installation. Migration stopped without deleting Tasks. Back up and split institutions into separate installations before retrying.';
 END IF;
END $$;
DELETE FROM public.workspace_operations WHERE result ?& ARRAY['assigned_to','created_by','priority','due_date'] AND payload->>'action' IN ('save','state');
DELETE FROM public.workspace_events WHERE kind LIKE 'trainer_task_%';
DROP TABLE public.organization_tasks;
COMMIT;
