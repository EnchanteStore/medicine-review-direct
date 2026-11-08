# Supabase project

Eason first authorised a Supabase project in London (`eu-west-2`). On 8 November 2026 he changed
the intended database region to **Central EU (Frankfurt, `eu-central-1`)**. This is infrastructure
preparation, not launch approval. SES remains London (`eu-west-2`). Do not copy the local database
into a hosted project. Do not load real patient data. Public intake stays off.

Eason supplied this project URL on 8 November 2026:

`https://qcjkngnwjjoxwutgjfyt.supabase.co`

No keys are stored here. The app is not connected to it. That URL is not recorded as Frankfurt,
and it is not recorded as London. The hostname does not say which region the project is in.
Read the region on the Supabase dashboard. Link it, push migrations, or send traffic only if the
dashboard says `eu-central-1`. If it says anything else, do not use it and do not create a
replacement from this repository.

## Region

The database region to use is Central EU (Frankfurt, `eu-central-1`). Do not create that project
from here. Do not treat `https://qcjkngnwjjoxwutgjfyt.supabase.co` as the Frankfurt project.

1. Sign in to the Supabase dashboard with the owner's account.
2. Open the supplied project and read its region.
3. Continue only when the dashboard says **Central EU (Frankfurt)**, `eu-central-1`.
4. Do not import the local Docker database. Do not run `supabase/seed.sql`. That file creates synthetic local users and a development setting.

## Apply the tested migrations

From a checkout of this repository, with the Supabase CLI logged in as the owner:

Do this only after the dashboard for that project says `eu-central-1`. The ref below is the
host label in the supplied URL. It is not evidence of the region.

```bash
supabase link --project-ref qcjkngnwjjoxwutgjfyt
supabase db push
```

`supabase db push` applies the files in `supabase/migrations` in this order:

1. `20261107000100_foundation_schema.sql`
2. `20261107000200_phase2_enum_values.sql`
3. `20261107000300_phase2_patient_intake.sql`
4. `20261107000400_owner_decisions.sql`
5. `20261107000500_phase3_payments_booking.sql`
6. `20261107000600_phase4_enum.sql`
7. `20261107000700_phase4_clinical.sql`
8. `20261108000100_medsinfocus_enum.sql`
9. `20261108000200_medsinfocus.sql`

Do not rename those files. Do not run the seed. The default `app_settings.environment` is `production`, so intake and live payments stay closed until launch sign-offs are recorded.

In the new project's Auth settings, add only these redirect URLs:

- `https://medsinfocus.co.uk/auth/confirm`
- `https://www.medsinfocus.co.uk/auth/confirm`
- `https://staging.medsinfocus.co.uk/auth/confirm` once a staging host exists
- `http://127.0.0.1:3000/auth/confirm` for local development

Those URLs have no query string. Do not add a patient's email address or any clinical detail to them.

Store the project URL and keys under the names in [CREDENTIALS_NEEDED.md](./CREDENTIALS_NEEDED.md). Do not commit the values.

DNS is a separate step. [IONOS_DNS.md](./IONOS_DNS.md) keeps every target blank until a web host exists.
