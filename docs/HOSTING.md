# Hosting

Cloudflare is the web-host preference. Use the Free plan first. Workers Paid is a later choice
and needs the owner's approval. The clinical app was not deployed. No paid Cloudflare plan was
bought. Netlify and Vercel are not the host. Supabase London is not the current database
preference. Those older choices stay in [DECISION_LOG.md](./DECISION_LOG.md) as history.

The database is separate from the web host. It is the confirmed Supabase project
`https://qcjkngnwjjoxwutgjfyt.supabase.co` in Central EU (Frankfurt, `eu-central-1`). See
[SUPABASE_LONDON.md](./SUPABASE_LONDON.md).

## Why the clinical app cannot run on Workers Free

Checked against the Cloudflare Workers limits page (updated 29 October 2026) and the pricing page
(updated 2 October 2026), and against this repository.

Workers Free allows **10 ms of CPU time per HTTP request**. Exceeding it returns Error 1102,
`Worker exceeded resource limits`. Waiting on the network does not count. Cloudflare's own limit
note says server-side rendering and parsing a large payload typically use 10–20 ms, which is
already over the Free limit. This app does that work inside the request:

- Next.js 16 server rendering, server actions and route handlers.
- The medication-review PDF is built with `pdf-lib` in the pharmacist's request
  (`apps/web/src/lib/report-pdf.ts`).
- An upload of up to 10 MB is accepted by a server action (`serverActions.bodySizeLimit` is
  `11mb` in `apps/web/next.config.ts`).

The scan cannot run on Workers Free or Workers Paid. `apps/web/src/lib/malware-scan.ts` writes the
upload to a temporary file and spawns the native `clamscan` binary through `node:child_process`.
On Workers, `node:child_process` is a non-functional stub (listed as a stub from compatibility
date 17 March 2026). Calling it does not run a program. Memory is **128 MB on Free and on Paid**.
The ClamAV signature database does not fit in that memory, and the Workers runtime has no
`clamscan` binary. The app was not rewritten to remove the scan.

## Cheapest next option

Workers Paid starts at **$5 USD per month**. It raises the CPU limit from 10 ms to 5 minutes,
with a default of 30 seconds. It does not raise memory above 128 MB and it does not make
`node:child_process` run `clamscan`. Buying it would not let this clinical app run unchanged, so
it was not bought.

The cheapest host that can run the current server, the PDF builder and ClamAV together is a small
Node.js process in the EU with `clamscan` installed. That was not bought either. Hosting
deployment stopped.

A static marketing site could use Cloudflare's free static hosting, because requests for static
assets are not charged and do not run the clinical routes. No marketing site was deployed. Safari
was not signed in to Cloudflare, and the clinical app was not split apart to make one.

## What was not done

- No `wrangler` deploy.
- No Workers Paid purchase.
- No nameserver change. `medsinfocus.co.uk` still uses the IONOS nameservers. See
  [IONOS_DNS.md](./IONOS_DNS.md).
- No public clinical intake.
