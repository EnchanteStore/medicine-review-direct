-- Phase 4: ops cannot assign or read clinical records, release needs a succeeded
-- payment, generation failure does not publish, and a declined review can
-- record a safety note but not a medication-review report.
begin;
create extension if not exists pgtap with schema extensions;

select plan(43);

create function pg_temp.as_user(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('61000000-0000-4000-a000-000000000001', 'phase4.patient@example.test', 'authenticated', 'authenticated', '{}'),
  ('61000000-0000-4000-a000-000000000002', 'phase4.other@example.test', 'authenticated', 'authenticated', '{}'),
  ('61000000-0000-4000-a000-0000000000a1', 'phase4.pharm@example.test', 'authenticated', 'authenticated', '{}'),
  ('61000000-0000-4000-a000-0000000000a2', 'phase4.pharm2@example.test', 'authenticated', 'authenticated', '{}'),
  ('61000000-0000-4000-a000-0000000000b1', 'phase4.admin@example.test', 'authenticated', 'authenticated', '{}'),
  ('61000000-0000-4000-a000-0000000000c1', 'phase4.ops@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set given_name = 'Phase', family_name = 'Patient', date_of_birth = '1950-01-02'
  where id = '61000000-0000-4000-a000-000000000001';
update public.profiles set given_name = 'Other', family_name = 'Patient', date_of_birth = '1951-02-03'
  where id = '61000000-0000-4000-a000-000000000002';
update public.profiles set given_name = 'Asha', family_name = 'Synthetic'
  where id = '61000000-0000-4000-a000-0000000000a1';
insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('61000000-0000-4000-a000-0000000000b1', 'clinical_admin', 'verified', null, now(), '61000000-0000-4000-a000-0000000000a1'),
  ('61000000-0000-4000-a000-0000000000c1', 'ops_admin', 'verified', null, now(), '61000000-0000-4000-a000-0000000000b1'),
  ('61000000-0000-4000-a000-0000000000a1', 'pharmacist', 'verified', '0000007', now(), '61000000-0000-4000-a000-0000000000b1'),
  ('61000000-0000-4000-a000-0000000000a2', 'pharmacist', 'verified', '0000008', now(), '61000000-0000-4000-a000-0000000000b1');

insert into public.review_orders (id, patient_id, status, assigned_pharmacist_id) values
  ('61000000-0000-4000-b000-000000000001', '61000000-0000-4000-a000-000000000001', 'in_review', '61000000-0000-4000-a000-0000000000a1'),
  ('61000000-0000-4000-b000-000000000002', '61000000-0000-4000-a000-000000000001', 'in_review', '61000000-0000-4000-a000-0000000000a1'),
  ('61000000-0000-4000-b000-000000000003', '61000000-0000-4000-a000-000000000001', 'declined', '61000000-0000-4000-a000-0000000000a1');
insert into public.safety_screenings (order_id, patient_id, ruleset_version, answers, outcome) values
  ('61000000-0000-4000-b000-000000000001', '61000000-0000-4000-a000-000000000001', '2026-11-draft.2',
    '{"Q1":"no","Q2":"no","Q3":"no","Q4":"no"}', 'routine'),
  ('61000000-0000-4000-b000-000000000002', '61000000-0000-4000-a000-000000000001', '2026-11-draft.2',
    '{"Q1":"no","Q2":"no","Q3":"no","Q4":"no"}', 'routine');
insert into public.questionnaire_submissions (order_id, patient_id, status, version_no, answers, medications, submitted_at) values
  ('61000000-0000-4000-b000-000000000001', '61000000-0000-4000-a000-000000000001', 'submitted', 1,
    '{"mainConcern":"Why am I on this medicine?"}', '[{"name":"Paracetamol"}]', now()),
  ('61000000-0000-4000-b000-000000000002', '61000000-0000-4000-a000-000000000001', 'submitted', 1,
    '{"mainConcern":"Why am I on this medicine?"}', '[{"name":"Paracetamol"}]', now());
insert into public.payments (order_id, patient_id, amount_pence, status, source, receipt_number)
  values ('61000000-0000-4000-b000-000000000001', '61000000-0000-4000-a000-000000000001',
          5900, 'succeeded', 'manual_audited', 'R-PHASE4-0001');

select lives_ok(
  $$ select app.assert_no_direct_medicine_change('DRAFT pending clinical approval. This review is for discussion with the prescriber. It is not an instruction to alter any medicine by yourself.') $$,
  'the standard disclaimer is allowed');
select throws_ok(
  $$ select app.assert_no_direct_medicine_change('Please stop taking this medicine') $$,
  '23514', null, 'a direct instruction to change a medicine is rejected');

select pg_temp.as_user('61000000-0000-4000-a000-0000000000c1', 'aal2');
set local role authenticated;
select throws_ok(
  $$ select public.assign_pharmacist('61000000-0000-4000-b000-000000000001', '61000000-0000-4000-a000-0000000000a1') $$,
  '42501', null, 'an operations administrator cannot assign a pharmacist');
select is((select count(*)::int from public.review_orders), 0, 'an operations administrator cannot read reviews');
select is((select count(*)::int from public.questionnaire_submissions), 0, 'an operations administrator cannot read questionnaires');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-0000000000b1', 'aal2');
set local role authenticated;
select lives_ok(
  $$ select public.assign_pharmacist('61000000-0000-4000-b000-000000000001', '61000000-0000-4000-a000-0000000000a1') $$,
  'a clinical administrator can assign a verified pharmacist');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select public.pharmacist_create_report('61000000-0000-4000-b000-000000000001');
select throws_like(
  $$ select public.pharmacist_save_report_content(
       (select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001'),
       '{"findings":"Please stop taking this medicine","medicationIssues":[{"medicine":"Paracetamol","issue":"Unsure why it was started."}],"recommendations":["Ask the GP."],"monitoring":["Review pain."],"gpDiscussionPoints":["Indication."],"safetyAdvice":"Call 999 in an emergency.","limitations":"DRAFT pending clinical approval."}'::jsonb) $$,
  '%start, stop or change%',
  'report wording cannot tell the patient to stop a medicine');
select lives_ok(
  $$ select public.pharmacist_save_report_content(
       (select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001'),
       '{"findings":"Discuss the indication with the GP.","medicationIssues":[{"medicine":"Paracetamol","issue":"The patient is unsure why it was started."}],"recommendations":["Ask the GP whether this medicine is still needed."],"monitoring":["Review pain at the next GP appointment."],"gpDiscussionPoints":["Indication for long-term use."],"safetyAdvice":"If you feel very unwell, contact your GP or NHS 111.","limitations":"DRAFT pending clinical approval. This review is for discussion with the prescriber."}'::jsonb) $$,
  'the assigned pharmacist can save a draft that discusses the medicine with the GP');
select public.pharmacist_record_consultation('61000000-0000-4000-b000-000000000001', 'telephone', now(), true,
  'Synthetic: two-way conversation about the pain medicine.');
select public.pharmacist_confirm_report_checks((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001'), true, true);
select public.pharmacist_approve_report(
  (select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001'),
  (select id from public.consultations where order_id = '61000000-0000-4000-b000-000000000001' and two_way_completed));
select lives_ok(
  $$ select public.pharmacist_set_generation_status((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001'), 'generating', null) $$,
  'the pharmacist can start PDF generation');
select lives_ok(
  $$ select public.pharmacist_set_generation_status((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001'), 'generation_failed', null) $$,
  'generation failure is recorded');
reset role;
select is(
  (select status::text from public.reports where order_id = '61000000-0000-4000-b000-000000000001'),
  'generation_failed', 'a failed generation stays failed until someone retries');

select pg_temp.as_user('61000000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.reports), 0, 'a generation failure does not publish the report');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select lives_ok(
  $$ select public.pharmacist_set_generation_status((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001'), 'generating', null) $$,
  'generation can be retried after a failure');
select lives_ok(
  $$ select public.pharmacist_set_generation_status((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001'), 'ready_for_release', 'reports/synthetic.pdf') $$,
  'a successful file can be marked ready for release');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.reports), 0, 'ready for release is still hidden from the patient');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select public.pharmacist_create_report('61000000-0000-4000-b000-000000000002');
select public.pharmacist_save_report_content(
  (select id from public.reports where order_id = '61000000-0000-4000-b000-000000000002'),
  '{"findings":"Discuss the indication with the GP.","medicationIssues":[{"medicine":"Paracetamol","issue":"The patient is unsure why it was started."}],"recommendations":["Ask the GP whether this medicine is still needed."],"monitoring":["Review pain at the next GP appointment."],"gpDiscussionPoints":["Indication for long-term use."],"safetyAdvice":"If you feel very unwell, contact your GP or NHS 111.","limitations":"DRAFT pending clinical approval. This review is for discussion with the prescriber."}'::jsonb);
select public.pharmacist_record_consultation('61000000-0000-4000-b000-000000000002', 'secure_video', now(), true,
  'Synthetic: two-way video consultation.');
select public.pharmacist_confirm_report_checks((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000002'), true, true);
select public.pharmacist_approve_report(
  (select id from public.reports where order_id = '61000000-0000-4000-b000-000000000002'),
  (select id from public.consultations where order_id = '61000000-0000-4000-b000-000000000002' and two_way_completed));
select public.pharmacist_set_generation_status((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000002'), 'generating', null);
select public.pharmacist_set_generation_status((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000002'), 'ready_for_release', 'reports/unpaid.pdf');
select throws_like(
  $$ select public.pharmacist_release_report((select id from public.reports where order_id = '61000000-0000-4000-b000-000000000002')) $$,
  '%order_not_paid%', 'an unpaid review cannot be released');
select throws_like(
  $$ select public.pharmacist_create_report('61000000-0000-4000-b000-000000000003') $$,
  '%cannot produce a review report%', 'a declined review cannot produce a medication-review report');
select lives_ok(
  $$ select public.record_safety_notice('61000000-0000-4000-b000-000000000003', 'referral', 'Synthetic: please ask your GP to review this. This is not a medication review report.') $$,
  'a declined review can record a referral note');
select throws_like(
  $$ select public.record_safety_notice('61000000-0000-4000-b000-000000000001', 'safety_notification', 'Synthetic note that should not replace the report.') $$,
  '%only for a declined%', 'an open review cannot be closed with a safety note');
reset role;
select is(
  (select count(*)::int from public.reports where order_id = '61000000-0000-4000-b000-000000000003'),
  0, 'the referral is not stored as a report');

select pg_temp.as_user('61000000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.safety_notices), 1, 'the patient can read their safety note');
select lives_ok(
  $$ select public.send_review_message('61000000-0000-4000-b000-000000000001', 'Synthetic marker phrase from the patient') $$,
  'the patient can send a message on the review');
select throws_ok(
  $$ update public.messages set body = 'changed' where order_id = '61000000-0000-4000-b000-000000000001' $$,
  '42501', null, 'the patient cannot edit a message');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.safety_notices), 0, 'another patient cannot read the safety note');
select is((select count(*)::int from public.reports), 0, 'another patient cannot read the report');
select is((select count(*)::int from public.messages), 0, 'another patient cannot read the messages');
reset role;

set local role service_role;
select throws_like(
  $$ update public.messages set body = 'changed by automation' where order_id = '61000000-0000-4000-b000-000000000001' $$,
  '%append-only%', 'automation cannot rewrite a message');
reset role;
create temp table phase4_report as
  select id from public.reports where order_id = '61000000-0000-4000-b000-000000000001';
grant select on phase4_report to authenticated;
select pg_temp.as_user('61000000-0000-4000-a000-0000000000a2', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.reports), 0, 'an unassigned pharmacist cannot read the report');
select throws_ok(
  $$ select public.pharmacist_release_report((select id from phase4_report)) $$,
  '42501', null, 'an unassigned pharmacist cannot release a report even with its id');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select lives_ok(
  $$ select public.save_gp_letter('61000000-0000-4000-b000-000000000001', 'Why the pain medicine was started.', 'The indication should be discussed.', 'Ask whether it is still needed.') $$,
  'the pharmacist can draft a GP letter');
select throws_like(
  $$ select public.approve_gp_letter((select id from public.gp_letters where order_id = '61000000-0000-4000-b000-000000000001')) $$,
  '%checked before the letter is approved%', 'a GP letter cannot be approved before the practice is recorded');
select lives_ok(
  $$ select public.verify_gp_recipient((select id from public.gp_letters where order_id = '61000000-0000-4000-b000-000000000001'), 'Dr Synthetic', 'Example Practice', 'Checked the practice name with the patient during the consultation.') $$,
  'the pharmacist records the practice they checked');
select throws_like(
  $$ select public.approve_gp_letter((select id from public.gp_letters where order_id = '61000000-0000-4000-b000-000000000001')) $$,
  '%case-specific consent%', 'a GP letter cannot be approved without this patient''s consent');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.gp_letters), 0, 'the patient cannot see a draft GP letter');
select public.record_gp_letter_consent('61000000-0000-4000-b000-000000000001', true);
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select lives_ok(
  $$ select public.approve_gp_letter((select id from public.gp_letters where order_id = '61000000-0000-4000-b000-000000000001')) $$,
  'the pharmacist can approve the letter after consent and a checked practice');
select lives_ok(
  $$ select public.record_gp_letter_dispatch((select id from public.gp_letters where order_id = '61000000-0000-4000-b000-000000000001')) $$,
  'dispatch is recorded by the pharmacist');
select public.send_review_message('61000000-0000-4000-b000-000000000001', 'Synthetic reply from the pharmacist');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select status from public.gp_letters where order_id = '61000000-0000-4000-b000-000000000001'), 'dispatched',
  'the patient can see the letter once it is dispatched');
select ok(
  (select dispatch_evidence like '%Not transmitted%' from public.gp_letters where order_id = '61000000-0000-4000-b000-000000000001'),
  'dispatch evidence says the letter was not sent');
select public.mark_review_messages_read('61000000-0000-4000-b000-000000000001');
select ok(
  (select read_at is not null from public.messages where order_id = '61000000-0000-4000-b000-000000000001' and sender_id = '61000000-0000-4000-a000-0000000000a1'),
  'opening the thread marks the pharmacist message read');
reset role;

select pg_temp.as_user('61000000-0000-4000-a000-0000000000c1', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.messages), 0, 'an operations administrator cannot read messages');
select is((select count(*)::int from public.gp_letters), 0, 'an operations administrator cannot read GP letters');
select is((select count(*)::int from public.safety_notices), 0, 'an operations administrator cannot read safety notes');
select is((select count(*)::int from public.reports), 0, 'an operations administrator cannot read reports');
reset role;

select * from finish();
rollback;
