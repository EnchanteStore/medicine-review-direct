-- Phase 3: test checkout, receipts, recorded refunds, and booking.
-- Live card payments stay closed until every launch sign-off is recorded.
-- Development may start a labelled test checkout. Clinical gates still apply:
-- an emergency or urgent exclusion cannot pay or book, and payment never
-- releases a report.

create extension if not exists btree_gist with schema extensions;

-- ===========================================================================
-- 1. Test checkout is allowed in development. Live payments are not.
-- ===========================================================================
create or replace function app.live_payments_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.live_service_enabled();
$$;

create or replace function app.payments_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.live_payments_open()
      or (select environment from public.app_settings) = 'development';
$$;

create or replace function public.service_status()
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
    'live_payments_open', app.live_payments_open(),
    'payments_mode', case
      when app.live_payments_open() then 'live'
      when app.payments_open() then 'test'
      else 'closed'
    end,
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

grant execute on function app.live_payments_open() to authenticated, service_role;

-- ===========================================================================
-- 2. Checkout sessions, payments, provider events, refunds, receipts
-- ===========================================================================
create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  patient_id uuid not null references auth.users (id) on delete restrict,
  product_code text not null references public.products (code),
  amount_pence integer not null check (amount_pence > 0),
  currency char(3) not null default 'GBP' check (currency = 'GBP'),
  -- local_test_harness is not Stripe. stripe_test is Stripe test mode only.
  provider text not null check (provider in ('local_test_harness', 'stripe_test')),
  status text not null default 'open' check (status in ('open', 'complete', 'expired')),
  created_at timestamptz not null default now()
);
create unique index checkout_one_open_per_order on public.checkout_sessions (order_id) where status = 'open';

create table public.provider_events (
  event_id text primary key check (char_length(event_id) between 8 and 200),
  event_type text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  patient_id uuid not null references auth.users (id) on delete restrict,
  checkout_session_id uuid references public.checkout_sessions (id) on delete restrict,
  amount_pence integer not null check (amount_pence > 0),
  currency char(3) not null default 'GBP' check (currency = 'GBP'),
  status text not null check (status in ('succeeded', 'refund_recorded')),
  source text not null check (source in ('provider_event', 'manual_audited')),
  provider_event_id text unique references public.provider_events (event_id),
  manual_reference text,
  receipt_number text not null unique,
  created_at timestamptz not null default now()
);
create unique index payments_one_success_per_order on public.payments (order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount_pence integer not null check (amount_pence > 0),
  status text not null default 'recorded' check (status = 'recorded'),
  reason text not null check (char_length(reason) between 1 and 200),
  recorded_by uuid not null references auth.users (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  -- Never a live Stripe refund id. This column stays null on purpose.
  provider_refund_id text
);
create trigger refunds_append_only before update or delete on public.refunds
  for each row execute function app.reject_mutation();

-- ===========================================================================
-- 3. Availability and appointments. No double-booking under concurrency.
-- ===========================================================================
create table public.pharmacist_availability (
  id uuid primary key default gen_random_uuid(),
  pharmacist_id uuid not null references auth.users (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '12 hours')
);
alter table public.pharmacist_availability add constraint availability_no_overlap
  exclude using gist (
    pharmacist_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  );

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.review_orders (id) on delete restrict,
  patient_id uuid not null references auth.users (id) on delete restrict,
  pharmacist_id uuid not null references auth.users (id) on delete restrict,
  slot tstzrange not null,
  starts_at timestamptz generated always as (lower(slot)) stored,
  method text not null check (method in ('telephone', 'secure_video')),
  status text not null check (status in ('booked', 'rescheduled', 'cancellation_requested', 'cancelled')),
  reschedule_count integer not null default 0 check (reschedule_count between 0 and 2),
  created_at timestamptz not null default now(),
  check (upper(slot) - lower(slot) = interval '30 minutes')
);
-- A rescheduled row is historical. Only a booked row holds the slot.
alter table public.appointments add constraint appointments_no_double_book
  exclude using gist (
    pharmacist_id with =,
    slot with &&
  ) where (status = 'booked');
create unique index appointments_one_booked_per_order on public.appointments (order_id) where status = 'booked';

create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id) on delete restrict,
  event text not null check (event in ('booked', 'rescheduled', 'cancellation_requested')),
  slot tstzrange not null,
  recorded_at timestamptz not null default now()
);
create trigger appointment_events_append_only before update or delete on public.appointment_events
  for each row execute function app.reject_mutation();

-- ===========================================================================
-- 4. Checkout and payment functions
-- ===========================================================================
create function public.begin_checkout(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders := app.own_order(p_order_id);
  product public.products;
  existing public.checkout_sessions;
  created public.checkout_sessions;
  provider text;
begin
  if o.status = 'awaiting_payment' then
    select * into existing from public.checkout_sessions
      where order_id = o.id and status = 'open' order by created_at desc limit 1;
    if found then
      return jsonb_build_object(
        'session_id', existing.id, 'amount_pence', existing.amount_pence,
        'currency', existing.currency, 'provider', existing.provider, 'product_code', existing.product_code
      );
    end if;
  elsif o.status <> 'questionnaire_submitted' then
    raise exception 'checkout is not available for this review' using errcode = 'check_violation';
  end if;
  if not app.payments_open() then
    raise exception 'payments are disabled until the live service is approved' using errcode = 'check_violation';
  end if;
  select * into product from public.products where code = o.product_code and is_active;
  if not found then
    raise exception 'this product is not available' using errcode = 'check_violation';
  end if;
  -- Live Stripe is refused here. A sk_test_ integration can set stripe_test later.
  provider := case when app.live_payments_open() then 'stripe_test' else 'local_test_harness' end;
  if provider = 'stripe_test' then
    raise exception 'live Stripe checkout is not enabled' using errcode = 'check_violation';
  end if;

  if o.status = 'questionnaire_submitted' then
    update public.review_orders set status = 'awaiting_payment' where id = o.id;
  end if;
  insert into public.checkout_sessions (order_id, patient_id, product_code, amount_pence, currency, provider)
  values (o.id, o.patient_id, product.code, product.price_pence, product.currency, provider)
  returning * into created;
  perform app.write_audit('payment.checkout_started', 'checkout_session', created.id::text,
    jsonb_build_object('order_id', o.id, 'amount_pence', created.amount_pence, 'provider', provider));
  return jsonb_build_object(
    'session_id', created.id, 'amount_pence', created.amount_pence,
    'currency', created.currency, 'provider', created.provider, 'product_code', created.product_code
  );
end;
$$;

-- Called only with the service role, after the webhook signature has been checked.
-- The amount is taken from the checkout row, and the payload amount must match.
create function public.apply_provider_event(
  p_event_id text,
  p_event_type text,
  p_session_id uuid,
  p_amount_pence integer,
  p_currency text,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session public.checkout_sessions;
  payment_id uuid;
  receipt text;
begin
  insert into public.provider_events (event_id, event_type, payload_hash)
  values (p_event_id, p_event_type, p_payload_hash)
  on conflict (event_id) do nothing;
  if not found then
    return jsonb_build_object('outcome', 'duplicate_event');
  end if;

  if p_event_type <> 'checkout.session.completed' then
    update public.provider_events set processed_at = now(), outcome = 'ignored' where event_id = p_event_id;
    return jsonb_build_object('outcome', 'ignored');
  end if;

  select * into session from public.checkout_sessions where id = p_session_id for update;
  if not found then
    update public.provider_events set processed_at = now(), outcome = 'unknown_session' where event_id = p_event_id;
    return jsonb_build_object('outcome', 'unknown_session');
  end if;
  if lower(p_currency) <> 'gbp' or p_amount_pence is distinct from session.amount_pence then
    update public.provider_events set processed_at = now(), outcome = 'amount_mismatch' where event_id = p_event_id;
    perform app.write_audit('payment.rejected', 'checkout_session', session.id::text,
      jsonb_build_object('order_id', session.order_id, 'reason', 'amount_mismatch'));
    return jsonb_build_object('outcome', 'amount_mismatch');
  end if;
  if exists (select 1 from public.payments where order_id = session.order_id) then
    update public.provider_events set processed_at = now(), outcome = 'already_fulfilled' where event_id = p_event_id;
    return jsonb_build_object('outcome', 'already_fulfilled');
  end if;

  receipt := 'R-' || to_char(now() at time zone 'Europe/London', 'YYYYMMDD') || '-' || substr(replace(session.id::text, '-', ''), 1, 8);
  insert into public.payments (
    order_id, patient_id, checkout_session_id, amount_pence, currency, status, source, provider_event_id, receipt_number
  ) values (
    session.order_id, session.patient_id, session.id, session.amount_pence, 'GBP', 'succeeded', 'provider_event', p_event_id, receipt
  ) returning id into payment_id;
  update public.checkout_sessions set status = 'complete' where id = session.id;
  update public.review_orders set status = 'paid' where id = session.order_id and status = 'awaiting_payment';
  update public.provider_events set processed_at = now(), outcome = 'fulfilled' where event_id = p_event_id;
  perform app.write_audit('payment.fulfilled', 'payment', payment_id::text,
    jsonb_build_object('order_id', session.order_id, 'amount_pence', session.amount_pence, 'source', 'provider_event'));
  return jsonb_build_object('outcome', 'fulfilled', 'payment_id', payment_id, 'receipt_number', receipt);
end;
$$;

create function public.record_manual_payment(p_order_id uuid, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.review_orders;
  product public.products;
  payment_id uuid;
  receipt text;
begin
  if not app.has_verified_role('ops_admin') then
    raise exception 'verified operations administrator with MFA required' using errcode = 'insufficient_privilege';
  end if;
  if p_reference !~ '^[A-Za-z0-9-]{4,40}$' then
    raise exception 'use a short reference made of letters, numbers and hyphens' using errcode = 'invalid_parameter_value';
  end if;
  select * into o from public.review_orders where id = p_order_id;
  if not found then raise exception 'order not found' using errcode = 'no_data_found'; end if;
  if exists (select 1 from public.payments where order_id = o.id) then
    return jsonb_build_object('outcome', 'already_fulfilled');
  end if;
  if o.status = 'questionnaire_submitted' then
    update public.review_orders set status = 'awaiting_payment' where id = o.id;
    o.status := 'awaiting_payment';
  end if;
  if o.status <> 'awaiting_payment' then
    raise exception 'this review cannot be marked paid' using errcode = 'check_violation';
  end if;
  select * into product from public.products where code = o.product_code and is_active;
  receipt := 'R-' || to_char(now() at time zone 'Europe/London', 'YYYYMMDD') || '-M' || substr(replace(o.id::text, '-', ''), 1, 8);
  insert into public.payments (
    order_id, patient_id, amount_pence, currency, status, source, manual_reference, receipt_number
  ) values (
    o.id, o.patient_id, product.price_pence, 'GBP', 'succeeded', 'manual_audited', p_reference, receipt
  ) returning id into payment_id;
  update public.review_orders set status = 'paid' where id = o.id;
  perform app.write_audit('payment.manual_recorded', 'payment', payment_id::text,
    jsonb_build_object('order_id', o.id, 'amount_pence', product.price_pence, 'reference', p_reference));
  return jsonb_build_object('outcome', 'fulfilled', 'payment_id', payment_id, 'receipt_number', receipt);
end;
$$;

create function public.record_refund(p_payment_id uuid, p_amount_pence integer, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
  new_id uuid;
  already integer;
begin
  if not app.has_verified_role('ops_admin') then
    raise exception 'verified operations administrator with MFA required' using errcode = 'insufficient_privilege';
  end if;
  select * into payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found' using errcode = 'no_data_found'; end if;
  select coalesce(sum(amount_pence), 0) into already from public.refunds where payment_id = payment.id;
  if p_amount_pence + already > payment.amount_pence then
    raise exception 'refund is larger than the amount paid' using errcode = 'check_violation';
  end if;
  insert into public.refunds (payment_id, amount_pence, reason, recorded_by)
  values (payment.id, p_amount_pence, btrim(p_reason), (select auth.uid()))
  returning id into new_id;
  -- Recorded only. Nothing is sent to Stripe.
  if p_amount_pence + already = payment.amount_pence then
    update public.payments set status = 'refund_recorded' where id = payment.id;
    update public.review_orders set status = 'refunded'
      where id = payment.order_id and status in ('paid', 'consultation_booked', 'in_review', 'declined');
  end if;
  perform app.write_audit('payment.refund_recorded', 'refund', new_id::text,
    jsonb_build_object('payment_id', payment.id, 'amount_pence', p_amount_pence, 'sent_to_provider', false));
  return new_id;
end;
$$;

-- ===========================================================================
-- 5. Booking
-- ===========================================================================
create function public.set_availability(p_starts timestamptz, p_ends timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not app.has_verified_role('pharmacist') then
    raise exception 'verified pharmacist with MFA required' using errcode = 'insufficient_privilege';
  end if;
  insert into public.pharmacist_availability (pharmacist_id, starts_at, ends_at)
  values ((select auth.uid()), p_starts, p_ends)
  returning id into new_id;
  return new_id;
end;
$$;

create function public.bookable_slots(p_from timestamptz, p_to timestamptz)
returns table (pharmacist_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.pharmacist_id, gs, gs + interval '30 minutes'
  from public.pharmacist_availability a
  cross join lateral generate_series(
    a.starts_at,
    a.ends_at - interval '30 minutes',
    interval '30 minutes'
  ) as gs
  where gs >= p_from and gs < p_to and gs > now()
    and not exists (
      select 1 from public.appointments ap
      where ap.pharmacist_id = a.pharmacist_id
        and ap.status = 'booked'
        and ap.slot && tstzrange(gs, gs + interval '30 minutes', '[)')
    )
  order by gs;
$$;

create function public.book_appointment(p_order_id uuid, p_pharmacist_id uuid, p_starts timestamptz)
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
  select case q.answers ->> 'consultationMethod' when 'secure_video' then 'secure_video' else 'telephone' end
    into method
  from public.questionnaire_submissions q
  where q.order_id = o.id and q.status = 'submitted'
  order by q.version_no desc limit 1;
  chosen := tstzrange(p_starts, p_starts + interval '30 minutes', '[)');
  insert into public.appointments (order_id, patient_id, pharmacist_id, slot, method, status)
  values (o.id, o.patient_id, p_pharmacist_id, chosen, coalesce(method, 'telephone'), 'booked')
  returning id into new_id;
  insert into public.appointment_events (appointment_id, event, slot) values (new_id, 'booked', chosen);
  update public.review_orders set status = 'consultation_booked' where id = o.id;
  perform app.write_audit('appointment.booked', 'appointment', new_id::text,
    jsonb_build_object('order_id', o.id, 'method', coalesce(method, 'telephone')));
  return new_id;
end;
$$;

create function public.reschedule_appointment(p_appointment_id uuid, p_pharmacist_id uuid, p_starts timestamptz)
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
  insert into public.appointment_events (appointment_id, event, slot) values (ap.id, 'rescheduled', chosen);
  perform app.write_audit('appointment.rescheduled', 'appointment', ap.id::text, jsonb_build_object('order_id', ap.order_id));
end;
$$;

create function public.request_cancellation(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ap public.appointments;
  uid uuid;
begin
  uid := app.require_user();
  select * into ap from public.appointments
    where id = p_appointment_id and patient_id = uid and status = 'booked'
    for update;
  if not found then raise exception 'appointment not found' using errcode = 'no_data_found'; end if;
  update public.appointments set status = 'cancellation_requested' where id = ap.id;
  insert into public.appointment_events (appointment_id, event, slot) values (ap.id, 'cancellation_requested', ap.slot);
  update public.review_orders set status = 'paid' where id = ap.order_id and status = 'consultation_booked';
  perform app.write_audit('appointment.cancellation_requested', 'appointment', ap.id::text,
    jsonb_build_object('order_id', ap.order_id));
end;
$$;

-- ===========================================================================
-- 6. RLS and grants. Ops admins see payments, not clinical records.
-- ===========================================================================
alter table public.checkout_sessions enable row level security;
alter table public.provider_events enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.pharmacist_availability enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;

create policy checkout_select_own on public.checkout_sessions
  for select to authenticated using (patient_id = (select auth.uid()));
create policy payments_select_own on public.payments
  for select to authenticated using (patient_id = (select auth.uid()));
create policy payments_select_ops on public.payments
  for select to authenticated using ((select app.has_verified_role('ops_admin')));
create policy refunds_select_own on public.refunds
  for select to authenticated using (
    exists (select 1 from public.payments p where p.id = payment_id and p.patient_id = (select auth.uid()))
  );
create policy refunds_select_ops on public.refunds
  for select to authenticated using ((select app.has_verified_role('ops_admin')));
create policy provider_events_select_ops on public.provider_events
  for select to authenticated using ((select app.has_verified_role('ops_admin')));
create policy availability_select_own on public.pharmacist_availability
  for select to authenticated using (pharmacist_id = (select auth.uid()));
create policy appointments_select_own on public.appointments
  for select to authenticated using (
    patient_id = (select auth.uid()) or (
      pharmacist_id = (select auth.uid()) and (select app.has_verified_role('pharmacist'))
    )
  );
create policy appointment_events_select_own on public.appointment_events
  for select to authenticated using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and (
        a.patient_id = (select auth.uid())
        or (a.pharmacist_id = (select auth.uid()) and (select app.has_verified_role('pharmacist')))
      )
    )
  );

revoke all on public.checkout_sessions, public.provider_events, public.payments, public.refunds,
  public.pharmacist_availability, public.appointments, public.appointment_events
  from anon, authenticated;
grant select on public.checkout_sessions, public.payments, public.refunds, public.provider_events,
  public.pharmacist_availability, public.appointments, public.appointment_events
  to authenticated;
grant all on public.checkout_sessions, public.provider_events, public.payments, public.refunds,
  public.pharmacist_availability, public.appointments, public.appointment_events
  to service_role;

revoke all on function public.begin_checkout(uuid), public.apply_provider_event(text, text, uuid, integer, text, text),
  public.record_manual_payment(uuid, text), public.record_refund(uuid, integer, text),
  public.set_availability(timestamptz, timestamptz), public.bookable_slots(timestamptz, timestamptz),
  public.book_appointment(uuid, uuid, timestamptz), public.reschedule_appointment(uuid, uuid, timestamptz),
  public.request_cancellation(uuid)
  from public, anon;
grant execute on function public.begin_checkout(uuid), public.bookable_slots(timestamptz, timestamptz),
  public.book_appointment(uuid, uuid, timestamptz), public.reschedule_appointment(uuid, uuid, timestamptz),
  public.request_cancellation(uuid), public.set_availability(timestamptz, timestamptz)
  to authenticated;
grant execute on function public.record_manual_payment(uuid, text), public.record_refund(uuid, integer, text)
  to authenticated;
grant execute on function public.apply_provider_event(text, text, uuid, integer, text, text)
  to service_role;
