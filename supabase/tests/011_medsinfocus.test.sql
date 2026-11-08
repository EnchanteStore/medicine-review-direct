-- MedsInFocus: prescribing stays off, handover is audited, approval identity
-- follows the signed-in pharmacist, corrections supersede, and scans fail closed.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

create function pg_temp.as_user(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('71000000-0000-4000-a000-000000000001', 'mif.patient@example.test', 'authenticated', 'authenticated', '{}'),
  ('71000000-0000-4000-a000-0000000000a1', 'mif.pharm1@example.test', 'authenticated', 'authenticated', '{}'),
  ('71000000-0000-4000-a000-0000000000a2', 'mif.pharm2@example.test', 'authenticated', 'authenticated', '{}'),
  ('71000000-0000-4000-a000-0000000000b1', 'mif.admin@example.test', 'authenticated', 'authenticated', '{}'),
  ('71000000-0000-4000-a000-0000000000c1', 'mif.ops@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set given_name = 'Morgan', family_name = 'Patient', date_of_birth = '1952-03-04'
  where id = '71000000-0000-4000-a000-000000000001';
update public.profiles set given_name = 'Cheuk Kin', family_name = 'Sung'
  where id = '71000000-0000-4000-a000-0000000000a1';
update public.profiles set given_name = 'Ka Po', family_name = 'Ng'
  where id = '71000000-0000-4000-a000-0000000000a2';
insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('71000000-0000-4000-a000-0000000000b1', 'clinical_admin', 'verified', null, now(), '71000000-0000-4000-a000-0000000000a1'),
  ('71000000-0000-4000-a000-0000000000c1', 'ops_admin', 'verified', null, now(), '71000000-0000-4000-a000-0000000000b1'),
  ('71000000-0000-4000-a000-0000000000a1', 'pharmacist', 'verified', '2234388', now(), '71000000-0000-4000-a000-0000000000b1'),
  ('71000000-0000-4000-a000-0000000000a2', 'pharmacist', 'verified', '2235658', now(), '71000000-0000-4000-a000-0000000000b1');
update public.staff_roles set independent_prescriber_owner_confirmed = true
  where user_id = '71000000-0000-4000-a000-0000000000a2';

select throws_ok(
  $$ update public.staff_roles set prescribing_enabled = true where user_id = '71000000-0000-4000-a000-0000000000a2' $$,
  '23514', null, 'prescribing cannot be switched on');

insert into public.review_orders (id, patient_id, status, assigned_pharmacist_id) values
  ('71000000-0000-4000-b000-000000000001', '71000000-0000-4000-a000-000000000001', 'in_review', '71000000-0000-4000-a000-0000000000a1');
insert into public.safety_screenings (order_id, patient_id, ruleset_version, answers, outcome) values
  ('71000000-0000-4000-b000-000000000001', '71000000-0000-4000-a000-000000000001', '2026-11-draft.2',
    '{"Q1":"no","Q2":"no","Q3":"no","Q4":"no"}', 'routine');
insert into public.questionnaire_submissions (order_id, patient_id, status, version_no, answers, medications, submitted_at) values
  ('71000000-0000-4000-b000-000000000001', '71000000-0000-4000-a000-000000000001', 'submitted', 1,
    '{"mainConcern":"Why am I on this medicine?"}', '[{"name":"Paracetamol"}]', now());
insert into public.payments (order_id, patient_id, amount_pence, status, source, receipt_number)
  values ('71000000-0000-4000-b000-000000000001', '71000000-0000-4000-a000-000000000001',
          5900, 'succeeded', 'manual_audited', 'R-MIF-0001');
insert into public.documents (order_id, patient_id, storage_path, original_filename, mime_type, size_bytes, scan_status, scan_engine)
  values ('71000000-0000-4000-b000-000000000001', '71000000-0000-4000-a000-000000000001',
          '71000000-0000-4000-a000-000000000001/71000000-0000-4000-b000-000000000001/note.pdf',
          'note.pdf', 'application/pdf', 1200, 'pending_scan', 'not_run');

select is(public.record_malware_scan(
  (select id from public.documents where storage_path like '%note.pdf'), 'not_run', 'skipped'),
  'rejected', 'a skipped scan is not clean');
select is((select scan_status from public.documents where storage_path like '%note.pdf'), 'rejected',
  'the document stays rejected');
select throws_ok(
  $$ update public.documents set scan_status = 'clean', scan_engine = 'stub-not-scanned' where storage_path like '%note.pdf' $$,
  '23514', null, 'a direct update cannot mark a file clean');
select is(public.record_malware_scan(
  (select id from public.documents where storage_path like '%note.pdf'), 'clamav', 'clean'),
  'clean', 'ClamAV clean is the only clean verdict');

select pg_temp.as_user('71000000-0000-4000-a000-000000000001', 'aal2');
set local role authenticated;
select throws_ok(
  $$ select public.record_malware_scan('71000000-0000-4000-b000-000000000099', 'clamav', 'clean') $$,
  '42501', null, 'a patient cannot record a scan result');
reset role;

select pg_temp.as_user('71000000-0000-4000-a000-0000000000c1', 'aal2');
set local role authenticated;
select throws_ok(
  $$ select public.handover_review('71000000-0000-4000-b000-000000000001', '71000000-0000-4000-a000-0000000000a2', 'availability') $$,
  '42501', null, 'an operations administrator cannot hand over a review');
reset role;

select pg_temp.as_user('71000000-0000-4000-a000-0000000000b1', 'aal2');
set local role authenticated;
select lives_ok(
  $$ select public.handover_review('71000000-0000-4000-b000-000000000001', '71000000-0000-4000-a000-0000000000a2', 'clinical_cover') $$,
  'a clinical administrator can hand a review to the other pharmacist');
reset role;
select is(
  (select assigned_pharmacist_id::text from public.review_orders where id = '71000000-0000-4000-b000-000000000001'),
  '71000000-0000-4000-a000-0000000000a2', 'the review is now with the second pharmacist');
select ok(
  (select metadata ->> 'from_pharmacist_id' = '71000000-0000-4000-a000-0000000000a1'
      and metadata ->> 'reason' = 'clinical_cover'
    from public.audit_log where action = 'review.handed_over'),
  'the handover audit records the previous pharmacist and the reason');

select pg_temp.as_user('71000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select throws_ok(
  $$ select public.pharmacist_create_report('71000000-0000-4000-b000-000000000001') $$,
  '42501', null, 'the previous pharmacist cannot act after handover');
reset role;

select pg_temp.as_user('71000000-0000-4000-a000-0000000000a2', 'aal2');
set local role authenticated;
select public.pharmacist_create_report('71000000-0000-4000-b000-000000000001');
select public.pharmacist_save_report_content(
  (select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001'),
  '{"findings":"Discuss the indication with the GP.","medicationIssues":[{"medicine":"Paracetamol","issue":"The patient is unsure why it was started."}],"recommendations":["Ask the GP whether this medicine is still needed."],"monitoring":["Review pain at the next GP appointment."],"gpDiscussionPoints":["Indication for long-term use."],"safetyAdvice":"If you feel very unwell, contact your GP or NHS 111.","limitations":"DRAFT pending clinical approval. This review is for discussion with the prescriber."}'::jsonb);
select public.pharmacist_record_consultation('71000000-0000-4000-b000-000000000001', 'telephone', now(), true,
  'Synthetic: two-way conversation.');
select public.pharmacist_confirm_report_checks((select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status <> 'superseded'), true, true);
select public.pharmacist_approve_report(
  (select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status <> 'superseded'),
  (select id from public.consultations where order_id = '71000000-0000-4000-b000-000000000001'));
select is((select approver_display_name from public.reports where order_id = '71000000-0000-4000-b000-000000000001'),
  'Ka Po Ng', 'the report is approved in the signed-in pharmacist''s own name');
select is((select approver_gphc_number from public.reports where order_id = '71000000-0000-4000-b000-000000000001'),
  '2235658', 'the report records that pharmacist''s own GPhC number');
select public.pharmacist_set_generation_status((select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001'), 'generating', null);
select public.pharmacist_set_generation_status((select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001'), 'ready_for_release', 'reports/mif.pdf');
select public.pharmacist_release_report((select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status = 'ready_for_release'));
select lives_ok(
  $$ select public.pharmacist_start_correction((select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status = 'released'), 'Corrected the monitoring wording after a further check.') $$,
  'the assigned pharmacist can start a correction');
reset role;
select is((select count(*)::int from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status = 'released'),
  1, 'the original released report stays visible until the new version is released');

select pg_temp.as_user('71000000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.reports), 1, 'the patient still sees only the released version');
reset role;

select pg_temp.as_user('71000000-0000-4000-a000-0000000000a2', 'aal2');
set local role authenticated;
select public.pharmacist_confirm_report_checks((select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status = 'draft'), true, true);
select public.pharmacist_approve_report(
  (select id from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status = 'draft'),
  (select id from public.consultations where order_id = '71000000-0000-4000-b000-000000000001'));
select public.pharmacist_set_generation_status((select id from public.reports where status = 'clinically_approved' and order_id = '71000000-0000-4000-b000-000000000001'), 'generating', null);
select public.pharmacist_set_generation_status((select id from public.reports where status = 'generating' and order_id = '71000000-0000-4000-b000-000000000001'), 'ready_for_release', 'reports/mif-v2.pdf');
select public.pharmacist_release_report((select id from public.reports where status = 'ready_for_release' and order_id = '71000000-0000-4000-b000-000000000001'));
reset role;
select is((select count(*)::int from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status = 'superseded'),
  1, 'the earlier report is kept and marked superseded');
select is((select version_no from public.reports where order_id = '71000000-0000-4000-b000-000000000001' and status = 'released'),
  2, 'the patient-facing report is the new version');

select * from finish();
rollback;
