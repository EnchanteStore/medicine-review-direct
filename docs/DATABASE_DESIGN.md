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

## Designed entities (built in later phases)

### Phase 2: patient application

| Table                       | Key columns                                                                                                                         | RLS outline                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `review_orders`             | `id`, `patient_id`, `product_code`, `status` (order state machine), `price_pence_at_purchase`, `assigned_pharmacist_id`, timestamps | Patient: own. Assigned pharmacist and clinical_admin: read. Ops: status/billing columns via a restricted view without clinical joins |
| `questionnaire_versions`    | `id`, `version`, `schema` (jsonb), `approved_by`, `approved_at`, `is_active`                                                        | Read: authenticated. Write: service role after pharmacist approval                                                                   |
| `questionnaire_submissions` | `id`, `order_id`, `questionnaire_version_id`, `answers` (jsonb), `status` (`draft`/`submitted`), `submitted_at`, `supersedes_id`    | Patient: own drafts editable; submitted rows immutable; amendments create new rows                                                   |
| `medications`               | `id`, `submission_id`, `name`, `strength`, `formulation`, `dose`, `frequency`, `route`, `indication`, `notes`, `dont_know_flags`    | As submissions. Free text is not clinically validated                                                                                |
| `safety_screenings`         | `id`, `order_id`, `ruleset_version`, `answers`, `outcome` (`clear`/`escalated`), `matched_rules`, `acknowledged_at`                 | Patient: insert/read own; immutable. Clinicians: read. Escalation alerts clinical staff                                              |
| `safety_rulesets`           | `version`, `rules` (deterministic jsonb), `emergency_advice`, `approved_by`, `approved_at`                                          | Read-only to app; changes require pharmacist approval                                                                                |
| `documents`                 | `id`, `order_id`, `owner_id`, `storage_path`, `mime_type`, `size_bytes`, `sha256`, `scan_status` (`pending`/`clean`/`infected`)     | Patient: own. Assigned pharmacist: read when clean. Private bucket; short-lived signed URLs only                                     |

### Phase 3: commercial

| Table                     | Key columns                                                                                                                              | Notes                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payments`                | `id`, `order_id`, `stripe_checkout_session_id` (unique), `stripe_payment_intent_id`, `amount_pence`, `currency`, `status`, `receipt_url` | Written only from verified Stripe webhooks or audited manual workflow                                                                                                   |
| `stripe_events`           | `event_id` PK, `type`, `received_at`, `processed_at`, `payload_hash`                                                                     | Idempotency: event processed once                                                                                                                                       |
| `refunds`                 | `id`, `payment_id`, `amount_pence`, `reason`, `requested_by`, `approved_by`, `stripe_refund_id`, `status`                                | Ops admin, audited                                                                                                                                                      |
| `pharmacist_availability` | `id`, `pharmacist_id`, `starts_at`, `ends_at` (timestamptz; displayed Europe/London)                                                     | Exclusion constraint prevents overlaps                                                                                                                                  |
| `appointments`            | `id`, `order_id`, `pharmacist_id`, `slot` (tstzrange), `status`, `reschedule_count`                                                      | `EXCLUDE USING gist (pharmacist_id WITH =, slot WITH &&) WHERE status in ('booked')` prevents double-booking under concurrency; booking requires a paid order (trigger) |

### Phase 4: clinical operations

| Table                  | Key columns                                                                                                                              | Notes                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `consultations`        | `id`, `appointment_id`, `occurred` (bool), `outcome`, `started_at`, `ended_at`, `notes`                                                  | Records whether the consultation happened; required before release |
| `clinical_notes`       | `id`, `order_id`, `author_id`, `body`, `created_at`                                                                                      | Append-only; assigned pharmacist and clinical_admin only           |
| `reports`              | `id`, `order_id`, `status` (report state machine), `current_version_id`, `approved_by`, `approved_at`, `released_by`, `released_at`      | Patient can read **only** when `status = 'released'`               |
| `report_versions`      | `id`, `report_id`, `version`, `content` (jsonb sections), `pdf_storage_path`, `pdf_sha256`, `created_by`, `created_at`, `correction_of`  | Immutable; corrections create a new version with reason            |
| `gp_letters`           | `id`, `order_id`, `consent_id`, `recipient_practice`, `recipient_verified_by`, `content`, `status`, `dispatched_at`, `dispatch_evidence` | Requires case-specific consent and verified recipient              |
| `messages`             | `id`, `order_id`, `sender_id`, `body`, `attachment_document_id`, `created_at`, `read_at`                                                 | Append-only; notifications carry no content                        |
| `notifications_outbox` | `id`, `user_id`, `template`, `status`, `attempts`, `next_attempt_at`                                                                     | Generic templates only; dev mode never sends                       |
| `jobs`                 | queue tables (pg-boss/pgmq)                                                                                                              | Idempotent PDF generation, emails, retries                         |

## State machines

Defined in `packages/domain` (unit-tested) and to be enforced by database triggers when the
tables are built.

**Order:** `draft → questionnaire_submitted → awaiting_payment → paid → consultation_booked →
in_review → report_released → completed`, with `safety_escalated` (blocks checkout, terminal
except cancel), `cancelled`, `refunded`.

**Report:** `draft → clinically_approved → generating → ready_for_release → released`, with
`generation_failed` (retry or back to draft). Release requires a paid order, a recorded
consultation and an explicit verified-pharmacist action. `released` is terminal; corrections
create a new version. Nothing becomes patient-visible automatically.

## Migrations

| File                                   | Contents                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `20261107000100_foundation_schema.sql` | Types, `app` helpers, profiles, staff_roles, consents, audit_log, products, triggers, RLS, grants, launch product |

`supabase/seed.sql` creates **local-only synthetic** users and staff roles (`@example.test`).

## Tests (`supabase/tests`, 62 assertions)

- `001_schema_hardening`: expected tables, RLS on all tables, pinned search_path, no API access
  to `write_audit`, table and column privileges, launch price.
- `002_patient_isolation`: sign-up trigger, cross-patient read/update denial, protected columns,
  DB-level age and phone rules, consent append-only and forgery prevention, no self-escalation,
  audit metadata contains field names only, anonymous denial.
- `003_staff_access`: verification constraints, ops admin denied patient data, unverified and
  verified-but-unassigned pharmacist denied, clinical admin access, suspension revokes access,
  inactive products hidden, audit log immutable even to the owner.
