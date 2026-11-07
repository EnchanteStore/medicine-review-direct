# Database design

Postgres 17 on Supabase. Forward-only versioned migrations in `supabase/migrations`. pgTAP tests in
`supabase/tests`. Types for the web app are generated with `pnpm db:types`.

**Legend:** **BUILT** = migrated and tested in Phase 1. **DESIGNED** = specified here, built in the
phase shown.

## Principles

1. **RLS on every table**, enforced by a pgTAP test that fails if any public table lacks it.
2. **Explicit, minimal grants.** `auto_expose_new_tables = false`; each table grants only what API
   roles need, down to column level (e.g. patients can update only four profile columns).
3. **Role helpers are `security definer` with a pinned `search_path`** in a private `app` schema
   that is not exposed through the Data API. Tested.
4. **Ops admins never get clinical access.** Clinical policies use `app.is_verified_clinician()`
   (pharmacist or clinical_admin, verified) or assignment checks; ops policies use
   `app.is_verified_admin()` and only touch non-clinical tables.
5. **Append-only where history matters** (audit log, consents, report versions, messages):
   triggers reject UPDATE/DELETE/TRUNCATE even for the table owner.
6. **State machines enforced twice:** in `packages/domain` (for UI and server logic) and in the
   database (check constraints plus transition triggers) so no client can skip a state.
7. **No clinical data in identity tables or the audit log.** Audit metadata stores identifiers
   and field names, never values or free text.
8. **Retention over cascade.** Foreign keys to `auth.users` use `on delete restrict`; account
   deletion is a governed request subject to retention (periods awaiting approval).
9. **Money in integer pence, GBP only.**

## Roles

| Role             | Where held                                          | Access (summary)                                                            |
| ---------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| `patient`        | Implicit: any authenticated user without staff role | Own rows only                                                               |
| `pharmacist`     | `staff_roles` (verified, GPhC number required)      | Assigned reviews only (Phase 4). No blanket patient access                  |
| `clinical_admin` | `staff_roles` (verified)                            | Read patient identity/consents; assign reviews; audit log                   |
| `ops_admin`      | `staff_roles` (verified)                            | Staff list, audit log, products, billing (Phase 3). **No clinical content** |

Verification states: `pending`, `verified`, `suspended`, `revoked`. Only `verified` grants access;
suspension removes access immediately (tested). A verified row needs `verified_by` and
`verified_at`, cannot be self-verified, and pharmacists need a 7-digit GPhC number.

## Helper functions (`app` schema) — BUILT

| Function                                                    | Purpose                                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `app.has_verified_role(role)`                               | Current user holds the role with status `verified`                                           |
| `app.is_verified_clinician()`                               | Verified pharmacist or clinical_admin (excludes ops_admin)                                   |
| `app.is_verified_admin()`                                   | Verified clinical_admin or ops_admin                                                         |
| `app.write_audit(action, entity_type, entity_id, metadata)` | Inserts an audit row; **not callable by API roles**, only from triggers and the service role |
| `app.handle_new_user()`                                     | Trigger on `auth.users` insert: creates profile, records sign-up consents, audits            |
| `app.handle_user_email_confirmed()`                         | Audits email verification                                                                    |
| `app.validate_profile()`                                    | Adult-only date of birth; clears phone verification when the number changes                  |
| `app.reject_mutation()`                                     | Append-only enforcement                                                                      |

## Built tables (Phase 1)

### `profiles` — BUILT

| Column                      | Type                   | Notes                                               |
| --------------------------- | ---------------------- | --------------------------------------------------- |
| `id`                        | uuid PK → `auth.users` | on delete restrict                                  |
| `given_name`, `family_name` | text                   | 1 to 100 chars                                      |
| `date_of_birth`             | date                   | Trigger: age 18 to 120                              |
| `phone_number`              | text                   | E.164 UK only `^\+44[1-37]\d{8,9}$`                 |
| `phone_verified_at`         | timestamptz            | Not writable by patients; reset when number changes |
| `created_at`, `updated_at`  | timestamptz            |                                                     |

RLS: patient selects/updates own row; verified clinical_admin selects all. Grants: `SELECT`,
`UPDATE(given_name, family_name, date_of_birth, phone_number)`. No insert/delete for API roles.

### `staff_roles` — BUILT

`id`, `user_id`, `role`, `verification_status`, `gphc_registration_number`, `verified_at`,
`verified_by`, timestamps; unique `(user_id, role)`. RLS: own rows, or all for verified admins.
**No API writes**; invitations and verification will use audited security-definer functions or
the service role (Phase 4).

### `consents` — BUILT

`id`, `user_id` (default `auth.uid()`), `consent_type` (`terms_of_service`, `privacy_notice`,
`adult_declaration`; extended later with `health_data_processing`, `gp_letter_sharing`),
`document_version`, `granted`, `source` (`sign_up`, `account_settings`, `staff_recorded`),
`recorded_at`. Append-only; withdrawal is a new row with `granted = false`. Patients can insert
only for themselves with `source = 'account_settings'`; sign-up consents are written by the
trigger.

### `audit_log` — BUILT

`id` (identity), `occurred_at`, `actor_id`, `action` (dotted lowercase, e.g. `profile.updated`),
`entity_type`, `entity_id`, `metadata` (jsonb object). Immutable (UPDATE/DELETE/TRUNCATE
rejected). Readable by verified admins only. Events today: `account.created`,
`account.email_verified`, `profile.updated` (field names only), `consent.recorded`,
`staff_role.created`, `staff_role.status_changed`, `product.updated`.

### `products` — BUILT

`code` PK, `name`, `description`, `price_pence`, `standard_price_pence` (≥ price), `currency`
(`GBP` only), `is_active`, `display_order`, timestamps. Anonymous users see active products only;
admins see all. Price changes are audited. Seeded: `standard_review` £59 (normally £79). Price
writes through the API are not granted yet (admin price editing arrives with the ops dashboard).

## Built in Phase 2 (migration `20261107000300_phase2_patient_intake.sql`)

| Table                       | Purpose                                                                                    | Write path                                                                                | Read (RLS)                                          |
| --------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `app_settings`              | `environment` (`production` default, `development` in local seed)                          | Service role only                                                                         | Via `service_status()` only                         |
| `launch_signoffs`           | Append-only sign-offs per `launch_gate` (10 gates)                                         | Clinical admin (MFA) insert                                                               | Verified admins                                     |
| `safety_rulesets`           | Versioned, immutable rule set definitions; one active; `draft`/`approved`                  | Migration / service role                                                                  | Authenticated                                       |
| `review_orders`             | Order state machine; `suitability_review_required`; assigned pharmacist                    | `start_review_order()` and other functions; trigger `app.enforce_order_rules`             | Own; assigned pharmacist; clinical admin            |
| `safety_screenings`         | Answers, outcome, matched rules, flags, rule set version; immutable except acknowledgement | `submit_safety_screening()` (evaluates in SQL)                                            | Own; clinicians on the order                        |
| `suitability_assessments`   | Urgent reassessment and complexity review; immutable                                       | `record_suitability_assessment()` (clinician, MFA)                                        | Clinicians on the order                             |
| `questionnaire_submissions` | Draft, submitted and superseded versions, `amends_submission_id`, attention flags          | `save_questionnaire_draft()`, `submit_questionnaire()`, `start_questionnaire_amendment()` | Own; clinicians on the order                        |
| `high_risk_medicine_terms`  | Draft term list for attention flags                                                        | Migration                                                                                 | Verified clinicians                                 |
| `documents`                 | Metadata for private storage objects; `scan_status`                                        | `register_document()` (checks path and object exist)                                      | Own; clinicians only when `clean`                   |
| `retention_policies`        | Six provisional categories                                                                 | Service role (audited)                                                                    | Verified admins                                     |
| `legal_holds`               | Holds on a user or order                                                                   | `place_legal_hold()` (clinical admin, MFA)                                                | Clinical admins                                     |
| `deletion_requests`         | Requests and stored retention assessment                                                   | `request_account_deletion()`, `review_deletion_request()`                                 | Own; clinical admins                                |
| `consultations`             | Method (telephone/secure_video), time, two-way flag, clinical notes; immutable             | `pharmacist_record_consultation()`                                                        | Clinicians on the order                             |
| `reports`                   | Report status, confirmations, approval with name and GPhC number, release                  | `pharmacist_*` functions; trigger `app.enforce_report_gate` for all roles                 | Patient only when released; clinicians on the order |

Storage: the private bucket `patient-documents`. Patients may insert and read only under
`<user_id>/` while intake is open.

New consent types: `health_data_processing` (required before questionnaire drafts) and
`remote_consultation` (required before submission). New consent source: `intake`.

Key database functions:

- `app.evaluate_screening`
- `app.order_screening_cleared`
- `app.report_gate_blockers`
- `app.live_service_enabled`, `app.intake_open`, `app.payments_open`
- `app.retention_assessment`, `app.retention_candidates`, `app.purge_abandoned_intake`
- `app.current_aal`

## Built in Phase 3 (migration `20261107000500_phase3_payments_booking.sql`)

| Table                     | Purpose                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout_sessions`       | One open test checkout per order. Amount copied from `products` at the start. Provider is `local_test_harness` until a Stripe test key exists |
| `provider_events`         | Idempotency key for a signed payment event. Stores a hash, not the body                                                                       |
| `payments`                | One successful payment per order, with a receipt number. Source is `provider_event` or `manual_audited`                                       |
| `refunds`                 | Append-only recorded refunds. `provider_refund_id` stays null                                                                                 |
| `pharmacist_availability` | UK-time windows opened by a verified pharmacist. Overlaps are rejected                                                                        |
| `appointments`            | 30-minute slots. A booked row holds the time. Exclusion constraint `appointments_no_double_book`                                              |
| `appointment_events`      | Append-only history: booked, rescheduled, cancellation requested                                                                              |

`app.payments_open()` is true for the labelled development checkout or for the live service.
`app.live_payments_open()` is true only when every launch gate is signed off and the rule set
is approved. The order trigger still refuses payment and booking when screening has not cleared
or an urgent hold is open.

## Designed entities (later phases)

| Table                                     | Phase | Notes                                                                                                                                                                  |
| ----------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payments`, `stripe_events`, `refunds`    | 3     | Verified webhooks only; idempotent; order `paid` also needs the live service                                                                                           |
| `pharmacist_availability`, `appointments` | 3     | Exclusion constraint against double-booking; booking needs a cleared screening, no urgent hold, and a suitability review when required (already enforced on the order) |
| `report_versions`                         | Later | A released report is already immutable. A correction would be a new report, not an edit. Not built in this slice                                                       |
| `notifications_outbox`, job queue         | Later | Mailpit is called from the web app. A queue is still the plan before production                                                                                        |
| `message` attachments                     | Later | Left out until a real scanner exists                                                                                                                                   |

## State machines

Defined in `packages/domain` (unit-tested) and to be enforced by database triggers when the
tables are built.

**Order (Phase 2):** `draft →` (screening) `safety_emergency_excluded` (terminal) |
`safety_urgent_hold` (only to `intake` after a suitable reassessment, or `declined`) | `intake →
questionnaire_submitted` (`→ intake` for amendments) `→ awaiting_payment → paid →
consultation_booked → in_review → report_released → completed`, plus `declined`, `cancelled`
and `refunded`. Live payment and booking need the launch sign-offs. Development can use the
labelled test checkout. Enforced by `app.enforce_order_rules`.

**Report:** `draft → clinically_approved → generating → ready_for_release → released`, with
`generation_failed` (retry or back to draft). Approval and release follow the owner's section 8
gate (see PHASE_2_SPEC), plus a succeeded payment and non-empty clinical sections. This is
enforced by `app.enforce_report_gate` for every role. `released` is terminal. Nothing becomes
patient-visible automatically.

## Phase 4 tables

| Table                      | Notes                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `messages`                 | Append-only except the first `read_at`. Patient and assigned pharmacist only. The body is not copied into email or the audit log                           |
| `gp_letters`               | One per order. Draft, approved, dispatched. Patient sees it only after approval. Dispatch evidence is a fixed sentence: not transmitted, no NHS connection |
| `safety_notices`           | `safety_notification` or `referral` on a declined, urgent or emergency-excluded order. Append-only. Not a row in `reports`                                 |
| `reports.pdf_storage_path` | Set when the PDF is ready. Cleared if generation fails. The bucket `clinical-reports` is private                                                           |
| `consents.order_id`        | Makes `gp_letter_sharing` specific to one review. The latest row wins                                                                                      |

A completed two-way consultation moves `consultation_booked` to `in_review`. The patient can
read that consultation only after the report is `released`.

## Migrations

| File                                       | Contents                                                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261107000100_foundation_schema.sql`     | Types, `app` helpers, profiles, staff_roles, consents, audit_log, products, triggers, RLS, grants, launch product                                                               |
| `20261107000200_phase2_enum_values.sql`    | New consent types and source                                                                                                                                                    |
| `20261107000300_phase2_patient_intake.sql` | Staff MFA in role helpers, kill switch, rule sets, orders, screening, questionnaire, documents and storage policies, retention, consultations and reports with the release gate |

`supabase/seed.sql` creates **local-only synthetic** users and staff roles (`@example.test`).

## Tests (`supabase/tests`, 219 assertions)

- `001_schema_hardening`: expected tables, RLS on every table, pinned search_path, privileges.
- `002_patient_isolation`: cross-patient isolation, protected columns, consent forgery.
- `003_staff_access`: staff boundaries, suspension, immutable audit log, **aal1 staff denied**.
- `004_safety_rule_cases` (**generated** from the shared fixture): 24 documented cases plus 3
  invalid inputs.
- `005_safety_pathways_and_kill_switch`: emergency, urgent and routine pathways; database
  blocking of payment and booking; urgent hold across orders; MFA reassessment; complexity
  review before booking; kill switch, sign-offs and revocation.
- `006_questionnaire_documents_retention`: consent gates, drafts, versioned submission and
  amendment, immutability, documents, scan gating, deletion requests, legal holds, purge.
- `007_report_release_gate`: every section 8 condition; service role, clinical admin,
  unassigned and non-MFA pharmacists denied; immutable release; declined and excluded orders
  cannot produce reports.
