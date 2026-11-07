# Clinical safety

**Clinical approver:** Eason Sung, UK-registered pharmacist. The binding Phase 2 decisions (7 Nov 2026) are recorded in [PHASE_2_SPEC.md](./PHASE_2_SPEC.md). Nothing else in the software, website
copy or rule set is approved clinical content until the owner signs it off.

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

| ID     | Item                                                                                                                   | Status                                                                                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CS-01  | Full emergency banner wording                                                                                          | **Approved by owner** (exact text, 7 Nov 2026). Implemented; unit-tested for exact match                                                                                                                               |
| CS-01a | Shortened persistent banner wording                                                                                    | **DRAFT: needs owner approval**: "Important: Not an emergency service. {brand} is not monitored 24 hours a day. In a life-threatening emergency, call 999 immediately. For urgent advice, contact your GP or NHS 111." |
| CS-02  | Clinical Service and Safety Information page                                                                           | Placeholder; needs clinical and regulatory review                                                                                                                                                                      |
| CS-05  | Screening question wording (16 questions in rule set `2026-11-draft.1`)                                                | **DRAFT: needs clinical approval**. Topics follow the owner decision                                                                                                                                                   |
| CS-06  | Screening rules: "Not sure" escalates on emergency/urgent questions; flags incomplete information on routine questions | **DRAFT: needs clinical approval**                                                                                                                                                                                     |
| CS-06a | Documented test cases (24 positive/negative/ambiguous, 3 invalid)                                                      | DRAFT; pass in both TypeScript and the database                                                                                                                                                                        |
| CS-07  | Escalation SOP: who reviews urgent holds and complexity reviews, and response expectations                             | **Not written. Launch gate**                                                                                                                                                                                           |
| CS-08  | Questionnaire content, "why we ask" text, "don't know" options                                                         | Draft implemented; needs approval                                                                                                                                                                                      |
| CS-09  | Report template, limitations and disclaimer                                                                            | Phase 4; needs content                                                                                                                                                                                                 |
| CS-10  | GP letter template and recipient verification                                                                          | Phase 4                                                                                                                                                                                                                |
| CS-11  | Report when consultation did not happen                                                                                | **Decided:** never a completed review report without a completed two-way consultation; a declined service may produce a safety or referral communication only (owner section 8)                                        |
| CS-12  | Out-of-hours messaging wording                                                                                         | Phase 4                                                                                                                                                                                                                |
| CS-13  | Pharmacist verification procedure (GPhC, identity, indemnity)                                                          | Launch gate                                                                                                                                                                                                            |
| CS-14  | Clinical record retention                                                                                              | **Provisional:** 8 years after last clinical contact; needs governance approval                                                                                                                                        |
| CS-15  | High-risk medicine term list (20 terms, draft)                                                                         | Needs clinical approval                                                                                                                                                                                                |
| CS-16  | MHRA medical-device classification and CQC scope assessments                                                           | **Launch gates**                                                                                                                                                                                                       |

## Hazard log (initial)

| Hazard                                                           | Cause                  | Controls (built unless stated)                                                                                                                                                       |
| ---------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Patient in an emergency continues routine intake                 | Misunderstanding scope | Emergency questions first; terminal exclusion; full warning and 999 instruction; DB blocks payment and booking (pgTAP + E2E "emergency blocks purchase")                             |
| Patient believes the service will call 999 or is monitoring them | Wording                | Owner-approved text; tests assert no "we will call" or "we monitor" wording                                                                                                          |
| Patient with an urgent problem waits for a review                | Wording, booking       | Urgent hold; GP/NHS 111 advice; booking blocked across all the patient's orders until a documented reassessment                                                                      |
| Screening outcome tampered with by the client                    | Client-side logic      | Outcome computed in the database; patients cannot insert screenings or change order status (tested)                                                                                  |
| Ambiguous answer under-triaged                                   | "Not sure" answers     | Conservative escalation policy (draft, needs approval)                                                                                                                               |
| High-risk medicine user blocked unnecessarily                    | Over-triage            | Routine flags never block (tested), but trigger an individual suitability review before booking                                                                                      |
| Report released without an adequate consultation                 | Process failure        | Section 8 gate in the database: two-way consultation with notes, sufficiency and adequacy confirmations, assigned verified pharmacist with MFA; service role cannot release (tested) |
| Report shown before release                                      | Defect                 | RLS shows reports to patients only when `released` (tested)                                                                                                                          |
| Unscanned malicious upload reaches a pharmacist                  | No scanner yet         | RLS hides `pending_scan` documents from clinicians; the scanner is a labelled stub (launch blocker)                                                                                  |
| Health information leaks by email                                | Notification content   | Generic "update in your account" template only (tested)                                                                                                                              |
| Clinical records lost on account deletion                        | Deletion workflow      | Deletion requests never erase clinical records; `on delete restrict`; purge refuses clinical orders (tested)                                                                         |
| Staff account compromise exposes patient data                    | Credential theft       | TOTP MFA; database staff privileges require aal2 (tested)                                                                                                                            |
