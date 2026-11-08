# IONOS DNS

Do not change these records from the application or from this repository. Targets stay blank
until the owner authorises a London host. Nothing here has been applied at IONOS.

The primary name is `medsinfocus.co.uk`. After deployment, `www` should redirect to the apex.
`medsinfocus.com`, `medsinfocus.uk`, and `medsinfocus.info` are secondary names and are not
redirected yet.

| Type  | Host | Target |
| ----- | ---- | ------ |
| A     | @    |        |
| A     | www  |        |
| CNAME | www  |        |
| MX    | @    |        |
| TXT   | @    |        |

Proposed mailboxes `hello@`, `support@`, and `noreply@medsinfocus.co.uk` are not operational.
SES is not configured. Local mail stays in Mailpit.
