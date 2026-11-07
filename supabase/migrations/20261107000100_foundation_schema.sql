-- Medicine Review Direct: Phase 1 foundation schema.
-- Forward-only. Tables: profiles, staff_roles, consents, audit_log, products.
-- Every table has RLS enabled and explicit, minimal grants (auto-expose is disabled
-- in supabase/config.toml). See docs/DATABASE_DESIGN.md and docs/SECURITY_MODEL.md.

-- ---------------------------------------------------------------------------
-- Private schema for helpers. Not exposed through the Data API.
-- ---------------------------------------------------------------------------
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('pharmacist', 'clinical_admin', 'ops_admin');
create type public.verification_status as enum ('pending', 'verified', 'suspended', 'revoked');
create type public.consent_type as enum ('terms_of_service', 'privacy_notice', 'adult_declaration');
create type public.consent_source as enum ('sign_up', 'account_settings', 'staff_recorded');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per auth user, created by trigger. Identity and contact data only;
-- clinical data never lives here. on delete restrict: account deletion is a
-- governed request subject to retention, not a cascade.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  given_name text check (char_length(given_name) between 1 and 100),
  family_name text check (char_length(family_name) between 1 and 100),
  date_of_birth date,
  phone_number text check (phone_number ~ '^\+44[1-37][0-9]{8,9}$'),
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Patient/staff identity and contact details. No clinical data.';

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  role public.staff_role not null,
  verification_status public.verification_status not null default 'pending',
  gphc_registration_number text check (gphc_registration_number ~ '^[0-9]{7}$'),
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role),
  constraint verified_requires_verifier check (
    verification_status <> 'verified' or (verified_at is not null and verified_by is not null)
  ),
  constraint no_self_verification check (verified_by is null or verified_by <> user_id),
  constraint pharmacist_requires_gphc check (
    role <> 'pharmacist' or verification_status <> 'verified' or gphc_registration_number is not null
  )
);
comment on table public.staff_roles is
  'Staff role grants. Clinical access requires a verified pharmacist or clinical_admin row. Written only by service role.';

-- Append-only. Withdrawal is a new row with granted = false.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete restrict,
  consent_type public.consent_type not null,
  document_version text not null check (char_length(document_version) between 1 and 50),
  granted boolean not null,
  source public.consent_source not null default 'account_settings',
  recorded_at timestamptz not null default now()
);
create index consents_user_id_idx on public.consents (user_id, consent_type, recorded_at desc);

-- Append-only audit trail. metadata must never contain clinical content or
-- free text entered by patients; record field names and identifiers only.
create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);

-- Server-controlled catalogue and prices (pence, GBP). Inactive products are
-- invisible to the public until approved.
create table public.products (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text not null,
  price_pence integer not null check (price_pence > 0),
  standard_price_pence integer check (standard_price_pence is null or standard_price_pence >= price_pence),
  currency char(3) not null default 'GBP' check (currency = 'GBP'),
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies can consult staff_roles without
-- exposing it). search_path is pinned to avoid hijacking.
-- ---------------------------------------------------------------------------
create function app.has_verified_role(target public.staff_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles sr
    where sr.user_id = (select auth.uid())
      and sr.role = target
      and sr.verification_status = 'verified'
  );
$$;

-- Pharmacist or clinical admin, verified. Ops admins are deliberately excluded.
create function app.is_verified_clinician()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_verified_role('pharmacist') or app.has_verified_role('clinical_admin');
$$;

create function app.is_verified_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_verified_role('clinical_admin') or app.has_verified_role('ops_admin');
$$;

create function app.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

revoke all on all functions in schema app from public;
grant execute on function app.has_verified_role(public.staff_role) to authenticated;
grant execute on function app.is_verified_clinician() to authenticated;
grant execute on function app.is_verified_admin() to authenticated;
-- write_audit is intentionally not granted to API roles; only triggers and the service role use it.
grant execute on all functions in schema app to service_role;

-- ---------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------
create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function app.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; % is not permitted', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();
create trigger staff_roles_set_updated_at before update on public.staff_roles
  for each row execute function app.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function app.set_updated_at();

create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function app.reject_mutation();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function app.reject_mutation();
create trigger consents_append_only before update or delete on public.consents
  for each row execute function app.reject_mutation();
create trigger consents_no_truncate before truncate on public.consents
  for each statement execute function app.reject_mutation();

-- ---------------------------------------------------------------------------
-- Profile rules and audit
-- ---------------------------------------------------------------------------
create function app.validate_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_of_birth is not null then
    if new.date_of_birth > (current_date - interval '18 years')::date then
      raise exception 'date_of_birth: service is for adults aged 18 or over'
        using errcode = 'check_violation';
    end if;
    if new.date_of_birth < (current_date - interval '120 years')::date then
      raise exception 'date_of_birth: implausible date' using errcode = 'check_violation';
    end if;
  end if;
  -- A changed phone number is no longer verified.
  if tg_op = 'UPDATE' and new.phone_number is distinct from old.phone_number then
    new.phone_verified_at := null;
  end if;
  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function app.validate_profile();

create function app.audit_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if new.given_name is distinct from old.given_name then changed := array_append(changed, 'given_name'); end if;
  if new.family_name is distinct from old.family_name then changed := array_append(changed, 'family_name'); end if;
  if new.date_of_birth is distinct from old.date_of_birth then changed := array_append(changed, 'date_of_birth'); end if;
  if new.phone_number is distinct from old.phone_number then changed := array_append(changed, 'phone_number'); end if;
  if cardinality(changed) > 0 then
    perform app.write_audit('profile.updated', 'profile', new.id::text, jsonb_build_object('fields', changed));
  end if;
  return null;
end;
$$;

create trigger profiles_audit_update after update on public.profiles
  for each row execute function app.audit_profile_update();

-- ---------------------------------------------------------------------------
-- Staff role and consent audit
-- ---------------------------------------------------------------------------
create function app.audit_staff_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit('staff_role.created', 'staff_role', new.id::text,
      jsonb_build_object('user_id', new.user_id, 'role', new.role, 'status', new.verification_status));
  elsif new.verification_status is distinct from old.verification_status then
    perform app.write_audit('staff_role.status_changed', 'staff_role', new.id::text,
      jsonb_build_object('user_id', new.user_id, 'role', new.role,
        'from', old.verification_status, 'to', new.verification_status));
  end if;
  return null;
end;
$$;

create trigger staff_roles_audit after insert or update on public.staff_roles
  for each row execute function app.audit_staff_role();

create function app.audit_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.write_audit('consent.recorded', 'consent', new.id::text,
    jsonb_build_object('user_id', new.user_id, 'type', new.consent_type,
      'version', new.document_version, 'granted', new.granted, 'source', new.source));
  return null;
end;
$$;

create trigger consents_audit after insert on public.consents
  for each row execute function app.audit_consent();

create function app.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.write_audit('product.updated', 'product', new.code,
    jsonb_build_object(
      'price_pence', jsonb_build_object('from', old.price_pence, 'to', new.price_pence),
      'standard_price_pence', jsonb_build_object('from', old.standard_price_pence, 'to', new.standard_price_pence),
      'is_active', jsonb_build_object('from', old.is_active, 'to', new.is_active)));
  return null;
end;
$$;

create trigger products_audit_update after update on public.products
  for each row execute function app.audit_product_change();

-- ---------------------------------------------------------------------------
-- New auth user: create profile, record sign-up acknowledgements, audit.
-- Metadata is supplied by the sign-up form (user-asserted).
-- ---------------------------------------------------------------------------
create function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  terms_version text := nullif(new.raw_user_meta_data ->> 'terms_version', '');
begin
  insert into public.profiles (id) values (new.id);

  if terms_version is not null then
    insert into public.consents (user_id, consent_type, document_version, granted, source) values
      (new.id, 'terms_of_service', left(terms_version, 50), true, 'sign_up'),
      (new.id, 'privacy_notice', left(terms_version, 50), true, 'sign_up');
  end if;
  if (new.raw_user_meta_data ->> 'adult_declaration') = 'true' then
    insert into public.consents (user_id, consent_type, document_version, granted, source)
      values (new.id, 'adult_declaration', coalesce(left(terms_version, 50), 'unversioned'), true, 'sign_up');
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id)
    values (new.id, 'account.created', 'user', new.id::text);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

create function app.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, entity_type, entity_id)
    values (new.id, 'account.email_verified', 'user', new.id::text);
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function app.handle_user_email_confirmed();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.consents enable row level security;
alter table public.audit_log enable row level security;
alter table public.products enable row level security;

-- profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_clinical_admin on public.profiles
  for select to authenticated using ((select app.has_verified_role('clinical_admin')));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- staff_roles: read own grants; admins read all. No API writes.
create policy staff_roles_select_own on public.staff_roles
  for select to authenticated using (user_id = (select auth.uid()));
create policy staff_roles_select_admin on public.staff_roles
  for select to authenticated using ((select app.is_verified_admin()));

-- consents
create policy consents_select_own on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_select_clinical_admin on public.consents
  for select to authenticated using ((select app.has_verified_role('clinical_admin')));
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()) and source = 'account_settings');

-- audit_log: verified admins only; inserts happen via security definer triggers.
create policy audit_log_select_admin on public.audit_log
  for select to authenticated using ((select app.is_verified_admin()));

-- products: public sees active products; admins see all.
create policy products_select_active on public.products
  for select to anon, authenticated using (is_active);
create policy products_select_admin on public.products
  for select to authenticated using ((select app.is_verified_admin()));

-- ---------------------------------------------------------------------------
-- Grants (explicit and minimal)
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.staff_roles, public.consents, public.audit_log, public.products
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (given_name, family_name, date_of_birth, phone_number) on public.profiles to authenticated;
grant select on public.staff_roles to authenticated;
grant select on public.consents to authenticated;
grant insert (consent_type, document_version, granted, source) on public.consents to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.products to anon, authenticated;

grant all on public.profiles, public.staff_roles, public.consents, public.audit_log, public.products
  to service_role;
grant usage on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Catalogue: launch product. Future products are added inactive once approved.
-- ---------------------------------------------------------------------------
insert into public.products (code, name, description, price_pence, standard_price_pence, is_active, display_order)
values (
  'standard_review',
  'Pharmacist medication review',
  'A telephone consultation with a UK-registered pharmacist and a written report of their findings and recommendations.',
  5900,
  7900,
  true,
  1
);
