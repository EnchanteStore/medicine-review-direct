# Medicine Review Direct

Private online pharmacist medication review service for adults in England (working name).
**Pre-launch. Not deployed. Synthetic data only.**

Start with [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).

## Quick start

Requirements: Node 22, pnpm 10, Docker.

```bash
pnpm install
pnpm db:start                     # Supabase in Docker: Postgres, Auth, Storage, Mailpit
pnpm --filter @mrd/web env:local  # write apps/web/.env.local from `supabase status`
pnpm dev                          # http://127.0.0.1:3000
```

Captured emails: http://127.0.0.1:54324 (Mailpit). No real emails are sent.

## Checks

```bash
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test
pnpm db:test                                    # pgTAP RLS tests
pnpm --filter @mrd/web build && pnpm test:e2e   # Playwright + axe
```

## Docs

[Overview](docs/PROJECT_OVERVIEW.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Database](docs/DATABASE_DESIGN.md) · [Security](docs/SECURITY_MODEL.md) ·
[Clinical safety](docs/CLINICAL_SAFETY.md) · [Plan](docs/IMPLEMENTATION_PLAN.md) ·
[Progress](docs/PROGRESS.md) · [Decisions](docs/DECISION_LOG.md)
