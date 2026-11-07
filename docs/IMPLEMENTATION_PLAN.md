# Implementation plan

Each phase is delivered as vertical slices (UI, validation, server logic, database rules, error
handling and tests together). Nothing is claimed as working unless it is tested; mocks and stubs
are labelled.

## Phase 1: Foundation — complete (see PROGRESS.md)

- Architecture, database/RLS design, security model, clinical safety register, decision log.
- pnpm + Turborepo monorepo; strict TypeScript; ESLint; Prettier; GitHub Actions CI.
- Design system (tokens + accessible components).
- Local Supabase in Docker; foundation migration (profiles, staff_roles, consents, audit_log,
  products); pgTAP RLS tests.
- Public website (11 pages; legal and clinical-safety pages marked DRAFT); server-sourced price.
- Patient registration: sign-up, email verification (Mailpit locally), sign-in/out, password
  reset, Zod-validated profile, protected dashboard shell, staff area shell, rate limiting.
- Vitest, Playwright and axe tests.

## Phase 2: Patient intake — implemented (see PHASE_2_SPEC.md and PROGRESS.md)

- Configurable trading name ("PharmReview", provisional) and business identity with placeholders.
- Emergency banner: the exact full wording at checkpoints; a short persistent version.
- Five legal pages with marked placeholders.
- Versioned DRAFT safety rule set with three pathways, evaluated in the database; documented
  test cases; urgent reassessment; complexity review.
- Review orders, consent capture, multi-step questionnaire with drafts, versioned submission and
  amendments; private document upload (scanner stubbed); dashboard status.
- Retention settings, lawful holds, deletion requests, purge function (not scheduled).
- Report-release gate schema and tests (pharmacist UI is Phase 4).
- Live-service kill switch tied to launch sign-offs.
- Staff TOTP MFA enforced in the database.

Deferred from Phase 2:

- real malware scanning
- an SES transport
- patient MFA
- phone verification (SMS disabled)
- a scheduled retention job
- storage-object purge

## Phase 3: Commercial workflow — test checkout and booking implemented

- Labelled local test checkout (Stripe's signature scheme). No `sk_test_` key is configured, so
  the hosted Stripe API is not called. A live secret key is refused. The price is the database
  price (£59). Development may open this test checkout. Production stays closed until launch
  sign-offs. Emergency and urgent exclusions still cannot pay.
- Signature-checked webhook, idempotent provider events, one successful payment per order,
  receipts, and recorded refunds that are not sent to Stripe. An MFA operations administrator
  can record a manual payment. The audit trail stores amounts and references, not clinical text.
- Booking after a confirmed payment: pharmacist availability, 30-minute slots shown in UK time,
  a database exclusion constraint against double-booking, up to two reschedules and only more
  than 24 hours ahead, cancellation requests, and an appointment history. Emails say an
  appointment changed and contain no health details.
- Still later: the real Stripe test-mode API once a test key exists, `apps/worker`, and the
  background job queue.

## Phase 4: Clinical operations

Built on `cursor/phase-4-clinical-workspace`:

- Clinical administrator assigns a verified pharmacist. Operations administrators cannot assign
  or read clinical content.
- Pharmacist workspace for assigned reviews: questionnaire, medicines, concerns, safety answers,
  clean documents (60-second link), payment and appointment, consultation with required notes.
- Report sections, approval, server-side multi-page PDF, recoverable generation failure, and a
  separate release. The patient sees only the released version. The email has no health details.
- An unpaid or refunded review cannot be released. A declined, urgent or emergency-excluded
  review can record a safety note or referral, not a medication-review report.
- Messages: append-only, unread, timestamps, generic notification, out-of-hours warning.
- GP letter: case-specific consent, practice name checked with the patient, dispatch recorded
  as not sent.

Still later, and not claimed as done:

- Staff invitations and an evidence pack for independent verification.
- Message attachments, a correction as a new report version, and a background worker for PDFs.
- An audit-log screen. Availability and recorded refunds already exist from Phase 3.

## Phase 5: Assurance and launch preparation

Built on `cursor/phase-5-launch-assurance`. This slice does not open the service.

- One Playwright journey from registration and email verification through routine screening,
  consent, questionnaire, labelled test payment, booking, pharmacist consultation, approval, PDF
  generation, release, and the patient reading the report. Drafts stay hidden until release.
- The existing denial tests stay: second patient, unassigned pharmacist, operations administrator,
  and an emergency answer blocking checkout.
- Local security checks: sign-in rate limit, no health details in emails or stored payment rows,
  release gate for unpaid and unconsulted orders (pgTAP), and document links that expire.
- Keyboard-only screening and booking. Screen-reader testing is not done.
- The generated PDF is opened and checked for the agreed sections, a page break, and the DRAFT
  label. [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) and
  [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) record what is still blocked.

Still later, and not claimed as done:

- DCB0129 clinical safety case and Clinical Safety Officer sign-off.
- DPIA, solicitor-approved legal pages, and the retention job.
- Penetration test, nonce-based CSP, shared rate-limit store, a backup restore drill, monitoring,
  and an accessibility audit with screen-reader users.
- Staging and production in London. Live Stripe only after an explicit owner decision.

## Phase 6: Native apps

- Expo / React Native app reusing `packages/domain` and `packages/validation`, a typed
  `packages/api-client`, and the same Supabase Auth and RLS. Push notifications without health
  content.

## Priority E2E scenarios (from the brief) and where they land

| #   | Scenario                               | Phase | Status                                                                      |
| --- | -------------------------------------- | ----- | --------------------------------------------------------------------------- |
| 1   | Registration and email verification    | 1     | Automated, passing                                                          |
| 2   | Sign-in/out and password reset         | 1     | Automated, passing                                                          |
| 3   | Profile with validation                | 1     | Automated, passing                                                          |
| 4   | Questionnaire draft, submit, amend     | 2     | Passing in `intake.spec.ts`                                                 |
| 5   | Emergency screening blocks purchase    | 2     | Passing in `intake.spec.ts`                                                 |
| 6   | Document upload and scanning           | 2     | Passing. Scanner is still a labelled stub                                   |
| 7   | Purchase via Stripe test mode          | 3     | Local signed test harness passing. Real Stripe API not called (no test key) |
| 8   | Booking without double-booking         | 3     | Passing. Database exclusion constraint plus a Playwright booking            |
| 9   | Pharmacist pre-review and consultation | 4     | Passing in `clinical.spec.ts` and the Phase 5 journey                       |
| 10  | Report approve, generate, release      | 4     | Passing, including the database gate                                        |
| 11  | Patient views released report only     | 4     | Passing. The journey also checks the draft is hidden                        |
| 12  | GP letter with consent                 | 4     | Passing in `clinical.spec.ts`. Letter is not sent (R-01)                    |
| 13  | Cross-patient access denied            | 1     | Automated (pgTAP + Data API), passing                                       |
| 14  | Unauthorised/unverified staff denied   | 1     | Automated (pgTAP + UI), passing                                             |
| 15  | Ops admin denied clinical records      | 1     | Automated (pgTAP + Data API), passing for current tables                    |

## Pre-launch blockers (owner decision section 9)

The live clinical service, public intake and patient payments stay disabled until every item is
signed off in `launch_signoffs` and the rule set is approved. The full checklist, with the
database gate name for each item, is in [PHASE_2_SPEC.md section 9](./PHASE_2_SPEC.md#pre-launch-blockers-checklist).
Summary:

1. Clinical screening content and escalation SOP
2. Operational response arrangements
3. MHRA medical-device classification assessment
4. CQC scope assessment
5. Professional indemnity
6. Legal terms and privacy notice
7. Retention policy and DPIA
8. Company, ICO and GPhC details
9. VAT and brand checks
10. Data residency, processor agreements and security review (including a real malware scanner)
