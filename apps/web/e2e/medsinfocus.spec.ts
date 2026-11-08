import { expect, test } from '@playwright/test';
import { SEED, SEED_PASSWORD, signIn } from './helpers';
import { createClient } from '@supabase/supabase-js';

test('the homepage uses the MedsInFocus name, both pharmacists, and no prescribing claim', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your medicines. A clearer picture.',
  );
  await expect(page.getByRole('link', { name: 'Book a Medication Review' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'How It Works', exact: true })).toBeVisible();
  await expect(page.getByTestId('pharmacist-2234388')).toContainText('Cheuk Kin Sung');
  await expect(page.getByTestId('pharmacist-2234388')).toContainText('Lead Pharmacist');
  await expect(page.getByTestId('pharmacist-2234388')).toContainText(
    'Live GPhC register check pending',
  );
  await expect(page.getByTestId('pharmacist-2235658')).toContainText('Ka Po Ng');
  await expect(page.getByTestId('pharmacist-2235658')).toContainText('Pharmacist');
  await expect(page.getByText(/independent prescriber/i)).toHaveCount(0);
  await expect(
    page.getByText(
      'MedsInFocus is a trading name of PHARMA247 LTD, registered in England and Wales.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Company number 17365383.')).toBeVisible();
  await expect(page.getByTestId('home-price')).toContainText('£59');
  await page.screenshot({
    path: '/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/medsinfocus/homepage.png',
    fullPage: true,
  });
});

test('the portal alias asks a signed-out visitor to sign in and opens the account when signed in', async ({
  page,
}) => {
  await page.goto('/portal');
  await expect(page).toHaveURL(/\/sign-in/);
  await signIn(page, SEED.patient, SEED_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/portal');
  await expect(page.getByRole('heading', { name: 'Hello, Demo' })).toBeVisible();
  await page.screenshot({
    path: '/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/medsinfocus/portal.png',
    fullPage: true,
  });
});

test('a patient can choose either pharmacist or the next available time', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const later = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const laterEnd = new Date(later.getTime() + 60 * 60 * 1000);
  const rows = await admin.from('pharmacist_availability').insert([
    {
      pharmacist_id: '00000000-0000-4000-a000-000000000013',
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
    },
    {
      pharmacist_id: '00000000-0000-4000-a000-000000000014',
      starts_at: later.toISOString(),
      ends_at: laterEnd.toISOString(),
    },
  ]);
  expect(rows.error).toBeNull();
  const patient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await patient.auth.signInWithPassword({
    email: SEED.patient,
    password: SEED_PASSWORD,
  });
  expect(signed.error).toBeNull();
  const choices = await patient.rpc('bookable_slot_choices', {
    p_from: new Date().toISOString(),
    p_to: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  });
  expect(choices.error).toBeNull();
  const names = new Set(
    (choices.data ?? []).map((slot: { display_name: string | null }) => slot.display_name),
  );
  expect(names.has('Cheuk Kin Sung')).toBe(true);
  expect(names.has('Ka Po Ng')).toBe(true);
  const earliest = [...(choices.data ?? [])].sort(
    (a: { starts_at: string }, b: { starts_at: string }) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )[0] as { display_name?: string } | undefined;
  expect(earliest?.display_name).toBe('Cheuk Kin Sung');
});
