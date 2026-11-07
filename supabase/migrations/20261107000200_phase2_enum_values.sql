-- New enum values must be committed before use, so they live in their own migration.
alter type public.consent_type add value if not exists 'health_data_processing';
alter type public.consent_type add value if not exists 'remote_consultation';
alter type public.consent_source add value if not exists 'intake';
