-- LOCAL DEVELOPMENT ONLY. Synthetic users; never run against a hosted project.
-- All accounts use the password: Synthetic-Local-Only-1
-- Emails use the reserved .test TLD so they can never reach a real inbox.

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'patient.demo@example.test'),
      ('00000000-0000-4000-a000-000000000011'::uuid, 'pharmacist.verified@example.test'),
      ('00000000-0000-4000-a000-000000000012'::uuid, 'pharmacist.pending@example.test'),
      ('00000000-0000-4000-a000-000000000013'::uuid, 'cheuk.sung@example.test'),
      ('00000000-0000-4000-a000-000000000014'::uuid, 'ka.po.ng@example.test'),
      ('00000000-0000-4000-a000-000000000021'::uuid, 'clinical.admin@example.test'),
      ('00000000-0000-4000-a000-000000000031'::uuid, 'ops.admin@example.test')
    ) as t(id, email)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Synthetic-Local-Only-1', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"terms_version":"draft-2026-11","adult_declaration":"true"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end $$;

update public.profiles set given_name = 'Demo', family_name = 'Patient', date_of_birth = '1954-04-12',
  phone_number = '+447700900001'
  where id = '00000000-0000-4000-a000-000000000001';

-- Staff grants. Verification here is synthetic; real staff verification is a
-- manual, documented process (see docs/SECURITY_MODEL.md).
insert into public.staff_roles (user_id, role, verification_status, gphc_registration_number, verified_at, verified_by) values
  ('00000000-0000-4000-a000-000000000031', 'ops_admin', 'verified', null, now(), '00000000-0000-4000-a000-000000000021'),
  ('00000000-0000-4000-a000-000000000021', 'clinical_admin', 'verified', null, now(), '00000000-0000-4000-a000-000000000031'),
  ('00000000-0000-4000-a000-000000000011', 'pharmacist', 'verified', '0000001', now(), '00000000-0000-4000-a000-000000000021'),
  ('00000000-0000-4000-a000-000000000012', 'pharmacist', 'pending', null, null, null),
  ('00000000-0000-4000-a000-000000000013', 'pharmacist', 'verified', '2234388', now(), '00000000-0000-4000-a000-000000000021'),
  ('00000000-0000-4000-a000-000000000014', 'pharmacist', 'verified', '2235658', now(), '00000000-0000-4000-a000-000000000021');

-- Synthetic staff names (report approval records the pharmacist's name).
update public.profiles set given_name = 'Priya', family_name = 'Synthetic' where id = '00000000-0000-4000-a000-000000000011';
update public.profiles set given_name = 'Pending', family_name = 'Synthetic' where id = '00000000-0000-4000-a000-000000000012';
update public.profiles set given_name = 'Clara', family_name = 'Synthetic' where id = '00000000-0000-4000-a000-000000000021';
update public.profiles set given_name = 'Omar', family_name = 'Synthetic' where id = '00000000-0000-4000-a000-000000000031';
update public.profiles set given_name = 'Cheuk Kin', family_name = 'Sung' where id = '00000000-0000-4000-a000-000000000013';
update public.profiles set given_name = 'Ka Po', family_name = 'Ng' where id = '00000000-0000-4000-a000-000000000014';
-- Owner-confirmed independent prescriber. The prescribing flag cannot be turned on.
update public.staff_roles set independent_prescriber_owner_confirmed = true
  where user_id = '00000000-0000-4000-a000-000000000014' and role = 'pharmacist';

-- Local development: opens synthetic intake. Payments and report release stay
-- closed because no launch sign-offs are recorded and the rule set is DRAFT.
update public.app_settings set environment = 'development';
