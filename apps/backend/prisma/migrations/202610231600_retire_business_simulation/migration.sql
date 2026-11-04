-- Retire provider simulation, not historical account/export records.
BEGIN;
DROP FUNCTION public.simulate_business_event(uuid,uuid,bigint,jsonb);
DROP FUNCTION public.apply_business_event(uuid,uuid,bigint,jsonb);
DROP TABLE public.runtime_settings;
COMMIT;
