# Progress

## MedsInFocus rebrand

**Status:** on `cursor/medsinfocus-rebrand`, based on Phase 7. Not deployed. Public intake, live
payments, prescribing, SES, and IONOS DNS stay off. The safety-question wording was not rewritten.
The report limitations sentence now uses the name MedsInFocus. Synthetic data only.

Checked on 8 November 2026 (London).

| Check                                                                       | Result                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format, lint, typecheck                                                     | PASS                                                                                                                                                                                                                                  |
| Vitest                                                                      | PASS. Domain 89, including the brand strings and the rule that only ClamAV plus a clean verdict may mark a file clean. Web, validation, ui and mobile suites also passed                                                              |
| pgTAP                                                                       | PASS. 11 files, 299 assertions. Includes prescribing locked off, audited handover, approval in the signed-in pharmacist's own name, report supersession, and a skipped scan staying rejected                                          |
| Playwright rebrand, portal and pharmacist choice                            | PASS. Homepage, public pages on desktop and mobile, `/portal`, and both pharmacists returned as bookable choices                                                                                                                      |
| Playwright quarantine upload                                                | PASS. A synthetic PDF goes through the scan step. The page does not say a file was marked clean without a scan                                                                                                                        |
| ClamAV engine                                                               | PASS on this machine. `clamscan` 1.5.4 accepted a plain text file (exit 0) and reported `Eicar-Signature FOUND` for the EICAR test file (exit 1). CI does not install ClamAV, so this engine check is not part of the GitHub workflow |
| Playwright for the correction screen and the released-report name           | NOT EXECUTED. Those rules are covered by pgTAP, not by a browser journey                                                                                                                                                              |
| Full Playwright suite                                                       | NOT EXECUTED                                                                                                                                                                                                                          |
| Screen reader                                                               | NOT EXECUTED                                                                                                                                                                                                                          |
| Public intake, live payments, prescribing, SES, IONOS DNS, store submission | BLOCKED. Unchanged                                                                                                                                                                                                                    |

Screenshots:

- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/medsinfocus/homepage.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/medsinfocus/portal.png`

## Phase 7: Staff audit log

**Status:** built on `cursor/phase-7-follow-on`, stacked on Phase 6. Not deployed. Public intake,
live payments and store submission stay off. The clinical wording approved for development on
8 November 2026 was not rewritten. Synthetic data only.

A verified operations administrator or clinical administrator can open `/staff/audit` after MFA.
The page lists recent events. Details are limited to identifiers, flags and short codes. A
verified pharmacist is sent to the not-found page, and the database already hides the log from
that role.

| Check                                                                                   | Result                                                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Format, lint                                                                            | PASS                                                                                                     |
| Typecheck                                                                               | PASS. The web production build also includes `/staff/audit`                                              |
| Vitest                                                                                  | PASS. Domain 87, web 30, validation 38, ui 8, mobile 8                                                   |
| pgTAP after database reset                                                              | PASS. 10 files, 281 assertions. A verified pharmacist cannot read the audit log                          |
| Playwright audit screen, including axe                                                  | PASS. `e2e/access.spec.ts`. An operations administrator sees `staff_role.created`. A pharmacist gets 404 |
| Full Playwright suite                                                                   | NOT EXECUTED this phase. The new test was run on its own                                                 |
| Screen reader on the audit screen                                                       | NOT EXECUTED                                                                                             |
| Public intake, live payments, store submission                                          | BLOCKED. Unchanged                                                                                       |
| Malware scanner, SES, Stripe, hosting, EAS, MHRA, CQC, indemnity, DPIA, retention clock | BLOCKED. Not started. See the Phase 7 note in IMPLEMENTATION_PLAN.md                                     |

Screenshot:

- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-7/audit-log.png`

## Phase 6: Local mobile app

**Status:** a local Expo app on `cursor/phase-6-mobile`, stacked on Phase 5. Not submitted to a
store. No EAS project. The identifier is `uk.pharma247.pharmreview.dev`. The trading name is
shown as provisional. Public intake and live payments stay off. Synthetic data only.

What works, checked on 7 November 2026 (London):

- Sign-in keeps the session in secure storage on a device, and in sessionStorage for the web
  preview. Unit tests show a long session round-trips and is then deleted. Logs drop anything
  that is not an allowed event name.
- The home screen shows the review status, what to do next, and the appointment. Payment and
  booking are links to the website. The app has no card form.
- A released report uses the same section builder as the website. A draft, even with complete
  content, renders only "Drafts are not shown here." The emergency limitation is on every screen.
- Messages use the shared out-of-hours warning and have no attachment control. Documents can be
  chosen only while the questionnaire is open, with the same file checks as the website. The app
  says no scanner is connected.

| Check                                  | Result                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Mobile format, typecheck, lint, Vitest | PASS. Domain patient-action tests included (domain 83). Mobile 8 tests |
| Expo web layout preview                | PASS. No page errors. Screenshots below                                |
| Android emulator or a physical device  | NOT EXECUTED. No emulator is installed on this machine                 |
| Apple or Google store submission       | BLOCKED. Not registered and not submitted                              |
| Screen reader on the app               | NOT EXECUTED                                                           |
| Public intake and live payments        | BLOCKED. Unchanged                                                     |

Screenshots from the Expo web preview, labelled as synthetic and not a patient record:

- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-6/sign-in.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-6/home.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-6/report.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-6/report-hidden.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-6/messages.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-6/documents.png`

## Phase 5: Launch assurance

**Status:** assurance checks added on `cursor/phase-5-launch-assurance`, stacked on Phase 4. Not
deployed. Public intake, live payments and real email stay off. No clinical, legal or regulatory
approval is claimed. R-01, R-02 and R-03 stay as built.

Checked locally on 7 November 2026 (London), after `supabase db reset` and then the test suite.
An earlier pgTAP run against a database that already held Playwright rows failed in
`006_questionnaire_documents_retention` and `009_payments_and_booking`: those files read
`deletion_requests` and `checkout_sessions` as the database owner, and more than one row existed.
That is test isolation, not a product failure. CI starts from a reset database. The result below
is that run.

| Check                                                                                                                                                                  | Result                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Format, typecheck, lint                                                                                                                                                | PASS                                                                                                       |
| Vitest                                                                                                                                                                 | PASS. Domain 81, web 30, validation 38, ui 8                                                               |
| Schema lint                                                                                                                                                            | PASS                                                                                                       |
| pgTAP after database reset                                                                                                                                             | PASS. 10 files, 280 assertions. Includes unpaid release (`010`) and release without a consultation (`007`) |
| Playwright                                                                                                                                                             | PASS. 75 tests, 1.3 min                                                                                    |
| Priority journey (register, verify, screen, consent, questionnaire, test payment, book, pharmacist MFA, consult, approve, generate, release, patient reads the report) | PASS. `e2e/journey.spec.ts`                                                                                |
| Draft report hidden, including the PDF route                                                                                                                           | PASS in that journey. The file returned 404 before release                                                 |
| Payment rows and provider events contain no health details, and the event body is not stored                                                                           | PASS in that journey, plus `payment-metadata.test.ts`                                                      |
| Emails in the journey contain no health details                                                                                                                        | PASS                                                                                                       |
| Auth rate limit                                                                                                                                                        | PASS. `e2e/auth.spec.ts`, ten failures then "Too many attempts"                                            |
| Signed document link expires                                                                                                                                           | PASS. The route's link is about 60 seconds. A one-second link was rejected after it expired                |
| Keyboard-only screening and booking                                                                                                                                    | PASS. `e2e/assurance.spec.ts`. Desktop Chromium only                                                       |
| Emergency screening blocks checkout                                                                                                                                    | PASS. Existing `e2e/intake.spec.ts`                                                                        |
| Second patient, unassigned pharmacist, operations administrator                                                                                                        | PASS. Existing clinical, access and pgTAP tests. Not removed                                               |
| Screen-reader test                                                                                                                                                     | NOT EXECUTED                                                                                               |
| Other browsers, penetration test, backup restore drill                                                                                                                 | NOT EXECUTED                                                                                               |
| Clinical wording, MHRA, CQC, indemnity, legal pages, DPIA, company and ICO details, VAT, brand, Stripe live, SES, hosting region                                       | BLOCKED. See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md). None are marked approved                      |

PDF pages, opened with poppler. Both pages are labelled DRAFT. The agreed sections continue onto page 2.

- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-5/report-page-1.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-5/report-page-2.png`

## Phase 4: Pharmacist workspace, reports, messages and GP letters

**Status:** implemented on branch `cursor/phase-4-clinical-workspace`, stacked on Phase 3. Not
deployed. Synthetic data only. No live Stripe, no real email, no NHS connection. Clinical wording
in the report and GP letter is **DRAFT pending clinical approval**. Public intake and live
payments stay off.

What works, checked locally on 7 November 2026 (London):

- A clinical administrator assigns a pharmacist. The pharmacist, with an authenticator, records a
  telephone consultation, writes the report, approves it, creates a multi-page PDF, and releases
  it. The patient sees that version. A second patient and another pharmacist get a 404.
- Before release, the patient is told no report has been released. The findings text is not on
  the page.
- The release email and the message email use the generic account template. Neither contains the
  medicine name or the message text.
- A GP letter needs this patient's agreement and a practice name. The recorded dispatch says the
  letter was not transmitted.
- The database rejects an unpaid release, an operations administrator assigning or reading
  clinical rows, a direct instruction to stop a medicine, and a medication-review report on a
  declined order. A generation failure stays hidden and can be retried.

| Check                                                    | Result                                                                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format, typecheck, lint                                  | PASS                                                                                                                                                                                |
| Vitest                                                   | PASS. Domain 81, web 29, validation 38, ui 8                                                                                                                                        |
| pgTAP, including file `010_phase4_clinical_access`       | PASS. 10 files, 280 assertions                                                                                                                                                      |
| Schema lint                                              | PASS                                                                                                                                                                                |
| Playwright, 72 tests                                     | PASS. 1.1 min. Includes record, approve, generate, release, patient view, and denial of a second patient and an unassigned pharmacist. Axe on the workspace and the released report |
| Screen reader and browsers other than Chromium           | NOT EXECUTED                                                                                                                                                                        |
| Real Stripe, live email, NHS send, background PDF worker | NOT EXECUTED                                                                                                                                                                        |
| Clinical approval of the report and GP letter wording    | BLOCKED. The text is marked DRAFT                                                                                                                                                   |
| Public intake, live payments, delivery to a real patient | BLOCKED until the launch sign-offs                                                                                                                                                  |

Screenshots:

- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-4/pharmacist-workspace.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-4/report-ready.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-4/patient-report.png`
- `/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-4/messages.png`

## Phase 3: Test checkout and booking

**Status:** implemented on branch `cursor/phase-3-payments-booking`, stacked on Phase 2. Not
deployed. No Stripe test key is configured, so checkout uses a labelled local harness that signs
events the way Stripe documents. No live charge is made. Synthetic data only.

What works, checked locally:

- A cleared review pays £59 taken from the database, then books a pharmacist's open 30-minute
  slot. The email says the appointment changed and does not name a medicine.
- An emergency answer cannot start checkout.
- The same payment event does not pay twice. A wrong amount is rejected. A second booking of the
  same time is rejected by the database. A recorded refund is not sent to a card provider.
- An operations administrator can read the payment and still cannot read the questionnaire.

| Check                                            | Result                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Format, typecheck, lint                          | PASS (recorded with the final run)                                                           |
| Vitest                                           | PASS. Domain 65, web 27, validation 38, ui 8                                                 |
| pgTAP, including file `009_payments_and_booking` | PASS. 9 files, 237 assertions                                                                |
| Schema lint                                      | PASS                                                                                         |
| Playwright, 71 tests                             | PASS. 53.7s. Includes pay-then-book and an emergency answer blocking checkout                |
| Real Stripe API checkout                         | NOT EXECUTED. No `sk_test_` key. The local harness is the stand-in and is labelled on screen |
| Live card payments                               | BLOCKED until the launch sign-offs. A live secret key is refused                             |
| Screen reader and other browsers                 | NOT EXECUTED                                                                                 |

## Phase 2: Patient intake

Product-owner decisions P-01 to P-11 (7 November 2026) are recorded in
[DECISION_LOG.md](./DECISION_LOG.md) and implemented for development. They are not clinical, legal
or regulatory certification. The active screening rule set is `2026-11-draft.2` (four questions).
Not sure is never treated as no. PHARMA247 LTD and Cheuk Kin Sung (GPhC 2234388, live register
check pending) are shown on the legal pages. Phone, email, ICO number and insurance are still
placeholders. Public intake and payments stay disabled.

**Status:** implemented on branch `cursor/phase-2-patient-intake`, stacked on Phase 1. Not
deployed. Synthetic data only. The live clinical service is **disabled**: no launch sign-offs
are recorded and the rule set is pending clinical approval. No Stripe, no SES, no real emails.

Follow-up check after P-01 to P-11, same day: format, typecheck and lint passed. Vitest 131
(domain 60, validation 38, web 25, ui 8). `supabase db reset`, schema lint, and pgTAP passed
(8 files, 217 assertions). Playwright and axe passed (70 tests, 51.5s).

Evidence was produced on 7 November 2026 on the Cloud VM with the same toolchain as Phase 1
(Node 22.23.4, pnpm 10.33.4, Docker 29.9.3, Supabase CLI 3.0.0 / Postgres 17, Playwright 1.65
Chromium).

### What genuinely works (verified end to end locally)

- **Emergency answers stop everything.** The patient sees the full warning and an instruction to
  call 999 immediately. The order becomes terminally excluded. The UI offers no way forward, and
  the database rejects re-screening, questionnaire drafts and any move to payment, even when the
  service is live.
- **Urgent answers pause the request.** The patient is advised to contact their GP or NHS 111.
  Payment and booking are blocked for all of the patient's orders until a verified pharmacist
  with MFA records a documented reassessment.
- **Routine intake works end to end:**
  - Flags are recorded but never block, and nothing says the medicines are safe.
  - Explicit consents are captured.
  - The four-step questionnaire saves drafts and resumes from the dashboard.
  - Medicines can be added and removed, with per-field "don't know".
  - Validation errors are linked to their fields.
  - The full warning appears at the final checkpoint.
  - Submission creates version 1, and a controlled amendment creates version 2 while keeping
    version 1 unchanged.
  - A generic notification with no health details arrives in local Mailpit.
- **Private document upload:**
  - Files are type-, size- and magic-byte-checked, then stored per patient.
  - They are marked "waiting for security scan". The scanner is a labelled stub.
  - Clinicians cannot see unscanned files, and other patients cannot list them.
- **Deletion requests** record a retention assessment and never erase clinical records. Lawful
  holds block purges.
- **Report-release gate:** every section 8 condition is enforced in the database for all roles.
  The service role, clinical admins, unassigned pharmacists and pharmacists without MFA cannot
  approve or release.
- **Kill switch:**
  - Production mode without sign-offs keeps intake closed.
  - Development mode opens synthetic intake but never payments.
  - All sign-offs plus an approved rule set open payments, and revoking one sign-off closes them
    again.
- **Staff MFA:** new staff enrol TOTP with a real code before reaching `/staff`. Staff signed in
  with a password only (aal1) get no staff data from the database.
- **Brand and legal pages:**
  - The brand defaults to "PharmReview", flagged provisional.
  - The five legal pages show explicit placeholders for every company, ICO, GPhC, VAT and
    indemnity value.
  - The pricing page states that no VAT is added and that payments are switched off.

### Test results

| #     | Check                                                                                                                                                           | Command                                            | Result           | Evidence                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| P2-1  | Formatting                                                                                                                                                      | `pnpm format:check`                                | **PASS**         | All matched files use Prettier code style                                                                             |
| P2-2  | TypeScript, 4 packages                                                                                                                                          | `pnpm typecheck`                                   | **PASS**         | 4/4 successful                                                                                                        |
| P2-3  | ESLint, 4 packages                                                                                                                                              | `pnpm lint`                                        | **PASS**         | 0 problems                                                                                                            |
| P2-4  | Vitest: domain (screening fixture cases, section 8 gate, order lifecycle, exact banner text, business config, migration/JSON parity, generated pgTAP freshness) | `pnpm test`                                        | **PASS**         | 70 passed                                                                                                             |
| P2-5  | Vitest: validation (questionnaire, upload checks)                                                                                                               | `pnpm test`                                        | **PASS**         | 38 passed                                                                                                             |
| P2-6  | Vitest: web (status mapping, error mapping, notification template, redirects, rate limiter)                                                                     | `pnpm test`                                        | **PASS**         | 25 passed                                                                                                             |
| P2-7  | Vitest: ui                                                                                                                                                      | `pnpm test`                                        | **PASS**         | 8 passed                                                                                                              |
| P2-8  | Production build                                                                                                                                                | `pnpm --filter @mrd/web build`                     | **PASS**         | Next.js 16.4.5, 29 dynamic routes + proxy                                                                             |
| P2-9  | Migrations from scratch + seed                                                                                                                                  | `supabase db reset`                                | **PASS**         | 3 migrations applied                                                                                                  |
| P2-10 | Schema lint (plpgsql_check)                                                                                                                                     | `supabase db lint --level warning --fail-on error` | **PASS**         | "No schema errors found" (after fixing 2 false-positive errors and 2 warnings)                                        |
| P2-11 | pgTAP, 7 files                                                                                                                                                  | `supabase test db`                                 | **PASS**         | Files=7, Tests=219, Result: PASS                                                                                      |
| P2-12 | Documented screening cases in the database (24 cases + 3 invalid, generated from fixture)                                                                       | `004_safety_rule_cases`                            | **PASS**         | 52 assertions                                                                                                         |
| P2-13 | Emergency blocks purchase: pgTAP                                                                                                                                | `005_…kill_switch`                                 | **PASS**         | Excluded order cannot reach `awaiting_payment` even when live                                                         |
| P2-14 | Emergency blocks purchase: Playwright (UI + Data API)                                                                                                           | `intake.spec.ts`                                   | **PASS**         | "emergency answers stop intake and block purchase"                                                                    |
| P2-15 | Report-release gate                                                                                                                                             | `007_report_release_gate`                          | **PASS**         | 26 assertions                                                                                                         |
| P2-16 | Playwright + axe, desktop + mobile Chromium                                                                                                                     | `pnpm test:e2e`                                    | **PASS**         | 70 passed (52.1s), 0 failed, 0 flaky                                                                                  |
| P2-17 | axe WCAG 2.0/2.1/2.2 A+AA on intake screens (screening, outcomes, consent, questionnaire steps, documents, settings, MFA)                                       | within P2-16                                       | **PASS**         | 0 violations                                                                                                          |
| P2-18 | GitHub Actions CI on the Phase 2 PR (quality, database, e2e)                                                                                                    | `.github/workflows/ci.yml`                         | **PASS**         | [Run 42327299333](https://github.com/EnchanteStore/medicine-review-direct/actions/runs/42327299333): all 3 jobs green |
| P2-19 | Clinical approval of rule set, short banner, term list                                                                                                          | n/a                                                | **BLOCKED**      | Awaiting owner (CLINICAL_SAFETY CS-01a, CS-05, CS-06, CS-15)                                                          |
| P2-20 | Legal review of the five pages                                                                                                                                  | n/a                                                | **BLOCKED**      | Awaiting solicitor                                                                                                    |
| P2-21 | Real malware scanning                                                                                                                                           | n/a                                                | **NOT EXECUTED** | Scanner is a labelled stub                                                                                            |
| P2-22 | SES email delivery                                                                                                                                              | n/a                                                | **NOT EXECUTED** | Not implemented by design (local Mailpit only)                                                                        |
| P2-23 | Stripe payments                                                                                                                                                 | n/a                                                | **NOT EXECUTED** | Phase 3; payments disabled by kill switch                                                                             |
| P2-24 | Pharmacist workspace UI for consultation and report release                                                                                                     | n/a                                                | **NOT EXECUTED** | Phase 4 (database gate is tested)                                                                                     |
| P2-25 | Scheduled retention job, storage-object purge                                                                                                                   | n/a                                                | **NOT EXECUTED** | Designed; purge function tested, not scheduled                                                                        |
| P2-26 | Screen reader, Firefox/Safari, penetration test                                                                                                                 | n/a                                                | **NOT EXECUTED** | Phase 5                                                                                                               |

### Playwright run (Phase 2, full list)

```
access.spec  › a patient cannot open the staff area
access.spec  › an unverified pharmacist cannot open the staff area
access.spec  › verified staff without MFA are sent to two-step verification
access.spec  › a patient cannot open the MFA page
access.spec  › a new ops_admin enrols a TOTP authenticator and then reaches the staff area
access.spec  › a new pharmacist enrols a TOTP authenticator and then reaches the staff area
access.spec  › a patient can read only their own profile and consents
access.spec  › a patient cannot update another user or escalate privileges
access.spec  › an ops admin cannot read patient profiles or consents
access.spec  › anonymous visitors can read active prices but nothing personal
access.spec  › verified staff signed in without MFA (aal1) get no staff data from the API
access.spec  › the active rule set in the database matches the reviewed JSON definition
access.spec  › anonymous visitors see the service as closed for payments
auth.spec    › 9 registration, verification, reset, enumeration, redirect and rate-limit tests
intake.spec  › emergency answers stop intake and block purchase (UI and database)
intake.spec  › urgent answers pause the request until a pharmacist reassesses it
intake.spec  › routine intake: consent, multi-step questionnaire with drafts, submission, amendment and generic email
intake.spec  › private document upload with type checks and stubbed scanning
intake.spec  › account deletion request records retention without erasing clinical records
intake.spec  › notification email to a seeded inbox contains no health details
public.spec  › 42 tests: 13 pages x desktop/mobile with banner, placeholder and axe checks, plus pricing,
               404, skip link, headers, navigation, contact redirect, placeholder values, preview notice
70 passed (52.1s)
```

### Issues found and fixed during Phase 2 testing

- A pgTAP test assumed an unassigned pharmacist could see an urgent-hold order. RLS correctly hid
  it, so the test now assigns the pharmacist first, as the real workflow would.
- A purge test re-triggered `updated_at = now()`, which made the order look recent. Test fixed.
- The deletion-request E2E raced sign-in, and the page correctly re-rendered to show the request
  status. Test fixed.
- A copy replacement silently missed in the footer and left old "working name" text. Fixed, and
  the brand is now configuration-driven.
- Schema lint: inline `app.require_user()` calls produced false-positive lint errors, so they
  were moved into variable assignments. Also fixed: `evaluate_screening` was marked immutable
  (now stable), and an unused variable was removed.

### Screenshots (synthetic data)

Stored in the project store under `media/phase-2/`:

- `emergency-banner-screening-checkpoint.png`
- `screening-emergency-exclusion.png`
- `questionnaire-medicines-step.png`
- `legal-terms-placeholders.png`

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

| #   | Check                                                                                                            | Command                                            | Result           | Evidence                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Formatting                                                                                                       | `pnpm format:check`                                | **PASS**         | "All matched files use Prettier code style!"                                                                                                                     |
| 2   | TypeScript (4 packages, strict)                                                                                  | `pnpm typecheck`                                   | **PASS**         | Turbo: 4 successful, 4 total                                                                                                                                     |
| 3   | ESLint (4 packages)                                                                                              | `pnpm lint`                                        | **PASS**         | Turbo: 4 successful, 0 problems                                                                                                                                  |
| 4   | Vitest: `packages/domain` (state machines, release guard, roles, pricing)                                        | `pnpm test`                                        | **PASS**         | 2 files, 20 tests passed                                                                                                                                         |
| 5   | Vitest: `packages/validation` (Zod schemas)                                                                      | `pnpm test`                                        | **PASS**         | 1 file, 29 tests passed                                                                                                                                          |
| 6   | Vitest: `packages/ui` (components, a11y wiring, jsdom)                                                           | `pnpm test`                                        | **PASS**         | 1 file, 8 tests passed                                                                                                                                           |
| 7   | Vitest: `apps/web` (safe redirect, rate limiter, date fields)                                                    | `pnpm test`                                        | **PASS**         | 1 file, 18 tests passed                                                                                                                                          |
| 8   | Production build                                                                                                 | `pnpm --filter @mrd/web build`                     | **PASS**         | Next.js 16.4.5: compiled successfully, 22 routes + proxy                                                                                                         |
| 9   | Migrations from scratch + seed                                                                                   | `supabase db reset`                                | **PASS**         | "Finished supabase db reset"                                                                                                                                     |
| 10  | Schema lint                                                                                                      | `supabase db lint --level warning --fail-on error` | **PASS**         | "No schema errors found"                                                                                                                                         |
| 11  | pgTAP RLS tests                                                                                                  | `supabase test db`                                 | **PASS**         | Files=3, Tests=62, Result: PASS                                                                                                                                  |
| 12  | pgTAP harness sanity (deliberately wrong assertion)                                                              | temporary test file                                | **PASS**         | Harness reported `Failed: 1`, `Result: FAIL`; file removed                                                                                                       |
| 13  | Playwright E2E + axe (desktop + mobile Chromium)                                                                 | `pnpm test:e2e`                                    | **PASS**         | 55 passed (34.7s), 0 failed, 0 flaky                                                                                                                             |
| 14  | axe-core WCAG 2.0/2.1/2.2 A+AA on 14 pages x 2 viewports, plus sign-up error, profile error and dashboard states | within #13                                         | **PASS**         | 0 violations                                                                                                                                                     |
| 15  | GitHub Actions CI on the PR (quality, database, e2e jobs)                                                        | `.github/workflows/ci.yml`                         | **PASS**         | [Run 42322000113](https://github.com/EnchanteStore/medicine-review-direct/actions/runs/42322000113): all 3 jobs green; pgTAP Tests=62 PASS; Playwright 55 passed |
| 16  | Manual screen-reader testing (NVDA/VoiceOver)                                                                    | n/a                                                | **NOT EXECUTED** | No screen reader on the VM; axe does not replace this                                                                                                            |
| 17  | Real-user accessibility testing with older users                                                                 | n/a                                                | **NOT EXECUTED** | Phase 5                                                                                                                                                          |
| 18  | Cross-browser (Firefox, WebKit/Safari)                                                                           | n/a                                                | **NOT EXECUTED** | Only Chromium installed; add projects in Phase 5                                                                                                                 |
| 19  | Penetration test / security scan                                                                                 | n/a                                                | **NOT EXECUTED** | Phase 5                                                                                                                                                          |
| 20  | Clinical content review                                                                                          | n/a                                                | **BLOCKED**      | Awaiting pharmacist owner approval (CLINICAL_SAFETY.md)                                                                                                          |
| 21  | Payment, booking, report, PDF, messaging tests                                                                   | n/a                                                | **NOT EXECUTED** | Features not in Phase 1 scope                                                                                                                                    |

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
