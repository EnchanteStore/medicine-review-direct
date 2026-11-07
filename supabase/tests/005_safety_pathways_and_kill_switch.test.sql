-- Safety pathways (emergency, urgent, routine), database-enforced blocking of
-- payment and booking, urgent reassessment, and the live-service kill switch.
begin;
create extension if not exists pgtap with schema extensions;

select plan(40);

create function pg_temp.as_user(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
create function pg_temp.ans(o jsonb) returns jsonb language sql as $$
  select (select jsonb_object_agg(x ->> 'id', 'no') from jsonb_array_elements(
    (select definition from public.safety_rulesets where is_active) -> 'questions') x) || o
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('40000000-0000-4000-a000-000000000001', 'scr.emergency@example.test', 'authenticated', 'authenticated', '{}'),
  ('40000000-0000-4000-a000-000000000002', 'scr.urgent@example.test', 'authenticated', 'authenticated', '{}'),
  ('40000000-0000-4000-a000-000000000003', 'scr.routine@example.test', 'authenticated', 'authenticated', '{}'),
  ('40000000-0000-4000-a000-000000000004', 'scr.noprofile@example.test', 'authenticated', 'authenticated', '{}'),
  ('40000000-0000-4000-a000-0000000000a1', 'scr.pharm@example.test', 'authenticated', 'authenticated', '{}'),
  ('40000000-0000-4000-a000-0000000000b1', 'scr.admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set given_name = 'Test', family_name = 'Patient', date_of_birth = '1955-05-05'
  where id in ('40000000-0000-4000-a000-000000000001', '40000000-0000-4000-a000-000000000002', '40000000-0000-4000-a000-000000000003');
insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('40000000-0000-4000-a000-0000000000b1', 'clinical_admin', 'verified', null, now(), '40000000-0000-4000-a000-0000000000a1'),
  ('40000000-0000-4000-a000-0000000000a1', 'pharmacist', 'verified', '0000003', now(), '40000000-0000-4000-a000-0000000000b1');
update public.app_settings set environment = 'development';

-- Kill switch: production with no sign-offs keeps intake closed
update public.app_settings set environment = 'production';
select pg_temp.as_user('40000000-0000-4000-a000-000000000001');
set local role authenticated;
select throws_ok($$ select public.start_review_order() $$, '23514', 'intake is closed until the live service is approved',
  'production without launch sign-offs: public intake is closed');
reset role;
update public.app_settings set environment = 'development';

select ok(not app.payments_open(), 'development mode never opens payments without sign-offs');
select is((public.service_status() ->> 'outstanding_gate_count')::int, 10, 'all 10 launch gates are outstanding');

-- Profile completion required
select pg_temp.as_user('40000000-0000-4000-a000-000000000004');
set local role authenticated;
select throws_ok($$ select public.start_review_order() $$, '23514', null, 'a review cannot start until the profile is complete');

-- EMERGENCY pathway
select pg_temp.as_user('40000000-0000-4000-a000-000000000001');
select lives_ok($$ select public.start_review_order() $$, 'patient can start a review in development mode');
select is((select status::text from public.review_orders), 'draft', 'new order is a draft');
select is(
  (select public.submit_safety_screening((select id from public.review_orders), pg_temp.ans('{"E1":"yes"}')) ->> 'outcome'),
  'emergency', 'chest pain answer gives the emergency outcome (computed by the database)');
select is((select status::text from public.review_orders), 'safety_emergency_excluded', 'emergency excludes the order');
select throws_ok(
  $$ select public.submit_safety_screening((select id from public.review_orders), pg_temp.ans('{}')) $$,
  '23514', 'this review has already been screened', 'an excluded order cannot be re-screened to a better outcome');
select throws_ok(
  $$ insert into public.safety_screenings (order_id, patient_id, ruleset_version, answers, outcome)
     select id, patient_id, '2026-11-draft.1', '{}', 'routine' from public.review_orders $$,
  '42501', null, 'patients cannot write a screening outcome directly');
select throws_ok($$ update public.review_orders set status = 'intake' $$, '42501', null,
  'patients cannot change order status directly');
select lives_ok($$ select public.acknowledge_safety_advice((select id from public.safety_screenings)) $$,
  'patient can acknowledge the emergency advice');
reset role;

select isnt((select acknowledged_at from public.safety_screenings where patient_id = '40000000-0000-4000-a000-000000000001'), null,
  'acknowledgement is recorded');
select throws_ok(
  $$ update public.review_orders set status = 'intake' where patient_id = '40000000-0000-4000-a000-000000000001' $$,
  '23514', null, 'even the database owner cannot move an emergency-excluded order back into intake');
select is(
  (select array(select jsonb_object_keys(metadata) order by 1) from public.audit_log
    where action = 'safety.screening_recorded'
      and metadata ->> 'order_id' = (select id::text from public.review_orders where patient_id = '40000000-0000-4000-a000-000000000001')),
  array['order_id', 'outcome', 'ruleset_version'],
  'screening audit event is minimal: no answers recorded in the audit log');
select throws_ok(
  $$ update public.safety_screenings set outcome = 'routine' where patient_id = '40000000-0000-4000-a000-000000000001' $$,
  '42501', null, 'screening records are immutable, even for the owner');

-- URGENT pathway
select pg_temp.as_user('40000000-0000-4000-a000-000000000002');
set local role authenticated;
select lives_ok($$ select public.start_review_order() $$, 'urgent patient starts a review');
select is(
  (select public.submit_safety_screening((select id from public.review_orders), pg_temp.ans('{"U1":"yes"}')) ->> 'outcome'),
  'urgent', 'serious side effect answer gives the urgent outcome');
select is((select status::text from public.review_orders), 'safety_urgent_hold', 'urgent outcome places the order on hold');
select is(public.start_review_order(), (select id from public.review_orders),
  'starting again returns the held order rather than a fresh, unscreened one');
reset role;
select throws_ok(
  $$ update public.review_orders set status = 'intake' where patient_id = '40000000-0000-4000-a000-000000000002' $$,
  '23514', null, 'an urgent hold cannot return to intake without pharmacist reassessment');

-- ROUTINE pathway: high-risk medicine alone does not block
select pg_temp.as_user('40000000-0000-4000-a000-000000000003');
set local role authenticated;
select lives_ok($$ select public.start_review_order() $$, 'routine patient starts a review');
select is(
  (select public.submit_safety_screening((select id from public.review_orders), pg_temp.ans('{"R1":"yes"}')) -> 'flags'),
  '["high_risk_medicine"]'::jsonb, 'high-risk medicine is flagged for the pharmacist');
select is((select status::text from public.review_orders), 'intake', 'routine outcome continues to intake');
select ok((select suitability_review_required from public.review_orders), 'flagged routine order needs an individual suitability review');
insert into public.consents (consent_type, document_version, granted, source) values
  ('health_data_processing', 'draft-test', true, 'intake'), ('remote_consultation', 'draft-test', true, 'intake');
select lives_ok(
  $$ select public.save_questionnaire_draft((select id from public.review_orders), 4,
       '{"mainConcern":"Synthetic concern"}', '[{"name":"Synthetic medicine A"}]') $$, 'routine patient saves questionnaire');
select is(public.submit_questionnaire((select id from public.review_orders)), 1, 'routine patient submits questionnaire v1');
reset role;

select throws_ok(
  $$ update public.review_orders set status = 'awaiting_payment' where patient_id = '40000000-0000-4000-a000-000000000003' $$,
  '23514', 'order: payments and booking are disabled until the live service is approved',
  'kill switch: payment cannot start before launch sign-off, even for a routine order');

-- Record every launch sign-off and approve the rule set (synthetic, inside this transaction only)
insert into public.launch_signoffs (gate, decision, signed_off_by, evidence_reference)
  select g, 'approved', '40000000-0000-4000-a000-0000000000b1', 'synthetic test evidence'
  from unnest(enum_range(null::public.launch_gate)) g;
select ok(not app.live_service_enabled(), 'sign-offs alone do not enable the live service while the rule set is DRAFT');
update public.safety_rulesets set status = 'approved', approved_by = '40000000-0000-4000-a000-0000000000a1', approved_at = now()
  where is_active;
select ok(app.live_service_enabled(), 'all sign-offs plus an approved rule set enable the live service');

select lives_ok(
  $$ update public.review_orders set status = 'awaiting_payment' where patient_id = '40000000-0000-4000-a000-000000000003' $$,
  'routine order can proceed to payment once live');
select throws_ok(
  $$ update public.review_orders set status = 'awaiting_payment' where patient_id = '40000000-0000-4000-a000-000000000001' $$,
  '23514', null, 'emergency-excluded order still cannot reach payment when the service is live');

-- A patient on urgent hold cannot pay for another order either
insert into public.review_orders (id, patient_id, status) values
  ('40000000-0000-4000-b000-000000000002', '40000000-0000-4000-a000-000000000002', 'questionnaire_submitted');
insert into public.safety_screenings (order_id, patient_id, ruleset_version, answers, outcome)
  values ('40000000-0000-4000-b000-000000000002', '40000000-0000-4000-a000-000000000002', '2026-11-draft.1', '{}', 'routine');
select throws_ok(
  $$ update public.review_orders set status = 'awaiting_payment' where id = '40000000-0000-4000-b000-000000000002' $$,
  '23514', 'order: patient has an urgent safety hold awaiting pharmacist reassessment',
  'routine booking is stopped for a patient with an unresolved urgent hold');

-- Reassessment requires a verified pharmacist with MFA
update public.review_orders set assigned_pharmacist_id = '40000000-0000-4000-a000-0000000000a1'
  where patient_id = '40000000-0000-4000-a000-000000000002';
select pg_temp.as_user('40000000-0000-4000-a000-0000000000a1', 'aal1');
set local role authenticated;
select throws_ok(
  $$ select public.record_suitability_assessment('40000000-0000-4000-b000-000000000002', 'urgent_reassessment', 'suitable', 'x') $$,
  '42501', null, 'reassessment without an MFA session is refused');
select pg_temp.as_user('40000000-0000-4000-a000-0000000000a1', 'aal2');
select lives_ok(
  $$ select public.record_suitability_assessment(
       (select id from public.review_orders where patient_id = '40000000-0000-4000-a000-000000000002' and status = 'safety_urgent_hold'),
       'urgent_reassessment', 'suitable', 'Synthetic: concern resolved by GP; suitable for routine review') $$,
  'verified pharmacist with MFA records a documented reassessment');
reset role;
select is((select count(*)::int from public.review_orders where patient_id = '40000000-0000-4000-a000-000000000002' and status = 'intake'), 1,
  'suitable reassessment returns the held order to intake');
select lives_ok(
  $$ update public.review_orders set status = 'awaiting_payment' where id = '40000000-0000-4000-b000-000000000002' $$,
  'after reassessment the patient may proceed to routine booking');

-- Complex patients need an individual suitability review before booking
update public.review_orders set status = 'paid' where patient_id = '40000000-0000-4000-a000-000000000003';
select throws_ok(
  $$ update public.review_orders set status = 'consultation_booked' where patient_id = '40000000-0000-4000-a000-000000000003' $$,
  '23514', 'order: individual pharmacist suitability assessment required before booking',
  'flagged patient cannot be booked before an individual suitability assessment');

-- Revoking any sign-off closes payments again
insert into public.launch_signoffs (gate, decision, signed_off_by, evidence_reference)
  values ('professional_indemnity', 'revoked', '40000000-0000-4000-a000-0000000000b1', 'synthetic: cover lapsed');
select ok(not app.payments_open(), 'revoking one sign-off disables payments immediately');

select throws_ok($$ update public.safety_rulesets set definition = '{"questions":[]}' where is_active $$, '42501', null,
  'rule set definitions are immutable; changes need a new version');

select * from finish();
rollback;
