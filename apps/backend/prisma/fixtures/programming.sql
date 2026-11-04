-- Curated local organization example; never seed hosting. Existing edits are preserved.
insert into public.institution_programs(id,institution_id,created_by,title,draft,listed)
select '14000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001','Build a steady foundation',
 jsonb_set(prescription||'{"schema":2,"cycleWeeks":1,"presentation":{"goal":"Build confidence with two full-body sessions each week.","level":"beginner"}}'::jsonb,'{days}',(select jsonb_agg(d.value||jsonb_build_object('week',1,'weekday',(d.n-1)*2) order by d.n) from jsonb_array_elements(prescription->'days') with ordinality d(value,n))),true
from (select __SAMPLE_PRESCRIPTION__ as prescription) source
on conflict(id) do nothing;
insert into public.institution_versions(id,institution_id,program_id,revision,title,prescription,created_by)
select '15000000-0000-4000-8000-000000000001',institution_id,id,1,title,draft,created_by from public.institution_programs where id='14000000-0000-4000-8000-000000000001' on conflict(id) do nothing;
insert into public.institution_assignments(id,institution_id,member_id,version_id,created_by,start_date,schedule_mode)
select '16000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000003','15000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001',current_date,'flexible'
where not exists(select 1 from public.institution_assignments where institution_id='12000000-0000-4000-8000-000000000001' and member_id='13000000-0000-4000-8000-000000000003' and state='active') on conflict(id) do nothing;
