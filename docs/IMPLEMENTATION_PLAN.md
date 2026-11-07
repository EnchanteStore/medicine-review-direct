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

## Phase 3: Commercial workflow

- Stripe hosted Checkout in **test mode**. Note that the order trigger only allows payment
  states when the live service is enabled, so test-mode payments need a deliberate local-only
  approach (for example, synthetic sign-offs in a disposable database), decided at the start of
  Phase 3. Server-side prices; webhook signature verification;
  idempotent `stripe_events`; payments, receipts, refunds with audit; manual audited workflow.
- Booking: pharmacist availability, Europe/London display, slot exclusion constraints (no
  double-booking under concurrency), reschedule and cancellation rules, generic emails.
- Notification abstraction with dev/test transport only.
- Postgres-backed job queue and `apps/worker` for emails and retries.
- Tests: payment success/failure/duplicate webhook, concurrency booking test, refund flow.

## Phase 4: Clinical operations

- Staff invitations and independent verification records (MFA is already enforced).
- Admin: queues, assignment, availability, billing/refunds, audit viewer, service configuration
  (ops admin cannot see clinical content).
- Pharmacist workspace: assigned reviews, questionnaire, documents, safety answers, appointment,
  consultation record, notes, medication issues, recommendations, monitoring, GP discussion points.
- Reports: pharmacist UI on top of the existing database gate. Draft → approve → generate PDF
  (React PDF, server-side, in worker) → ready → explicit release; recoverable generation
  failure; corrections as new versions.
- Messaging (append-only, unread indicators, attachments, contentless notifications,
  out-of-hours warning).
- GP letter with case-specific consent and verified recipient; dispatch evidence.
- Tests: full journey E2E (registration through report release), permission boundaries,
  report-never-auto-visible, unpaid-cannot-release.

## Phase 5: Assurance and launch preparation

- DCB0129 clinical safety case and hazard log, Clinical Safety Officer sign-off.
- DPIA, privacy notice, retention schedule and jobs, legal review of all policy pages.
- Penetration test, nonce-based CSP, shared rate-limit store, backup/restore drill, monitoring
  and alerting, incident runbooks, accessibility audit with real users.
- Staging and production environments in the approved region; Stripe live activation **only with
  explicit owner approval**.

## Phase 6: Native apps

- Expo / React Native app reusing `packages/domain` and `packages/validation`, a typed
  `packages/api-client`, and the same Supabase Auth and RLS. Push notifications without health
  content.

## Priority E2E scenarios (from the brief) and where they land

| #   | Scenario                               | Phase | Status                                                   |
| --- | -------------------------------------- | ----- | -------------------------------------------------------- |
| 1   | Registration and email verification    | 1     | Automated, passing                                       |
| 2   | Sign-in/out and password reset         | 1     | Automated, passing                                       |
| 3   | Profile with validation                | 1     | Automated, passing                                       |
| 4   | Questionnaire draft, submit, amend     | 2     | Not started                                              |
| 5   | Emergency screening blocks purchase    | 2     | Domain rule unit-tested; UI not started                  |
| 6   | Document upload and scanning           | 2     | Not started                                              |
| 7   | Purchase via Stripe test mode          | 3     | Not started                                              |
| 8   | Booking without double-booking         | 3     | Not started                                              |
| 9   | Pharmacist pre-review and consultation | 4     | Not started                                              |
| 10  | Report approve, generate, release      | 4     | Domain rule unit-tested                                  |
| 11  | Patient views released report only     | 4     | Not started                                              |
| 12  | GP letter with consent                 | 4     | Not started                                              |
| 13  | Cross-patient access denied            | 1     | Automated (pgTAP + Data API), passing                    |
| 14  | Unauthorised/unverified staff denied   | 1     | Automated (pgTAP + UI), passing                          |
| 15  | Ops admin denied clinical records      | 1     | Automated (pgTAP + Data API), passing for current tables |

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
