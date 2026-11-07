-- Staff role boundaries: ops admins get no clinical/patient data, unverified or
-- suspended clinicians get nothing, the audit log is immutable.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('20000000-0000-4000-a000-0000000000c1', 'rls.patient.c@example.test', 'authenticated', 'authenticated',
   '{"terms_version":"draft-test","adult_declaration":"true"}'),
  ('20000000-0000-4000-a000-0000000000a1', 'rls.pharm.ok@example.test', 'authenticated', 'authenticated', '{}'),
  ('20000000-0000-4000-a000-0000000000a2', 'rls.pharm.pending@example.test', 'authenticated', 'authenticated', '{}'),
  ('20000000-0000-4000-a000-0000000000b1', 'rls.clinadmin@example.test', 'authenticated', 'authenticated', '{}'),
  ('20000000-0000-4000-a000-0000000000d1', 'rls.ops@example.test', 'authenticated', 'authenticated', '{}');

insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('20000000-0000-4000-a000-0000000000d1', 'ops_admin', 'verified', null, now(), '20000000-0000-4000-a000-0000000000b1'),
  ('20000000-0000-4000-a000-0000000000b1', 'clinical_admin', 'verified', null, now(), '20000000-0000-4000-a000-0000000000d1'),
  ('20000000-0000-4000-a000-0000000000a1', 'pharmacist', 'verified', '0000002', now(), '20000000-0000-4000-a000-0000000000b1'),
  ('20000000-0000-4000-a000-0000000000a2', 'pharmacist', 'pending', null, null, null);

insert into public.products (code, name, description, price_pence, is_active)
  values ('future_followup_test', 'Follow-up call (test)', 'Inactive test product', 2500, false);

-- Constraints on staff verification
select throws_ok(
  $$ insert into public.staff_roles (user_id, role, verification_status)
     values ('20000000-0000-4000-a000-0000000000c1', 'ops_admin', 'verified') $$,
  '23514', null, 'a verified role requires a recorded verifier');
select throws_ok(
  $$ insert into public.staff_roles (user_id, role, verification_status, verified_at, verified_by)
     values ('20000000-0000-4000-a000-0000000000c1', 'ops_admin', 'verified', now(), '20000000-0000-4000-a000-0000000000c1') $$,
  '23514', null, 'staff cannot verify themselves');
select throws_ok(
  $$ insert into public.staff_roles (user_id, role, verification_status, verified_at, verified_by)
     values ('20000000-0000-4000-a000-0000000000c1', 'pharmacist', 'verified', now(), '20000000-0000-4000-a000-0000000000b1') $$,
  '23514', null, 'a verified pharmacist requires a GPhC registration number');

-- Ops admin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true);
select is_empty($$ select 1 from public.profiles where id = '20000000-0000-4000-a000-0000000000c1' $$,
  'ops admin cannot read patient profiles');
select is_empty($$ select 1 from public.consents where user_id = '20000000-0000-4000-a000-0000000000c1' $$,
  'ops admin cannot read patient consents');
select isnt_empty($$ select 1 from public.audit_log $$, 'ops admin can read the audit log');
select is((select count(*)::int from public.staff_roles where user_id::text like '20000000-%'), 4,
  'ops admin can see staff role grants');
select isnt_empty($$ select 1 from public.products where code = 'future_followup_test' $$,
  'ops admin can see inactive products');
select throws_ok($$ update public.products set price_pence = 1 $$, '42501', null,
  'ops admin cannot change prices through the API in Phase 1');

-- Pending pharmacist
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-a000-0000000000a2","role":"authenticated"}', true);
select is_empty($$ select 1 from public.profiles where id = '20000000-0000-4000-a000-0000000000c1' $$,
  'unverified pharmacist cannot read patient profiles');
select is((select count(*)::int from public.staff_roles), 1, 'unverified pharmacist sees only their own role');
select is_empty($$ select 1 from public.audit_log $$, 'unverified pharmacist cannot read the audit log');

-- Verified pharmacist: no blanket patient access (assignment-scoped access arrives in Phase 4)
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-a000-0000000000a1","role":"authenticated"}', true);
select is_empty($$ select 1 from public.profiles where id = '20000000-0000-4000-a000-0000000000c1' $$,
  'verified pharmacist has no blanket access to patient profiles');

-- Verified clinical admin
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-a000-0000000000b1","role":"authenticated"}', true);
select isnt_empty($$ select 1 from public.profiles where id = '20000000-0000-4000-a000-0000000000c1' $$,
  'verified clinical admin can read patient profiles');
select is((select count(*)::int from public.consents where user_id = '20000000-0000-4000-a000-0000000000c1'), 3,
  'verified clinical admin can read patient consents');
select is_empty(
  $$ update public.profiles set given_name = 'Changed' where id = '20000000-0000-4000-a000-0000000000c1' returning id $$,
  'clinical admin cannot edit patient profiles');

-- Suspension removes access immediately
reset role;
update public.staff_roles set verification_status = 'suspended'
  where user_id = '20000000-0000-4000-a000-0000000000b1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-a000-0000000000b1","role":"authenticated"}', true);
select is_empty($$ select 1 from public.profiles where id = '20000000-0000-4000-a000-0000000000c1' $$,
  'suspended clinical admin loses patient access');

-- Anonymous visitors see only active products
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select results_eq($$ select code from public.products order by code $$, $$ values ('standard_review'::text) $$,
  'anonymous visitors see only active products');

-- Audit log is immutable even for the database owner
reset role;
select isnt_empty(
  $$ select 1 from public.audit_log where action = 'staff_role.status_changed'
       and metadata ->> 'to' = 'suspended' and metadata ->> 'from' = 'verified' $$,
  'staff status change is audited');
select throws_ok($$ update public.audit_log set action = 'tampered.event' $$, '42501', null,
  'audit log rows cannot be updated, even by the owner');
select throws_ok($$ delete from public.audit_log $$, '42501', null,
  'audit log rows cannot be deleted, even by the owner');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'audit log cannot be truncated');

select * from finish();
rollback;
