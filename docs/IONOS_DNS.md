# IONOS DNS

Nameservers were not changed. MX was not changed. The working SPF record was not changed. No
record was added. IONOS asked Safari to sign in, so the domain page was not opened. The values
below are from `dig` on 8 November 2026.

The primary name is `medsinfocus.co.uk`. `www` was not pointed at a host. `medsinfocus.com`,
`medsinfocus.uk` and `medsinfocus.info` were not changed.

## Records left as they are

| Type  | Name                  | Value                                   |
| ----- | --------------------- | --------------------------------------- |
| NS    | `@`                   | `ns1018.ui-dns.org`                     |
| NS    | `@`                   | `ns1051.ui-dns.com`                     |
| NS    | `@`                   | `ns1081.ui-dns.de`                      |
| NS    | `@`                   | `ns1084.ui-dns.biz`                     |
| A     | `@`                   | `217.160.0.2`                           |
| MX    | `@`                   | `10 mx00.ionos.co.uk`                   |
| MX    | `@`                   | `10 mx01.ionos.co.uk`                   |
| TXT   | `@`                   | `v=spf1 include:_spf-eu.ionos.com ~all` |
| CNAME | `_dmarc`              | `dmarc.ionos.co.uk`                     |
| CNAME | `s1-ionos._domainkey` | `s1.dkim.ionos.com`                     |
| CNAME | `s2-ionos._domainkey` | `s2.dkim.ionos.com`                     |

The address `217.160.0.2` is the existing IONOS address. It was not replaced with a Cloudflare
address. The clinical app is not deployed. See [HOSTING.md](./HOSTING.md).

## Proposed email records

Do not add these until SES in London has created the `medsinfocus.co.uk` identity and shown the
real DKIM names. The tokens below are placeholders, not values to publish. See
[SES_LONDON.md](./SES_LONDON.md).

| Type  | Name                  | Target                        | Add it?                                                         |
| ----- | --------------------- | ----------------------------- | --------------------------------------------------------------- |
| CNAME | `<token1>._domainkey` | `<token1>.dkim.amazonses.com` | Only if SES shows this name and the name does not already exist |
| CNAME | `<token2>._domainkey` | `<token2>.dkim.amazonses.com` | Only if SES shows this name and the name does not already exist |
| CNAME | `<token3>._domainkey` | `<token3>.dkim.amazonses.com` | Only if SES shows this name and the name does not already exist |
| TXT   | `@`                   | see the SPF note              | No. This would change the working SPF record                    |
| MX    | `@`                   | unchanged                     | No. Do not replace `mx00.ionos.co.uk` or `mx01.ionos.co.uk`     |

SPF note, not applied:

```text
v=spf1 include:_spf-eu.ionos.com include:amazonses.com ~all
```

That would keep IONOS and add Amazon. It is still an edit of a working TXT record, so it was not
written at IONOS.

`hello@`, `support@` and `noreply@medsinfocus.co.uk` are not mailboxes yet. Do not publish them
as working addresses. Patient email stays off.

## Rollback

Delete only SES CNAME names that were added for DKIM. Restore the apex TXT to:

```text
v=spf1 include:_spf-eu.ionos.com ~all
```

Do not delete the MX records, the IONOS DKIM names, the DMARC CNAME, or the four `ui-dns`
nameservers.
