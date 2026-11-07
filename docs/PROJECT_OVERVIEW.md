# Project overview

**PharmReview** (provisional trading name, configurable, pending name and trade mark clearance;
the repository keeps its original working name) is a private online medication review service
for adults aged 18+ in England, delivered by GPhC-registered pharmacists.

- **Owner and clinical approver:** Eason Sung, UK-registered pharmacist. Approves all clinical
  content, safety rules and clinical safety decisions.
- **Status:** Phase 1 (foundation) and Phase 2 (patient intake) built on stacked feature branches.
  Not deployed. The live clinical service is disabled until the section 9 sign-offs are recorded.
  All data is synthetic.

## The service

One consultation with a pharmacist, by telephone or secure video, plus a written report. Launch price £59 (normal
displayed price £79), GBP only, server-controlled.

Patient journey (target, built across Phases 1 to 4):

1. Learn about the service on the public website.
2. Create a secure account and confirm email address. **(Phase 1: built)**
3. Complete a structured health and medication questionnaire; optionally upload documents.
4. Safety screening and consent. Emergencies are directed to 999/NHS 111 and routine checkout is
   blocked.
5. Pay through Stripe hosted Checkout (test mode until live activation is approved).
6. Book a telephone consultation (Europe/London).
7. Pharmacist pre-review, telephone consultation, records findings and recommendations.
8. Pharmacist clinically approves the report, a PDF is generated, the pharmacist explicitly
   releases it.
9. Patient gets a generic notification (no health information) and reads the report in their
   account.
10. Optional GP letter with separate consent and a verified recipient.

## Clinical boundaries

No diagnosis, prescribing, dispensing, autonomous instructions to change medicines, GP
replacement, emergency care, NHS record access or AI clinical decisions. All recommendations are
made and controlled by an authorised pharmacist. No NHS logos or implied endorsement. See
[CLINICAL_SAFETY.md](./CLINICAL_SAFETY.md).

## Repository map

| Path                  | Contents                                                                         |
| --------------------- | -------------------------------------------------------------------------------- |
| `apps/web`            | Next.js App Router app: public site, patient area, `/staff` area                 |
| `packages/domain`     | State machines (order, report), roles, pricing helpers                           |
| `packages/validation` | Zod schemas shared by server actions and (later) the mobile app                  |
| `packages/ui`         | Design tokens (Tailwind v4 theme) and shadcn-style components                    |
| `packages/config`     | Shared TypeScript and ESLint configuration                                       |
| `supabase/`           | `config.toml`, forward-only migrations, pgTAP tests, email templates, local seed |
| `docs/`               | This documentation set                                                           |

## Running locally

Requirements: Node 22, pnpm 10, Docker.

```bash
pnpm install
pnpm db:start                    # local Supabase in Docker (Postgres, Auth, Storage, Mailpit)
pnpm --filter @mrd/web env:local # writes apps/web/.env.local from `supabase status`
pnpm dev                         # http://127.0.0.1:3000
```

- Captured emails (verification, password reset): Mailpit at http://127.0.0.1:54324. No real
  emails are sent.
- Synthetic seeded accounts (password `Synthetic-Local-Only-1`): `patient.demo@example.test`,
  `pharmacist.verified@example.test`, `pharmacist.pending@example.test`,
  `clinical.admin@example.test`, `ops.admin@example.test`.

Tests:

```bash
pnpm typecheck && pnpm lint && pnpm test   # TypeScript, ESLint, Vitest
pnpm db:test                               # pgTAP RLS tests against local Postgres
pnpm --filter @mrd/web build && pnpm test:e2e   # Playwright + axe (needs Supabase running)
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md): system design, design system, request flow
- [DATABASE_DESIGN.md](./DATABASE_DESIGN.md): full entity design, RLS, state machines
- [SECURITY_MODEL.md](./SECURITY_MODEL.md): authn/authz, threats, controls, open items
- [CLINICAL_SAFETY.md](./CLINICAL_SAFETY.md): clinical boundaries and items needing approval
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md): Phases 1 to 6
- [PHASE_2_SPEC.md](./PHASE_2_SPEC.md): owner decisions (7 Nov 2026), implementation and pre-launch blockers
- [PROGRESS.md](./PROGRESS.md): what is done, with test evidence
- [DECISION_LOG.md](./DECISION_LOG.md): decisions and those awaiting the owner
