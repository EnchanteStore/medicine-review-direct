-- New enum values must be committed before they are used.
alter type public.report_status add value if not exists 'superseded';
