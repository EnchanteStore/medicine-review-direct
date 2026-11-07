-- P-01 restart after exclusion, P-04 medicine list changes, P-10/P-11 recovery.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

create function pg_temp.as_user(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
create function pg_temp.ans(o jsonb) returns jsonb language sql as $$
  select (select jsonb_object_agg(x ->> 'id', 'no') from jsonb_array_elements(
    (select definition from public.safety_rulesets where is_active) -> 'questions') x) || o
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('70000000-0000-4000-a000-000000000001', 'p01.patient@example.test', 'authenticated', 'authenticated', '{}'),
  ('70000000-0000-4000-a000-0000000000a1', 'p01.pharm@example.test', 'authenticated', 'authenticated', '{}'),
  ('70000000-0000-4000-a000-0000000000b1', 'p01.admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set given_name = 'Test', family_name = 'Patient', date_of_birth = '1951-01-01'
  where id = '70000000-0000-4000-a000-000000000001';
update public.profiles set given_name = 'Asha', family_name = 'Pharmacist' where id = '70000000-0000-4000-a000-0000000000a1';
insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('70000000-0000-4000-a000-0000000000b1', 'clinical_admin', 'verified', null, now(), '70000000-0000-4000-a000-0000000000a1'),
  ('70000000-0000-4000-a000-0000000000a1', 'pharmacist', 'verified', '0000007', now(), '70000000-0000-4000-a000-0000000000b1');
update public.app_settings set environment = 'development';

select pg_temp.as_user('70000000-0000-4000-a000-000000000001');
set local role authenticated;
select public.start_review_order();
select is(
  (select public.submit_safety_screening((select id from public.review_orders), pg_temp.ans('{"Q1":"unsure"}')) ->> 'exclusion_label'),
  'EMERGENCY_EXCLUDED', 'question 1 not sure is an emergency exclusion, not a no');
select is((select status::text from public.review_orders), 'safety_emergency_excluded', 'the excluded request is closed');

select isnt(public.start_review_order(), (select id from public.review_orders where status = 'safety_emergency_excluded'),
  'the patient can start a new request; the old one is not reopened');
select ok((select requires_prior_exclusion_review from public.review_orders where status = 'draft'),
  'the new request cannot forget the earlier exclusion');
select throws_ok(
  $$ select public.submit_safety_screening((select id from public.review_orders where status = 'draft'), pg_temp.ans('{}')) $$,
  '23514', 'confirm that the earlier concern has been assessed or is no longer present',
  'repeating the questionnaire does not bypass the earlier exclusion');
select lives_ok($$ select public.confirm_prior_safety_concern((select id from public.review_orders where status = 'draft')) $$,
  'the patient can confirm the earlier concern was assessed or has passed');
select is(
  (select public.submit_safety_screening((select id from public.review_orders where status = 'draft'), pg_temp.ans('{}')) ->> 'outcome'),
  'routine', 'a fresh all-no screen can continue');
reset role;

update public.review_orders set assigned_pharmacist_id = '70000000-0000-4000-a000-0000000000a1'
  where patient_id = '70000000-0000-4000-a000-000000000001' and status = 'intake';
insert into public.questionnaire_submissions (order_id, patient_id, status, version_no, answers, medications, submitted_at)
select id, patient_id, 'submitted', 1, '{"mainConcern":"synthetic"}', '[{"name":"Synthetic medicine"}]', now()
from public.review_orders where patient_id = '70000000-0000-4000-a000-000000000001' and status = 'intake';
update public.review_orders set status = 'questionnaire_submitted'
  where patient_id = '70000000-0000-4000-a000-000000000001' and status = 'intake';
insert into public.launch_signoffs (gate, decision, signed_off_by, evidence_reference)
  select g, 'approved', '70000000-0000-4000-a000-0000000000b1', 'synthetic'
  from unnest(enum_range(null::public.launch_gate)) g;
update public.safety_rulesets set status = 'approved', approved_by = '70000000-0000-4000-a000-0000000000a1', approved_at = now()
  where version = '2026-11-draft.2';
update public.review_orders set status = 'awaiting_payment'
  where patient_id = '70000000-0000-4000-a000-000000000001' and status = 'questionnaire_submitted';
update public.review_orders set status = 'paid'
  where patient_id = '70000000-0000-4000-a000-000000000001' and status = 'awaiting_payment';
select throws_ok(
  $$ update public.review_orders set status = 'consultation_booked'
       where patient_id = '70000000-0000-4000-a000-000000000001' and status = 'paid' $$,
  '23514', 'order: a pharmacist must review the earlier safety exclusion before booking',
  'a green rescreen does not authorise booking after an earlier exclusion');

select pg_temp.as_user('70000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.patient_safety_history('70000000-0000-4000-a000-000000000001')), 1,
  'a clinician can still see the earlier positive trigger');
select lives_ok(
  $$ select public.record_suitability_assessment(
       (select id from public.review_orders where patient_id = '70000000-0000-4000-a000-000000000001' and status = 'paid'),
       'prior_exclusion_review', 'suitable', 'Synthetic: earlier concern assessed by NHS 111 and resolved') $$,
  'the pharmacist documents suitability after reading the earlier exclusion');
select lives_ok($$ select public.add_high_risk_term('apixaban extra', 'anticoagulant') $$, 'a clinician can add a draft medicine term without a code change');
reset role;
select lives_ok(
  $$ update public.review_orders set status = 'consultation_booked'
       where patient_id = '70000000-0000-4000-a000-000000000001' and status = 'paid' $$,
  'booking is allowed after the documented review');
select is((select status from public.high_risk_medicine_terms where term = 'apixaban extra'), 'draft',
  'a newly added term stays draft until clinical approval');
select ok(exists (select 1 from public.high_risk_medicine_changes where term = 'apixaban extra' and change = 'added'),
  'medicine list changes are recorded');

select pg_temp.as_user('70000000-0000-4000-a000-0000000000b1', 'aal2');
set local role authenticated;
select throws_ok($$ select public.recover_staff_mfa('70000000-0000-4000-a000-0000000000b1', 'in_person') $$,
  '23514', null, 'an administrator cannot recover their own authenticator');
select throws_ok($$ select public.recover_staff_mfa('70000000-0000-4000-a000-0000000000a1', 'email') $$,
  '22023', null, 'email alone cannot reset an authenticator');
select lives_ok($$ select public.recover_staff_mfa('70000000-0000-4000-a000-0000000000a1', 'in_person') $$,
  'another administrator can revoke factors after an in-person check');
select is((select count(*)::int from public.launch_readiness()), 10, 'the launch checklist lists every gate');
reset role;
select pg_temp.as_user('70000000-0000-4000-a000-0000000000b1', 'aal1');
set local role authenticated;
select is((select count(*)::int from public.launch_readiness()), 0, 'without MFA the launch checklist is empty');

select * from finish();
rollback;
