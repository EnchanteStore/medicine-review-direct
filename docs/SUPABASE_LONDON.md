# Supabase project

Eason first authorised a Supabase project in London (`eu-west-2`). On 8 November 2026 he changed
the database region to **Central EU (Frankfurt, `eu-central-1`)**. London remains in
[DECISION_LOG.md](./DECISION_LOG.md) as history. It is not the current database preference. SES
remains London (`eu-west-2`). This is not launch approval. Do not load real patient data. Public
intake stays off.

The confirmed project is:

`https://qcjkngnwjjoxwutgjfyt.supabase.co`

Safari on Eason's Mac showed the project name `med review`, the reference
`qcjkngnwjjoxwutgjfyt`, and the region **Central EU (Frankfurt, eu-central-1)**. The dashboard
plan badge was Free and the environment badge was Production. No second project was created.

## Empty before the migrations

Checked with the Supabase CLI against that project, before `db push`:

| Check             | Count |
| ----------------- | ----- |
| `auth.users`      | 0     |
| `auth.identities` | 0     |
| public tables     | 0     |
| storage objects   | 0     |
| storage buckets   | 0     |

There was no patient record to protect. The local database was not copied. `supabase/seed.sql`
was not run.

## Migrations applied

From this repository, while the CLI was already signed in:

```bash
supabase db push --dry-run --remote=qcjkngnwjjoxwutgjfyt --skip-vault
supabase db push --remote=qcjkngnwjjoxwutgjfyt --skip-vault --yes
```

The dry run listed the nine files below and listed no seed. The push then applied them in this
order:

1. `20261107000100_foundation_schema.sql`
2. `20261107000200_phase2_enum_values.sql`
3. `20261107000300_phase2_patient_intake.sql`
4. `20261107000400_owner_decisions.sql`
5. `20261107000500_phase3_payments_booking.sql`
6. `20261107000600_phase4_enum.sql`
7. `20261107000700_phase4_clinical.sql`
8. `20261108000100_medsinfocus_enum.sql`
9. `20261108000200_medsinfocus.sql`

`supabase_migrations.schema_migrations` contains those nine versions. The database password was
not written into `apps/web/.env.local`. This CLI could push with the existing login.

## After the migrations

| Check                      | Result                            |
| -------------------------- | --------------------------------- |
| `auth.users`               | 0                                 |
| `public.profiles`          | 0                                 |
| `public.review_orders`     | 0                                 |
| `public.payments`          | 0                                 |
| questionnaire submissions  | 0                                 |
| storage objects            | 0                                 |
| `app_settings.environment` | `production`                      |
| `launch_signoffs`          | 0                                 |
| safety rulesets            | two `draft` rows, none `approved` |

Storage buckets `patient-documents`, `clinical-reports` and `document-quarantine` exist and hold
no objects.

`app.intake_open()` and `app.payments_open()` are true only when the live service is enabled or
the environment is `development`. The live service needs every launch sign-off and an approved
active ruleset. None of that is true, and the environment is `production`. Public intake and live
payments were not opened.

## Patient isolation

`supabase/tests/002_patient_isolation.test.sql` was run on this project inside a transaction that
ended in `rollback`. The last assertion returned `ok 26 - anonymous visitors cannot read profiles`.
A second statement then checked the same rules and returned:

| Check                                      | Passed |
| ------------------------------------------ | ------ |
| Sign-up creates the caller's profile       | yes    |
| The caller sees only that profile          | yes    |
| The caller cannot read the other profile   | yes    |
| The caller cannot update the other profile | yes    |
| An anonymous role cannot read profiles     | yes    |

After the rollback, users, profiles and audit rows were 0 again. The pgTAP extension was not left
installed. The synthetic addresses were `@example.test` and were not kept.

## Keys

`apps/web/.env.local` is gitignored and is not in the tree. The anon key and the service-role key
were not copied into it. Eason types those into that file if the Next.js app should connect. Do
not paste them into chat. The app is not connected to this project.

Auth redirect URLs were not changed.

DNS is a separate step. [IONOS_DNS.md](./IONOS_DNS.md) records the records that were left alone.
