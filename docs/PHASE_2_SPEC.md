# Phase 2 specification: patient intake

> Update, 7 November 2026. Product-owner decisions P-01 to P-11 replace the earlier 16-question
> screen and the first banner draft. The active rule set is `2026-11-draft.2` (four questions).
> Not sure is never treated as no. See [DECISION_LOG.md](./DECISION_LOG.md). Nothing in that
> decision is clinical, legal or regulatory certification.

Source: owner decisions by Eason Sung, 7 November 2026 (binding). This document records those
decisions and how the software implements them. Where software cannot settle a matter (clinical,
legal, regulatory), it is listed as a **pre-launch blocker** in section 9 and the live service
stays disabled.

## 1. Launch scope

| Decision                                                                                                        | Implementation                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private pharmacist-led reviews for adults 18+, England first                                                    | Adult checks at sign-up, in the profile form and in the database (`app.validate_profile`)                                                                                                                 |
| Telephone **or** secure video consultations                                                                     | `consultations.method in ('telephone','secure_video')`; the questionnaire asks the patient's preference; consent covers both                                                                              |
| Structured medication questionnaire and secure document upload                                                  | Built (sections 6 and 7 below)                                                                                                                                                                            |
| Reports prepared, checked and signed by a GPhC-registered pharmacist                                            | Release gate (section 8) records the approving pharmacist's name and GPhC number                                                                                                                          |
| No emergency or same-day urgent care; no autonomous diagnosis, prescribing or medicine changes; no AI decisions | Screening routes emergencies to 999 and urgent problems to GP/NHS 111. No AI anywhere in the code path                                                                                                    |
| No NHS affiliation claims or record access                                                                      | Footer and legal pages say so; no NHS integration exists                                                                                                                                                  |
| Higher-risk or complex patients need an individual suitability assessment                                       | Any routine flag, high-risk medicine name match or 10+ medicines sets `suitability_review_required`. The database blocks booking until a pharmacist records a `complexity_review` with outcome `suitable` |

## 2. Safety screening: three pathways

**Rule set:** `2026-11-draft.1`, stored once as JSON (`packages/domain/src/safety/ruleset-2026-11-draft-1.json`)
and embedded in the migration. A unit test checks that the migration and the JSON match, and an
E2E test checks that the database row and the JSON match. Status is **DRAFT** until clinically
approved. Definitions are immutable: changing a rule means creating a new version.

**Evaluation is done in the database** (`app.evaluate_screening`, called by
`public.submit_safety_screening`), so a client cannot choose its own outcome. The TypeScript
mirror (`evaluateScreening`) and the SQL version are tested against the same documented
fixture (`screening-test-cases.json`): 24 cases (positive, negative and ambiguous) and 3 invalid
inputs. The pgTAP file for these cases is generated from the fixture, and a unit test fails if
that generated file is out of date.

| Pathway             | Questions                                                                                                                                                          | Effect                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Emergency exclusion | E1 heart attack, E2 stroke, E3 severe breathing difficulty, E4 severe allergic reaction, E5 collapse, E6 severe bleeding, E7 immediate danger of serious self-harm | Order becomes `safety_emergency_excluded`, a terminal state with no transitions. The patient sees the full warning and an instruction to call 999 immediately, plus "we will not contact emergency services for you". Re-screening and any move to payment or booking are rejected by the database, even for the owner                                                   |
| Urgent exclusion    | U1 serious ADR, U2 harmful medication error, U3 urgent essential-medicine supply, U4 needs same-day assessment                                                     | Order becomes `safety_urgent_hold`. The patient is told to contact their GP or NHS 111 and not to wait. Payment and booking are blocked for **all** of the patient's orders while a hold is unresolved. It leaves the hold only through `record_suitability_assessment` by a verified clinician with MFA (`suitable` returns it to intake; `unsuitable` sets `declined`) |
| Routine             | R1 high-risk medicine, R2 10+ medicines, R3 monitoring gap, R4 vulnerable situation, R5 pregnancy/breastfeeding                                                    | Intake continues. Flags are recorded for the pharmacist. A high-risk medicine alone does not block. The outcome page says this "does not mean your medicines are safe"                                                                                                                                                                                                   |

**Ambiguity policy (draft, needs approval):** "Not sure" on an emergency or urgent question
escalates to that pathway. "Not sure" on a routine question adds `incomplete_information`.
Precedence is emergency, then urgent, then routine.

**Audit:** `safety.screening_recorded` stores only `order_id`, `outcome` and `ruleset_version`,
never the answers. It is recorded only for signed-in (identified) users. The answers themselves
live in the immutable `safety_screenings` row as part of the clinical record.

**Acknowledgement:** patients can confirm they have read emergency or urgent advice
(`acknowledged_at`, set once).

## 3. Emergency banner

- **Full version:** the owner's exact wording, with the brand name substituted. It is shown at
  safety checkpoints: the screening page, the emergency and urgent outcome pages, the final
  "check and send" step, the Clinical Service and Safety page, and the Complaints and Contact
  page. A unit test asserts the exact text.
- **Short version:** shown persistently on every page, including throughout intake. Its wording
  was written by the developer and is **DRAFT pending owner approval**.
- Neither version implies that we will call emergency services or monitor anything in real time
  (unit-tested).

## 4. Legal pages

Five pages, each marked "Placeholder" and awaiting professional review:

- Terms of Service (`/terms`)
- Privacy Notice (`/privacy`)
- Clinical Service and Safety Information (`/clinical-safety`)
- Cancellation and Refund Policy (`/refunds`)
- Complaints and Contact Information (`/complaints`; `/contact` redirects here)

The pages cover:

- company identity and registered address
- contact details
- service scope
- pharmacist registration
- complaints process
- privacy rights and processors
- retention
- refunds and cancellation

Business facts come from environment configuration (`BUSINESS_*`), resolved by `resolveBusinessConfig`:

- A missing value renders as `[Placeholder: <field> not yet supplied and verified]`.
- A supplied value shows an "Unverified" badge until `BUSINESS_<FIELD>_VERIFIED=true`.

Statutory cancellation rights, liability terms, lawful bases and timescales are explicit
placeholders. Nothing is invented.

## 5. Retention (provisional)

`retention_policies` holds these provisional values. Changes to a policy are audited.

| Category          | Period                    | Starts from           |
| ----------------- | ------------------------- | --------------------- |
| Clinical record   | 8 years                   | Last clinical contact |
| Safety escalation | 8 years                   | Last clinical contact |
| Abandoned intake  | 90 days                   | Last activity         |
| Accounting        | 6 years                   | End of financial year |
| Security log      | 12 months                 | Event                 |
| Temporary backup  | 90 days (target 30 to 90) | Backup created        |

- **Lawful holds:** `legal_holds`, placed by a clinical admin with MFA. An open hold blocks any
  purge.
- **Deletion requests:**
  - Patients request deletion from Settings.
  - A clinical admin reviews the request, and the stored retention assessment lists which orders
    are retained as clinical records and until when.
  - Completing a request **never erases clinical records**.
  - The portal account is deactivated, not deleted (`on delete restrict` everywhere).
- **Purge job (designed, not scheduled):**
  - `app.retention_candidates()` lists abandoned intakes past 90 days with no hold.
  - `app.purge_abandoned_intake()` (service role only) deletes their questionnaire drafts and
    writes an audit entry.
  - It refuses anything clinical, recent or under a hold.
  - Removing storage objects and closing the auth account are documented follow-ups.

## 6. Technology and data protection

| Decision                                                     | Status                                                                                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase London (eu-west-2) for the clinical DB and storage  | Planned; no hosted project created. Local only                                                                                                       |
| AWS SES London for transactional email; SMS disabled         | Not implemented. The notification abstraction has a Mailpit transport for development only; outside development nothing is sent                      |
| No health details in email subjects, SMS or payment metadata | The only app notification is "There is an update in your account" (unit- and E2E-tested). Auth emails contain no health details                      |
| Pharmacist/admin MFA                                         | Built: TOTP through Supabase Auth. **Database staff privileges require an aal2 session** (`app.has_verified_role`), and `/staff` redirects to `/mfa` |
| Private storage                                              | `patient-documents` bucket, private. Storage RLS limits each patient to their own folder                                                             |
| Malware scanning                                             | **Stub, labelled.** Every upload stays `pending_scan`, and RLS hides unscanned documents from clinicians                                             |
| Data residency, DPIA, processor agreements, security review  | Pre-launch blocker (gate `processor_agreements_and_security_review`)                                                                                 |

## 7. VAT and legal identity

- No VAT is added. The pricing page says "We do not add VAT to this price." Accountant
  confirmation is a launch gate.
- The trading name is configurable: `BRAND_TRADING_NAME` defaults to "PharmReview". It is
  flagged provisional until `BRAND_TRADING_NAME_CLEARED=true`. No brand text is hard-coded in the
  banner, legal pages or emails.
- Company name, number, address, VAT number, ICO number, responsible pharmacist GPhC number and
  indemnity insurer are unverified configuration.

## 8. Consultation and report-release gate

Enforced in `packages/domain` (`approvalBlockers`, `releaseBlockers`) and, authoritatively, in
the database (`app.report_gate_blockers`, `app.enforce_report_gate`). The trigger applies to
**every role**, including `service_role`.

Approval and release both require:

1. **Screening cleared:** the latest screening is routine, or an urgent outcome was later
   reassessed as suitable. Emergency never clears.
2. **Eligibility:** the patient profile is complete and adult.
3. **A submitted questionnaire**, and the pharmacist's confirmation that the clinical information
   is sufficient.
4. **A completed two-way consultation**, recorded with date, method (telephone or secure video)
   and non-empty clinical notes. Audio recording is not required.
5. **The pharmacist's confirmation** that the assessment is clinically adequate.
6. **Approval by the assigned, verified pharmacist in an MFA session.** Their name and GPhC
   number are recorded on the report.
7. **Explicit release** by that pharmacist. This needs `ready_for_release` and an order
   `in_review`.
8. **Immutable audit:** `report.clinically_approved` and `report.released` are written, with the
   pharmacist ID and GPhC number.

Never sufficient on their own: a questionnaire, an AI draft (there is none), a payment or a
booking.

Who can do what:

- Automation (service role) may move an approved report through PDF generation, but cannot
  approve or release.
- Clinical admins, unassigned pharmacists and pharmacists without MFA cannot approve or release.
- Declined or emergency-excluded orders cannot have a review report at all.
- Released reports are immutable.

There is no feature flag in this path.

## 9. Development versus public launch: kill switch and pre-launch blockers

- `app.live_service_enabled()` returns true only when every launch gate's latest sign-off is
  `approved` **and** the active rule set is clinically `approved`.
- Sign-offs are append-only rows in `launch_signoffs`, recorded by a clinical admin with MFA.
  A revocation row closes the service immediately.

| Mode                                                       | Public intake | Payments and booking | Report release   |
| ---------------------------------------------------------- | ------------- | -------------------- | ---------------- |
| `production` without all sign-offs (the migration default) | Closed        | Closed               | Gate (section 8) |
| `development` (local/CI seed only; synthetic data)         | Open          | **Closed**           | Gate (section 8) |
| Live (all sign-offs + approved rule set)                   | Open          | Open                 | Gate (section 8) |

The `development` setting can only open synthetic intake. It never opens payments and never
bypasses clinical approval. The site shows a "Development preview" or "Not yet open" notice
whenever the live service is not enabled.

### Pre-launch blockers checklist

Each item maps to a database launch gate (`public.launch_gate`). None are signed off.

- [ ] **Clinical screening content and escalation SOP** (`clinical_screening_content_and_sop`):
  - approve rule set `2026-11-draft.1` (wording, unsure policy, test cases)
  - approve the short banner wording
  - write the urgent-hold reassessment SOP
- [ ] **Operational response arrangements** (`operational_response_arrangements`): who reviews
      urgent holds and complex-patient assessments, and how fast. This must be consistent with "not
      monitored 24 hours a day".
- [ ] **MHRA medical-device classification assessment** (`mhra_device_classification`), documented.
- [ ] **CQC scope assessment** (`cqc_scope_assessment`), documented.
- [ ] **Professional indemnity** (`professional_indemnity`), verified for every pharmacist.
- [ ] **Legal terms and privacy notice** (`legal_terms_and_privacy_notice`): solicitor-approved
      wording for all five pages, including cancellation rights.
- [ ] **Retention policy and DPIA** (`retention_policy_and_dpia`): approve the provisional
      periods; complete the DPIA.
- [ ] **Company, ICO and GPhC details** (`company_ico_gphc_details`): supply and verify the
      `BUSINESS_*` values; complete the ICO fee assessment; verify pharmacist registration.
- [ ] **VAT and brand checks** (`vat_and_brand_checks`): accountant confirmation of the VAT
      exemption; name and trade mark clearance for "PharmReview".
- [ ] **Data residency, processor agreements and security review**
      (`processor_agreements_and_security_review`):
  - London region confirmed for Supabase and SES
  - subprocessors, logs, backups and analytics validated
  - DPAs signed
  - security review / penetration test passed
  - a real malware scanner replaces the stub

Engineering items that must also be completed before launch (not gates, but required):

- a real malware scanner
- an SES transport
- a hosted environment in eu-west-2
- a shared rate-limit store
- a nonce-based CSP
- a staff MFA recovery procedure
- storage-object purge in the retention job
- a scheduled retention job
