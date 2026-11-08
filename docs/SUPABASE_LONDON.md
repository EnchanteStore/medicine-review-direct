# Supabase in London

Eason authorised preparing a Supabase project in London (`eu-west-2`) on 8 November 2026.
This is infrastructure preparation, not launch approval. Do not copy the local database into it.
Do not load real patient data. Public intake stays off.

Eason supplied this project URL on 8 November 2026:

`https://qcjkngnwjjoxwutgjfyt.supabase.co`

No keys are stored here. The app is not connected to it. The region is not recorded as London.
Confirm on the Supabase dashboard that the project says `eu-west-2` before linking, pushing
migrations, or sending any traffic. If the dashboard shows another region, stop.

## Create one empty project

1. Sign in to the Supabase dashboard with the owner's account.
2. Choose **New project**.
3. Set the region to **Europe (London)**, `eu-west-2`. If that region is not offered, stop. Do not pick another region.
4. Do not import a database, and do not paste the local Docker data. The project starts empty.
5. Do not run `supabase/seed.sql`. That file creates synthetic local users and a development setting.
6. The URL above is already supplied. Before linking it, confirm the dashboard says `eu-west-2`. Do not treat the URL alone as proof of the region.

## Apply the tested migrations

From a checkout of this repository, with the Supabase CLI logged in as the owner:

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
