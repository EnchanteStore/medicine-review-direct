# SES London

Email stays on AWS SES in London (`eu-west-2`). The app already refuses any other region and
refuses a From address other than `hello@medsinfocus.co.uk`, `support@medsinfocus.co.uk` and
`noreply@medsinfocus.co.uk`. `SES_SEND_ENABLED` is still required before a send, and it is unset.
Patient email stays off. Local mail stays in Mailpit.

## What was found

On 8 November 2026 Safari opened the SES identities page for `eu-west-2` and showed the AWS
sign-in form. No account was selected and no password was entered. There is no AWS credential
file on this Mac. The `medsinfocus.co.uk` identity was not created. No message was sent. The
sandbox was not reached, so the one non-clinical test was not sent.

`hello@`, `support@` and `noreply@` stay unpublished until those mailboxes exist.

## DNS that must stay

These public records were read with `dig`. They were not changed. Nameservers were not changed.

| Type  | Name                                    | Value                                     |
| ----- | --------------------------------------- | ----------------------------------------- |
| NS    | `medsinfocus.co.uk`                     | `ns1018.ui-dns.org`                       |
| NS    | `medsinfocus.co.uk`                     | `ns1051.ui-dns.com`                       |
| NS    | `medsinfocus.co.uk`                     | `ns1081.ui-dns.de`                        |
| NS    | `medsinfocus.co.uk`                     | `ns1084.ui-dns.biz`                       |
| MX    | `medsinfocus.co.uk`                     | `10 mx00.ionos.co.uk`                     |
| MX    | `medsinfocus.co.uk`                     | `10 mx01.ionos.co.uk`                     |
| TXT   | `medsinfocus.co.uk`                     | `v=spf1 include:_spf-eu.ionos.com ~all`   |
| CNAME | `_dmarc.medsinfocus.co.uk`              | `dmarc.ionos.co.uk` (`v=DMARC1; p=none;`) |
| CNAME | `s1-ionos._domainkey.medsinfocus.co.uk` | `s1.dkim.ionos.com`                       |
| CNAME | `s2-ionos._domainkey.medsinfocus.co.uk` | `s2.dkim.ionos.com`                       |

The SPF record is working. The MX records deliver to IONOS. They were not replaced.

## Proposed records, not applied

SES had no identity, so it has not issued DKIM names yet. Do not invent those names. After Eason
signs in to SES in `eu-west-2` and creates the domain identity, SES will show three CNAME records.
Add only those CNAME records, and only if each name is new. They do not replace MX or SPF.

Do not apply this SPF edit yet. It would change a working SPF record:

```text
v=spf1 include:_spf-eu.ionos.com include:amazonses.com ~all
```

That line keeps the IONOS include. It is still a change to the live TXT record, so it was left
untouched. Do not add an SES MX record. Do not replace `_dmarc`. Do not replace the IONOS DKIM
names. Do not change the nameservers.

## Rollback

If the three SES CNAME records are added later, delete those three names only. If the SPF TXT is
edited later, put back:

```text
v=spf1 include:_spf-eu.ionos.com ~all
```

Leave the MX records, the IONOS DKIM names, the DMARC CNAME and the nameservers as they are.

## Owner action

Sign in to AWS in Safari, open SES in London, and create the `medsinfocus.co.uk` identity if it
is not there. Copy the DKIM names into [IONOS_DNS.md](./IONOS_DNS.md) before any record is added.
Do not type access keys into chat. If the app is to hold them, type them into `apps/web/.env.local`
and leave `SES_SEND_ENABLED` unset until a mailbox exists and a non-clinical test is intended.
