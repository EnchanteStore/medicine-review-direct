-- MedsInFocus: two-pharmacist handover, report corrections, and fail-closed scanning.
-- Does not rename earlier migrations, audit action names, or storage paths.

alter table public.staff_roles
  add column prescribing_enabled boolean not null default false,
  add column independent_prescriber_owner_confirmed boolean not null default false;

alter table public.staff_roles
  add constraint prescribing_stays_disabled check (prescribing_enabled = false);

alter table public.reports drop constraint reports_order_id_key;

alter table public.reports
  add column version_no integer not null default 1,
  add column supersedes_report_id uuid references public.reports (id) on delete restrict,
  add column correction_reason text,
  add column superseded_at timestamptz;

create unique index reports_one_released_per_order
  on public.reports (order_id) where status = 'released';
create unique index reports_one_open_per_order
  on public.reports (order_id) where status not in ('released', 'superseded');

create or replace function app.report_transition_allowed(p_from public.report_status, p_to public.report_status)
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
    when 'released' then p_to = 'superseded'
    else false
  end;
$$;

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
    if p_report.approved_by is distinct from (select auth.uid()) then
      blockers := array_append(blockers, 'approver_is_not_the_signed_in_pharmacist');
    end if;
    if o.status <> 'in_review' and not (o.status = 'report_released' and p_report.version_no > 1) then
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

create or replace function app.enforce_report_gate()
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
    if new.status = 'superseded'
       and current_setting('app.report_supersede', true) = 'on'
       and new.content is not distinct from old.content
       and new.approved_by is not distinct from old.approved_by
       and new.approver_display_name is not distinct from old.approver_display_name then
      return new;
    end if;
    raise exception 'released reports are immutable; issue a correction as a new version'
      using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'superseded' then
    raise exception 'superseded reports are immutable' using errcode = 'insufficient_privilege';
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
      if new.approver_display_name is null or new.approver_gphc_number is null then
        raise exception 'report approval requires the pharmacist''s own name and GPhC number' using errcode = 'check_violation';
      end if;
      new.approved_at := now();
    elsif new.status = 'draft' then
      new.approved_by := null; new.approved_at := null;
      new.approver_display_name := null; new.approver_gphc_number := null;
      new.adequacy_confirmed_by := null; new.adequacy_confirmed_at := null;
    elsif new.status = 'released' then
      if new.released_by is distinct from actor or not app.is_assigned_verified_pharmacist(new.order_id, actor) then
        raise exception 'report release requires an explicit action by the assigned verified pharmacist (MFA)'
          using errcode = 'insufficient_privilege';
      end if;
      if new.approved_by is distinct from actor then
        raise exception 'a pharmacist cannot approve or release a report as someone else' using errcode = 'insufficient_privilege';
      end if;
      blockers := app.report_gate_blockers(new, true);
      if cardinality(blockers) > 0 then
        raise exception 'report release blocked: %', array_to_string(blockers, ', ') using errcode = 'check_violation';
      end if;
      new.released_at := now();
      perform set_config('app.report_supersede', 'on', true);
      update public.reports
        set status = 'superseded', superseded_at = now()
        where order_id = new.order_id and id <> new.id and status = 'released';
      perform set_config('app.report_supersede', 'off', true);
    elsif new.status in ('generating', 'ready_for_release', 'generation_failed') then
      if old.approved_by is null then
        raise exception 'report has not been clinically approved' using errcode = 'check_violation';
      end if;
    end if;
  elsif new.approved_by is distinct from old.approved_by or new.released_by is distinct from old.released_by
        or new.approver_display_name is distinct from old.approver_display_name
        or new.approver_gphc_number is distinct from old.approver_gphc_number then
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

create or replace function app.after_report_change()
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
          'approved_by', new.approved_by, 'gphc_number', new.approver_gphc_number,
          'version_no', new.version_no));
      update public.review_orders set status = 'report_released'
        where id = new.order_id and status is distinct from 'report_released';
    elsif new.status = 'superseded' then
      perform app.write_audit('report.superseded', 'report', new.id::text,
        jsonb_build_object('order_id', new.order_id, 'version_no', new.version_no));
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

create or replace function public.book_appointment(p_order_id uuid, p_pharmacist_id uuid, p_starts timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders := app.own_order(p_order_id);
  method text := 'telephone';
  new_id uuid;
  chosen tstzrange;
  previous uuid;
begin
  if o.status <> 'paid' then
    raise exception 'choose a time after your payment is confirmed' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.bookable_slots(p_starts, p_starts + interval '1 second') s
    where s.pharmacist_id = p_pharmacist_id and s.starts_at = p_starts
  ) then
    raise exception 'that time is not available' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.staff_roles sr
    where sr.user_id = p_pharmacist_id and sr.role = 'pharmacist' and sr.verification_status = 'verified'
      and sr.prescribing_enabled = false
  ) then
    raise exception 'that pharmacist is not available' using errcode = 'check_violation';
  end if;
  select case q.answers ->> 'consultationMethod' when 'secure_video' then 'secure_video' else 'telephone' end
    into method
  from public.questionnaire_submissions q
  where q.order_id = o.id and q.status = 'submitted'
  order by q.version_no desc limit 1;
  chosen := tstzrange(p_starts, p_starts + interval '30 minutes', '[)');
  previous := o.assigned_pharmacist_id;
  insert into public.appointments (order_id, patient_id, pharmacist_id, slot, method, status)
  values (o.id, o.patient_id, p_pharmacist_id, chosen, coalesce(method, 'telephone'), 'booked')
  returning id into new_id;
  insert into public.appointment_events (appointment_id, event, slot) values (new_id, 'booked', chosen);
  update public.review_orders
    set status = 'consultation_booked', assigned_pharmacist_id = p_pharmacist_id
    where id = o.id;
  perform app.write_audit('appointment.booked', 'appointment', new_id::text,
    jsonb_build_object('order_id', o.id, 'method', coalesce(method, 'telephone'),
      'pharmacist_id', p_pharmacist_id, 'previous_pharmacist_id', previous));
  return new_id;
end;
$$;

create function public.handover_review(p_order_id uuid, p_pharmacist_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous uuid;
begin
  if not app.has_verified_role('clinical_admin') then
    raise exception 'verified clinical admin with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if p_reason not in ('patient_request', 'availability', 'clinical_cover') then
    raise exception 'handover needs a recorded reason' using errcode = 'check_violation';
  end if;
  select assigned_pharmacist_id into previous from public.review_orders where id = p_order_id;
  if not found then
    raise exception 'order not found' using errcode = 'no_data_found';
  end if;
  if previous is null then
    raise exception 'assign a pharmacist before handing the review over' using errcode = 'check_violation';
  end if;
  if previous = p_pharmacist_id then
    raise exception 'the review is already with that pharmacist' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.staff_roles
    where user_id = p_pharmacist_id and role = 'pharmacist' and verification_status = 'verified'
      and gphc_registration_number is not null and prescribing_enabled = false
  ) then
    raise exception 'the new pharmacist must be verified' using errcode = 'check_violation';
  end if;
  update public.review_orders set assigned_pharmacist_id = p_pharmacist_id where id = p_order_id;
  perform app.write_audit('review.handed_over', 'review_order', p_order_id::text,
    jsonb_build_object('from_pharmacist_id', previous, 'pharmacist_id', p_pharmacist_id, 'reason', p_reason));
end;
$$;

create function public.pharmacist_start_correction(p_report_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source public.reports;
  new_id uuid;
begin
  select * into source from public.reports where id = p_report_id;
  if not found then
    raise exception 'report not found' using errcode = 'no_data_found';
  end if;
  if source.status <> 'released' then
    raise exception 'only a released report can be corrected' using errcode = 'check_violation';
  end if;
  if not app.is_assigned_verified_pharmacist(source.order_id, (select auth.uid())) then
    raise exception 'only the assigned verified pharmacist can correct this report' using errcode = 'insufficient_privilege';
  end if;
  if char_length(btrim(p_reason)) < 10 or char_length(p_reason) > 500 then
    raise exception 'a correction needs a short reason' using errcode = 'check_violation';
  end if;
  perform app.assert_no_direct_medicine_change(p_reason);
  if exists (
    select 1 from public.reports
    where order_id = source.order_id and status not in ('released', 'superseded')
  ) then
    raise exception 'a correction is already in progress' using errcode = 'check_violation';
  end if;
  insert into public.reports (
    order_id, status, content, consultation_id, version_no, supersedes_report_id, correction_reason
  ) values (
    source.order_id, 'draft', source.content, source.consultation_id, source.version_no + 1, source.id, btrim(p_reason)
  ) returning id into new_id;
  perform app.write_audit('report.correction_started', 'report', new_id::text,
    jsonb_build_object('order_id', source.order_id, 'version_no', source.version_no + 1,
      'supersedes_report_id', source.id));
  return new_id;
end;
$$;

create or replace function public.register_document(p_order_id uuid, p_storage_path text, p_filename text, p_mime text, p_size integer)
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
  if not exists (
    select 1 from storage.objects
    where name = p_storage_path and bucket_id in ('document-quarantine', 'patient-documents')
  ) then
    raise exception 'uploaded file not found' using errcode = 'no_data_found';
  end if;
  insert into public.documents (order_id, patient_id, storage_path, original_filename, mime_type, size_bytes, scan_status, scan_engine)
  values (o.id, o.patient_id, p_storage_path, p_filename, p_mime, p_size, 'pending_scan', 'not_run')
  returning id into new_id;
  return new_id;
end;
$$;

create function app.enforce_scan_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scan_status = 'clean' and (
    new.scan_engine is distinct from 'clamav'
    or current_setting('app.malware_scan', true) is distinct from 'on'
  ) then
    raise exception 'a file can be marked clean only by ClamAV' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger documents_scan_gate before insert or update on public.documents
  for each row execute function app.enforce_scan_status();

create function public.record_malware_scan(p_document_id uuid, p_engine text, p_verdict text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  if not exists (select 1 from public.documents where id = p_document_id) then
    raise exception 'document not found' using errcode = 'no_data_found';
  end if;
  if p_engine = 'clamav' and p_verdict = 'clean' then
    perform set_config('app.malware_scan', 'on', true);
    update public.documents set scan_status = 'clean', scan_engine = 'clamav' where id = p_document_id;
    perform set_config('app.malware_scan', 'off', true);
    result := 'clean';
  else
    update public.documents
      set scan_status = 'rejected', scan_engine = coalesce(nullif(btrim(p_engine), ''), 'not_run')
      where id = p_document_id;
    result := 'rejected';
  end if;
  perform app.write_audit('document.scan_recorded', 'document', p_document_id::text,
    jsonb_build_object('engine', coalesce(nullif(btrim(p_engine), ''), 'not_run'), 'verdict', result));
  return result;
end;
$$;

create function public.bookable_slot_choices(p_from timestamptz, p_to timestamptz)
returns table (pharmacist_id uuid, display_name text, gphc_number text, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.pharmacist_id,
    nullif(btrim(concat_ws(' ', p.given_name, p.family_name)), ''),
    sr.gphc_registration_number,
    s.starts_at,
    s.ends_at
  from public.bookable_slots(p_from, p_to) s
  join public.staff_roles sr on sr.user_id = s.pharmacist_id and sr.role = 'pharmacist'
    and sr.verification_status = 'verified' and sr.prescribing_enabled = false
  join public.profiles p on p.id = s.pharmacist_id;
$$;

do $storage$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('document-quarantine', 'document-quarantine', false, 10485760,
          array['application/pdf', 'image/jpeg', 'image/png'])
  on conflict (id) do nothing;
  create policy document_quarantine_insert_own on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'document-quarantine'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and app.intake_open()
    );
end
$storage$;

revoke all on function public.record_malware_scan(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_malware_scan(uuid, text, text) to service_role;

create or replace function public.reschedule_appointment(p_appointment_id uuid, p_pharmacist_id uuid, p_starts timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap public.appointments;
  chosen tstzrange;
  uid uuid;
begin
  uid := app.require_user();
  select * into ap from public.appointments
    where id = p_appointment_id and patient_id = uid and status = 'booked'
    for update;
  if not found then raise exception 'appointment not found' using errcode = 'no_data_found'; end if;
  if ap.reschedule_count >= 2 then
    raise exception 'this appointment has already been moved twice' using errcode = 'check_violation';
  end if;
  if lower(ap.slot) < now() + interval '24 hours' then
    raise exception 'an appointment can only be moved more than 24 hours before it starts' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.bookable_slots(p_starts, p_starts + interval '1 second') s
    where s.pharmacist_id = p_pharmacist_id and s.starts_at = p_starts
  ) then
    raise exception 'that time is not available' using errcode = 'check_violation';
  end if;
  chosen := tstzrange(p_starts, p_starts + interval '30 minutes', '[)');
  update public.appointments
    set slot = chosen, pharmacist_id = p_pharmacist_id, reschedule_count = reschedule_count + 1
    where id = ap.id;
  update public.review_orders set assigned_pharmacist_id = p_pharmacist_id where id = ap.order_id;
  insert into public.appointment_events (appointment_id, event, slot) values (ap.id, 'rescheduled', chosen);
  perform app.write_audit('appointment.rescheduled', 'appointment', ap.id::text,
    jsonb_build_object('order_id', ap.order_id, 'pharmacist_id', p_pharmacist_id));
end;
$$;

grant execute on function public.handover_review(uuid, uuid, text),
  public.pharmacist_start_correction(uuid, text),
  public.bookable_slot_choices(timestamptz, timestamptz)
  to authenticated;
