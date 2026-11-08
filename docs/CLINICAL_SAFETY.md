# Clinical safety

**Clinical lead named by the company:** Cheuk Kin Sung, GPhC 2234388 (live register check pending). Product owner: Eason Sung. The binding Phase 2 decisions (7 Nov 2026) are recorded in [PHASE_2_SPEC.md](./PHASE_2_SPEC.md).

On 8 November 2026 the patient-facing name became MedsInFocus (M-01). That is a product-design decision, not MHRA, CQC, legal, indemnity, or public-launch approval. The safety-question wording and the report and GP-letter clinical wording approved for development the same day were not rewritten, apart from substituting the trading name where a patient would otherwise still see the previous name.

On 8 November 2026 Eason Sung approved, for development only, the current safety-question wording and the current report and GP-letter draft wording. That approval is recorded as OD-11 in [DECISION_LOG.md](./DECISION_LOG.md). It is not MHRA, CQC, legal, indemnity, or public-launch approval. The wording was not rewritten. Public intake, live payments and store submission stay off. No other website copy or rule is approved clinical content.

This is not a DCB0129/DCB0160 clinical safety case. Producing one is part of the launch gates.

## Clinical boundaries (enforced in product design)

The service does **not**:

- provide emergency or same-day urgent care
- diagnose
- prescribe, supply or dispense
- give autonomous instructions to change medicines
- replace the GP
- access NHS records
- claim NHS affiliation
- use AI for clinical decisions

How the software enforces these boundaries:

- **Emergency warning:**
  - the owner's exact wording is shown at safety checkpoints
  - a shortened version is shown on every page
  - neither implies that we call 999 or monitor anything
- **Screening is deterministic and versioned.** It is evaluated in the database, and no AI or
  automation can downgrade an outcome:
  - Emergency exclusion is terminal for the order.
  - An urgent hold needs a documented pharmacist reassessment.
  - Routine flags never block, and never declare medicines safe.
- **Complex patients** (any routine flag, high-risk medicine name match, or 10+ medicines) need an
  individual pharmacist suitability assessment before booking.
- **The report-release gate** (owner section 8) is enforced in the database for every role. A
  declined or excluded service cannot produce a review report.
- **Free-text matching of medicine names** only raises pharmacist attention flags. It is not
  clinical validation.
- **Ops admins cannot see clinical content**, and staff without MFA see nothing (RLS, tested).

## Status of clinical items

| ID     | Item                                                                                       | Status                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CS-01  | Expanded emergency warning                                                                 | **Approved for development (P-02).** Pending clinical approval                                                                                                                                                                                                                                              |
| CS-01a | Short persistent banner                                                                    | **Approved for development (P-02).** Pending clinical approval. Not certification                                                                                                                                                                                                                           |
| CS-02  | Clinical Service and Safety Information page                                               | Placeholder; needs clinical and regulatory review                                                                                                                                                                                                                                                           |
| CS-05  | Screening questions                                                                        | **Approved for development by Eason Sung on 8 November 2026 (OD-11).** Four questions in `2026-11-draft.2` (P-01). Wording unchanged. Not MHRA, CQC, legal, indemnity, or public-launch approval. An MHRA assessment is still required                                                                      |
| CS-06  | Not sure is never no. Q1 stops the request. Q2 to Q4 pause it                              | **Approved for development (P-01).** Pending clinical approval                                                                                                                                                                                                                                              |
| CS-06a | Documented test cases (24 positive/negative/ambiguous, 3 invalid)                          | DRAFT; pass in both TypeScript and the database                                                                                                                                                                                                                                                             |
| CS-07  | Escalation SOP: who reviews urgent holds and complexity reviews, and response expectations | **Not written. Launch gate**                                                                                                                                                                                                                                                                                |
| CS-08  | Questionnaire content, "why we ask" text, "don't know" options                             | Draft implemented; needs approval                                                                                                                                                                                                                                                                           |
| CS-09  | Report template, limitations and disclaimer                                                | **Approved for development by Eason Sung on 8 November 2026 (OD-11).** Wording unchanged, including the DRAFT label already in the template. Sections are fixed. Wording that tells the patient to start, stop or change a medicine is rejected. Not MHRA, CQC, legal, indemnity, or public-launch approval |
| CS-10  | GP letter template and recipient verification                                              | **Approved for development by Eason Sung on 8 November 2026 (OD-11).** Wording unchanged. Practice name is recorded by the pharmacist after checking it with the patient. No email address. Not sent. No NHS connection. Not MHRA, CQC, legal, indemnity, or public-launch approval                         |
| CS-11  | Report when consultation did not happen                                                    | **Decided and built:** no medication-review report without a completed two-way consultation. A declined, urgent or emergency-excluded review can store a safety note or referral only                                                                                                                       |
| CS-12  | Out-of-hours messaging wording                                                             | **Draft on the message screens.** States the service is not monitored 24 hours a day and points to 999, GP or NHS 111. Pending clinical approval                                                                                                                                                            |
| CS-13  | Pharmacist verification procedure (GPhC, identity, indemnity)                              | Launch gate                                                                                                                                                                                                                                                                                                 |
| CS-14  | Clinical record retention                                                                  | **Provisional:** 8 years after last clinical contact; needs governance approval                                                                                                                                                                                                                             |
| CS-15  | High-risk medicine term list (20 terms, draft)                                             | Needs clinical approval                                                                                                                                                                                                                                                                                     |
| CS-16  | MHRA medical-device classification and CQC scope assessments                               | **Launch gates**                                                                                                                                                                                                                                                                                            |

## Hazard log (initial)

| Hazard                                                           | Cause                  | Controls (built unless stated)                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patient in an emergency continues routine intake                 | Misunderstanding scope | Emergency questions first; terminal exclusion; full warning and 999 instruction; DB blocks payment and booking (pgTAP + E2E "emergency blocks purchase")                                                                                                              |
| Patient believes the service will call 999 or is monitoring them | Wording                | Owner-approved text; tests assert no "we will call" or "we monitor" wording                                                                                                                                                                                           |
| Patient with an urgent problem waits for a review                | Wording, booking       | Urgent hold; GP/NHS 111 advice; booking blocked across all the patient's orders until a documented reassessment                                                                                                                                                       |
| Screening outcome tampered with by the client                    | Client-side logic      | Outcome computed in the database; patients cannot insert screenings or change order status (tested)                                                                                                                                                                   |
| Ambiguous answer under-triaged                                   | "Not sure" answers     | Conservative escalation policy (draft, needs approval)                                                                                                                                                                                                                |
| High-risk medicine user blocked unnecessarily                    | Over-triage            | Routine flags never block (tested), but trigger an individual suitability review before booking                                                                                                                                                                       |
| Report released without an adequate consultation                 | Process failure        | Section 8 gate in the database: two-way consultation with notes, sufficiency and adequacy confirmations, clinical sections, a succeeded payment, assigned verified pharmacist with MFA; service role cannot release (tested)                                          |
| Patient changes a medicine because the report told them to       | Wording                | Database and app reject direct instructions such as "stop taking". The report says it is for discussion with the prescriber. The template wording is approved for development (OD-11) and the existing DRAFT label is unchanged. This is not a public-launch approval |
| Patient treats a message or a draft as an emergency service      | Wording, expectation   | Out-of-hours warning on the message screen. Emergency-excluded reviews cannot use messaging. Draft reports are hidden                                                                                                                                                 |
| GP letter sent to an unchecked address                           | Dispatch               | No send path. Recipient cannot contain an email address. Dispatch evidence says the letter was not transmitted                                                                                                                                                        |
| Report shown before release                                      | Defect                 | RLS shows reports to patients only when `released` (tested)                                                                                                                                                                                                           |
| Unscanned malicious upload reaches a pharmacist                  | No scanner yet         | RLS hides `pending_scan` documents from clinicians; the scanner is a labelled stub (launch blocker)                                                                                                                                                                   |
| Health information leaks by email                                | Notification content   | Generic "update in your account" template only (tested)                                                                                                                                                                                                               |
| Clinical records lost on account deletion                        | Deletion workflow      | Deletion requests never erase clinical records; `on delete restrict`; purge refuses clinical orders (tested)                                                                                                                                                          |
| Staff account compromise exposes patient data                    | Credential theft       | TOTP MFA; database staff privileges require aal2 (tested)                                                                                                                                                                                                             |
