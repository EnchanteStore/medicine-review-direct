# Progress

## Phase 1: Foundation

**Status:** implemented on branch `cursor/phase-1-foundation-2083`. Not deployed. Synthetic data
only. No real emails, payments or external changes.

Evidence below was produced on 7 November 2026 on the Cloud VM: Ubuntu 24.04, Node 22.23.4,
pnpm 10.33.4, Docker 29.9.3, Supabase CLI 3.0.0 (Postgres 17), Playwright 1.65 (Chromium).

### What was implemented

| Area                         | Delivered                                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture and design docs | All eight documents in `docs/`                                                                                                                                                                                   |
| Monorepo                     | pnpm workspaces + Turborepo; `apps/web`, `packages/{domain,validation,ui,config}`; strict TS, ESLint 9, Prettier                                                                                                 |
| Design system                | Tailwind v4 tokens and accessible components in `packages/ui`                                                                                                                                                    |
| Local Supabase               | `supabase/config.toml` hardened (confirmations on, 12-char passwords, explicit grants, custom email templates)                                                                                                   |
| Database                     | Migration `20261107000100_foundation_schema.sql`: profiles, staff_roles, consents, audit_log, products; helpers; triggers; RLS; grants; launch product £59/£79                                                   |
| RLS tests                    | 3 pgTAP files, 62 assertions                                                                                                                                                                                     |
| CI                           | `.github/workflows/ci.yml`: quality, database (pgTAP + schema lint), e2e (Playwright)                                                                                                                            |
| Public site                  | Home, How it works, Pricing (database price), About, FAQ, Contact, Clinical safety (DRAFT), Privacy, Terms, Refunds, Complaints (DRAFT); emergency banner; 404 and error pages                                   |
| Registration                 | Sign-up with adult and terms acknowledgement (recorded as consents), email verification via `/auth/confirm`, resend link, sign-in/out, forgotten password, reset password, rate limiting, no account enumeration |
| Patient area                 | Protected `/account` dashboard shell (sections honestly labelled "Not yet available"), `/account/profile` with Zod validation and DB-level rules                                                                 |
| Staff area                   | `/staff` shell gated to verified staff roles (404 otherwise); shows whether the role has clinical access                                                                                                         |

### What genuinely works (verified end to end locally)

- A visitor can create an account, receives a confirmation email in local Mailpit, cannot sign
  in until confirmed, confirms via the link, lands on the dashboard, completes their profile,
  signs out and signs back in.
- Password reset by emailed link works; the old password stops working; links are single use.
- Pricing is read from Postgres; changing the database row changes the page (no hard-coded price).
- Patients can only see and edit their own data, through both SQL and the real Data API.
- Ops admins cannot read patient profiles or consents; unverified pharmacists cannot open
  `/staff`.

### Not implemented in Phase 1 (by design)

Questionnaire, safety screening, documents, Stripe, booking, pharmacist workspace, reports, PDF,
messaging, GP letters, MFA, phone verification, background worker. See
[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Test results

| #   | Check                                                                                                            | Command                                            | Result           | Evidence                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- | ------------------------------------------------------------------- |
| 1   | Formatting                                                                                                       | `pnpm format:check`                                | **PASS**         | "All matched files use Prettier code style!"                        |
| 2   | TypeScript (4 packages, strict)                                                                                  | `pnpm typecheck`                                   | **PASS**         | Turbo: 4 successful, 4 total                                        |
| 3   | ESLint (4 packages)                                                                                              | `pnpm lint`                                        | **PASS**         | Turbo: 4 successful, 0 problems                                     |
| 4   | Vitest: `packages/domain` (state machines, release guard, roles, pricing)                                        | `pnpm test`                                        | **PASS**         | 2 files, 20 tests passed                                            |
| 5   | Vitest: `packages/validation` (Zod schemas)                                                                      | `pnpm test`                                        | **PASS**         | 1 file, 29 tests passed                                             |
| 6   | Vitest: `packages/ui` (components, a11y wiring, jsdom)                                                           | `pnpm test`                                        | **PASS**         | 1 file, 8 tests passed                                              |
| 7   | Vitest: `apps/web` (safe redirect, rate limiter, date fields)                                                    | `pnpm test`                                        | **PASS**         | 1 file, 18 tests passed                                             |
| 8   | Production build                                                                                                 | `pnpm --filter @mrd/web build`                     | **PASS**         | Next.js 16.4.5: compiled successfully, 22 routes + proxy            |
| 9   | Migrations from scratch + seed                                                                                   | `supabase db reset`                                | **PASS**         | "Finished supabase db reset"                                        |
| 10  | Schema lint                                                                                                      | `supabase db lint --level warning --fail-on error` | **PASS**         | "No schema errors found"                                            |
| 11  | pgTAP RLS tests                                                                                                  | `supabase test db`                                 | **PASS**         | Files=3, Tests=62, Result: PASS                                     |
| 12  | pgTAP harness sanity (deliberately wrong assertion)                                                              | temporary test file                                | **PASS**         | Harness reported `Failed: 1`, `Result: FAIL`; file removed          |
| 13  | Playwright E2E + axe (desktop + mobile Chromium)                                                                 | `pnpm test:e2e`                                    | **PASS**         | 55 passed (34.7s), 0 failed, 0 flaky                                |
| 14  | axe-core WCAG 2.0/2.1/2.2 A+AA on 14 pages x 2 viewports, plus sign-up error, profile error and dashboard states | within #13                                         | **PASS**         | 0 violations                                                        |
| 15  | GitHub Actions CI on the PR                                                                                      | `.github/workflows/ci.yml`                         | See PR checks    | Workflow written; results depend on the PR run (recorded in the PR) |
| 16  | Manual screen-reader testing (NVDA/VoiceOver)                                                                    | n/a                                                | **NOT EXECUTED** | No screen reader on the VM; axe does not replace this               |
| 17  | Real-user accessibility testing with older users                                                                 | n/a                                                | **NOT EXECUTED** | Phase 5                                                             |
| 18  | Cross-browser (Firefox, WebKit/Safari)                                                                           | n/a                                                | **NOT EXECUTED** | Only Chromium installed; add projects in Phase 5                    |
| 19  | Penetration test / security scan                                                                                 | n/a                                                | **NOT EXECUTED** | Phase 5                                                             |
| 20  | Clinical content review                                                                                          | n/a                                                | **BLOCKED**      | Awaiting pharmacist owner approval (CLINICAL_SAFETY.md)             |
| 21  | Payment, booking, report, PDF, messaging tests                                                                   | n/a                                                | **NOT EXECUTED** | Features not in Phase 1 scope                                       |

A passing build and these automated tests are not clinical testing and do not show the service is
safe to launch.

### Priority E2E scenarios covered in Phase 1

| Scenario (brief)                     | Result                    | Evidence                                                           |
| ------------------------------------ | ------------------------- | ------------------------------------------------------------------ |
| Registration and email verification  | **PASS**                  | `auth.spec.ts` "register, verify email, complete profile…"         |
| Sign-in/out and password reset       | **PASS**                  | `auth.spec.ts` "password reset via emailed link"                   |
| Cross-patient access denied          | **PASS**                  | pgTAP `002_patient_isolation`; `access.spec.ts` Data API tests     |
| Unauthorised/unverified staff denied | **PASS**                  | pgTAP `003_staff_access`; `access.spec.ts` UI tests                |
| Ops admin denied clinical records    | **PASS** (current tables) | pgTAP `003_staff_access`; `access.spec.ts`                         |
| Emergency screening blocks purchase  | **NOT EXECUTED** (E2E)    | Domain rule unit-tested (`order-and-roles.test.ts`); UI is Phase 2 |
| All other scenarios                  | **NOT EXECUTED**          | Later phases                                                       |

### Playwright run (full list)

```
✓   1 [desktop-chromium] › access.spec.ts › a patient cannot open the staff area
✓   2 [desktop-chromium] › access.spec.ts › an unverified pharmacist cannot open the staff area
✓   3 [desktop-chromium] › access.spec.ts › a verified ops admin can open the staff area but is told there is no clinical access
✓   4 [desktop-chromium] › access.spec.ts › a verified pharmacist sees the clinical workspace placeholder
✓   5 [desktop-chromium] › access.spec.ts › a patient can read only their own profile and consents
✓   6 [desktop-chromium] › access.spec.ts › a patient cannot update another user or escalate privileges
✓   7 [desktop-chromium] › access.spec.ts › an ops admin cannot read patient profiles or consents
✓   8 [desktop-chromium] › access.spec.ts › anonymous visitors can read active prices but nothing personal
✓   9 [desktop-chromium] › auth.spec.ts › sign-up validation shows accessible, linked errors
✓  10 [desktop-chromium] › auth.spec.ts › register, verify email, complete profile, sign out and sign back in
✓  11 [desktop-chromium] › auth.spec.ts › password reset via emailed link
✓  12 [desktop-chromium] › auth.spec.ts › password reset for an unknown email gives the same response and sends nothing
✓  13 [desktop-chromium] › auth.spec.ts › signing up with an existing email does not reveal that the account exists
✓  14 [desktop-chromium] › auth.spec.ts › protected pages redirect to sign-in and return afterwards
✓  15 [desktop-chromium] › auth.spec.ts › sign-in ignores off-site redirect targets
✓  16 [desktop-chromium] › auth.spec.ts › invalid or tampered verification links are rejected
✓  17 [desktop-chromium] › auth.spec.ts › repeated failed sign-ins for one email are rate limited
✓  18-31 [desktop-chromium] › public.spec.ts › 14 pages render, show emergency advice, have no axe violations
✓  32-36 [desktop-chromium] › public.spec.ts › pricing from DB, 404, skip link, security headers, navigation
✓  37-55 [mobile-chromium]  › public.spec.ts › the same 19 public tests on a Pixel 7 viewport
55 passed (34.7s)
```

### Issues found and fixed during testing

- Migration used `text[] || 'literal'`, which Postgres parsed as an array literal; fixed with
  `array_append`.
- A quick repeat sign-up returned Auth's per-user email throttle (`over_email_send_rate_limit`),
  which the app showed as "Too many attempts". That would reveal the account exists, so it is now
  handled identically to a new sign-up (decision D-015).
- E2E race (navigating before sign-in completed) and a mobile menu locator; tests corrected.

### Environment notes

Docker and the Supabase CLI were not on the VM. Docker was installed; the VM's stale legacy
iptables rules dropped container-to-container traffic, fixed locally with a `DOCKER-USER` ACCEPT
rule (not needed on CI runners). The Supabase CLI is a pinned dev dependency (`supabase@3.0.0`).
