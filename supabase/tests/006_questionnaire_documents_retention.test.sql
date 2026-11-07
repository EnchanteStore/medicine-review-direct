-- Questionnaire drafts, versioned submissions and amendments; consent gates;
-- private documents; retention, lawful holds and deletion requests.
begin;
create extension if not exists pgtap with schema extensions;

select plan(37);

create function pg_temp.as_user(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
create function pg_temp.ans(o jsonb) returns jsonb language sql as $$
  select (select jsonb_object_agg(x ->> 'id', 'no') from jsonb_array_elements(
    (select definition from public.safety_rulesets where is_active) -> 'questions') x) || o
$$;

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('50000000-0000-4000-a000-000000000001', 'q.patient@example.test', 'authenticated', 'authenticated', '{}'),
  ('50000000-0000-4000-a000-000000000002', 'q.other@example.test', 'authenticated', 'authenticated', '{}'),
  ('50000000-0000-4000-a000-000000000003', 'q.abandoned@example.test', 'authenticated', 'authenticated', '{}'),
  ('50000000-0000-4000-a000-0000000000a1', 'q.pharm@example.test', 'authenticated', 'authenticated', '{}'),
  ('50000000-0000-4000-a000-0000000000b1', 'q.admin@example.test', 'authenticated', 'authenticated', '{}');
update public.profiles set given_name = 'Test', family_name = 'Patient', date_of_birth = '1950-02-02'
  where id::text like '50000000-0000-4000-a000-00000000000%';
insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('50000000-0000-4000-a000-0000000000b1', 'clinical_admin', 'verified', null, now(), '50000000-0000-4000-a000-0000000000a1'),
  ('50000000-0000-4000-a000-0000000000a1', 'pharmacist', 'verified', '0000005', now(), '50000000-0000-4000-a000-0000000000b1');
update public.app_settings set environment = 'development';

-- Patient starts and passes routine screening
select pg_temp.as_user('50000000-0000-4000-a000-000000000001');
set local role authenticated;
select public.start_review_order();
select public.submit_safety_screening((select id from public.review_orders), pg_temp.ans('{}'));

select throws_ok(
  $$ select public.save_questionnaire_draft((select id from public.review_orders), 1, '{}', '[]') $$,
  '23514', 'consent to process health information is required', 'questionnaire needs explicit health-data consent first');
insert into public.consents (consent_type, document_version, granted, source) values ('health_data_processing', 'draft-test', true, 'intake');
select lives_ok(
  $$ select public.save_questionnaire_draft((select id from public.review_orders), 2, '{"conditions":"dont_know"}', '[]') $$,
  'draft saves after consent');
select lives_ok(
  $$ select public.save_questionnaire_draft((select id from public.review_orders), 3, '{"conditions":"dont_know","mainConcern":""}', '[]') $$,
  'draft can be saved again');
select is((select count(*)::int from public.questionnaire_submissions where status = 'draft'), 1, 'only one draft per order');
select is((select current_step from public.questionnaire_submissions), 3, 'draft remembers the step reached');
select throws_ok($$ update public.questionnaire_submissions set answers = '{}' $$, '42501', null,
  'patients cannot edit questionnaire rows directly (only through the controlled functions)');
select throws_ok($$ select public.submit_questionnaire((select id from public.review_orders)) $$, '23514',
  'consent to a telephone or video consultation is required', 'submission needs consultation consent');
insert into public.consents (consent_type, document_version, granted, source) values ('remote_consultation', 'draft-test', true, 'intake');
select throws_ok($$ select public.submit_questionnaire((select id from public.review_orders)) $$, '23514',
  'questionnaire is incomplete', 'incomplete questionnaire cannot be submitted');
select lives_ok(
  $$ select public.save_questionnaire_draft((select id from public.review_orders), 4,
       '{"conditions":"dont_know","mainConcern":"Synthetic: unsure why I take two blood pressure tablets"}',
       '[{"name":"Warfarin 3mg tablets","dontKnow":["indication"]},{"name":"Synthetic medicine B"}]') $$,
  'complete draft saved');
select is(public.submit_questionnaire((select id from public.review_orders)), 1, 'first submission is version 1');
select is((select status::text from public.review_orders), 'questionnaire_submitted', 'order moves to questionnaire_submitted');
select is((select attention_flags from public.questionnaire_submissions where version_no = 1),
  array['high_risk_medicine_match', 'incomplete_information'],
  'pharmacist attention flags: high-risk name match and "don''t know" answers (non-blocking)');
select ok((select suitability_review_required from public.review_orders), 'high-risk match requires an individual suitability review');
select throws_ok(
  $$ select public.save_questionnaire_draft((select id from public.review_orders), 1, '{}', '[]') $$,
  '23514', null, 'submitted questionnaire cannot be edited without an amendment');

-- Controlled amendment
select lives_ok($$ select public.start_questionnaire_amendment((select id from public.review_orders)) $$, 'patient starts an amendment');
select is((select status::text from public.review_orders), 'intake', 'amendment returns the order to intake');
select lives_ok(
  $$ select public.save_questionnaire_draft((select id from public.review_orders), 4,
       '{"mainConcern":"Synthetic: amended concern"}', '[{"name":"Synthetic medicine B"}]') $$, 'amendment draft saved');
select is(public.submit_questionnaire((select id from public.review_orders)), 2, 'amended submission is version 2');
select is((select status from public.questionnaire_submissions where version_no = 1), 'superseded', 'version 1 is superseded');
select is((select answers ->> 'mainConcern' from public.questionnaire_submissions where version_no = 1),
  'Synthetic: unsure why I take two blood pressure tablets', 'version 1 content is preserved unchanged');
select isnt((select amends_submission_id from public.questionnaire_submissions where version_no = 2), null,
  'version 2 links to the submission it amends');
reset role;

select throws_ok(
  $$ update public.questionnaire_submissions set answers = '{}' where version_no = 2
       and patient_id = '50000000-0000-4000-a000-000000000001' $$,
  '42501', null, 'submitted questionnaires are immutable, even for the owner');

-- Isolation
select pg_temp.as_user('50000000-0000-4000-a000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.questionnaire_submissions), 0, 'another patient cannot read the questionnaire');
select throws_ok(
  $$ select public.save_questionnaire_draft((select id from public.review_orders o where false), 1, '{}', '[]') $$,
  'P0002', null, 'another patient cannot write to the order');
reset role;

-- Documents
select pg_temp.as_user('50000000-0000-4000-a000-000000000001');
set local role authenticated;
select throws_ok(
  $$ select public.register_document((select id from public.review_orders), '50000000-0000-4000-a000-000000000002/x/a.pdf',
       'a.pdf', 'application/pdf', 100) $$,
  '42501', 'invalid storage path', 'documents must live under the patient''s own folder');
select throws_ok(
  $$ select public.register_document((select id from public.review_orders),
       '50000000-0000-4000-a000-000000000001/' || (select id from public.review_orders) || '/missing.pdf',
       'missing.pdf', 'application/pdf', 100) $$,
  'P0002', 'uploaded file not found', 'a document row needs a real uploaded object');
reset role;
insert into storage.objects (bucket_id, name, owner)
  select 'patient-documents', '50000000-0000-4000-a000-000000000001/' || id || '/prescription.pdf', '50000000-0000-4000-a000-000000000001'
  from public.review_orders where patient_id = '50000000-0000-4000-a000-000000000001';
select pg_temp.as_user('50000000-0000-4000-a000-000000000001');
set local role authenticated;
select lives_ok(
  $$ select public.register_document((select id from public.review_orders),
       '50000000-0000-4000-a000-000000000001/' || (select id from public.review_orders) || '/prescription.pdf',
       'repeat prescription.pdf', 'application/pdf', 2048) $$, 'uploaded document is registered');
select is((select scan_status from public.documents), 'pending_scan', 'documents start unscanned (scanner is a labelled stub)');
reset role;
select ok(
  (select not (metadata ? 'original_filename') from public.audit_log where action = 'document.uploaded'
     and metadata ->> 'order_id' = (select id::text from public.review_orders where patient_id = '50000000-0000-4000-a000-000000000001')),
  'document audit event omits the filename (it may contain health information)');
update public.review_orders set assigned_pharmacist_id = '50000000-0000-4000-a000-0000000000a1'
  where patient_id = '50000000-0000-4000-a000-000000000001';
select pg_temp.as_user('50000000-0000-4000-a000-0000000000a1', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.documents), 0, 'clinicians cannot see documents until they pass scanning');
reset role;

-- Deletion request never erases clinical records
select pg_temp.as_user('50000000-0000-4000-a000-000000000001');
set local role authenticated;
select lives_ok($$ select public.request_account_deletion() $$, 'patient can request account deletion');
reset role;
select pg_temp.as_user('50000000-0000-4000-a000-0000000000b1', 'aal2');
set local role authenticated;
select lives_ok($$ select public.review_deletion_request((select id from public.deletion_requests), 'completed') $$,
  'clinical admin reviews the request');
reset role;
select is((select jsonb_array_length(retention_assessment -> 'clinical_orders_retained') from public.deletion_requests
           where user_id = '50000000-0000-4000-a000-000000000001'), 1,
  'the submitted review is retained as a clinical record');
select is((select count(*)::int from public.questionnaire_submissions where patient_id = '50000000-0000-4000-a000-000000000001'), 2,
  'completing a deletion request does not erase clinical records');

-- Abandoned intake purge respects lawful holds
insert into public.review_orders (id, patient_id, status, updated_at, created_at) values
  ('50000000-0000-4000-b000-000000000003', '50000000-0000-4000-a000-000000000003', 'intake', now() - interval '100 days', now() - interval '100 days');
insert into public.questionnaire_submissions (order_id, patient_id, answers)
  values ('50000000-0000-4000-b000-000000000003', '50000000-0000-4000-a000-000000000003', '{"mainConcern":"abandoned"}');
insert into public.legal_holds (order_id, reason_category, placed_by)
  values ('50000000-0000-4000-b000-000000000003', 'complaint', '50000000-0000-4000-a000-0000000000b1');
select throws_ok($$ select app.purge_abandoned_intake('50000000-0000-4000-b000-000000000003') $$, '23514', null,
  'a lawful hold prevents purging');
update public.legal_holds set released_by = '50000000-0000-4000-a000-0000000000b1', released_at = now()
  where order_id = '50000000-0000-4000-b000-000000000003';
select is((app.purge_abandoned_intake('50000000-0000-4000-b000-000000000003') ->> 'drafts_deleted')::int, 1,
  'abandoned intake past 90 days is purged once the hold is released');
select throws_ok(
  $$ select app.purge_abandoned_intake((select id from public.review_orders where patient_id = '50000000-0000-4000-a000-000000000001')) $$,
  '23514', null, 'clinical records are never purged as abandoned intakes');

select * from finish();
rollback;
