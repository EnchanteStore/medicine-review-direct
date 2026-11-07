-- Structural security checks: RLS on every table, pinned search_path on
-- security definer functions, and minimal grants.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

select tables_are('public', array['profiles', 'staff_roles', 'consents', 'audit_log', 'products',
  'app_settings', 'launch_signoffs', 'safety_rulesets', 'review_orders', 'safety_screenings',
  'suitability_assessments', 'questionnaire_submissions', 'high_risk_medicine_terms', 'documents',
  'retention_policies', 'legal_holds', 'deletion_requests', 'consultations', 'reports',
  'high_risk_medicine_changes', 'mfa_recovery_events',
  'checkout_sessions', 'provider_events', 'payments', 'refunds',
  'pharmacist_availability', 'appointments', 'appointment_events',
  'messages', 'gp_letters', 'safety_notices'],
  'public schema contains only the expected tables');

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every public table has row level security enabled');

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('app', 'public') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%') $$,
  'every security definer function pins search_path');

select is_empty(
  $$ select 1 from information_schema.routine_privileges
     where routine_schema = 'app' and routine_name = 'write_audit'
       and grantee in ('anon', 'authenticated', 'PUBLIC') $$,
  'API roles cannot call app.write_audit directly');

select table_privs_are('public', 'profiles', 'anon', array[]::text[], 'anon has no access to profiles');
select table_privs_are('public', 'consents', 'anon', array[]::text[], 'anon has no access to consents');
select table_privs_are('public', 'staff_roles', 'anon', array[]::text[], 'anon has no access to staff_roles');
select table_privs_are('public', 'audit_log', 'anon', array[]::text[], 'anon has no access to audit_log');
select table_privs_are('public', 'products', 'anon', array['SELECT'], 'anon can only read products');

select table_privs_are('public', 'profiles', 'authenticated', array['SELECT'],
  'authenticated has table-level SELECT only on profiles (updates are column-scoped)');
select table_privs_are('public', 'staff_roles', 'authenticated', array['SELECT'],
  'authenticated cannot write staff_roles');
select table_privs_are('public', 'audit_log', 'authenticated', array['SELECT'],
  'authenticated cannot write audit_log');

select column_privs_are('public', 'profiles', 'phone_verified_at', 'authenticated', array['SELECT'],
  'patients cannot mark their own phone as verified');

select is(
  (select count(*)::int from public.products where is_active and code = 'standard_review'
     and price_pence = 5900 and standard_price_pence = 7900 and currency = 'GBP'),
  1, 'launch product is seeded at £59 (normally £79)');

select * from finish();
rollback;
