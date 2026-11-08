# Credentials still needed

Eason authorised the preparation on 8 November 2026. These names are the only secrets he needs
to add. No values belong in this file, in git, or in chat. None of these are set for a live
service. Adding a name here does not turn the integration on.

| Name                            | Used for                                           | Constraint                                                                                                                                                |
| ------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase API                                       | Set this to `https://qcjkngnwjjoxwutgjfyt.supabase.co`. Safari confirmed that project is Central EU (Frankfurt, `eu-central-1`). Not the local Docker URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server, as the signed-in user          | Publishable anon key only                                                                                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | Webhook, scan result, and stored PDF on the server | Never exposed to the browser                                                                                                                              |
| `STAGING_SITE_URL`              | Staging auth callbacks                             | Must be exactly `https://staging.medsinfocus.co.uk` or it is ignored                                                                                      |
| `STRIPE_SECRET_KEY`             | Stripe Checkout test mode                          | Must start with `sk_test_`. A key starting with `sk_live_` is refused                                                                                     |
| `STRIPE_WEBHOOK_SECRET`         | Signature check for test-mode events               | Stripe test webhook secret. Not used for the local harness                                                                                                |
| `AWS_ACCESS_KEY_ID`             | SES in London                                      | Absent means no SES send                                                                                                                                  |
| `AWS_SECRET_ACCESS_KEY`         | SES in London                                      | Absent means no SES send                                                                                                                                  |
| `AWS_SES_REGION`                | SES region                                         | Must be `eu-west-2` or mail is not sent                                                                                                                   |
| `SES_FROM_EMAIL`                | From address                                       | One of `hello@medsinfocus.co.uk`, `support@medsinfocus.co.uk`, `noreply@medsinfocus.co.uk`                                                                |
| `SES_SEND_ENABLED`              | Allows an SES send                                 | Leave unset. `true` is not enough on its own; this preparation does not call AWS                                                                          |

Type a value into `apps/web/.env.local` only. That file is gitignored by `.env.*`, and
`!.env.example` is the only exception. `git check-ignore -v apps/web/.env.local` reports that
rule. Do not paste a value into chat, a commit, or a screenshot.

The Stripe secret must be the Pharma247 test key, starting with `sk_test_`. Do not use a key from
another Stripe account, and do not use a live key. Leave `SES_SEND_ENABLED` unset.

Local development keeps using Mailpit and the labelled Stripe harness. Those local names
(`MAILPIT_URL`, the local Supabase URL, and the local service-role key) are written by
`pnpm --filter @mrd/web env:local` and are not the hosted project credentials. The confirmed
database is `https://qcjkngnwjjoxwutgjfyt.supabase.co` in Central EU (Frankfurt, `eu-central-1`).
SES stays in London (`eu-west-2`). The anon key and service-role key are not in `.env.local`.
