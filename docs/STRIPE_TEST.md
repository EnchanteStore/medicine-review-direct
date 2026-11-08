# Stripe test mode

Live mode stays off. A secret that starts with `sk_live_` is refused by `classifyStripeSecret`.
The labelled local harness is still the checkout used when no Pharma247 test secret is configured.
Its signing secret is the fixed local value `whsec_local_test_only` in
`apps/web/src/lib/stripe-signature.ts`. That value is not a Stripe secret. Do not remove the
harness.

## What Safari showed

On 8 November 2026 Safari was signed in to the Pharma247 Stripe dashboard. The page title was
`Home – Pharma247 – Stripe [Test]`. The banner said the account was a sandbox and that no real
transaction would be processed. The home page showed £0.00 gross volume. No live-mode switch was
used.

The Stripe CLI already on this Mac is logged into a different business. It was not used, and its
live restricted key was not used.

## What was tested

`pnpm --filter @mrd/web exec vitest run test/stripe-signature.test.ts test/hosting-prep.test.ts test/payment-metadata.test.ts`

Result: 3 files, 10 tests, all passed.

The signature tests accept a signature the harness just created. They reject a tampered body, a
signature made with a different secret, an old timestamp, and a missing header. The webhook route
uses that same check and returns 400 before it talks to the database when the signature fails.

## What was not tested

A test-card success (`4242…`) and a decline (`4000…0002`) were not created on the Pharma247
account. The Pharma247 test secret and a webhook signing secret are not in `apps/web/.env.local`.
Safari would not run page scripts from the terminal, and assistive clicking was not allowed, so
the dashboard buttons were not pressed. No webhook was added. No charge, even a test charge, was
sent.

## Owner action

In the Pharma247 test dashboard, reveal the test secret and add a webhook for the local route
`/api/stripe/webhook`. Type `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` into
`apps/web/.env.local` only. The secret must start with `sk_test_`. Do not paste either value into
chat. Do not switch the dashboard to live mode.

After those names are present, a success, a decline and a rejected signature can be repeated
against the Pharma247 account. Until then the local harness remains the way to exercise the
signed webhook.
