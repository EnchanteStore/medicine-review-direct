# IONOS DNS

Do not change these records from the application or from this repository. Nothing here has been
applied at IONOS. MX records are not changed.

Eason authorised preparing Supabase and SES in London on 8 November 2026. That does not authorise
a DNS change. Targets stay blank until a web host exists. The names below are the records to fill
then. Their targets are intentionally empty.

The primary name is `medsinfocus.co.uk`. After a host exists, `www` should redirect to the apex.
`medsinfocus.com`, `medsinfocus.uk`, and `medsinfocus.info` are secondary names and are not
redirected yet.

| Type  | Host | Target | Fill after                                                     |
| ----- | ---- | ------ | -------------------------------------------------------------- |
| A     | @    |        | The web host exists                                            |
| A     | www  |        | The web host exists, if www is an address rather than an alias |
| CNAME | www  |        | The web host exists, if www is an alias of the apex            |
| TXT   | @    |        | SES gives a domain-verification value. Not known yet           |
| CNAME |      |        | SES gives the DKIM name and target. Not known yet              |

MX for `@` is not in this change and is not given a new target.

Proposed mailboxes `hello@`, `support@`, and `noreply@medsinfocus.co.uk` are not operational.
SES is not configured. Local mail stays in Mailpit.
