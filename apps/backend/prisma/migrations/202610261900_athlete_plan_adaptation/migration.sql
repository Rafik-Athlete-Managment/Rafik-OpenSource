-- Personalization belongs to the existing assignment, never the shared program library.
ALTER TABLE public.institution_assignments ADD COLUMN adaptation jsonb;
ALTER TABLE public.institution_assignments ADD CONSTRAINT institution_assignment_adaptation CHECK (
 adaptation IS NULL OR (
 jsonb_typeof(adaptation)='object' AND adaptation ?& ARRAY['title','prescription','revision','source_version_id'] AND
 jsonb_typeof(adaptation->'title')='string' AND length(adaptation->>'title') BETWEEN 1 AND 100 AND
 jsonb_typeof(adaptation->'prescription')='object' AND
 jsonb_typeof(adaptation->'revision')='number' AND (adaptation->>'revision')::integer > 0 AND
 adaptation->>'source_version_id'=version_id::text
 ));
