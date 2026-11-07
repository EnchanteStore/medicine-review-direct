-- Phase 4 clinical workspace.
-- Release still cannot be authorised by a questionnaire, a payment, a booking,
-- an administrator, a feature flag or PDF generation. A succeeded payment is
-- necessary as well as the section 8 gate: without one, release is blocked.
-- A GP letter is kept on the clinical file. It is not emailed and there is no
-- NHS connection. Messaging is append-only apart from a read timestamp.

alter table public.consents
  add column order_id uuid references public.review_orders (id) on delete restrict;
create index consents_order_idx on public.consents (order_id, consent_type, recorded_at desc);

create or replace function app.audit_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.write_audit('consent.recorded', 'consent', new.id::text,
    jsonb_build_object('user_id', new.user_id, 'type', new.consent_type,
      'version', new.document_version, 'granted', new.granted, 'source', new.source,
      'order_id', new.order_id));
  return null;
end;
$$;

-- -------------------------------------------------------------------------
-- Wording guard. Recommendations are for the prescriber, not instructions
-- the patient should carry out alone. DRAFT pending clinical approval.
-- -------------------------------------------------------------------------
create function app.assert_no_direct_medicine_change(p_text text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_text ~* '\mstop taking\M'
    or p_text ~* '\mstop your medicine\M'
    or p_text ~* '\mdo not take\M'
    or p_text ~* '\mdon''t take\M'
    or p_text ~* '\mdo not start\M'
    or p_text ~* '\mstart taking\M'
    or p_text ~* '\mchange your dose\M'
    or p_text ~* '\mincrease your dose\M'
    or p_text ~* '\mdecrease your dose\M'
    or p_text ~* '\mdouble your dose\M'
    or p_text ~* '\mhalve your dose\M'
    or p_text ~* '\myou should stop\M'
    or p_text ~* '\myou must stop\M'
    or p_text ~* '\myou need to stop\M'
    or p_text ~* '\myou should start\M'
    or p_text ~* '\myou must start\M'
  then
    raise exception 'wording tells the patient to start, stop or change a medicine on their own'
      using errcode = 'check_violation';
  end if;
end;
$$;

create function app.assert_text_list(p_value jsonb, p_label text, p_min integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  line text;
  n integer;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' then
    raise exception '% must be a list', p_label using errcode = 'check_violation';
  end if;
  n := jsonb_array_length(p_value);
  if n < p_min or n > 20 then
    raise exception '% needs between % and 20 items', p_label, p_min using errcode = 'check_violation';
  end if;
  for line in select btrim(jsonb_array_elements_text(p_value))
  loop
    if char_length(line) not between 1 and 1000 then
      raise exception '% items must be between 1 and 1000 characters', p_label using errcode = 'check_violation';
    end if;
    perform app.assert_no_direct_medicine_change(line);
  end loop;
end;
$$;

create function app.assert_report_content(p_content jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  issue jsonb;
  medicine text;
  description text;
begin
  if p_content is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'report content is incomplete' using errcode = 'check_violation';
  end if;
  if coalesce(char_length(btrim(p_content ->> 'findings')), 0) not between 1 and 4000 then
    raise exception 'key findings are required' using errcode = 'check_violation';
  end if;
  perform app.assert_no_direct_medicine_change(p_content ->> 'findings');
  if jsonb_typeof(p_content -> 'medicationIssues') <> 'array'
     or jsonb_array_length(p_content -> 'medicationIssues') not between 1 and 20 then
    raise exception 'at least one medication-related issue is required' using errcode = 'check_violation';
  end if;
  for issue in select jsonb_array_elements(p_content -> 'medicationIssues')
  loop
    medicine := btrim(issue ->> 'medicine');
    description := btrim(issue ->> 'issue');
    if coalesce(char_length(medicine), 0) not between 1 and 200
       or coalesce(char_length(description), 0) not between 1 and 1000 then
      raise exception 'each medication-related issue needs a medicine and a description'
        using errcode = 'check_violation';
    end if;
    perform app.assert_no_direct_medicine_change(medicine);
    perform app.assert_no_direct_medicine_change(description);
  end loop;
  perform app.assert_text_list(p_content -> 'recommendations', 'recommendations', 1);
  perform app.assert_text_list(p_content -> 'monitoring', 'monitoring', 1);
  perform app.assert_text_list(p_content -> 'gpDiscussionPoints', 'points to discuss with the GP', 1);
  if coalesce(char_length(btrim(p_content ->> 'safetyAdvice')), 0) not between 1 and 2000 then
    raise exception 'safety advice is required' using errcode = 'check_violation';
  end if;
  if coalesce(char_length(btrim(p_content ->> 'limitations')), 0) not between 1 and 2000 then
    raise exception 'limitations are required' using errcode = 'check_violation';
  end if;
  perform app.assert_no_direct_medicine_change(p_content ->> 'safetyAdvice');
  perform app.assert_no_direct_medicine_change(p_content ->> 'limitations');
end;
$$;

-- -------------------------------------------------------------------------
-- Release gate: an unpaid or refunded review cannot be released.
-- Payment is still not enough on its own. Section 8 remains the authority.
-- -------------------------------------------------------------------------
create or replace function app.report_gate_blockers(p_report public.reports, p_for_release boolean)
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
  if not exists (
    select 1 from public.questionnaire_submissions q
    where q.order_id = o.id and q.status = 'submitted'
  ) then
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
  if coalesce(btrim(p_report.content ->> 'findings'), '') = '' then
    blockers := array_append(blockers, 'report_content_incomplete');
  elsif jsonb_typeof(p_report.content -> 'medicationIssues') is distinct from 'array' then
    blockers := array_append(blockers, 'report_content_incomplete');
  elsif jsonb_array_length(p_report.content -> 'medicationIssues') < 1 then
    blockers := array_append(blockers, 'report_content_incomplete');
  elsif jsonb_typeof(p_report.content -> 'recommendations') is distinct from 'array' then
    blockers := array_append(blockers, 'report_content_incomplete');
  elsif jsonb_array_length(p_report.content -> 'recommendations') < 1 then
    blockers := array_append(blockers, 'report_content_incomplete');
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
    if not exists (
      select 1 from public.payments pay
      where pay.order_id = o.id and pay.status = 'succeeded'
    ) then
      blockers := array_append(blockers, 'order_not_paid');
    end if;
  end if;
  return blockers;
end;
$$;

alter table public.reports
  add column pdf_storage_path text
  check (pdf_storage_path is null or char_length(pdf_storage_path) between 1 and 300);

-- A completed two-way consultation is what moves a booked review into clinical review.
create or replace function public.pharmacist_record_consultation(
  p_order_id uuid, p_method text, p_occurred_at timestamptz, p_two_way_completed boolean, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_id uuid;
begin
  if not app.is_assigned_verified_pharmacist(p_order_id, actor) then
    raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.consultations (order_id, pharmacist_id, method, occurred_at, two_way_completed, clinical_notes)
  values (p_order_id, actor, p_method, p_occurred_at, p_two_way_completed, p_notes)
  returning id into new_id;
  update public.review_orders
    set last_clinical_contact_at = greatest(coalesce(last_clinical_contact_at, p_occurred_at), p_occurred_at),
        status = case
          when p_two_way_completed and status = 'consultation_booked' then 'in_review'::public.order_status
          else status
        end
  where id = p_order_id;
  return new_id;
end;
$$;

create function public.pharmacist_save_report_content(p_report_id uuid, p_content jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  r public.reports;
begin
  select * into r from public.reports where id = p_report_id for update;
  if not found then raise exception 'report not found' using errcode = 'no_data_found'; end if;
  if not app.is_assigned_verified_pharmacist(r.order_id, actor) then
    raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if r.status <> 'draft' then
    raise exception 'report content can only change in draft' using errcode = 'check_violation';
  end if;
  perform app.assert_report_content(p_content);
  update public.reports set content = p_content where id = r.id;
end;
$$;

-- Generation only. This function cannot approve or release.
create function public.pharmacist_set_generation_status(p_report_id uuid, p_status text, p_pdf_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  r public.reports;
begin
  if p_status not in ('generating', 'generation_failed', 'ready_for_release') then
    raise exception 'that status is not a generation step' using errcode = 'check_violation';
  end if;
  select * into r from public.reports where id = p_report_id for update;
  if not found then raise exception 'report not found' using errcode = 'no_data_found'; end if;
  if not app.is_assigned_verified_pharmacist(r.order_id, actor) then
    raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if p_status = 'ready_for_release' and coalesce(btrim(p_pdf_path), '') = '' then
    raise exception 'a generated file is required before the report can be ready for release'
      using errcode = 'check_violation';
  end if;
  update public.reports
    set status = p_status::public.report_status,
        pdf_storage_path = case
          when p_status = 'ready_for_release' then btrim(p_pdf_path)
          when p_status = 'generation_failed' then null
          else pdf_storage_path
        end
  where id = r.id;
end;
$$;

-- -------------------------------------------------------------------------
-- Messages. Append-only except the first read timestamp. No attachments.
-- -------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  sender_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (read_at is null or read_at >= created_at)
);
create index messages_order_idx on public.messages (order_id, created_at);
comment on table public.messages is
  'Messages on one review. The body is never copied into email. Not an emergency channel.';

create function app.enforce_message_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'DELETE' then
    raise exception 'messages are append-only; DELETE is not permitted' using errcode = 'insufficient_privilege';
  end if;
  if new.id is distinct from old.id
     or new.order_id is distinct from old.order_id
     or new.sender_id is distinct from old.sender_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at
     or old.read_at is not null
     or new.read_at is null
  then
    raise exception 'messages are append-only' using errcode = 'insufficient_privilege';
  end if;
  if actor is not distinct from old.sender_id then
    raise exception 'the sender cannot mark their own message read' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.review_orders o
    where o.id = old.order_id
      and (o.patient_id = actor or app.can_view_order_clinically(o.id))
  ) then
    raise exception 'you cannot mark this message read' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger messages_append_only before update or delete on public.messages
  for each row execute function app.enforce_message_append_only();

create function public.send_review_message(p_order_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  o public.review_orders;
  new_id uuid;
begin
  if actor is null then
    raise exception 'sign in required' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(char_length(btrim(p_body)), 0) not between 1 and 2000 then
    raise exception 'write a message of up to 2000 characters' using errcode = 'check_violation';
  end if;
  select * into o from public.review_orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'no_data_found'; end if;
  if o.patient_id is distinct from actor and not app.is_assigned_verified_pharmacist(o.id, actor) then
    raise exception 'only the patient and the assigned pharmacist can send a message'
      using errcode = 'insufficient_privilege';
  end if;
  if o.status in ('draft', 'safety_emergency_excluded', 'cancelled', 'refunded') then
    raise exception 'messages are closed for this review' using errcode = 'check_violation';
  end if;
  insert into public.messages (order_id, sender_id, body)
  values (o.id, actor, btrim(p_body))
  returning id into new_id;
  perform app.write_audit('message.sent', 'message', new_id::text, jsonb_build_object('order_id', o.id));
  return new_id;
end;
$$;

create function public.mark_review_messages_read(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  o public.review_orders;
begin
  select * into o from public.review_orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'no_data_found'; end if;
  if o.patient_id is distinct from actor and not app.can_view_order_clinically(o.id) then
    raise exception 'you cannot read messages on this review' using errcode = 'insufficient_privilege';
  end if;
  update public.messages
    set read_at = now()
  where order_id = o.id and sender_id is distinct from actor and read_at is null;
end;
$$;

-- -------------------------------------------------------------------------
-- GP letter. Case-specific consent and a verified practice name before
-- approval. Dispatch records that nothing was transmitted.
-- -------------------------------------------------------------------------
create table public.gp_letters (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.review_orders (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'approved', 'dispatched')),
  concern text not null check (char_length(btrim(concern)) between 1 and 4000),
  findings text not null check (char_length(btrim(findings)) between 1 and 4000),
  discussion_points text not null check (char_length(btrim(discussion_points)) between 1 and 4000),
  recipient_name text check (recipient_name is null or (
    char_length(btrim(recipient_name)) between 2 and 200 and recipient_name !~ '@'
  )),
  recipient_practice text check (recipient_practice is null or (
    char_length(btrim(recipient_practice)) between 2 and 200 and recipient_practice !~ '@'
  )),
  verification_note text check (verification_note is null or (
    char_length(btrim(verification_note)) between 10 and 500 and verification_note !~ '@'
  )),
  recipient_verified_by uuid references auth.users (id) on delete restrict,
  recipient_verified_at timestamptz,
  consent_id uuid references public.consents (id) on delete restrict,
  approved_by uuid references auth.users (id) on delete restrict,
  approved_at timestamptz,
  dispatched_at timestamptz,
  dispatch_evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gp_letters_set_updated_at before update on public.gp_letters
  for each row execute function app.set_updated_at();
comment on table public.gp_letters is
  'Structured letter for the GP. Not emailed. No NHS integration. Drafts are hidden from the patient.';

create function app.order_gp_consent_id(p_order_id uuid, p_patient uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.granted then c.id end
  from public.consents c
  where c.user_id = p_patient
    and c.order_id = p_order_id
    and c.consent_type = 'gp_letter_sharing'
  order by c.recorded_at desc, c.id desc
  limit 1;
$$;

create function app.enforce_gp_letter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  o public.review_orders;
  consent uuid;
begin
  if tg_op = 'DELETE' then
    raise exception 'GP letters cannot be deleted' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'a GP letter starts as a draft' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.status = 'dispatched' then
    raise exception 'a dispatched GP letter is immutable' using errcode = 'insufficient_privilege';
  end if;
  perform app.assert_no_direct_medicine_change(new.concern);
  perform app.assert_no_direct_medicine_change(new.findings);
  perform app.assert_no_direct_medicine_change(new.discussion_points);
  if old.status <> 'draft' and (
    new.concern is distinct from old.concern
    or new.findings is distinct from old.findings
    or new.discussion_points is distinct from old.discussion_points
  ) then
    raise exception 'GP letter wording can only change in draft' using errcode = 'check_violation';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'approved' then
      select * into o from public.review_orders where id = new.order_id;
      if not app.is_assigned_verified_pharmacist(new.order_id, actor) then
        raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
      end if;
      if new.recipient_verified_at is null
         or new.recipient_verified_by is distinct from actor
         or new.recipient_name is null
         or new.recipient_practice is null
         or new.verification_note is null
      then
        raise exception 'the GP practice must be recorded and checked before the letter is approved'
          using errcode = 'check_violation';
      end if;
      consent := app.order_gp_consent_id(new.order_id, o.patient_id);
      if consent is null then
        raise exception 'case-specific consent is required before the GP letter is approved'
          using errcode = 'check_violation';
      end if;
      new.consent_id := consent;
      new.approved_by := actor;
      new.approved_at := now();
    elsif old.status = 'approved' and new.status = 'dispatched' then
      if not app.is_assigned_verified_pharmacist(new.order_id, actor) then
        raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
      end if;
      new.dispatched_at := now();
      new.dispatch_evidence :=
        'Recorded in the clinical file. Not transmitted to an external address. No NHS connection is configured.';
    else
      raise exception 'that GP letter status change is not allowed' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger gp_letters_enforce before insert or update or delete on public.gp_letters
  for each row execute function app.enforce_gp_letter();

create function app.audit_gp_letter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status = 'approved' then
    perform app.write_audit('gp_letter.approved', 'gp_letter', new.id::text,
      jsonb_build_object('order_id', new.order_id, 'pharmacist_id', new.approved_by));
  elsif new.status is distinct from old.status and new.status = 'dispatched' then
    perform app.write_audit('gp_letter.dispatch_recorded', 'gp_letter', new.id::text,
      jsonb_build_object('order_id', new.order_id, 'transmitted', false));
  end if;
  return null;
end;
$$;

create trigger gp_letters_audit after update on public.gp_letters
  for each row execute function app.audit_gp_letter();

create function public.record_gp_letter_consent(p_order_id uuid, p_granted boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  new_id uuid;
begin
  if not exists (
    select 1 from public.review_orders o where o.id = p_order_id and o.patient_id = actor
  ) then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;
  insert into public.consents (user_id, consent_type, document_version, granted, source, order_id)
  values (actor, 'gp_letter_sharing', 'draft-2026-11', p_granted, 'account_settings', p_order_id)
  returning id into new_id;
  return new_id;
end;
$$;

create function public.save_gp_letter(
  p_order_id uuid, p_concern text, p_findings text, p_discussion text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing public.gp_letters;
  new_id uuid;
begin
  if not app.is_assigned_verified_pharmacist(p_order_id, actor) then
    raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(char_length(btrim(p_concern)), 0) not between 1 and 4000
     or coalesce(char_length(btrim(p_findings)), 0) not between 1 and 4000
     or coalesce(char_length(btrim(p_discussion)), 0) not between 1 and 4000
  then
    raise exception 'the GP letter needs a concern, findings and points to discuss'
      using errcode = 'check_violation';
  end if;
  perform app.assert_no_direct_medicine_change(p_concern);
  perform app.assert_no_direct_medicine_change(p_findings);
  perform app.assert_no_direct_medicine_change(p_discussion);
  select * into existing from public.gp_letters where order_id = p_order_id for update;
  if found then
    if existing.status <> 'draft' then
      raise exception 'GP letter wording can only change in draft' using errcode = 'check_violation';
    end if;
    update public.gp_letters
      set concern = btrim(p_concern), findings = btrim(p_findings), discussion_points = btrim(p_discussion)
    where id = existing.id
    returning id into new_id;
    return new_id;
  end if;
  insert into public.gp_letters (order_id, concern, findings, discussion_points)
  values (p_order_id, btrim(p_concern), btrim(p_findings), btrim(p_discussion))
  returning id into new_id;
  return new_id;
end;
$$;

create function public.verify_gp_recipient(
  p_letter_id uuid, p_name text, p_practice text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  letter public.gp_letters;
begin
  select * into letter from public.gp_letters where id = p_letter_id for update;
  if not found then raise exception 'GP letter not found' using errcode = 'no_data_found'; end if;
  if not app.is_assigned_verified_pharmacist(letter.order_id, actor) then
    raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if letter.status <> 'draft' then
    raise exception 'the recipient can only be recorded while the letter is a draft'
      using errcode = 'check_violation';
  end if;
  if coalesce(char_length(btrim(p_name)), 0) not between 2 and 200
     or coalesce(char_length(btrim(p_practice)), 0) not between 2 and 200
     or coalesce(char_length(btrim(p_note)), 0) not between 10 and 500
     or p_name ~ '@' or p_practice ~ '@' or p_note ~ '@'
  then
    raise exception 'record the practice name you checked with the patient, not an email address'
      using errcode = 'check_violation';
  end if;
  update public.gp_letters
    set recipient_name = btrim(p_name),
        recipient_practice = btrim(p_practice),
        verification_note = btrim(p_note),
        recipient_verified_by = actor,
        recipient_verified_at = now()
  where id = letter.id;
end;
$$;

create function public.approve_gp_letter(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gp_letters set status = 'approved' where id = p_letter_id;
  if not found then raise exception 'GP letter not found' using errcode = 'no_data_found'; end if;
end;
$$;

create function public.record_gp_letter_dispatch(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gp_letters set status = 'dispatched' where id = p_letter_id;
  if not found then raise exception 'GP letter not found' using errcode = 'no_data_found'; end if;
end;
$$;

-- -------------------------------------------------------------------------
-- Declined, urgent or emergency-excluded reviews can record a safety note
-- or a referral. That row is never a medication-review report.
-- -------------------------------------------------------------------------
create table public.safety_notices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  kind text not null check (kind in ('safety_notification', 'referral')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index safety_notices_order_idx on public.safety_notices (order_id, created_at);
create trigger safety_notices_append_only before update or delete on public.safety_notices
  for each row execute function app.reject_mutation();
comment on table public.safety_notices is
  'Safety notification or referral. Not a completed medication-review report.';

create function public.record_safety_notice(p_order_id uuid, p_kind text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  o public.review_orders;
  new_id uuid;
begin
  if not app.is_assigned_verified_pharmacist(p_order_id, actor) then
    raise exception 'assigned verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if p_kind not in ('safety_notification', 'referral') then
    raise exception 'choose a safety notification or a referral' using errcode = 'check_violation';
  end if;
  if coalesce(char_length(btrim(p_body)), 0) not between 1 and 4000 then
    raise exception 'write the safety note' using errcode = 'check_violation';
  end if;
  perform app.assert_no_direct_medicine_change(p_body);
  select * into o from public.review_orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'no_data_found'; end if;
  if o.status not in ('declined', 'safety_emergency_excluded', 'safety_urgent_hold') then
    raise exception 'a safety note is only for a declined, urgent or emergency-excluded review'
      using errcode = 'check_violation';
  end if;
  insert into public.safety_notices (order_id, kind, body, created_by)
  values (o.id, p_kind, btrim(p_body), actor)
  returning id into new_id;
  perform app.write_audit('safety_notice.recorded', 'safety_notice', new_id::text,
    jsonb_build_object('order_id', o.id, 'kind', p_kind));
  return new_id;
end;
$$;

-- -------------------------------------------------------------------------
-- Who can see what. Ops admins stay out of clinical tables.
-- An assigned pharmacist can see the patient's name and whether the review
-- is paid. Unscanned documents stay hidden.
-- -------------------------------------------------------------------------
-- The patient can read the consultation record only after the report is released.
create policy consultations_select_released on public.consultations
  for select to authenticated using (
    exists (
      select 1 from public.reports r
      join public.review_orders o on o.id = r.order_id
      where r.order_id = consultations.order_id
        and r.status = 'released'
        and o.patient_id = (select auth.uid())
    )
  );

create policy profiles_select_assigned_pharmacist on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.review_orders o
      where o.patient_id = profiles.id
        and app.is_assigned_verified_pharmacist(o.id, (select auth.uid()))
    )
  );

create policy payments_select_assigned_pharmacist on public.payments
  for select to authenticated using (
    app.is_assigned_verified_pharmacist(order_id, (select auth.uid()))
  );
create policy payments_select_clinical_admin on public.payments
  for select to authenticated using ((select app.has_verified_role('clinical_admin')));

create policy appointments_select_assigned on public.appointments
  for select to authenticated using (
    app.is_assigned_verified_pharmacist(order_id, (select auth.uid()))
    or (select app.has_verified_role('clinical_admin'))
  );

alter table public.messages enable row level security;
alter table public.gp_letters enable row level security;
alter table public.safety_notices enable row level security;

create policy messages_select_participant on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.review_orders o
      where o.id = order_id
        and (o.patient_id = (select auth.uid()) or app.can_view_order_clinically(o.id))
    )
  );

create policy gp_letters_select_patient on public.gp_letters
  for select to authenticated using (
    status in ('approved', 'dispatched')
    and exists (
      select 1 from public.review_orders o
      where o.id = order_id and o.patient_id = (select auth.uid())
    )
  );
create policy gp_letters_select_clinical on public.gp_letters
  for select to authenticated using (app.can_view_order_clinically(order_id));

create policy safety_notices_select_own on public.safety_notices
  for select to authenticated using (
    exists (
      select 1 from public.review_orders o
      where o.id = order_id and o.patient_id = (select auth.uid())
    )
  );
create policy safety_notices_select_clinical on public.safety_notices
  for select to authenticated using (app.can_view_order_clinically(order_id));

revoke all on public.messages, public.gp_letters, public.safety_notices from anon, authenticated;
grant select on public.messages, public.gp_letters, public.safety_notices to authenticated;
grant all on public.messages, public.gp_letters, public.safety_notices to service_role;

revoke all on function
  public.pharmacist_save_report_content(uuid, jsonb),
  public.pharmacist_set_generation_status(uuid, text, text),
  public.send_review_message(uuid, text),
  public.mark_review_messages_read(uuid),
  public.record_gp_letter_consent(uuid, boolean),
  public.save_gp_letter(uuid, text, text, text),
  public.verify_gp_recipient(uuid, text, text, text),
  public.approve_gp_letter(uuid),
  public.record_gp_letter_dispatch(uuid),
  public.record_safety_notice(uuid, text, text)
  from public, anon;
grant execute on function
  public.pharmacist_save_report_content(uuid, jsonb),
  public.pharmacist_set_generation_status(uuid, text, text),
  public.send_review_message(uuid, text),
  public.mark_review_messages_read(uuid),
  public.record_gp_letter_consent(uuid, boolean),
  public.save_gp_letter(uuid, text, text, text),
  public.verify_gp_recipient(uuid, text, text, text),
  public.approve_gp_letter(uuid),
  public.record_gp_letter_dispatch(uuid),
  public.record_safety_notice(uuid, text, text)
  to authenticated;

revoke all on function
  app.assert_no_direct_medicine_change(text),
  app.assert_text_list(jsonb, text, integer),
  app.assert_report_content(jsonb),
  app.order_gp_consent_id(uuid, uuid),
  app.enforce_gp_letter(),
  app.audit_gp_letter(),
  app.enforce_message_append_only()
  from public, anon, authenticated;
grant execute on all functions in schema app to service_role;

do $storage$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; skipping clinical report bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('clinical-reports', 'clinical-reports', false, 10485760, array['application/pdf'])
  on conflict (id) do nothing;
end
$storage$;
