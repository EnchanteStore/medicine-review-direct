-- New enum values must be committed before they are used. See 20261107000700.
alter type public.consent_type add value if not exists 'gp_letter_sharing';
