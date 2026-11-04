-- A completed workout must contain actual results for every prescribed set.
-- Progress saves remain partial. A group participant may instead be explicitly skipped.
create or replace function public.validate_session_actuals(p_day jsonb,p_entries jsonb,p_note text,p_complete boolean) returns void language plpgsql set search_path=public,pg_temp as $$
declare e jsonb; expected_count int; kind text; prescribed jsonb; choice text;
begin
  if jsonb_typeof(p_entries) is distinct from 'array' or p_note is null or char_length(p_note)>2000 then raise exception 'invalid_session'; end if;
  select sum((x->>'sets')::int) into expected_count from jsonb_array_elements(p_day->'exercises') x;
  if jsonb_array_length(p_entries)<>expected_count or (select count(distinct (x->>'exercise_key',x->>'set_index')) from jsonb_array_elements(p_entries) x)<>expected_count then raise exception 'invalid_entries'; end if;
  if exists(select 1 from jsonb_array_elements(p_entries) x group by x->>'exercise_key' having count(distinct coalesce(x->>'exercise_id',''))>1) then raise exception 'inconsistent_exercise_choice'; end if;
  for e in select value from jsonb_array_elements(p_entries) loop
    select x,coalesce(x->>'kind','strength') into prescribed,kind from jsonb_array_elements(p_day->'exercises') x where x->>'key'=e->>'exercise_key';
    if prescribed is null or (e->>'set_index') is null or (e->>'set_index')::int<0 or (e->>'set_index')::int>=(prescribed->>'sets')::int
      or coalesce((e->>'reps')::int,-1) not between 0 and 200 or coalesce((e->>'load')::numeric,-1) not between 0 and 1000
      or coalesce(e->>'unit','') not in ('kg','lb') or jsonb_typeof(e->'completed') is distinct from 'boolean'
      or (e->>'seconds' is not null and (e->>'seconds')::int not between 0 and 86400)
      or (e->>'metres' is not null and (e->>'metres')::numeric not between 0 and 1000000)
      or (e->>'effort' is not null and (e->>'effort')::numeric not between 1 and 10)
      or ((e->>'completed')::boolean and ((kind='strength' and (e->>'reps')::int<1) or (kind='timed' and coalesce((e->>'seconds')::int,0)<1) or (kind='distance' and coalesce((e->>'metres')::numeric,0)<1))) then raise exception 'invalid_entry'; end if;
    choice:=nullif(e->>'exercise_id','');
    if choice is not null and choice<>prescribed->>'exerciseId' and not exists(select 1 from jsonb_array_elements(coalesce(prescribed->'alternatives','[]'::jsonb)) a where a->>'exerciseId'=choice) then raise exception 'invalid_exercise_choice'; end if;
  end loop;
  if p_complete and exists(select 1 from jsonb_array_elements(p_entries) x where (x->>'completed')::boolean is distinct from true) then raise exception 'incomplete_entries'; end if;
end $$;
