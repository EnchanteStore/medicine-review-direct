-- Test checkout, idempotent fulfilment, exclusion, and no double-booking.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

create function pg_temp.as_user(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
create function pg_temp.ans(o jsonb) returns jsonb language sql as $$
  select (select jsonb_object_agg(x ->> 'id', 'no') from jsonb_array_elements(
    (select definition from public.safety_rulesets where is_active) -> 'questions') x) || o
$$;
create function pg_temp.prepare(uid uuid) returns uuid language plpgsql as $$
declare
  order_id uuid;
begin
  perform pg_temp.as_user(uid);
  perform set_config('role', 'authenticated', true);
  select public.start_review_order() into order_id;
  perform public.submit_safety_screening(order_id, pg_temp.ans('{}'));
  insert into public.consents (consent_type, document_version, granted, source) values
    ('health_data_processing', 'draft-test', true, 'intake'),
    ('remote_consultation', 'draft-test', true, 'intake');
  perform public.save_questionnaire_draft(order_id, 4, '{"mainConcern":"Synthetic","consultationMethod":"telephone"}', '[{"name":"Synthetic medicine"}]');
  perform public.submit_questionnaire(order_id);
  return order_id;
end;
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('80000000-0000-4000-a000-000000000001', 'pay.emergency@example.test', 'authenticated', 'authenticated', '{}'),
  ('80000000-0000-4000-a000-000000000002', 'pay.one@example.test', 'authenticated', 'authenticated', '{}'),
  ('80000000-0000-4000-a000-000000000003', 'pay.two@example.test', 'authenticated', 'authenticated', '{}'),
  ('80000000-0000-4000-a000-0000000000a1', 'pay.pharm@example.test', 'authenticated', 'authenticated', '{}'),
  ('80000000-0000-4000-a000-0000000000b1', 'pay.ops@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set given_name = 'Test', family_name = 'Patient', date_of_birth = '1952-02-02'
  where id::text like '80000000-0000-4000-a000-00000000000%';
insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('80000000-0000-4000-a000-0000000000b1', 'ops_admin', 'verified', null, now(), '80000000-0000-4000-a000-0000000000a1'),
  ('80000000-0000-4000-a000-0000000000a1', 'pharmacist', 'verified', '0000008', now(), '80000000-0000-4000-a000-0000000000b1');
update public.app_settings set environment = 'development';

select pg_temp.as_user('80000000-0000-4000-a000-000000000001');
set local role authenticated;
select public.start_review_order();
select public.submit_safety_screening((select id from public.review_orders), pg_temp.ans('{"Q1":"yes"}'));
select throws_ok($$ select public.begin_checkout((select id from public.review_orders)) $$, '23514', null,
  'an emergency exclusion cannot start checkout');
reset role;

select ok(pg_temp.prepare('80000000-0000-4000-a000-000000000002') is not null, 'first patient is ready to pay');
select pg_temp.as_user('80000000-0000-4000-a000-000000000002');
set local role authenticated;
select is((public.begin_checkout((select id from public.review_orders where patient_id = '80000000-0000-4000-a000-000000000002')) ->> 'amount_pence')::int, 5900,
  'checkout charges the database price of £59');
select is(public.begin_checkout((select id from public.review_orders where patient_id = '80000000-0000-4000-a000-000000000002')) ->> 'provider', 'local_test_harness',
  'checkout is the labelled local harness, not live Stripe');
reset role;

select is((public.apply_provider_event('evt_local_one', 'checkout.session.completed',
  (select id from public.checkout_sessions), 5900, 'gbp', repeat('ab', 32)) ->> 'outcome'), 'fulfilled',
  'a matching event marks the review paid');
select is((public.apply_provider_event('evt_local_one', 'checkout.session.completed',
  (select id from public.checkout_sessions), 5900, 'gbp', repeat('ab', 32)) ->> 'outcome'), 'duplicate_event',
  'the same event is ignored');
select is((public.apply_provider_event('evt_local_two', 'checkout.session.completed',
  (select id from public.checkout_sessions), 100, 'gbp', repeat('cd', 32)) ->> 'outcome'), 'amount_mismatch',
  'a different amount is rejected');
select is((select count(*)::int from public.payments where status = 'succeeded'), 1, 'still one successful payment');

select pg_temp.as_user('80000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select lives_ok($$ select public.set_availability(now() + interval '3 days', now() + interval '3 days 1 hour') $$,
  'the pharmacist opens one hour');
reset role;
select pg_temp.as_user('80000000-0000-4000-a000-000000000002');
set local role authenticated;
select lives_ok($$ select public.book_appointment(
  (select id from public.review_orders where patient_id = '80000000-0000-4000-a000-000000000002'),
  '80000000-0000-4000-a000-0000000000a1',
  (select starts_at from public.bookable_slots(now(), now() + interval '30 days') order by starts_at limit 1)) $$,
  'the paid review books the first open time');
reset role;

select ok(pg_temp.prepare('80000000-0000-4000-a000-000000000003') is not null, 'second patient is ready to pay');
create temp table pay_ids as
  select id as order_id from public.review_orders where patient_id = '80000000-0000-4000-a000-000000000003';
select pg_temp.as_user('80000000-0000-4000-a000-0000000000b1', 'aal2');
set local role authenticated;
select lives_ok($$ select public.record_manual_payment((select order_id from pay_ids), 'BACS-TEST-1') $$,
  'an audited manual payment is recorded for an eligible review');
select is_empty($$ select 1 from public.questionnaire_submissions $$, 'operations admin cannot read questionnaires');
reset role;
create temp table taken as select starts_at from public.appointments where status = 'booked';
grant select on taken to authenticated;
select pg_temp.as_user('80000000-0000-4000-a000-000000000003');
set local role authenticated;
select throws_ok($$ select public.book_appointment((select order_id from pay_ids),
  '80000000-0000-4000-a000-0000000000a1', (select starts_at from taken)) $$,
  '23514', 'that time is not available', 'a second patient cannot book the same time');
reset role;
select throws_ok($$ insert into public.appointments (order_id, patient_id, pharmacist_id, slot, method, status)
  select (select id from public.review_orders where patient_id = '80000000-0000-4000-a000-000000000003'),
         '80000000-0000-4000-a000-000000000003', pharmacist_id, slot, 'telephone', 'booked'
  from public.appointments where status = 'booked' $$,
  '23P01', null, 'the exclusion constraint rejects the overlapping insert');

select pg_temp.as_user('80000000-0000-4000-a000-0000000000b1', 'aal2');
set local role authenticated;
select lives_ok($$ select public.record_refund((select id from public.payments where source = 'provider_event'), 5900, 'Synthetic refund') $$,
  'a refund is recorded and not sent to a card provider');
reset role;
select is((select provider_refund_id from public.refunds), null, 'no provider refund id is stored');
select is((select count(*)::int from public.appointment_events where event = 'booked'), 1, 'the booking is in the history');

select * from finish();
rollback;
