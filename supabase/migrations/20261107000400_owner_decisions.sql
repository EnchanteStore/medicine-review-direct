-- Owner decisions P-01 to P-11 (7 Nov 2026): four-question screening, prior-exclusion
-- review before a later booking, configurable high-risk medicine list with history,
-- and staff authenticator recovery that cannot be done by email alone.
-- The new rule set is DRAFT. Nothing here marks a clinical, legal or regulatory
-- approval as complete.

-- ===========================================================================
-- 1. Active safety rule set 2026-11-draft.2 (definition immutable once inserted)
-- ===========================================================================
update public.safety_rulesets set is_active = false where is_active;

insert into public.safety_rulesets (version, status, is_active, definition)
values ('2026-11-draft.2', 'draft', true, $ruleset${"version":"2026-11-draft.2","status_note":"Approved for development on 7 Nov 2026 (P-01). Pending clinical approval and an MHRA medical-device scope assessment. Not approved for public launch.","answer_options":["yes","no","unsure"],"unsure_policy":{"emergency":"escalate","urgent":"escalate","routine":"flag_incomplete"},"questions":[{"id":"Q1","pathway":"emergency","text":"Are you currently experiencing any of the following: chest pain suggesting a heart attack, severe difficulty breathing, signs of a stroke, collapse, severe bleeding, a severe allergic reaction, or immediate danger of serious self-harm?"},{"id":"Q2","pathway":"urgent","text":"Have you recently taken more medicine than prescribed, taken the wrong medicine, or made a medication mistake that you think could be dangerous?"},{"id":"Q3","pathway":"urgent","text":"Are you requesting this review because of a new or worsening medicine-related problem or symptom that you think may need urgent medical attention?"},{"id":"Q4","pathway":"urgent","text":"Have you run out of, missed, or been unable to obtain an essential medicine, and are you concerned this could cause harm before you can receive medical advice?"}]}$ruleset$::jsonb);

-- ===========================================================================
-- 2. Orders remember an earlier exclusion and a patient confirmation
-- ===========================================================================
alter table public.review_orders
  add column exclusion_label text check (exclusion_label in ('EMERGENCY_EXCLUDED', 'URGENT_EXCLUDED')),
  add column requires_prior_exclusion_review boolean not null default false,
  add column prior_concern_confirmed_at timestamptz;

create or replace function public.start_review_order()
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
  prior boolean;
begin
  if not app.intake_open() then
    raise exception 'intake is closed until the live service is approved' using errcode = 'check_violation';
  end if;
  select * into prof from public.profiles where id = uid;
  if prof.given_name is null or prof.family_name is null or prof.date_of_birth is null then
    raise exception 'complete your profile before starting a review' using errcode = 'check_violation';
  end if;
  -- An open request, including an urgent hold, is resumed. An emergency
  -- exclusion stays closed; the patient may start a new request.
  select id into existing from public.review_orders
    where patient_id = uid and status in ('draft', 'intake', 'questionnaire_submitted', 'safety_urgent_hold')
    order by created_at desc limit 1;
  if existing is not null then
    return existing;
  end if;
  select exists (
    select 1 from public.safety_screenings s
    where s.patient_id = uid and s.outcome in ('emergency', 'urgent')
  ) into prior;
  insert into public.review_orders (patient_id, requires_prior_exclusion_review)
  values (uid, prior) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.confirm_prior_safety_concern(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders := app.own_order(p_order_id);
begin
  if not o.requires_prior_exclusion_review then
    return;
  end if;
  if o.status <> 'draft' then
    raise exception 'this review has already been screened' using errcode = 'check_violation';
  end if;
  update public.review_orders set prior_concern_confirmed_at = coalesce(prior_concern_confirmed_at, now())
    where id = o.id;
  perform app.write_audit('safety.prior_concern_confirmed', 'review_order', o.id::text,
    jsonb_build_object('patient_id', o.patient_id));
end;
$$;

create or replace function public.submit_safety_screening(p_order_id uuid, p_answers jsonb)
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
  label text;
begin
  if not app.intake_open() then
    raise exception 'intake is closed until the live service is approved' using errcode = 'check_violation';
  end if;
  if o.status <> 'draft' then
    raise exception 'this review has already been screened' using errcode = 'check_violation';
  end if;
  if o.requires_prior_exclusion_review and o.prior_concern_confirmed_at is null then
    raise exception 'confirm that the earlier concern has been assessed or is no longer present'
      using errcode = 'check_violation';
  end if;
  select * into rs from public.safety_rulesets where is_active;
  if not found then
    raise exception 'no active safety rule set' using errcode = 'check_violation';
  end if;

  result := app.evaluate_screening(rs.definition, p_answers);
  outcome := result ->> 'outcome';
  select coalesce(array_agg(f), '{}') into flags from jsonb_array_elements_text(result -> 'flags') f;
  label := case outcome when 'emergency' then 'EMERGENCY_EXCLUDED' when 'urgent' then 'URGENT_EXCLUDED' else null end;

  insert into public.safety_screenings (order_id, patient_id, ruleset_version, answers, outcome, matched_rule_ids, flags)
  values (o.id, o.patient_id, rs.version, p_answers, outcome,
          (select coalesce(array_agg(m), '{}') from jsonb_array_elements_text(result -> 'matched_rule_ids') m), flags)
  returning id into screening_id;

  update public.review_orders set
    status = case outcome when 'emergency' then 'safety_emergency_excluded'::public.order_status
                          when 'urgent' then 'safety_urgent_hold'::public.order_status
                          else 'intake'::public.order_status end,
    exclusion_label = label,
    suitability_review_required = suitability_review_required or (outcome = 'routine' and cardinality(flags) > 0)
  where id = o.id;

  return result || jsonb_build_object(
    'screening_id', screening_id,
    'ruleset_version', rs.version,
    'exclusion_label', label
  );
end;
$$;

-- A later routine booking is refused until a pharmacist has reviewed the
-- earlier exclusion. Repeating the questionnaire does not clear it.
create or replace function app.block_booking_pending_prior_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'consultation_booked' and old.status is distinct from new.status
     and new.requires_prior_exclusion_review
     and not exists (
       select 1 from public.suitability_assessments a
       where a.order_id = new.id and a.kind = 'prior_exclusion_review' and a.outcome = 'suitable'
     ) then
    raise exception 'order: a pharmacist must review the earlier safety exclusion before booking'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger review_orders_prior_exclusion_review
  before update on public.review_orders
  for each row execute function app.block_booking_pending_prior_review();

alter table public.suitability_assessments drop constraint suitability_assessments_kind_check;
alter table public.suitability_assessments add constraint suitability_assessments_kind_check
  check (kind in ('urgent_reassessment', 'complexity_review', 'prior_exclusion_review'));

-- Positive and uncertain triggers stay visible to the patient and to clinicians.
create function public.patient_safety_history(p_patient_id uuid)
returns table (
  order_id uuid,
  outcome text,
  matched_rule_ids text[],
  ruleset_version text,
  recorded_at timestamptz,
  exclusion_label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.order_id, s.outcome, s.matched_rule_ids, s.ruleset_version, s.created_at, o.exclusion_label
  from public.safety_screenings s
  join public.review_orders o on o.id = s.order_id
  where s.patient_id = p_patient_id
    and s.outcome in ('emergency', 'urgent')
    and (s.patient_id = (select auth.uid()) or app.is_verified_clinician());
$$;

-- ===========================================================================
-- 3. High-risk medicines: categories, effective dates, change history
-- ===========================================================================
alter table public.high_risk_medicine_terms
  add column effective_from date not null default current_date,
  add column effective_to date,
  add column approved_by uuid references auth.users (id) on delete restrict,
  add column approved_at timestamptz;

insert into public.high_risk_medicine_terms (term, category, status) values
  ('heparin', 'anticoagulant', 'draft'),
  ('aspirin', 'antiplatelet', 'draft'),
  ('clopidogrel', 'antiplatelet', 'draft'),
  ('ticagrelor', 'antiplatelet', 'draft'),
  ('prasugrel', 'antiplatelet', 'draft'),
  ('gliclazide', 'sulfonylurea', 'draft'),
  ('glimepiride', 'sulfonylurea', 'draft'),
  ('methadone', 'opioid', 'draft'),
  ('buprenorphine', 'opioid', 'draft'),
  ('lamotrigine', 'antiepileptic', 'draft'),
  ('azathioprine', 'immunosuppressant', 'draft'),
  ('mycophenolate', 'immunosuppressant', 'draft'),
  ('furosemide', 'diuretic', 'draft'),
  ('bumetanide', 'diuretic', 'draft'),
  ('spironolactone', 'diuretic', 'draft'),
  ('ramipril', 'raas', 'draft'),
  ('lisinopril', 'raas', 'draft'),
  ('losartan', 'raas', 'draft'),
  ('candesartan', 'raas', 'draft'),
  ('ibuprofen', 'nsaid', 'draft'),
  ('naproxen', 'nsaid', 'draft'),
  ('diclofenac', 'nsaid', 'draft'),
  ('diazepam', 'sedative', 'draft'),
  ('lorazepam', 'sedative', 'draft'),
  ('zopiclone', 'sedative', 'draft'),
  ('zolpidem', 'sedative', 'draft'),
  ('gabapentin', 'gabapentinoid', 'draft'),
  ('pregabalin', 'gabapentinoid', 'draft')
on conflict (term) do nothing;

create table public.high_risk_medicine_changes (
  id bigint generated always as identity primary key,
  term text not null,
  category text,
  change text not null check (change in ('added', 'retired', 'approved', 'updated')),
  recorded_by uuid,
  recorded_at timestamptz not null default now()
);
create trigger high_risk_medicine_changes_append_only
  before update or delete on public.high_risk_medicine_changes
  for each row execute function app.reject_mutation();

create function app.record_high_risk_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.high_risk_medicine_changes (term, category, change, recorded_by)
    values (new.term, new.category, 'added', (select auth.uid()));
  elsif new.effective_to is distinct from old.effective_to and new.effective_to is not null then
    insert into public.high_risk_medicine_changes (term, category, change, recorded_by)
    values (new.term, new.category, 'retired', (select auth.uid()));
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.high_risk_medicine_changes (term, category, change, recorded_by)
    values (new.term, new.category, 'approved', (select auth.uid()));
  else
    insert into public.high_risk_medicine_changes (term, category, change, recorded_by)
    values (new.term, new.category, 'updated', (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger high_risk_medicine_terms_history
  after insert or update on public.high_risk_medicine_terms
  for each row execute function app.record_high_risk_change();

-- History for the rows already inserted above (the trigger did not exist yet).
insert into public.high_risk_medicine_changes (term, category, change)
select term, category, 'added' from public.high_risk_medicine_terms;

create function public.add_high_risk_term(p_term text, p_category text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalised text := lower(btrim(p_term));
begin
  if not app.is_verified_clinician() then
    raise exception 'verified clinician with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if normalised !~ '^[a-z][a-z -]{2,58}$' then
    raise exception 'medicine term must be 3 to 60 letters' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.high_risk_medicine_terms (term, category, status, effective_from)
  values (normalised, btrim(p_category), 'draft', current_date);
end;
$$;

create or replace function public.submit_questionnaire(p_order_id uuid)
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

  if jsonb_array_length(d.medications) >= 10 then attention := array_append(attention, 'polypharmacy'); end if;
  -- A name match is a pharmacist flag. It does not exclude the patient and it
  -- is not advice to stop or change a medicine. The list is still DRAFT.
  if exists (
    select 1 from jsonb_array_elements(d.medications) m, public.high_risk_medicine_terms t
    where (t.effective_to is null or t.effective_to >= current_date)
      and lower(m ->> 'name') like '%' || t.term || '%'
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

-- ===========================================================================
-- 4. Staff authenticator recovery. Email or SMS alone cannot do this.
--    A person cannot recover their own authenticator. One administrator
--    recovering the only other administrator is recorded; a single-administrator
--    business uses the offline procedure in docs/SECURITY_MODEL.md.
-- ===========================================================================
create table public.mfa_recovery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  verification_method text not null check (verification_method in (
    'in_person', 'video_with_known_staff', 'hardware_security_key', 'offline_recovery_code_checked'
  )),
  outcome text not null check (outcome in ('factors_revoked', 'refused')),
  approved_by uuid not null references auth.users (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint no_self_recovery check (approved_by <> user_id)
);
create trigger mfa_recovery_events_append_only
  before update or delete on public.mfa_recovery_events
  for each row execute function app.reject_mutation();

create function public.recover_staff_mfa(p_user_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if not app.is_verified_admin() then
    raise exception 'verified administrator with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if actor is null or actor = p_user_id then
    raise exception 'you cannot recover your own authenticator' using errcode = 'check_violation';
  end if;
  if p_method not in ('in_person', 'video_with_known_staff', 'hardware_security_key', 'offline_recovery_code_checked') then
    raise exception 'email or SMS alone cannot reset an authenticator' using errcode = 'invalid_parameter_value';
  end if;
  delete from auth.mfa_factors where user_id = p_user_id;
  insert into public.mfa_recovery_events (user_id, verification_method, outcome, approved_by)
  values (p_user_id, p_method, 'factors_revoked', actor);
  perform app.write_audit('staff.mfa_recovered', 'user', p_user_id::text,
    jsonb_build_object('method', p_method, 'approved_by', actor));
end;
$$;

create function public.launch_readiness()
returns table (gate public.launch_gate, decision text, evidence_reference text, recorded_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.gate,
    coalesce((select s.decision from public.launch_signoffs s where s.gate = g.gate order by s.id desc limit 1), 'outstanding'),
    (select s.evidence_reference from public.launch_signoffs s where s.gate = g.gate order by s.id desc limit 1),
    (select s.recorded_at from public.launch_signoffs s where s.gate = g.gate order by s.id desc limit 1)
  from unnest(enum_range(null::public.launch_gate)) as g(gate)
  where app.is_verified_admin();
$$;

-- ===========================================================================
-- 5. Grants and RLS for the new objects
-- ===========================================================================
alter table public.high_risk_medicine_changes enable row level security;
alter table public.mfa_recovery_events enable row level security;

create policy high_risk_changes_select_clinical on public.high_risk_medicine_changes
  for select to authenticated using ((select app.is_verified_clinician()));
create policy mfa_recovery_select_admin on public.mfa_recovery_events
  for select to authenticated using ((select app.is_verified_admin()));

revoke all on public.high_risk_medicine_changes, public.mfa_recovery_events from anon, authenticated;
grant select on public.high_risk_medicine_changes, public.mfa_recovery_events to authenticated;
grant all on public.high_risk_medicine_changes, public.mfa_recovery_events to service_role;

revoke all on function public.confirm_prior_safety_concern(uuid), public.patient_safety_history(uuid),
  public.add_high_risk_term(text, text), public.recover_staff_mfa(uuid, text), public.launch_readiness()
  from public, anon;
grant execute on function public.confirm_prior_safety_concern(uuid), public.patient_safety_history(uuid),
  public.add_high_risk_term(text, text), public.recover_staff_mfa(uuid, text), public.launch_readiness()
  to authenticated;
grant execute on function public.confirm_prior_safety_concern(uuid), public.patient_safety_history(uuid),
  public.add_high_risk_term(text, text), public.recover_staff_mfa(uuid, text), public.launch_readiness()
  to service_role;
