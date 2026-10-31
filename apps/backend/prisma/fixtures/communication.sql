-- Explicitly synthetic local conversation; no external messages are sent.
INSERT INTO public.institution_channels(id,institution_id,title,created_by)
VALUES('1a000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','Foundation group · local example','13000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_channel_members(channel_id,institution_id,member_id,manager)
SELECT '1a000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',id,id<>'13000000-0000-4000-8000-000000000003'::uuid FROM public.institution_members WHERE id IN('13000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
INSERT INTO public.institution_messages(id,institution_id,channel_id,sender_id,body) VALUES
('1b000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001','This is a synthetic conversation for local review. Everyone in the participant list can read these messages.'),
('1b000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000002','For the next foundation session, we will review the movement examples together. Bring any questions here.'),
('1b000000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000001','1a000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000003','سأراجع البرنامج وأضيف أسئلتي هنا. هذا مثال محلي للتجربة.') ON CONFLICT DO NOTHING;
