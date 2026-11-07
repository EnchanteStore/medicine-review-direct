-- Phase 2: live-service kill switch, versioned safety screening, review orders,
-- questionnaire, documents, retention, report-release gate (schema) and staff MFA.
-- See docs/PHASE_2_SPEC.md. Every write path for clinical state is a security
-- definer function or is guarded by triggers that apply to every role.

-- Function bodies reference tables created later in this file.
set check_function_bodies = off;

-- ===========================================================================
-- 0. Staff MFA: staff privileges require an aal2 (TOTP-verified) session.
-- ===========================================================================
create or replace function app.current_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1');
$$;

create or replace function app.has_verified_role(target public.staff_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.current_aal() = 'aal2' and exists (
    select 1 from public.staff_roles sr
    where sr.user_id = (select auth.uid())
      and sr.role = target
      and sr.verification_status = 'verified'
  );
$$;

grant execute on function app.current_aal() to authenticated, service_role;

-- ===========================================================================
-- 1. Service settings, launch sign-offs and the kill switch
-- ===========================================================================
create table public.app_settings (
  id boolean primary key default true check (id),
  -- Defaults to production (closed). Only local/CI seeds set 'development',
  -- which opens synthetic intake but never payments or report release.
  environment text not null default 'production' check (environment in ('development', 'production')),
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;

create type public.launch_gate as enum (
  'clinical_screening_content_and_sop',
  'operational_response_arrangements',
  'mhra_device_classification',
  'cqc_scope_assessment',
  'professional_indemnity',
  'legal_terms_and_privacy_notice',
  'retention_policy_and_dpia',
  'company_ico_gphc_details',
  'vat_and_brand_checks',
  'processor_agreements_and_security_review'
);

-- Append-only. The latest row per gate decides; revocation is a new row.
create table public.launch_signoffs (
  id bigint generated always as identity primary key,
  gate public.launch_gate not null,
  decision text not null check (decision in ('approved', 'revoked')),
  signed_off_by uuid not null references auth.users (id) on delete restrict,
  evidence_reference text not null check (char_length(evidence_reference) between 1 and 500),
  recorded_at timestamptz not null default now()
);

create trigger launch_signoffs_append_only before update or delete on public.launch_signoffs
  for each row execute function app.reject_mutation();

-- ===========================================================================
-- 2. Versioned safety rule sets
-- ===========================================================================
create type public.ruleset_status as enum ('draft', 'approved', 'retired');

create table public.safety_rulesets (
  version text primary key check (version ~ '^[a-z0-9.-]+$'),
  status public.ruleset_status not null default 'draft',
  is_active boolean not null default false,
  definition jsonb not null check (jsonb_typeof(definition -> 'questions') = 'array'),
  approved_by uuid references auth.users (id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approved_requires_approver check (
    status <> 'approved' or (approved_by is not null and approved_at is not null)
  ),
  constraint definition_version_matches check (definition ->> 'version' = version)
);
create unique index safety_rulesets_one_active on public.safety_rulesets (is_active) where is_active;

create function app.protect_ruleset_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.definition is distinct from old.definition or new.version is distinct from old.version then
    raise exception 'safety rule set definitions are immutable; create a new version'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger safety_rulesets_immutable before update on public.safety_rulesets
  for each row execute function app.protect_ruleset_definition();
create trigger safety_rulesets_no_delete before delete on public.safety_rulesets
  for each row execute function app.reject_mutation();

insert into public.safety_rulesets (version, status, is_active, definition)
values ('2026-11-draft.1', 'draft', true, $ruleset${"version":"2026-11-draft.1","status_note":"DRAFT: not clinically approved. Wording and rules require sign-off by the responsible pharmacist before any public use.","answer_options":["yes","no","unsure"],"unsure_policy":{"emergency":"escalate","urgent":"escalate","routine":"flag_incomplete"},"questions":[{"id":"E1","pathway":"emergency","text":"Do you have chest pain or pressure right now that could be a heart attack?"},{"id":"E2","pathway":"emergency","text":"Do you have signs of a stroke right now, such as a drooping face, weakness in an arm, or slurred speech?"},{"id":"E3","pathway":"emergency","text":"Are you having severe difficulty breathing right now?"},{"id":"E4","pathway":"emergency","text":"Are you having a severe allergic reaction right now, such as swelling of the lips, tongue or throat?"},{"id":"E5","pathway":"emergency","text":"Have you collapsed or lost consciousness today, or are you being asked these questions on behalf of someone who has?"},{"id":"E6","pathway":"emergency","text":"Do you have severe bleeding that will not stop?"},{"id":"E7","pathway":"emergency","text":"Are you in immediate danger of seriously harming yourself?"},{"id":"U1","pathway":"urgent","text":"In the last few days, have you had what could be a serious side effect from a medicine, such as a new rash with a high temperature, yellowing skin or eyes, or unusual bleeding or bruising?"},{"id":"U2","pathway":"urgent","text":"Have you recently taken too much of a medicine, the wrong medicine, or a medicine at the wrong time in a way that could cause harm?"},{"id":"U3","pathway":"urgent","text":"Have you run out, or will you run out in the next 2 days, of a medicine you must not miss (for example insulin, epilepsy medicine or a blood thinner), with no way to get more?"},{"id":"U4","pathway":"urgent","text":"Do you have new or worsening symptoms that you think need to be checked by a doctor or nurse today?"},{"id":"R1","pathway":"routine","flag":"high_risk_medicine","text":"Do you take any medicines that need extra care, such as a blood thinner, insulin, methotrexate, lithium or a strong painkiller?"},{"id":"R2","pathway":"routine","flag":"polypharmacy","text":"Do you take 10 or more different medicines, including ones you buy yourself?"},{"id":"R3","pathway":"routine","flag":"monitoring_gap","text":"Are you meant to have regular blood tests or check-ups for a medicine, but have not had one when expected?"},{"id":"R4","pathway":"routine","flag":"vulnerable_situation","text":"Do you find it hard to manage your medicines on your own, for example because of memory problems or living alone?"},{"id":"R5","pathway":"routine","flag":"pregnancy_or_breastfeeding","text":"Are you pregnant, breastfeeding, or planning a pregnancy?"}]}$ruleset$::jsonb);

-- ===========================================================================
-- 3. Live-service status
-- ===========================================================================
create function app.launch_gates_complete()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from unnest(enum_range(null::public.launch_gate)) as g(gate)
    where coalesce((
      select s.decision from public.launch_signoffs s
      where s.gate = g.gate order by s.id desc limit 1
    ), 'none') <> 'approved'
  );
$$;

-- No feature flag can make the live service available without every sign-off
-- and a clinically approved active rule set.
create function app.live_service_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.launch_gates_complete() and exists (
    select 1 from public.safety_rulesets where is_active and status = 'approved'
  );
$$;

create function app.intake_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.live_service_enabled()
      or (select environment from public.app_settings) = 'development';
$$;

create function app.payments_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.live_service_enabled();
$$;

create function public.service_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'environment', (select environment from public.app_settings),
    'intake_open', app.intake_open(),
    'payments_open', app.payments_open(),
    'live_service_enabled', app.live_service_enabled(),
    'active_ruleset_version', (select version from public.safety_rulesets where is_active),
    'active_ruleset_status', (select status from public.safety_rulesets where is_active),
    'outstanding_gate_count', (
      select count(*) from unnest(enum_range(null::public.launch_gate)) as g(gate)
      where coalesce((select s.decision from public.launch_signoffs s
                      where s.gate = g.gate order by s.id desc limit 1), 'none') <> 'approved'
    )
  );
$$;

-- ===========================================================================
-- 4. Review orders and their state machine
-- ===========================================================================
create type public.order_status as enum (
  'draft',
  'safety_emergency_excluded',
  'safety_urgent_hold',
  'intake',
  'questionnaire_submitted',
  'awaiting_payment',
  'paid',
  'consultation_booked',
  'in_review',
  'report_released',
  'completed',
  'declined',
  'cancelled',
  'refunded'
);

create table public.review_orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete restrict,
  product_code text not null default 'standard_review' references public.products (code),
  status public.order_status not null default 'draft',
  suitability_review_required boolean not null default false,
  assigned_pharmacist_id uuid references auth.users (id) on delete restrict,
  last_clinical_contact_at timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_orders_patient_idx on public.review_orders (patient_id, created_at desc);

create trigger review_orders_set_updated_at before update on public.review_orders
  for each row execute function app.set_updated_at();

create table public.safety_screenings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  patient_id uuid not null references auth.users (id) on delete restrict,
  ruleset_version text not null references public.safety_rulesets (version),
  answers jsonb not null,
  outcome text not null check (outcome in ('emergency', 'urgent', 'routine')),
  matched_rule_ids text[] not null default '{}',
  flags text[] not null default '{}',
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index safety_screenings_order_idx on public.safety_screenings (order_id, created_at desc);

-- Immutable except a single acknowledgement timestamp.
create function app.protect_screening()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'safety screenings are part of the clinical record and cannot be deleted'
      using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - 'acknowledged_at') is distinct from (to_jsonb(old) - 'acknowledged_at')
     or old.acknowledged_at is not null then
    raise exception 'safety screenings are immutable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger safety_screenings_protect before update or delete on public.safety_screenings
  for each row execute function app.protect_screening();

-- Pharmacist reassessment of an urgent hold, or individual suitability review
-- for complex patients. Immutable.
create table public.suitability_assessments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  kind text not null check (kind in ('urgent_reassessment', 'complexity_review')),
  outcome text not null check (outcome in ('suitable', 'unsuitable')),
  notes text not null check (char_length(notes) between 1 and 5000),
  assessed_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create trigger suitability_assessments_append_only before update or delete on public.suitability_assessments
  for each row execute function app.reject_mutation();

create function app.order_transition_allowed(p_from public.order_status, p_to public.order_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'draft' then p_to in ('safety_emergency_excluded', 'safety_urgent_hold', 'intake', 'cancelled')
    when 'safety_urgent_hold' then p_to in ('intake', 'declined', 'cancelled')
    when 'intake' then p_to in ('questionnaire_submitted', 'cancelled')
    when 'questionnaire_submitted' then p_to in ('intake', 'awaiting_payment', 'cancelled')
    when 'awaiting_payment' then p_to in ('paid', 'cancelled')
    when 'paid' then p_to in ('consultation_booked', 'refunded', 'declined')
    when 'consultation_booked' then p_to in ('in_review', 'paid', 'refunded', 'declined')
    when 'in_review' then p_to in ('report_released', 'refunded', 'declined')
    when 'report_released' then p_to in ('completed')
    when 'declined' then p_to in ('refunded')
    else false
  end;
$$;

-- Latest screening for the order passed, or an urgent outcome was later
-- reassessed as suitable by a pharmacist. Emergency outcomes never clear.
create function app.order_screening_cleared(p_order_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
begin
  select * into s from public.safety_screenings
    where order_id = p_order_id order by created_at desc, id desc limit 1;
  if not found then return false; end if;
  if s.outcome = 'routine' then return true; end if;
  if s.outcome = 'urgent' then
    return exists (
      select 1 from public.suitability_assessments a
      where a.order_id = p_order_id and a.kind = 'urgent_reassessment'
        and a.outcome = 'suitable' and a.created_at >= s.created_at
    );
  end if;
  return false;
end;
$$;

create function app.patient_has_urgent_hold(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.review_orders where patient_id = p_patient and status = 'safety_urgent_hold');
$$;

create function app.has_current_consent(p_user uuid, p_type public.consent_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted from public.consents c
    where c.user_id = p_user and c.consent_type = p_type
    order by c.recorded_at desc, c.id desc limit 1
  ), false);
$$;

create function app.enforce_order_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Orders start as drafts. Only the database owner (tests, migrations) may
    -- create orders in another state.
    if new.status <> 'draft'
       and coalesce(nullif(current_setting('role', true), 'none'), session_user) not in ('postgres', 'supabase_admin') then
      raise exception 'orders must be created as draft' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not app.order_transition_allowed(old.status, new.status) then
    raise exception 'order: transition from % to % is not allowed', old.status, new.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'intake' and old.status in ('draft', 'safety_urgent_hold')
     and not app.order_screening_cleared(new.id) then
    raise exception 'order: safety screening has not cleared this order' using errcode = 'check_violation';
  end if;

  if new.status = 'questionnaire_submitted' and not exists (
    select 1 from public.questionnaire_submissions q where q.order_id = new.id and q.status = 'submitted'
  ) then
    raise exception 'order: no submitted questionnaire' using errcode = 'check_violation';
  end if;

  if new.status in ('awaiting_payment', 'paid', 'consultation_booked') then
    if not app.payments_open() then
      raise exception 'order: payments and booking are disabled until the live service is approved'
        using errcode = 'check_violation';
    end if;
    if not app.order_screening_cleared(new.id) then
      raise exception 'order: safety screening has not cleared this order' using errcode = 'check_violation';
    end if;
    if app.patient_has_urgent_hold(new.patient_id) then
      raise exception 'order: patient has an urgent safety hold awaiting pharmacist reassessment'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'consultation_booked' and new.suitability_review_required and not exists (
    select 1 from public.suitability_assessments a
    where a.order_id = new.id and a.kind = 'complexity_review' and a.outcome = 'suitable'
  ) then
    raise exception 'order: individual pharmacist suitability assessment required before booking'
      using errcode = 'check_violation';
  end if;

  if new.status = 'report_released' and not exists (
    select 1 from public.reports r where r.order_id = new.id and r.status = 'released'
  ) then
    raise exception 'order: report has not been released' using errcode = 'check_violation';
  end if;

  new.status_changed_at := now();
  return new;
end;
$$;

-- ===========================================================================
-- 5. Questionnaire (drafts, versioned submissions, amendments)
-- ===========================================================================
create table public.questionnaire_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  patient_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'superseded')),
  version_no integer check (version_no > 0),
  amends_submission_id uuid references public.questionnaire_submissions (id) on delete restrict,
  current_step integer not null default 1 check (current_step between 1 and 4),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  medications jsonb not null default '[]'::jsonb check (
    jsonb_typeof(medications) = 'array' and jsonb_array_length(medications) <= 50
  ),
  attention_flags text[] not null default '{}',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, version_no),
  constraint draft_has_no_version check ((status = 'draft') = (version_no is null)),
  constraint size_limit check (pg_column_size(answers) + pg_column_size(medications) < 131072)
);
create unique index questionnaire_one_draft_per_order on public.questionnaire_submissions (order_id)
  where status = 'draft';

create trigger questionnaire_set_updated_at before update on public.questionnaire_submissions
  for each row execute function app.set_updated_at();

create function app.protect_questionnaire()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'draft' and current_setting('app.retention_purge', true) = 'on' then
      return old;
    end if;
    raise exception 'questionnaire records cannot be deleted' using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'submitted' then
    if new.status = 'superseded'
       and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      return new;
    end if;
    raise exception 'submitted questionnaires are immutable; start an amendment'
      using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'superseded' then
    raise exception 'superseded questionnaires are immutable' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger questionnaire_protect before update or delete on public.questionnaire_submissions
  for each row execute function app.protect_questionnaire();

-- Free-text matching for pharmacist attention only. Never blocks, never
-- validates, never declares anything safe. DRAFT list pending approval.
create table public.high_risk_medicine_terms (
  term text primary key check (term = lower(term) and char_length(term) between 3 and 60),
  category text not null,
  status text not null default 'draft' check (status in ('draft', 'approved'))
);
insert into public.high_risk_medicine_terms (term, category) values
  ('warfarin', 'anticoagulant'), ('apixaban', 'anticoagulant'), ('rivaroxaban', 'anticoagulant'),
  ('edoxaban', 'anticoagulant'), ('dabigatran', 'anticoagulant'), ('insulin', 'insulin'),
  ('methotrexate', 'immunosuppressant'), ('lithium', 'narrow therapeutic index'),
  ('digoxin', 'narrow therapeutic index'), ('amiodarone', 'antiarrhythmic'),
  ('phenytoin', 'antiepileptic'), ('carbamazepine', 'antiepileptic'), ('valproate', 'antiepileptic'),
  ('clozapine', 'antipsychotic'), ('tacrolimus', 'immunosuppressant'), ('ciclosporin', 'immunosuppressant'),
  ('morphine', 'opioid'), ('oxycodone', 'opioid'), ('fentanyl', 'opioid'), ('tramadol', 'opioid');

-- ===========================================================================
-- 6. Documents (private storage; malware scanning is a labelled stub)
-- ===========================================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  patient_id uuid not null references auth.users (id) on delete restrict,
  storage_path text not null unique check (char_length(storage_path) <= 500),
  original_filename text not null check (char_length(original_filename) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  scan_status text not null default 'pending_scan' check (scan_status in ('pending_scan', 'clean', 'rejected')),
  scan_engine text not null default 'stub-not-scanned',
  uploaded_at timestamptz not null default now()
);
create index documents_order_idx on public.documents (order_id);

do $storage$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present; skipping bucket and storage policies';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('patient-documents', 'patient-documents', false, 10485760,
          array['application/pdf', 'image/jpeg', 'image/png'])
  on conflict (id) do nothing;

  create policy patient_documents_insert_own on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'patient-documents'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and app.intake_open()
    );
  create policy patient_documents_select_own on storage.objects
    for select to authenticated
    using (bucket_id = 'patient-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
end
$storage$;

-- ===========================================================================
-- 7. Retention, lawful holds and deletion requests
-- ===========================================================================
create table public.retention_policies (
  record_category text primary key check (record_category in (
    'clinical_record', 'safety_escalation', 'abandoned_intake', 'accounting', 'security_log', 'temporary_backup'
  )),
  retention_period interval not null,
  period_starts_from text not null,
  basis text not null,
  status text not null default 'provisional' check (status in ('provisional', 'approved')),
  approved_by uuid references auth.users (id) on delete restrict,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint approved_requires_approver check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);
insert into public.retention_policies (record_category, retention_period, period_starts_from, basis) values
  ('clinical_record', interval '8 years', 'last_clinical_contact', 'Owner decision 7 Nov 2026 (provisional; needs governance and privacy approval)'),
  ('safety_escalation', interval '8 years', 'last_clinical_contact', 'Follows clinical record policy when part of a care record (provisional)'),
  ('abandoned_intake', interval '90 days', 'last_activity', 'Intakes with no clinical care (provisional)'),
  ('accounting', interval '6 years', 'end_of_financial_year', 'Accounting records, generally 6 years (provisional)'),
  ('security_log', interval '12 months', 'event_time', 'Routine security logs, subject to risk review (provisional)'),
  ('temporary_backup', interval '90 days', 'backup_created', 'Target 30 to 90 days (provisional)');

create trigger retention_policies_set_updated_at before update on public.retention_policies
  for each row execute function app.set_updated_at();

create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete restrict,
  order_id uuid references public.review_orders (id) on delete restrict,
  reason_category text not null check (reason_category in (
    'litigation', 'complaint', 'regulatory_investigation', 'safeguarding', 'other'
  )),
  placed_by uuid not null references auth.users (id) on delete restrict,
  placed_at timestamptz not null default now(),
  released_by uuid references auth.users (id) on delete restrict,
  released_at timestamptz,
  constraint hold_has_subject check (user_id is not null or order_id is not null),
  constraint release_is_complete check ((released_by is null) = (released_at is null))
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'received' check (status in ('received', 'in_review', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete restrict,
  reviewed_at timestamptz,
  retention_assessment jsonb
);
create unique index deletion_requests_one_open on public.deletion_requests (user_id)
  where status in ('received', 'in_review');

create function app.under_legal_hold(p_user uuid, p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.legal_holds h
    where h.released_at is null
      and ((p_user is not null and h.user_id = p_user) or (p_order is not null and h.order_id = p_order))
  );
$$;

-- An intake is abandoned (non-clinical) if no clinical care happened: never
-- paid, no submitted questionnaire, no emergency/urgent screening, no
-- consultation or report.
create function app.is_abandoned_intake(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.review_orders o
    where o.id = p_order_id
      and o.status in ('draft', 'intake', 'cancelled')
      and o.last_clinical_contact_at is null
      and not exists (select 1 from public.questionnaire_submissions q where q.order_id = o.id and q.status <> 'draft')
      and not exists (select 1 from public.safety_screenings s where s.order_id = o.id and s.outcome <> 'routine')
      and not exists (select 1 from public.consultations c where c.order_id = o.id)
      and not exists (select 1 from public.reports r where r.order_id = o.id)
  );
$$;

-- Read-only view of what a deletion request may and may not erase. Clinical
-- records are always retained for their retention period.
create function app.retention_assessment(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'assessed_at', now(),
    'legal_hold', app.under_legal_hold(p_user, null),
    'clinical_orders_retained', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'order_id', o.id,
        'retain_until', (coalesce(o.last_clinical_contact_at, o.updated_at)
                         + (select retention_period from public.retention_policies where record_category = 'clinical_record'))::date
      )), '[]'::jsonb)
      from public.review_orders o where o.patient_id = p_user and not app.is_abandoned_intake(o.id)
    ),
    'abandoned_intakes_erasable', (
      select coalesce(jsonb_agg(o.id), '[]'::jsonb) from public.review_orders o
      where o.patient_id = p_user and app.is_abandoned_intake(o.id) and not app.under_legal_hold(p_user, o.id)
    ),
    'portal_account', 'deactivate_only_clinical_records_retained'
  );
$$;

-- Designed for a scheduled job (not scheduled in Phase 2): abandoned intakes
-- past their retention period and not under a lawful hold.
create function app.retention_candidates()
returns table (order_id uuid, patient_id uuid, last_activity timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.patient_id, o.updated_at from public.review_orders o
  where app.is_abandoned_intake(o.id)
    and not app.under_legal_hold(o.patient_id, o.id)
    and o.updated_at < now() - (select retention_period from public.retention_policies where record_category = 'abandoned_intake');
$$;

-- ===========================================================================
-- 8. Consultations and reports: the release gate (section 8)
-- ===========================================================================
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  pharmacist_id uuid not null references auth.users (id) on delete restrict,
  method text not null check (method in ('telephone', 'secure_video')),
  occurred_at timestamptz not null,
  two_way_completed boolean not null,
  clinical_notes text not null check (char_length(btrim(clinical_notes)) between 1 and 20000),
  created_at timestamptz not null default now()
);
create trigger consultations_append_only before update or delete on public.consultations
  for each row execute function app.reject_mutation();

create type public.report_status as enum (
  'draft', 'clinically_approved', 'generating', 'generation_failed', 'ready_for_release', 'released'
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.review_orders (id) on delete restrict,
  status public.report_status not null default 'draft',
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  information_sufficient_by uuid references auth.users (id) on delete restrict,
  information_sufficient_at timestamptz,
  adequacy_confirmed_by uuid references auth.users (id) on delete restrict,
  adequacy_confirmed_at timestamptz,
  consultation_id uuid references public.consultations (id) on delete restrict,
  approved_by uuid references auth.users (id) on delete restrict,
  approved_at timestamptz,
  approver_display_name text,
  approver_gphc_number text,
  released_by uuid references auth.users (id) on delete restrict,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function app.is_assigned_verified_pharmacist(p_order_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null
    and app.current_aal() = 'aal2'
    and exists (select 1 from public.review_orders o where o.id = p_order_id and o.assigned_pharmacist_id = p_user)
    and exists (
      select 1 from public.staff_roles sr
      where sr.user_id = p_user and sr.role = 'pharmacist' and sr.verification_status = 'verified'
        and sr.gphc_registration_number is not null
    );
$$;

-- Every section 8 condition, checked from the database's own records. Returns
-- the list of unmet conditions (empty = gate passes).
create function app.report_gate_blockers(p_report public.reports, p_for_release boolean)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  blockers text[] := array[]::text[];
  o public.review_orders;
  c public.consultations;
  prof public.profiles;
begin
  select * into o from public.review_orders where id = p_report.order_id;
  select * into prof from public.profiles where id = o.patient_id;

  if not app.order_screening_cleared(o.id) then
    blockers := array_append(blockers, 'safety_screening_not_cleared');
  end if;
  if prof.given_name is null or prof.family_name is null or prof.date_of_birth is null then
    blockers := array_append(blockers, 'eligibility_profile_incomplete');
  end if;
  if not exists (select 1 from public.questionnaire_submissions q where q.order_id = o.id and q.status = 'submitted') then
    blockers := array_append(blockers, 'no_submitted_questionnaire');
  end if;
  if p_report.information_sufficient_by is null then
    blockers := array_append(blockers, 'clinical_information_not_confirmed_sufficient');
  end if;
  select * into c from public.consultations where id = p_report.consultation_id and order_id = o.id;
  if not found then
    blockers := array_append(blockers, 'no_consultation_recorded');
  elsif not c.two_way_completed then
    blockers := array_append(blockers, 'consultation_not_two_way_completed');
  end if;
  if p_report.adequacy_confirmed_by is null then
    blockers := array_append(blockers, 'clinical_adequacy_not_confirmed');
  end if;
  if o.status in ('declined', 'safety_emergency_excluded', 'safety_urgent_hold', 'cancelled', 'refunded') then
    blockers := array_append(blockers, 'service_declined_or_excluded');
  end if;
  if p_for_release then
    if p_report.approved_by is null or p_report.approver_gphc_number is null or p_report.approver_display_name is null then
      blockers := array_append(blockers, 'report_not_approved_with_professional_identification');
    end if;
    if o.status <> 'in_review' then
      blockers := array_append(blockers, 'order_not_in_review');
    end if;
  end if;
  return blockers;
end;
$$;

create function app.report_transition_allowed(p_from public.report_status, p_to public.report_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'draft' then p_to in ('clinically_approved')
    when 'clinically_approved' then p_to in ('generating', 'draft')
    when 'generating' then p_to in ('ready_for_release', 'generation_failed')
    when 'generation_failed' then p_to in ('generating', 'draft')
    when 'ready_for_release' then p_to in ('released', 'draft')
    else false
  end;
$$;

-- Applies to every role, including service_role: approval and release must be
-- performed by the assigned verified pharmacist in an MFA session.
create function app.enforce_report_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  blockers text[];
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    raise exception 'reports cannot be deleted' using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'reports must be created as draft' using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.review_orders o where o.id = new.order_id
               and o.status in ('declined', 'safety_emergency_excluded', 'cancelled')) then
      raise exception 'a declined or excluded service cannot produce a review report' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if old.status = 'released' then
    raise exception 'released reports are immutable; issue a correction as a new version'
      using errcode = 'insufficient_privilege';
  end if;
  if new.content is distinct from old.content and old.status <> 'draft' then
    raise exception 'report content can only change in draft' using errcode = 'check_violation';
  end if;
  if new.information_sufficient_by is distinct from old.information_sufficient_by and new.information_sufficient_by is not null
     and (new.information_sufficient_by <> actor or not app.is_assigned_verified_pharmacist(new.order_id, actor)) then
    raise exception 'only the assigned verified pharmacist can confirm information is sufficient' using errcode = 'insufficient_privilege';
  end if;
  if new.adequacy_confirmed_by is distinct from old.adequacy_confirmed_by and new.adequacy_confirmed_by is not null
     and (new.adequacy_confirmed_by <> actor or not app.is_assigned_verified_pharmacist(new.order_id, actor)) then
    raise exception 'only the assigned verified pharmacist can confirm clinical adequacy' using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status then
    if not app.report_transition_allowed(old.status, new.status) then
      raise exception 'report: transition from % to % is not allowed', old.status, new.status using errcode = 'check_violation';
    end if;

    if new.status = 'clinically_approved' then
      if new.approved_by is distinct from actor or not app.is_assigned_verified_pharmacist(new.order_id, actor) then
        raise exception 'report approval requires the assigned verified pharmacist (MFA)' using errcode = 'insufficient_privilege';
      end if;
      blockers := app.report_gate_blockers(new, false);
      if cardinality(blockers) > 0 then
        raise exception 'report approval blocked: %', array_to_string(blockers, ', ') using errcode = 'check_violation';
      end if;
      select sr.gphc_registration_number into new.approver_gphc_number from public.staff_roles sr
        where sr.user_id = actor and sr.role = 'pharmacist';
      select nullif(btrim(concat_ws(' ', p.given_name, p.family_name)), '') into new.approver_display_name
        from public.profiles p where p.id = actor;
      if new.approver_display_name is null then
        raise exception 'report approval requires the pharmacist''s name on their profile' using errcode = 'check_violation';
      end if;
      new.approved_at := now();
    elsif new.status = 'draft' then
      -- Returning to draft voids approval and confirmations.
      new.approved_by := null; new.approved_at := null;
      new.approver_display_name := null; new.approver_gphc_number := null;
      new.adequacy_confirmed_by := null; new.adequacy_confirmed_at := null;
    elsif new.status = 'released' then
      if new.released_by is distinct from actor or not app.is_assigned_verified_pharmacist(new.order_id, actor) then
        raise exception 'report release requires an explicit action by the assigned verified pharmacist (MFA)'
          using errcode = 'insufficient_privilege';
      end if;
      blockers := app.report_gate_blockers(new, true);
      if cardinality(blockers) > 0 then
        raise exception 'report release blocked: %', array_to_string(blockers, ', ') using errcode = 'check_violation';
      end if;
      new.released_at := now();
    elsif new.status in ('generating', 'ready_for_release', 'generation_failed') then
      if old.approved_by is null then
        raise exception 'report has not been clinically approved' using errcode = 'check_violation';
      end if;
    end if;
  elsif new.approved_by is distinct from old.approved_by or new.released_by is distinct from old.released_by then
    raise exception 'approval and release fields change only with a status transition' using errcode = 'check_violation';
  end if;

  if new.information_sufficient_by is distinct from old.information_sufficient_by then
    new.information_sufficient_at := case when new.information_sufficient_by is null then null else now() end;
  end if;
  if new.adequacy_confirmed_by is distinct from old.adequacy_confirmed_by then
    new.adequacy_confirmed_at := case when new.adequacy_confirmed_by is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger reports_gate before insert or update or delete on public.reports
  for each row execute function app.enforce_report_gate();
create trigger reports_set_updated_at before update on public.reports
  for each row execute function app.set_updated_at();

create function app.after_report_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'clinically_approved' then
      perform app.write_audit('report.clinically_approved', 'report', new.id::text,
        jsonb_build_object('order_id', new.order_id, 'pharmacist_id', new.approved_by,
          'gphc_number', new.approver_gphc_number, 'consultation_id', new.consultation_id));
    elsif new.status = 'released' then
      perform app.write_audit('report.released', 'report', new.id::text,
        jsonb_build_object('order_id', new.order_id, 'pharmacist_id', new.released_by,
          'approved_by', new.approved_by, 'gphc_number', new.approver_gphc_number));
      update public.review_orders set status = 'report_released' where id = new.order_id;
    elsif new.status = 'draft' then
      perform app.write_audit('report.approval_voided', 'report', new.id::text, jsonb_build_object('order_id', new.order_id));
    else
      perform app.write_audit('report.status_changed', 'report', new.id::text,
        jsonb_build_object('order_id', new.order_id, 'from', old.status, 'to', new.status));
    end if;
  end if;
  return null;
end;
$$;

create trigger reports_after_change after update on public.reports
  for each row execute function app.after_report_change();

-- Order trigger is created after reports exists (it references reports).
create trigger review_orders_rules before insert or update on public.review_orders
  for each row execute function app.enforce_order_rules();

-- ===========================================================================
-- 9. Audit triggers (minimal; identifiers only, never answers or free text)
-- ===========================================================================
create function app.audit_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.write_audit('order.created', 'review_order', new.id::text, jsonb_build_object('patient_id', new.patient_id));
  elsif new.status is distinct from old.status then
    perform app.write_audit('order.status_changed', 'review_order', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return null;
end;
$$;
create trigger review_orders_audit after insert or update on public.review_orders
  for each row execute function app.audit_order_status();

create function app.audit_simple()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := '{}'::jsonb;
begin
  case tg_table_name
    when 'safety_screenings' then
      meta := jsonb_build_object('order_id', new.order_id, 'outcome', new.outcome, 'ruleset_version', new.ruleset_version);
      perform app.write_audit('safety.screening_recorded', 'safety_screening', new.id::text, meta);
    when 'suitability_assessments' then
      meta := jsonb_build_object('order_id', new.order_id, 'kind', new.kind, 'outcome', new.outcome);
      perform app.write_audit('safety.suitability_assessed', 'suitability_assessment', new.id::text, meta);
    when 'documents' then
      meta := jsonb_build_object('order_id', new.order_id, 'size_bytes', new.size_bytes, 'mime_type', new.mime_type);
      perform app.write_audit('document.uploaded', 'document', new.id::text, meta);
    when 'consultations' then
      meta := jsonb_build_object('order_id', new.order_id, 'method', new.method, 'two_way_completed', new.two_way_completed);
      perform app.write_audit('consultation.recorded', 'consultation', new.id::text, meta);
    when 'launch_signoffs' then
      meta := jsonb_build_object('gate', new.gate, 'decision', new.decision);
      perform app.write_audit('launch.signoff_recorded', 'launch_signoff', new.id::text, meta);
    when 'legal_holds' then
      meta := jsonb_build_object('user_id', new.user_id, 'order_id', new.order_id, 'released', new.released_at is not null);
      perform app.write_audit(case when tg_op = 'INSERT' then 'retention.legal_hold_placed' else 'retention.legal_hold_released' end,
        'legal_hold', new.id::text, meta);
    when 'deletion_requests' then
      meta := jsonb_build_object('user_id', new.user_id, 'status', new.status);
      perform app.write_audit(case when tg_op = 'INSERT' then 'retention.deletion_requested' else 'retention.deletion_reviewed' end,
        'deletion_request', new.id::text, meta);
    when 'retention_policies' then
      meta := jsonb_build_object('category', new.record_category, 'period', new.retention_period::text, 'status', new.status);
      perform app.write_audit('retention.policy_changed', 'retention_policy', new.record_category, meta);
    else
      null;
  end case;
  return null;
end;
$$;

create trigger safety_screenings_audit after insert on public.safety_screenings for each row execute function app.audit_simple();
create trigger suitability_assessments_audit after insert on public.suitability_assessments for each row execute function app.audit_simple();
create trigger documents_audit after insert on public.documents for each row execute function app.audit_simple();
create trigger consultations_audit after insert on public.consultations for each row execute function app.audit_simple();
create trigger launch_signoffs_audit after insert on public.launch_signoffs for each row execute function app.audit_simple();
create trigger legal_holds_audit after insert or update on public.legal_holds for each row execute function app.audit_simple();
create trigger deletion_requests_audit after insert or update on public.deletion_requests for each row execute function app.audit_simple();
create trigger retention_policies_audit after update on public.retention_policies for each row execute function app.audit_simple();

-- ===========================================================================
-- 10. Patient RPCs
-- ===========================================================================
create function app.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;
  return uid;
end;
$$;

create function app.own_order(p_order_id uuid)
returns public.review_orders
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.review_orders;
  uid uuid;
begin
  uid := app.require_user();
  select * into o from public.review_orders where id = p_order_id and patient_id = uid;
  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;
  return o;
end;
$$;

create function public.start_review_order()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := app.require_user();
  prof public.profiles;
  existing uuid;
  new_id uuid;
begin
  if not app.intake_open() then
    raise exception 'intake is closed until the live service is approved' using errcode = 'check_violation';
  end if;
  select * into prof from public.profiles where id = uid;
  if prof.given_name is null or prof.family_name is null or prof.date_of_birth is null then
    raise exception 'complete your profile before starting a review' using errcode = 'check_violation';
  end if;
  select id into existing from public.review_orders
    where patient_id = uid and status in ('draft', 'intake', 'questionnaire_submitted', 'safety_urgent_hold')
    order by created_at desc limit 1;
  if existing is not null then
    return existing;
  end if;
  insert into public.review_orders (patient_id) values (uid) returning id into new_id;
  return new_id;
end;
$$;

-- Evaluates the active rule set in the database so the outcome cannot be
-- chosen by the client. Mirrors packages/domain evaluateScreening().
create function app.evaluate_screening(p_definition jsonb, p_answers jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  q jsonb;
  ans text;
  pathway text;
  matched text[] := array[]::text[];
  flags text[] := array[]::text[];
  has_emergency boolean := false;
  has_urgent boolean := false;
  question_ids text[];
begin
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'answers must be an object' using errcode = 'invalid_parameter_value';
  end if;
  select array_agg(x ->> 'id') into question_ids from jsonb_array_elements(p_definition -> 'questions') x;
  if exists (select 1 from jsonb_object_keys(p_answers) k where k <> all (question_ids)) then
    raise exception 'unknown screening question in answers' using errcode = 'invalid_parameter_value';
  end if;

  for q in select * from jsonb_array_elements(p_definition -> 'questions') loop
    ans := p_answers ->> (q ->> 'id');
    pathway := q ->> 'pathway';
    if ans is null or ans not in ('yes', 'no', 'unsure') then
      raise exception 'screening question % must be answered yes, no or unsure', q ->> 'id'
        using errcode = 'invalid_parameter_value';
    end if;
    if pathway in ('emergency', 'urgent') then
      if ans = 'yes' or (ans = 'unsure' and p_definition -> 'unsure_policy' ->> pathway = 'escalate') then
        matched := array_append(matched, q ->> 'id');
        if pathway = 'emergency' then has_emergency := true; else has_urgent := true; end if;
      end if;
    elsif pathway = 'routine' then
      if ans = 'yes' then
        matched := array_append(matched, q ->> 'id');
        if not (q ->> 'flag') = any (flags) then flags := array_append(flags, q ->> 'flag'); end if;
      elsif ans = 'unsure' and not 'incomplete_information' = any (flags) then
        flags := array_append(flags, 'incomplete_information');
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'outcome', case when has_emergency then 'emergency' when has_urgent then 'urgent' else 'routine' end,
    'matched_rule_ids', to_jsonb(matched),
    'flags', to_jsonb(flags)
  );
end;
$$;

create function public.submit_safety_screening(p_order_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders := app.own_order(p_order_id);
  rs public.safety_rulesets;
  result jsonb;
  screening_id uuid;
  outcome text;
  flags text[];
begin
  if not app.intake_open() then
    raise exception 'intake is closed until the live service is approved' using errcode = 'check_violation';
  end if;
  if o.status <> 'draft' then
    raise exception 'this review has already been screened' using errcode = 'check_violation';
  end if;
  select * into rs from public.safety_rulesets where is_active;
  if not found then
    raise exception 'no active safety rule set' using errcode = 'check_violation';
  end if;

  result := app.evaluate_screening(rs.definition, p_answers);
  outcome := result ->> 'outcome';
  select coalesce(array_agg(f), '{}') into flags from jsonb_array_elements_text(result -> 'flags') f;

  insert into public.safety_screenings (order_id, patient_id, ruleset_version, answers, outcome, matched_rule_ids, flags)
  values (o.id, o.patient_id, rs.version, p_answers, outcome,
          (select coalesce(array_agg(m), '{}') from jsonb_array_elements_text(result -> 'matched_rule_ids') m), flags)
  returning id into screening_id;

  update public.review_orders set
    status = case outcome when 'emergency' then 'safety_emergency_excluded'::public.order_status
                          when 'urgent' then 'safety_urgent_hold'::public.order_status
                          else 'intake'::public.order_status end,
    suitability_review_required = (outcome = 'routine' and cardinality(flags) > 0)
  where id = o.id;

  return result || jsonb_build_object('screening_id', screening_id, 'ruleset_version', rs.version);
end;
$$;

create function public.acknowledge_safety_advice(p_screening_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := app.require_user();
  update public.safety_screenings set acknowledged_at = now()
    where id = p_screening_id and patient_id = uid and acknowledged_at is null
      and outcome in ('emergency', 'urgent');
end;
$$;

create function public.save_questionnaire_draft(p_order_id uuid, p_step integer, p_answers jsonb, p_medications jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders := app.own_order(p_order_id);
  draft_id uuid;
begin
  if o.status <> 'intake' then
    raise exception 'the questionnaire cannot be edited at this stage' using errcode = 'check_violation';
  end if;
  if not app.has_current_consent(o.patient_id, 'health_data_processing') then
    raise exception 'consent to process health information is required' using errcode = 'check_violation';
  end if;
  update public.questionnaire_submissions
    set answers = coalesce(p_answers, answers), medications = coalesce(p_medications, medications),
        current_step = greatest(1, least(4, p_step))
    where order_id = o.id and status = 'draft'
    returning id into draft_id;
  if draft_id is null then
    insert into public.questionnaire_submissions (order_id, patient_id, answers, medications, current_step)
    values (o.id, o.patient_id, coalesce(p_answers, '{}'), coalesce(p_medications, '[]'), greatest(1, least(4, p_step)))
    returning id into draft_id;
  end if;
  return draft_id;
end;
$$;

create function public.submit_questionnaire(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders := app.own_order(p_order_id);
  d public.questionnaire_submissions;
  next_version integer;
  attention text[] := array[]::text[];
begin
  if o.status <> 'intake' then
    raise exception 'the questionnaire cannot be submitted at this stage' using errcode = 'check_violation';
  end if;
  if not app.has_current_consent(o.patient_id, 'remote_consultation') then
    raise exception 'consent to a telephone or video consultation is required' using errcode = 'check_violation';
  end if;
  select * into d from public.questionnaire_submissions where order_id = o.id and status = 'draft';
  if not found then
    raise exception 'no questionnaire draft' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(d.medications) = 0
     or exists (select 1 from jsonb_array_elements(d.medications) m where coalesce(btrim(m ->> 'name'), '') = '')
     or coalesce(btrim(d.answers ->> 'mainConcern'), '') = '' then
    raise exception 'questionnaire is incomplete' using errcode = 'check_violation';
  end if;

  -- Pharmacist attention flags (free-text matching is not clinical validation).
  if jsonb_array_length(d.medications) >= 10 then attention := array_append(attention, 'polypharmacy'); end if;
  if exists (
    select 1 from jsonb_array_elements(d.medications) m, public.high_risk_medicine_terms t
    where lower(m ->> 'name') like '%' || t.term || '%'
  ) then attention := array_append(attention, 'high_risk_medicine_match'); end if;
  if exists (select 1 from jsonb_array_elements(d.medications) m where jsonb_typeof(m -> 'dontKnow') = 'array' and jsonb_array_length(m -> 'dontKnow') > 0)
     or exists (select 1 from jsonb_each_text(d.answers) a where a.value = 'dont_know') then
    attention := array_append(attention, 'incomplete_information');
  end if;

  select coalesce(max(version_no), 0) + 1 into next_version from public.questionnaire_submissions where order_id = o.id;
  update public.questionnaire_submissions set status = 'superseded' where order_id = o.id and status = 'submitted';
  update public.questionnaire_submissions
    set status = 'submitted', version_no = next_version, submitted_at = now(), attention_flags = attention
    where id = d.id;
  update public.review_orders set status = 'questionnaire_submitted',
    suitability_review_required = suitability_review_required or 'high_risk_medicine_match' = any (attention)
                                  or 'polypharmacy' = any (attention)
    where id = o.id;
  perform app.write_audit('questionnaire.submitted', 'questionnaire_submission', d.id::text,
    jsonb_build_object('order_id', o.id, 'version_no', next_version));
  return next_version;
end;
$$;

create function public.start_questionnaire_amendment(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders := app.own_order(p_order_id);
  latest public.questionnaire_submissions;
  new_id uuid;
begin
  if o.status <> 'questionnaire_submitted' then
    raise exception 'amendments are only possible after submission and before payment' using errcode = 'check_violation';
  end if;
  select * into latest from public.questionnaire_submissions
    where order_id = o.id and status = 'submitted';
  insert into public.questionnaire_submissions (order_id, patient_id, answers, medications, current_step, amends_submission_id)
  values (o.id, o.patient_id, latest.answers, latest.medications, 1, latest.id)
  returning id into new_id;
  update public.review_orders set status = 'intake' where id = o.id;
  perform app.write_audit('questionnaire.amendment_started', 'questionnaire_submission', new_id::text,
    jsonb_build_object('order_id', o.id, 'amends', latest.id));
  return new_id;
end;
$$;

create function public.register_document(p_order_id uuid, p_storage_path text, p_filename text, p_mime text, p_size integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders := app.own_order(p_order_id);
  new_id uuid;
begin
  if o.status not in ('intake', 'questionnaire_submitted') then
    raise exception 'documents cannot be added at this stage' using errcode = 'check_violation';
  end if;
  if p_storage_path not like o.patient_id::text || '/' || o.id::text || '/%' then
    raise exception 'invalid storage path' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'patient-documents' and name = p_storage_path) then
    raise exception 'uploaded file not found' using errcode = 'no_data_found';
  end if;
  insert into public.documents (order_id, patient_id, storage_path, original_filename, mime_type, size_bytes)
  values (o.id, o.patient_id, p_storage_path, p_filename, p_mime, p_size)
  returning id into new_id;
  return new_id;
end;
$$;

create function public.request_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := app.require_user();
  new_id uuid;
begin
  select id into new_id from public.deletion_requests where user_id = uid and status in ('received', 'in_review');
  if new_id is not null then
    return new_id;
  end if;
  insert into public.deletion_requests (user_id, retention_assessment)
  values (uid, app.retention_assessment(uid)) returning id into new_id;
  return new_id;
end;
$$;

-- ===========================================================================
-- 11. Staff RPCs (verified role + MFA required by helpers)
-- ===========================================================================
create function public.record_suitability_assessment(p_order_id uuid, p_kind text, p_outcome text, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders;
  new_id uuid;
begin
  if not app.is_verified_clinician() then
    raise exception 'verified clinician with MFA required' using errcode = 'insufficient_privilege';
  end if;
  select * into o from public.review_orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'no_data_found'; end if;
  if p_kind = 'urgent_reassessment' and o.status <> 'safety_urgent_hold' then
    raise exception 'order is not on an urgent safety hold' using errcode = 'check_violation';
  end if;
  insert into public.suitability_assessments (order_id, kind, outcome, notes, assessed_by)
  values (o.id, p_kind, p_outcome, p_notes, auth.uid()) returning id into new_id;
  if p_kind = 'urgent_reassessment' then
    update public.review_orders set status = case when p_outcome = 'suitable' then 'intake'::public.order_status
                                                  else 'declined'::public.order_status end
      where id = o.id;
  end if;
  return new_id;
end;
$$;

create function public.assign_pharmacist(p_order_id uuid, p_pharmacist_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_verified_role('clinical_admin') then
    raise exception 'verified clinical admin with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.staff_roles where user_id = p_pharmacist_id and role = 'pharmacist'
                 and verification_status = 'verified') then
    raise exception 'assignee is not a verified pharmacist' using errcode = 'check_violation';
  end if;
  update public.review_orders set assigned_pharmacist_id = p_pharmacist_id where id = p_order_id;
  perform app.write_audit('order.pharmacist_assigned', 'review_order', p_order_id::text,
    jsonb_build_object('pharmacist_id', p_pharmacist_id));
end;
$$;

create function public.pharmacist_record_consultation(
  p_order_id uuid, p_method text, p_occurred_at timestamptz, p_two_way_completed boolean, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not app.is_assigned_verified_pharmacist(p_order_id, auth.uid()) then
    raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.consultations (order_id, pharmacist_id, method, occurred_at, two_way_completed, clinical_notes)
  values (p_order_id, auth.uid(), p_method, p_occurred_at, p_two_way_completed, p_notes) returning id into new_id;
  update public.review_orders set last_clinical_contact_at = greatest(coalesce(last_clinical_contact_at, p_occurred_at), p_occurred_at)
    where id = p_order_id;
  return new_id;
end;
$$;

create function public.pharmacist_create_report(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not app.is_assigned_verified_pharmacist(p_order_id, auth.uid()) then
    raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.reports (order_id) values (p_order_id) returning id into new_id;
  return new_id;
end;
$$;

create function public.pharmacist_confirm_report_checks(p_report_id uuid, p_information_sufficient boolean, p_clinically_adequate boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reports set
    information_sufficient_by = case when p_information_sufficient then auth.uid() else information_sufficient_by end,
    adequacy_confirmed_by = case when p_clinically_adequate then auth.uid() else adequacy_confirmed_by end
  where id = p_report_id;
end;
$$;

create function public.pharmacist_approve_report(p_report_id uuid, p_consultation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reports set status = 'clinically_approved', approved_by = auth.uid(), consultation_id = p_consultation_id
    where id = p_report_id;
  if not found then raise exception 'report not found' using errcode = 'no_data_found'; end if;
end;
$$;

create function public.pharmacist_release_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reports set status = 'released', released_by = auth.uid() where id = p_report_id;
  if not found then raise exception 'report not found' using errcode = 'no_data_found'; end if;
end;
$$;

create function public.review_deletion_request(p_request_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.deletion_requests;
  assessment jsonb;
begin
  if not app.has_verified_role('clinical_admin') then
    raise exception 'verified clinical admin with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('in_review', 'completed', 'rejected') then
    raise exception 'invalid decision' using errcode = 'invalid_parameter_value';
  end if;
  select * into r from public.deletion_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'no_data_found'; end if;
  assessment := app.retention_assessment(r.user_id);
  -- Completing a request records what is retained and why. It never erases
  -- clinical records; abandoned intakes are purged separately by the
  -- retention job, and the portal account is deactivated by the service role.
  update public.deletion_requests set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
    retention_assessment = assessment where id = r.id;
  return assessment;
end;
$$;

create function public.place_legal_hold(p_user_id uuid, p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not app.has_verified_role('clinical_admin') then
    raise exception 'verified clinical admin with MFA required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.legal_holds (user_id, order_id, reason_category, placed_by)
  values (p_user_id, p_order_id, p_reason, auth.uid()) returning id into new_id;
  return new_id;
end;
$$;

-- Retention job step (service role only): purges one abandoned intake past
-- its period and not under hold. Never touches clinical records.
create function app.purge_abandoned_intake(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  drafts integer;
  docs integer;
  screenings integer;
begin
  perform 1 from public.review_orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'no_data_found'; end if;
  if not exists (select 1 from app.retention_candidates() c where c.order_id = p_order_id) then
    raise exception 'order is not eligible for purge (clinical, recent or under legal hold)' using errcode = 'check_violation';
  end if;
  perform set_config('app.retention_purge', 'on', true);
  delete from public.questionnaire_submissions where order_id = p_order_id and status = 'draft';
  get diagnostics drafts = row_count;
  select count(*) into docs from public.documents where order_id = p_order_id;
  select count(*) into screenings from public.safety_screenings where order_id = p_order_id;
  perform set_config('app.retention_purge', 'off', true);
  perform app.write_audit('retention.abandoned_intake_purged', 'review_order', p_order_id::text,
    jsonb_build_object('drafts_deleted', drafts, 'documents_pending_storage_purge', docs,
      'routine_screenings_retained', screenings));
  update public.review_orders set status = 'cancelled' where id = p_order_id and status <> 'cancelled';
  return jsonb_build_object('drafts_deleted', drafts);
end;
$$;

-- ===========================================================================
-- 12. Consents: allow intake-sourced consents
-- ===========================================================================
drop policy consents_insert_own on public.consents;
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()) and source in ('account_settings', 'intake'));

-- ===========================================================================
-- 13. Row level security and grants
-- ===========================================================================
alter table public.app_settings enable row level security;
alter table public.launch_signoffs enable row level security;
alter table public.safety_rulesets enable row level security;
alter table public.review_orders enable row level security;
alter table public.safety_screenings enable row level security;
alter table public.suitability_assessments enable row level security;
alter table public.questionnaire_submissions enable row level security;
alter table public.high_risk_medicine_terms enable row level security;
alter table public.documents enable row level security;
alter table public.retention_policies enable row level security;
alter table public.legal_holds enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.consultations enable row level security;
alter table public.reports enable row level security;

create function app.can_view_order_clinically(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_verified_role('clinical_admin')
      or app.is_assigned_verified_pharmacist(p_order_id, (select auth.uid()));
$$;
grant execute on function app.can_view_order_clinically(uuid) to authenticated;

create policy launch_signoffs_select_admin on public.launch_signoffs
  for select to authenticated using ((select app.is_verified_admin()));
create policy launch_signoffs_insert_clinical_admin on public.launch_signoffs
  for insert to authenticated
  with check ((select app.has_verified_role('clinical_admin')) and signed_off_by = (select auth.uid()));

create policy safety_rulesets_select on public.safety_rulesets
  for select to authenticated using (true);

create policy review_orders_select_own on public.review_orders
  for select to authenticated using (patient_id = (select auth.uid()));
create policy review_orders_select_clinical on public.review_orders
  for select to authenticated using (app.can_view_order_clinically(id));

create policy safety_screenings_select_own on public.safety_screenings
  for select to authenticated using (patient_id = (select auth.uid()));
create policy safety_screenings_select_clinical on public.safety_screenings
  for select to authenticated using (app.can_view_order_clinically(order_id));

create policy suitability_select_clinical on public.suitability_assessments
  for select to authenticated using (app.can_view_order_clinically(order_id));

create policy questionnaire_select_own on public.questionnaire_submissions
  for select to authenticated using (patient_id = (select auth.uid()));
create policy questionnaire_select_clinical on public.questionnaire_submissions
  for select to authenticated using (app.can_view_order_clinically(order_id));

create policy high_risk_terms_select_clinical on public.high_risk_medicine_terms
  for select to authenticated using ((select app.is_verified_clinician()));

create policy documents_select_own on public.documents
  for select to authenticated using (patient_id = (select auth.uid()));
-- Clinicians only see documents that passed scanning.
create policy documents_select_clinical on public.documents
  for select to authenticated using (scan_status = 'clean' and app.can_view_order_clinically(order_id));

create policy retention_policies_select_admin on public.retention_policies
  for select to authenticated using ((select app.is_verified_admin()));
create policy legal_holds_select_admin on public.legal_holds
  for select to authenticated using ((select app.has_verified_role('clinical_admin')));
create policy deletion_requests_select_own on public.deletion_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy deletion_requests_select_admin on public.deletion_requests
  for select to authenticated using ((select app.has_verified_role('clinical_admin')));

create policy consultations_select_clinical on public.consultations
  for select to authenticated using (app.can_view_order_clinically(order_id));

create policy reports_select_own_released on public.reports
  for select to authenticated using (
    status = 'released' and exists (select 1 from public.review_orders o where o.id = order_id and o.patient_id = (select auth.uid()))
  );
create policy reports_select_clinical on public.reports
  for select to authenticated using (app.can_view_order_clinically(order_id));

revoke all on public.app_settings, public.launch_signoffs, public.safety_rulesets, public.review_orders,
  public.safety_screenings, public.suitability_assessments, public.questionnaire_submissions,
  public.high_risk_medicine_terms, public.documents, public.retention_policies, public.legal_holds,
  public.deletion_requests, public.consultations, public.reports
  from anon, authenticated;

grant select on public.launch_signoffs, public.safety_rulesets, public.review_orders, public.safety_screenings,
  public.suitability_assessments, public.questionnaire_submissions, public.high_risk_medicine_terms,
  public.documents, public.retention_policies, public.legal_holds, public.deletion_requests,
  public.consultations, public.reports
  to authenticated;
grant insert (gate, decision, signed_off_by, evidence_reference) on public.launch_signoffs to authenticated;

grant all on public.app_settings, public.launch_signoffs, public.safety_rulesets, public.review_orders,
  public.safety_screenings, public.suitability_assessments, public.questionnaire_submissions,
  public.high_risk_medicine_terms, public.documents, public.retention_policies, public.legal_holds,
  public.deletion_requests, public.consultations, public.reports
  to service_role;

revoke all on function
  public.start_review_order(), public.submit_safety_screening(uuid, jsonb), public.acknowledge_safety_advice(uuid),
  public.save_questionnaire_draft(uuid, integer, jsonb, jsonb), public.submit_questionnaire(uuid),
  public.start_questionnaire_amendment(uuid), public.register_document(uuid, text, text, text, integer),
  public.request_account_deletion(), public.record_suitability_assessment(uuid, text, text, text),
  public.assign_pharmacist(uuid, uuid), public.pharmacist_record_consultation(uuid, text, timestamptz, boolean, text),
  public.pharmacist_create_report(uuid), public.pharmacist_confirm_report_checks(uuid, boolean, boolean),
  public.pharmacist_approve_report(uuid, uuid), public.pharmacist_release_report(uuid),
  public.review_deletion_request(uuid, text), public.place_legal_hold(uuid, uuid, text), public.service_status()
  from public, anon;

grant execute on function
  public.start_review_order(), public.submit_safety_screening(uuid, jsonb), public.acknowledge_safety_advice(uuid),
  public.save_questionnaire_draft(uuid, integer, jsonb, jsonb), public.submit_questionnaire(uuid),
  public.start_questionnaire_amendment(uuid), public.register_document(uuid, text, text, text, integer),
  public.request_account_deletion(), public.record_suitability_assessment(uuid, text, text, text),
  public.assign_pharmacist(uuid, uuid), public.pharmacist_record_consultation(uuid, text, timestamptz, boolean, text),
  public.pharmacist_create_report(uuid), public.pharmacist_confirm_report_checks(uuid, boolean, boolean),
  public.pharmacist_approve_report(uuid, uuid), public.pharmacist_release_report(uuid),
  public.review_deletion_request(uuid, text), public.place_legal_hold(uuid, uuid, text)
  to authenticated;
grant execute on function public.service_status() to anon, authenticated;

revoke all on all functions in schema app from public;
grant execute on function app.has_verified_role(public.staff_role), app.is_verified_clinician(),
  app.is_verified_admin(), app.current_aal(), app.intake_open(), app.can_view_order_clinically(uuid),
  app.is_assigned_verified_pharmacist(uuid, uuid)
  to authenticated;
grant execute on all functions in schema app to service_role;
