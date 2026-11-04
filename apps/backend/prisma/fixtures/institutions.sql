insert into identity.users(id,email,email_confirmed_at) values
('11000000-0000-4000-8000-000000000001','orgadmin@rafik.test',now()),
('11000000-0000-4000-8000-000000000002','orgtrainer@rafik.test',now()),
('11000000-0000-4000-8000-000000000003','orgtrainee@rafik.test',now()),
('11000000-0000-4000-8000-000000000004','orgadmin2@rafik.test',now()) on conflict(id) do nothing;
insert into public.profiles(id,display_name) values
('11000000-0000-4000-8000-000000000001','Rania Mansour'),
('11000000-0000-4000-8000-000000000002','Kareem Nasser'),
('11000000-0000-4000-8000-000000000003','Sara Khalil'),
('11000000-0000-4000-8000-000000000004','Omar Saleh') on conflict(id) do nothing;
insert into public.institutions(id,kind,name,created_by) values
('12000000-0000-4000-8000-000000000001','organization','Madar Training','11000000-0000-4000-8000-000000000001') on conflict(id) do nothing;
insert into public.institution_members(id,institution_id,user_id,roles) values
('13000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001',array['admin']),
('13000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002',array['trainer']),
('13000000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000003',array['trainee']) on conflict(id) do nothing;
update public.institution_members set trainer_id='13000000-0000-4000-8000-000000000002' where id='13000000-0000-4000-8000-000000000003' and trainer_id is null and revision=1;

update public.institution_members m set name=p.display_name from public.profiles p where p.id=m.user_id and m.name='Former member';
