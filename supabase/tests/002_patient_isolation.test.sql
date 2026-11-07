-- Cross-patient isolation and patient write boundaries.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('10000000-0000-4000-a000-00000000000a', 'rls.patient.a@example.test', 'authenticated', 'authenticated',
   '{"terms_version":"draft-test","adult_declaration":"true"}'),
  ('10000000-0000-4000-a000-00000000000b', 'rls.patient.b@example.test', 'authenticated', 'authenticated',
   '{"terms_version":"draft-test","adult_declaration":"true"}');

update public.profiles set given_name = 'Bea', family_name = 'Other', date_of_birth = '1960-01-01'
  where id = '10000000-0000-4000-a000-00000000000b';

-- Sign-up trigger behaviour
select is((select count(*)::int from public.profiles where id = '10000000-0000-4000-a000-00000000000a'), 1,
  'sign-up creates a profile');
select is((select count(*)::int from public.consents where user_id = '10000000-0000-4000-a000-00000000000a'), 3,
  'sign-up records terms, privacy and adult acknowledgements');
select is((select count(*)::int from public.audit_log
            where action = 'account.created' and entity_id = '10000000-0000-4000-a000-00000000000a'), 1,
  'sign-up is audited');

-- Act as patient A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

select results_eq($$ select id from public.profiles $$,
  $$ values ('10000000-0000-4000-a000-00000000000a'::uuid) $$,
  'patient sees only their own profile');

select is_empty($$ select 1 from public.profiles where id = '10000000-0000-4000-a000-00000000000b' $$,
  'patient cannot read another patient''s profile');

select is_empty(
  $$ update public.profiles set given_name = 'Hacked' where id = '10000000-0000-4000-a000-00000000000b' returning id $$,
  'patient cannot update another patient''s profile');

select lives_ok(
  $$ update public.profiles set given_name = 'Ada', family_name = 'Lovelace', date_of_birth = '1950-12-10',
       phone_number = '+447700900123' where id = '10000000-0000-4000-a000-00000000000a' $$,
  'patient can update their own profile');

select throws_ok(
  $$ update public.profiles set phone_verified_at = now() where id = '10000000-0000-4000-a000-00000000000a' $$,
  '42501', null, 'patient cannot set phone_verified_at');

select throws_ok(
  $$ update public.profiles set id = '10000000-0000-4000-a000-00000000000b' where id = '10000000-0000-4000-a000-00000000000a' $$,
  '42501', null, 'patient cannot change their profile id');

select throws_ok(
  $$ update public.profiles set date_of_birth = (current_date - interval '17 years')::date
       where id = '10000000-0000-4000-a000-00000000000a' $$,
  '23514', null, 'database rejects an under-18 date of birth');

select throws_ok(
  $$ update public.profiles set phone_number = '+15555550100' where id = '10000000-0000-4000-a000-00000000000a' $$,
  '23514', null, 'database rejects a non-UK phone number');

select throws_ok($$ delete from public.profiles where id = '10000000-0000-4000-a000-00000000000a' $$,
  '42501', null, 'patient cannot delete their profile directly');

select throws_ok($$ insert into public.profiles (id) values (gen_random_uuid()) $$,
  '42501', null, 'patient cannot insert profiles');

-- Consents
select is((select count(*)::int from public.consents), 3, 'patient sees only their own consents');

select lives_ok(
  $$ insert into public.consents (consent_type, document_version, granted, source)
     values ('privacy_notice', 'draft-test-2', true, 'account_settings') $$,
  'patient can record their own consent');

select throws_ok(
  $$ insert into public.consents (user_id, consent_type, document_version, granted)
     values ('10000000-0000-4000-a000-00000000000b', 'privacy_notice', 'x', true) $$,
  '42501', null, 'patient cannot record consent for another user');

select throws_ok(
  $$ insert into public.consents (consent_type, document_version, granted, source)
     values ('terms_of_service', 'x', true, 'staff_recorded') $$,
  '42501', null, 'patient cannot forge a staff-recorded consent');

select throws_ok($$ update public.consents set granted = false $$,
  '42501', null, 'patient cannot rewrite consent history');

select throws_ok($$ delete from public.consents $$,
  '42501', null, 'patient cannot delete consent history');

-- Staff roles and audit
select throws_ok(
  $$ insert into public.staff_roles (user_id, role, verification_status)
     values ('10000000-0000-4000-a000-00000000000a', 'pharmacist', 'verified') $$,
  '42501', null, 'patient cannot grant themselves a staff role');

select is_empty($$ select 1 from public.staff_roles $$, 'patient sees no staff roles');
select is_empty($$ select 1 from public.audit_log $$, 'patient cannot read the audit log');

select throws_ok(
  $$ select app.write_audit('fake.event', 'user', 'x', '{}') $$,
  '42501', null, 'patient cannot write audit entries directly');

reset role;

select is(
  (select metadata -> 'fields' from public.audit_log
    where action = 'profile.updated' and entity_id = '10000000-0000-4000-a000-00000000000a'
    order by id desc limit 1),
  '["given_name", "family_name", "date_of_birth", "phone_number"]'::jsonb,
  'profile update is audited with field names only (no values)');

select is((select given_name from public.profiles where id = '10000000-0000-4000-a000-00000000000b'), 'Bea',
  'other patient''s profile is unchanged');

-- Anonymous visitors
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonymous visitors cannot read profiles');

reset role;
select * from finish();
rollback;
