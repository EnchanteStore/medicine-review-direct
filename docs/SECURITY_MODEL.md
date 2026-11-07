# Security model

This document describes controls as built in Phase 1 and those planned. It does **not** claim
compliance with UK GDPR, DSPT, DCB0129/0160 or any standard; items needing professional review are
listed at the end.

## Data classification

| Class                     | Examples                                 | Phase 1 handling                                                              |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Special category (health) | Questionnaire, medicines, notes, reports | Not collected yet. Will live only in RLS-protected tables and private storage |
| Personal                  | Name, DOB, phone, email                  | `profiles` and `auth.users`, own-row RLS                                      |
| Operational               | Prices, staff roles                      | RLS + explicit grants                                                         |
| Audit                     | `audit_log`                              | Immutable; identifiers and field names only                                   |

All data in every environment so far is **synthetic**.

## Authentication

- Supabase Auth (GoTrue), email + password. No homemade crypto; bcrypt hashing by Supabase.
- Email confirmation required before first sign-in (`enable_confirmations = true`).
- Password policy: 12+ characters including a letter and a digit, max 72 bytes (bcrypt limit),
  enforced by Zod and by Auth config (`minimum_password_length = 12`, `letters_digits`).
- Sessions in HTTP-only cookies via `@supabase/ssr`; refresh-token rotation on.
- Email links use token hashes verified server-side at `/auth/confirm`; links are single use and
  expire after 1 hour. A forged token is rejected (E2E tested).
- Password-changed notification email enabled.
- **Planned:** TOTP MFA (mandatory for staff, optional for patients, Phase 2/4), phone
  verification, account closure requests, session timeouts for staff.

## Authorisation

Defence in depth, each layer independently enforced:

1. `proxy.ts` redirects signed-out users from `/account` and `/staff` (convenience only).
2. Each protected layout/page/action calls `supabase.auth.getUser()` server-side.
3. `/staff` requires at least one **verified** staff role; others get a 404.
4. **Postgres RLS is the final authority.** The web app uses the user's JWT; the service role key
   is not used by the web app in Phase 1.

Key rules (all tested with pgTAP; several also through the real Data API in Playwright):

- Patients see and edit only their own rows; cannot set protected columns
  (`phone_verified_at`, `id`), delete profiles, grant themselves roles, or read the audit log.
- Ops admins cannot read patient profiles or consents.
- Unverified or suspended staff get nothing beyond their own role row.
- Verified pharmacists have no blanket access to patient data; access will be assignment-scoped.
- Audit log and consents are append-only, even for the table owner.

## Application controls

| Control                                                                 | Status                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-side validation with shared Zod schemas                          | Built                                                                                                                                                                              |
| Generic auth errors; no account enumeration on sign-up, reset or resend | Built, E2E tested                                                                                                                                                                  |
| Open-redirect protection for `next=` parameters                         | Built, unit + E2E tested                                                                                                                                                           |
| Rate limiting on sign-up, sign-in, reset, resend (per IP and per email) | Built (in-memory, single instance); E2E tested. **Needs a shared store before production**                                                                                         |
| Supabase Auth's own rate limits                                         | On (local `sign_in_sign_ups` raised for E2E; production values to be set)                                                                                                          |
| CSRF                                                                    | Server actions are POST-only with Next.js origin checks; `SameSite=Lax` cookies; CSP `form-action 'self'`                                                                          |
| XSS                                                                     | React escaping; no `dangerouslySetInnerHTML`; names validated against a letters-only pattern                                                                                       |
| Security headers                                                        | CSP (`frame-ancestors 'none'`, `base-uri`, `form-action`, `object-src`), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS in production; `X-Powered-By` removed |
| Full nonce-based CSP                                                    | Planned (Phase 5)                                                                                                                                                                  |
| `Cache-Control: private, no-store` on protected pages                   | Built                                                                                                                                                                              |
| Logging                                                                 | Auth/profile errors log only error codes; no emails, passwords or clinical data                                                                                                    |
| Safe error pages                                                        | Generic error and 404 pages; no stack traces                                                                                                                                       |
| Secrets                                                                 | None committed. `.env*` ignored. Local Supabase keys are the CLI's public demo keys                                                                                                |
| Search indexing                                                         | `robots.txt` disallows all and `noindex` metadata (pre-launch)                                                                                                                     |

## Planned controls by phase

- **Phase 2:** private Storage bucket with per-user path policies, malware scanning before
  documents become visible (`scan_status`), short-lived signed URLs, upload size/MIME limits,
  MFA enrolment.
- **Phase 3:** Stripe webhook signature verification, `stripe_events` idempotency, payment status
  only from verified events, server-side prices only, booking exclusion constraints.
- **Phase 4:** staff invitation flow, independent verification evidence, assignment-scoped RLS,
  mandatory staff MFA, report release guard in the database.
- **Phase 5:** penetration test, nonce CSP, shared rate-limit store, backups and restore drill,
  retention jobs, DPIA, DSPT evidence, incident response runbook.

## Known caveats

- In-memory rate limits reset on restart and are per-instance.
- All Auth requests reach Supabase from the server's IP, so Auth's per-IP limits see the server,
  not the patient. Production needs forwarded-IP configuration or reliance on app-level limits.
- Email-link scanners that prefetch GET links can consume a single-use token. If this becomes a
  problem, switch to a confirm-button page that verifies on POST.

## Items requiring professional review (not claimed as compliant)

- UK GDPR lawful basis and Article 9 condition for health data; DPIA.
- Data retention periods for clinical, financial and audit records.
- Hosting region (UK or EU) and international transfer assessment for each processor.
- Email/SMS provider and its data processing terms.
- Cyber Essentials / DSPT scope.
