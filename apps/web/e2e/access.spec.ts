import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { SEED, SEED_PASSWORD, signIn } from './helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SEED_PATIENT_ID = '00000000-0000-4000-a000-000000000001';

async function apiClientAs(email: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  expect(error).toBeNull();
  return { client, userId: data.user!.id };
}

test.describe('staff area (UI, server-side role checks)', () => {
  test('a patient cannot open the staff area', async ({ page }) => {
    await signIn(page, SEED.patient, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    const res = await page.goto('/staff');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('an unverified pharmacist cannot open the staff area', async ({ page }) => {
    await signIn(page, SEED.pharmacistPending, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    const res = await page.goto('/staff');
    expect(res?.status()).toBe(404);
  });

  test('a verified ops admin can open the staff area but is told there is no clinical access', async ({ page }) => {
    await signIn(page, SEED.opsAdmin, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await page.goto('/staff');
    await expect(page.getByRole('heading', { name: 'Staff area', level: 1 })).toBeVisible();
    await expect(page.getByText('Operations administrator: verified')).toBeVisible();
    await expect(page.getByText('Your role does not include access to clinical records.')).toBeVisible();
  });

  test('a verified pharmacist sees the clinical workspace placeholder', async ({ page }) => {
    await signIn(page, SEED.pharmacistVerified, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await page.goto('/staff');
    await expect(page.getByText('Pharmacist: verified')).toBeVisible();
    await expect(page.getByText(/pharmacist workspace/)).toBeVisible();
  });
});

test.describe('data API (RLS with real user tokens)', () => {
  test('a patient can read only their own profile and consents', async () => {
    const { client, userId } = await apiClientAs(SEED.patient);
    const profiles = await client.from('profiles').select('id');
    expect(profiles.error).toBeNull();
    expect(profiles.data!.map((r) => r.id)).toEqual([userId]);

    const consents = await client.from('consents').select('user_id');
    expect(consents.data!.length).toBeGreaterThan(0);
    expect(new Set(consents.data!.map((r) => r.user_id))).toEqual(new Set([userId]));

    expect((await client.from('staff_roles').select('id')).data).toEqual([]);
    expect((await client.from('audit_log').select('id')).data).toEqual([]);
  });

  test('a patient cannot update another user or escalate privileges', async () => {
    const { client } = await apiClientAs(SEED.patient);
    const other = await client
      .from('profiles')
      .update({ given_name: 'Hacked' })
      .eq('id', '00000000-0000-4000-a000-000000000011')
      .select('id');
    expect(other.data).toEqual([]);

    const escalate = await client
      .from('staff_roles')
      .insert({ user_id: SEED_PATIENT_ID, role: 'pharmacist', verification_status: 'verified' });
    expect(escalate.error?.code).toBe('42501');

    const verifyPhone = await client
      .from('profiles')
      .update({ phone_verified_at: new Date().toISOString() } as never)
      .eq('id', SEED_PATIENT_ID);
    expect(verifyPhone.error?.code).toBe('42501');
  });

  test('an ops admin cannot read patient profiles or consents', async () => {
    const { client } = await apiClientAs(SEED.opsAdmin);
    const p = await client.from('profiles').select('id').eq('id', SEED_PATIENT_ID);
    expect(p.data).toEqual([]);
    const c = await client.from('consents').select('id').eq('user_id', SEED_PATIENT_ID);
    expect(c.data).toEqual([]);
  });

  test('anonymous visitors can read active prices but nothing personal', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const products = await anon.from('products').select('code, price_pence');
    expect(products.data).toEqual([{ code: 'standard_review', price_pence: 5900 }]);
    const profiles = await anon.from('profiles').select('id');
    expect(profiles.error?.code).toBe('42501');
  });
});
