# Backup and recovery

This describes what exists today and what must be true before any real patient data is stored.
The confirmed Supabase project is in Central EU (Frankfurt, `eu-central-1`). It has the schema
and no patient records. No restore drill has been run. Backup settings were not opened. The
figures below are the provisional retention schedule from the 7 November 2026 decisions (P-06).
They are not a completed DPIA. The earlier London database preference is history.

## What is protected already

- Clinical rows use `on delete restrict`. Deleting an account does not erase a clinical record.
- Consultations, released reports, audit events, consents and safety notes are append-only or
  immutable once released.
- A clinical administrator can place a legal hold. The abandoned-intake purge refuses an order
  that has clinical content or a hold.
- The live service, public intake and live card payments stay off until every launch gate is
  signed off. A passing local test does not open them.
- Local email is Mailpit. Nothing in this environment is sent to a real address.

## What is not in place

| Item                                          | Status                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Hosted database in Frankfurt (`eu-central-1`) | CREATED and empty of patient records. Project `qcjkngnwjjoxwutgjfyt`. London is no longer the preference                   |
| Point-in-time recovery or daily backups       | NOT VERIFIED. The backup page was not opened                                                                               |
| Restore drill                                 | NOT EXECUTED                                                                                                               |
| Scheduled retention job                       | NOT BUILT. `app.purge_abandoned_intake` exists and is tested; nothing calls it on a clock                                  |
| Backup of Storage objects                     | NOT CONFIGURED. Hosted buckets `patient-documents`, `clinical-reports` and `document-quarantine` exist and have no objects |
| Off-site copy of the audit log                | NOT CONFIGURED                                                                                                             |

Provisional periods, pending the DPIA: clinical records 8 years from last clinical contact,
abandoned intake 90 days, accounting 6 years, security logs 12 months, temporary backups 30 to
90 days.

## Local development

`supabase start` keeps the database in Docker on this machine. `supabase db reset` drops that
database and replays migrations and seed. That is safe only because the data is synthetic.

Do not copy a local database, service-role key, or storage volume into a hosted project.

## When a hosted database exists

1. The confirmed region is Central EU (Frankfurt, `eu-central-1`). Do not create another project.
   If a project is in a different region, stop. Do not migrate clinical data to fix it.
2. Turn on the provider's backups and point-in-time recovery. Record the retention in the DPIA.
3. Restore into a new, empty project. Do not restore over the database that is serving patients.
4. On the restored copy, check that row level security is still enabled, that a patient cannot
   read another patient's report, and that `app.live_service_enabled()` is still false.
5. Keep the application pointed at the original project until that check passes.
6. Write down who ran the drill, the date, and whether the check passed. A drill that has not
   been written down has not happened.

A backup is not a reason to delete the live clinical record. Holds and the retention schedule
still apply after a restore.
