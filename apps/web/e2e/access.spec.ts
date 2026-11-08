import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import {
  SEED,
  SEED_PASSWORD,
  TEST_PASSWORD,
  createStaff,
  expectNoA11yViolations,
  signIn,
  signOut,
  totp,
} from './helpers';
import { readFileSync } from 'node:fs';

const ruleset = JSON.parse(
  readFileSync(
    new URL('../../../packages/domain/src/safety/ruleset-2026-11-draft-2.json', import.meta.url),
    'utf8',
  ),
);

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

  test('verified staff without MFA are sent to two-step verification', async ({ page }) => {
    await signIn(page, SEED.opsAdmin, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/mfa$/);
    await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
  });

  test('a patient cannot open the MFA page', async ({ page }) => {
    await signIn(page, SEED.patient, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    const res = await page.goto('/mfa');
    expect(res?.status()).toBe(404);
  });

  for (const [role, label, text] of [
    [
      'ops_admin',
      'Operations administrator: verified',
      'Your role does not include access to clinical records.',
    ],
    ['pharmacist', 'Pharmacist: verified', 'pharmacist workspace'],
  ] as const) {
    test(`a new ${role} enrols a TOTP authenticator and then reaches the staff area`, async ({
      page,
    }) => {
      const staff = await createStaff(role, role);
      await signIn(page, staff.email, TEST_PASSWORD);
      await expect(page).toHaveURL(/\/account$/);
      await page.goto('/staff');
      await expect(page).toHaveURL(/\/mfa$/);
      await page.getByRole('button', { name: 'Set up an authenticator app' }).click();
      const secret = (await page.getByTestId('mfa-secret').textContent())!.trim();
      await expect(
        page.getByRole('img', { name: 'QR code for your authenticator app' }),
      ).toBeVisible();
      await expectNoA11yViolations(page);

      await page.getByLabel('6-digit code').fill('000000');
      await page.getByRole('button', { name: 'Verify' }).click();
      await expect(page.getByText('That code is not right.')).toBeVisible();

      await page.getByLabel('6-digit code').fill(totp(secret));
      await page.getByRole('button', { name: 'Verify' }).click();
      await expect(page).toHaveURL(/\/staff$/);
      await expect(page.getByText(label)).toBeVisible();
      await expect(page.getByText(new RegExp(text))).toBeVisible();
    });
  }
});

test.describe('audit log', () => {
  async function enrol(page: Page, role: 'ops_admin' | 'pharmacist') {
    const staff = await createStaff(`audit-${role}`, role);
    await signIn(page, staff.email, TEST_PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await page.goto('/staff');
    await page.getByRole('button', { name: 'Set up an authenticator app' }).click();
    const secret = (await page.getByTestId('mfa-secret').textContent())!.trim();
    await page.getByLabel('6-digit code').fill(totp(secret));
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/staff$/);
  }

  test('an operations administrator can read the audit log and a pharmacist cannot', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await enrol(page, 'ops_admin');
    await expect(page.getByRole('link', { name: 'Audit log' })).toBeVisible();
    await page.getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'staff_role.created' }).first()).toBeVisible();
    await expect(page.getByText(/Paracetamol|stop taking/i)).toHaveCount(0);
    await expectNoA11yViolations(page);
    await page.screenshot({
      path: '/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-7/audit-log.png',
      fullPage: true,
    });

    await signOut(page);
    await enrol(page, 'pharmacist');
    await expect(page.getByRole('link', { name: 'Audit log' })).toHaveCount(0);
    const response = await page.goto('/staff/audit');
    expect(response?.status()).toBe(404);
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

  test('verified staff signed in without MFA (aal1) get no staff data from the API', async () => {
    const { client } = await apiClientAs(SEED.opsAdmin);
    expect((await client.from('audit_log').select('id')).data).toEqual([]);
    expect((await client.from('staff_roles').select('id')).data).toHaveLength(1);
  });

  test('the active rule set in the database matches the reviewed JSON definition', async () => {
    const { client } = await apiClientAs(SEED.patient);
    const { data } = await client
      .from('safety_rulesets')
      .select('version, status, definition')
      .eq('is_active', true)
      .single();
    expect(data!.status).toBe('draft');
    expect(data!.definition).toEqual(ruleset);
  });

  test('anonymous visitors see the service as closed for payments', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anon.rpc('service_status');
    expect(data).toMatchObject({
      payments_open: true,
      live_payments_open: false,
      payments_mode: 'test',
      live_service_enabled: false,
      active_ruleset_status: 'draft',
    });
  });
});
