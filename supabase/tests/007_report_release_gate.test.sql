-- Section 8 report-release gate, enforced in the database for every role.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

create function pg_temp.as_user(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('60000000-0000-4000-a000-000000000001', 'gate.patient@example.test', 'authenticated', 'authenticated', '{}'),
  ('60000000-0000-4000-a000-0000000000a1', 'gate.pharm@example.test', 'authenticated', 'authenticated', '{}'),
  ('60000000-0000-4000-a000-0000000000a2', 'gate.pharm2@example.test', 'authenticated', 'authenticated', '{}'),
  ('60000000-0000-4000-a000-0000000000b1', 'gate.admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set given_name = 'Gate', family_name = 'Patient', date_of_birth = '1948-03-03'
  where id = '60000000-0000-4000-a000-000000000001';
update public.profiles set given_name = 'Asha', family_name = 'Pharmacist' where id = '60000000-0000-4000-a000-0000000000a1';
insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('60000000-0000-4000-a000-0000000000b1', 'clinical_admin', 'verified', null, now(), '60000000-0000-4000-a000-0000000000a1'),
  ('60000000-0000-4000-a000-0000000000a1', 'pharmacist', 'verified', '0000004', now(), '60000000-0000-4000-a000-0000000000b1'),
  ('60000000-0000-4000-a000-0000000000a2', 'pharmacist', 'verified', '0000006', now(), '60000000-0000-4000-a000-0000000000b1');

-- Orders created by the owner in later states (payments are Phase 3).
insert into public.review_orders (id, patient_id, status, assigned_pharmacist_id) values
  ('60000000-0000-4000-b000-000000000001', '60000000-0000-4000-a000-000000000001', 'in_review', '60000000-0000-4000-a000-0000000000a1'),
  ('60000000-0000-4000-b000-000000000002', '60000000-0000-4000-a000-000000000001', 'in_review', '60000000-0000-4000-a000-0000000000a1'),
  ('60000000-0000-4000-b000-000000000003', '60000000-0000-4000-a000-000000000001', 'safety_emergency_excluded', '60000000-0000-4000-a000-0000000000a1'),
  ('60000000-0000-4000-b000-000000000004', '60000000-0000-4000-a000-000000000001', 'declined', '60000000-0000-4000-a000-0000000000a1');
insert into public.safety_screenings (order_id, patient_id, ruleset_version, answers, outcome) values
  ('60000000-0000-4000-b000-000000000001', '60000000-0000-4000-a000-000000000001', '2026-11-draft.1', '{}', 'routine'),
  ('60000000-0000-4000-b000-000000000002', '60000000-0000-4000-a000-000000000001', '2026-11-draft.1', '{}', 'routine');
insert into public.questionnaire_submissions (order_id, patient_id, status, version_no, answers, medications, submitted_at)
  values ('60000000-0000-4000-b000-000000000001', '60000000-0000-4000-a000-000000000001', 'submitted', 1,
          '{"mainConcern":"synthetic"}', '[{"name":"Synthetic medicine"}]', now());

-- Assigned pharmacist, MFA session
select pg_temp.as_user('60000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select lives_ok($$ select public.pharmacist_create_report('60000000-0000-4000-b000-000000000001') $$, 'assigned pharmacist creates a draft report');
select throws_like(
  $$ select public.pharmacist_approve_report((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000001'), null) $$,
  '%no_consultation_recorded%', 'approval blocked without a recorded consultation');
select lives_ok(
  $$ select public.pharmacist_record_consultation('60000000-0000-4000-b000-000000000001', 'telephone', now() - interval '1 hour', false,
       'Synthetic: call dropped after introductions') $$, 'an incomplete consultation can be recorded');
select throws_like(
  $$ select public.pharmacist_approve_report((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000001'),
       (select id from public.consultations where two_way_completed = false)) $$,
  '%consultation_not_two_way_completed%', 'approval blocked when the consultation was not a completed two-way conversation');
select throws_like(
  $$ select public.pharmacist_record_consultation('60000000-0000-4000-b000-000000000001', 'secure_video', now(), true, '   ') $$,
  '%clinical_notes%', 'a consultation requires documented clinical notes');
select lives_ok(
  $$ select public.pharmacist_record_consultation('60000000-0000-4000-b000-000000000001', 'secure_video', now(), true,
       'Synthetic: reviewed all medicines; discussed adherence; GP follow-up points agreed') $$,
  'completed two-way video consultation with notes is recorded');
select throws_like(
  $$ select public.pharmacist_approve_report((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000001'),
       (select id from public.consultations where two_way_completed)) $$,
  '%clinical_information_not_confirmed_sufficient%clinical_adequacy_not_confirmed%',
  'approval blocked until the pharmacist confirms sufficient information and clinical adequacy');
select lives_ok(
  $$ select public.pharmacist_confirm_report_checks((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000001'), true, true) $$,
  'pharmacist confirms information is sufficient and assessment is clinically adequate');
select lives_ok(
  $$ select public.pharmacist_approve_report((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000001'),
       (select id from public.consultations where two_way_completed)) $$, 'approval succeeds once every condition is met');
select is(
  (select approver_display_name || ' / ' || approver_gphc_number from public.reports where order_id = '60000000-0000-4000-b000-000000000001'),
  'Asha Pharmacist / 0000004', 'approval records the pharmacist''s name and GPhC number');
select throws_ok(
  $$ select public.pharmacist_release_report((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000001')) $$,
  '23514', null, 'an approved report cannot skip generation and the ready-for-release step');
reset role;

-- Automation (service role) may run PDF generation steps after approval, but never release
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok(
  $$ update public.reports set status = 'generating' where order_id = '60000000-0000-4000-b000-000000000001' $$,
  'automation can start generation after clinical approval');
select lives_ok(
  $$ update public.reports set status = 'ready_for_release' where order_id = '60000000-0000-4000-b000-000000000001' $$,
  'automation can mark the report ready for release');
select throws_ok(
  $$ update public.reports set status = 'released', released_by = '60000000-0000-4000-a000-0000000000a1'
       where order_id = '60000000-0000-4000-b000-000000000001' $$,
  '42501', null, 'automation cannot release a report, even naming the pharmacist');
reset role;

select pg_temp.as_user('60000000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.reports), 0, 'patient cannot see an unreleased report');
reset role;

select pg_temp.as_user('60000000-0000-4000-a000-0000000000a2', 'aal2');
set local role authenticated;
select throws_ok($$ select public.pharmacist_release_report((select r.id from public.reports r where false)) $$, 'P0002', null,
  'an unassigned pharmacist cannot even see the report to release it');
reset role;

select pg_temp.as_user('60000000-0000-4000-a000-0000000000b1', 'aal2');
set local role authenticated;
select throws_ok(
  $$ select public.pharmacist_release_report((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000001')) $$,
  '42501', null, 'a clinical administrator cannot release a report');
reset role;

select pg_temp.as_user('60000000-0000-4000-a000-0000000000a1', 'aal1');
set local role authenticated;
select throws_ok(
  $$ select public.pharmacist_release_report((select r.id from public.reports r where false)) $$,
  'P0002', null, 'the assigned pharmacist without an MFA session has no access');
select pg_temp.as_user('60000000-0000-4000-a000-0000000000a1', 'aal2');
select lives_ok(
  $$ select public.pharmacist_release_report((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000001')) $$,
  'the assigned pharmacist explicitly releases the report');
reset role;

select is((select status::text from public.review_orders where id = '60000000-0000-4000-b000-000000000001'), 'report_released',
  'release moves the order to report_released');
select is(
  (select metadata ->> 'gphc_number' from public.audit_log where action = 'report.released'
     and metadata ->> 'order_id' = '60000000-0000-4000-b000-000000000001'),
  '0000004', 'release is recorded in the immutable audit log with professional identification');

select pg_temp.as_user('60000000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.reports), 1, 'patient can see the report once released');
reset role;

select throws_ok($$ update public.reports set content = '{"edited":true}' where order_id = '60000000-0000-4000-b000-000000000001' $$,
  '42501', null, 'released reports are immutable, even for the owner');

-- Missing questionnaire blocks approval even after a consultation
select pg_temp.as_user('60000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select public.pharmacist_create_report('60000000-0000-4000-b000-000000000002');
select public.pharmacist_confirm_report_checks((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000002'), true, true);
select throws_like(
  $$ select public.pharmacist_approve_report((select id from public.reports where order_id = '60000000-0000-4000-b000-000000000002'),
       public.pharmacist_record_consultation('60000000-0000-4000-b000-000000000002', 'telephone', now(), true, 'Synthetic notes')) $$,
  '%no_submitted_questionnaire%', 'a booked, paid review without a submitted questionnaire cannot be approved');

-- Excluded or declined services never produce a review report
select throws_like($$ select public.pharmacist_create_report('60000000-0000-4000-b000-000000000003') $$,
  '%cannot produce a review report%', 'an emergency-excluded order cannot produce a review report');
select throws_like($$ select public.pharmacist_create_report('60000000-0000-4000-b000-000000000004') $$,
  '%cannot produce a review report%', 'a declined service cannot produce a review report');
reset role;

select * from finish();
rollback;
