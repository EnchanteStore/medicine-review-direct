# Clinical safety

**Clinical approver:** Eason Sung, UK-registered pharmacist. Nothing in this document, the website
copy or the software constitutes approved clinical content until the owner signs it off. This is
not a DCB0129/DCB0160 clinical safety case; producing one (and appointing a Clinical Safety
Officer) is a Phase 5 item.

## Clinical boundaries (enforced in product design)

The service does **not**: diagnose; prescribe; supply or dispense; give autonomous instructions to
stop, start or change medicines; replace the GP; provide urgent or emergency care; access NHS
records; or use AI/automated systems for clinical decisions. There are no NHS logos and no
implied NHS endorsement.

How the software supports these boundaries:

- Every page shows emergency advice (999 / NHS 111) and states the service is not monitored for
  emergencies.
- Report release is gated (domain logic now, database trigger in Phase 4) on clinical approval, a
  paid order, a recorded consultation and an explicit verified-pharmacist action. Reports are
  never auto-released.
- Safety screening will use **deterministic, versioned, pharmacist-approved rules only**. No AI
  triage. An emergency outcome blocks routine checkout (`safety_escalated` has no path to
  payment, unit-tested), shows approved advice, records acknowledgement, alerts clinical staff,
  and is audited.
- Free-text medicine matching is not clinical validation; the pharmacist validates during review.
- Ops admins cannot see clinical content (RLS, tested).

## Items awaiting your approval

| ID    | Item                                                                                                                                                                                                                                                                                     | Where it appears      | Status                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------- |
| CS-01 | Emergency banner wording ("Not for emergencies… call 999… NHS 111… not monitored")                                                                                                                                                                                                       | Every page            | Draft in use, **needs approval** |
| CS-02 | Clinical safety page content                                                                                                                                                                                                                                                             | `/clinical-safety`    | Marked DRAFT                     |
| CS-03 | Service scope statements on Home, How it works, About, FAQ                                                                                                                                                                                                                               | Public pages          | Draft, **needs approval**        |
| CS-04 | Eligibility: adults 18+ in England (self-declared at sign-up; DOB validated 18+)                                                                                                                                                                                                         | Sign-up, profile      | Implemented, **confirm**         |
| CS-05 | Safety screening topics and exact question wording (chest pain, severe breathing difficulty, anaphylaxis, significant bleeding, overdose, severe hypoglycaemia, stroke symptoms, collapse/confusion, severe infection, serious ADR, pregnancy medication concerns, mental health crisis) | Phase 2 questionnaire | Topics only; **wording needed**  |
| CS-06 | Deterministic escalation rules and the emergency advice shown for each                                                                                                                                                                                                                   | Phase 2               | **Rules needed**                 |
| CS-07 | Who is alerted on escalation, and expected response (noting the service is not monitored for emergencies)                                                                                                                                                                                | Phase 2/4             | **Decision needed**              |
| CS-08 | Questionnaire content, "why we ask" explanations and "don't know" options                                                                                                                                                                                                                | Phase 2               | **Content needed**               |
| CS-09 | Report section template, standard limitations and disclaimer text                                                                                                                                                                                                                        | Phase 4               | **Content needed**               |
| CS-10 | GP letter template and recipient verification method                                                                                                                                                                                                                                     | Phase 4               | **Content needed**               |
| CS-11 | Behaviour when a consultation does not happen (report allowed? wording?)                                                                                                                                                                                                                 | Phase 4               | **Decision needed**              |
| CS-12 | Out-of-hours messaging warning wording                                                                                                                                                                                                                                                   | Phase 4               | **Content needed**               |
| CS-13 | Pharmacist verification procedure (GPhC register check, identity, indemnity)                                                                                                                                                                                                             | Phase 4               | **Procedure needed**             |
| CS-14 | Clinical record retention period                                                                                                                                                                                                                                                         | Phase 5               | **Decision needed**              |

## Hazard log (initial, to be expanded into a formal log)

| Hazard                                                      | Cause                  | Control (built / planned)                                                                                     |
| ----------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Patient in an emergency uses the service instead of 999/111 | Misunderstanding scope | Banner on every page (built); safety screening blocks checkout (Phase 2)                                      |
| Patient changes medicines based on the report alone         | Report wording         | Approved disclaimer and recommendations framed for GP discussion (Phase 4, CS-09)                             |
| Report shown before pharmacist approval                     | Software defect        | Release guard in domain (built, tested) and DB trigger (Phase 4)                                              |
| Report for the wrong patient                                | Access control defect  | RLS own-row isolation (built, tested); report access only when released                                       |
| Unverified person acts as pharmacist                        | Staff onboarding       | Verified status required; GPhC number required for verified pharmacists; no self-verification (built, tested) |
| Ops staff see clinical data                                 | Role misconfiguration  | `is_verified_clinician()` excludes ops_admin (built, tested)                                                  |
| Health information leaks via email                          | Notification content   | Generic templates only; current auth emails contain no health information (built)                             |
| Under-18 uses the service                                   | Eligibility            | Declaration at sign-up and DOB validation in app and DB (built, tested)                                       |
