import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { readPdf, screenshotPdf } from './pdf-check';
import {
  TEST_PASSWORD,
  createStaff,
  serviceClient,
  signIn,
  signOut,
  totp,
  uniqueEmail,
  waitForAuthLink,
  waitForEmail,
} from './helpers';

const MEDIA = '/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-5';
const MEDICINE = 'Paracetamol';
const CONDITION = 'High blood pressure';
const CONCERN = 'Why am I on this medicine?';
const FINDING = 'Journey finding marker: discuss the indication with the GP.';
const HEALTH = new RegExp(`${MEDICINE}|${CONDITION}|${CONCERN}|${FINDING}`, 'i');

async function signUp(page: Page, email: string) {
  await page.goto('/sign-up');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Create a password').fill(TEST_PASSWORD);
  await page.getByLabel('Confirm your password').fill(TEST_PASSWORD);
  await page.getByLabel('I confirm I am 18 or over and live in England').check();
  await page.getByLabel(/I have read the terms of service/).check();
  await page.getByRole('button', { name: 'Create account' }).click();
}

async function verifyCode(page: Page, secret: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByLabel('6-digit code').fill(totp(secret));
    await page.getByRole('button', { name: 'Verify' }).click();
    try {
      await page.waitForURL(/\/staff/, { timeout: 8_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
}

async function enrol(page: Page): Promise<string> {
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/mfa/);
  await page.getByRole('button', { name: 'Set up an authenticator app' }).click();
  const secret = (await page.getByTestId('mfa-secret').textContent())!.trim();
  await verifyCode(page, secret);
  return secret;
}

async function openAsStaff(page: Page, secret: string, path: string) {
  await page.goto(path);
  if (page.url().includes('/mfa')) {
    await verifyCode(page, secret);
    await page.goto(path);
  }
}

test('priority path: register, review, pay, book, release, and read the report', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await mkdir(MEDIA, { recursive: true });
  const email = uniqueEmail('journey');
  const pharmacist = await createStaff('journey-pharmacist', 'pharmacist');
  const admin = await createStaff('journey-admin', 'clinical_admin');
  await serviceClient()
    .from('profiles')
    .update({ given_name: 'Asha', family_name: 'Synthetic' })
    .eq('id', pharmacist.id);

  const starts = new Date(Date.now() + (10 + Math.floor(Math.random() * 40)) * 24 * 60 * 60 * 1000);
  starts.setUTCHours(11, 0, 0, 0);
  const ends = new Date(starts.getTime() + 60 * 60 * 1000);
  const availability = await serviceClient().from('pharmacist_availability').insert({
    pharmacist_id: '00000000-0000-4000-a000-000000000011',
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
  });
  expect(availability.error).toBeNull();

  await signUp(page, email);
  await expect(page).toHaveURL(/\/sign-up\/check-email$/);
  await page.goto(await waitForAuthLink(email, 'Confirm your email address'));
  await expect(page).toHaveURL(/\/account\?notice=verified$/);

  await page.goto('/account/profile');
  await page.getByLabel('First name').fill('Journey');
  await page.getByLabel('Last name').fill('Patient');
  await page.getByLabel('Day').fill('10');
  await page.getByLabel('Month').fill('12');
  await page.getByLabel('Year').fill('1950');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('Your details have been saved.')).toBeVisible();

  await page.goto('/account');
  await page.getByRole('button', { name: 'Start a medication review' }).click();
  await expect(page).toHaveURL(/\/screening$/);
  const orderId = page.url().split('/review/')[1]!.split('/')[0]!;
  for (const id of ['Q1', 'Q2', 'Q3', 'Q4']) await page.locator(`#q_${id}-no`).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('outcome-routine')).toBeVisible();
  await page.getByRole('link', { name: 'Continue' }).click();

  await page.getByLabel(/may use the health information I give/).check();
  await page.getByLabel('I agree to have my consultation by telephone or secure video.').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await page.getByLabel('What health conditions do you have?').fill(CONDITION);
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.locator('#med_0_name').fill(MEDICINE);
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page
    .getByLabel('What is your main question or concern about your medicines?')
    .fill(CONCERN);
  await page.getByLabel('Telephone').check();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Send to pharmacist' }).click();
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await expect(page.getByTestId('checkout-test-banner')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to test checkout' }).click();
  await page.getByRole('button', { name: 'Confirm test payment' }).click();
  await expect(page.getByRole('heading', { name: 'Paid, appointment not booked' })).toBeVisible();

  const adminDb = serviceClient();
  const [sessions, payments, events] = await Promise.all([
    adminDb.from('checkout_sessions').select('*').eq('order_id', orderId),
    adminDb.from('payments').select('*').eq('order_id', orderId),
    adminDb.from('provider_events').select('*'),
  ]);
  expect(sessions.error).toBeNull();
  expect(payments.error).toBeNull();
  expect(events.error).toBeNull();
  expect(payments.data).toHaveLength(1);
  const stored = JSON.stringify({
    sessions: sessions.data,
    payments: payments.data,
    events: events.data,
  });
  expect(stored).not.toMatch(HEALTH);
  expect(stored).not.toContain(email);
  expect(events.data?.every((row) => !('payload' in row) && !('body' in row))).toBe(true);

  await page.getByRole('link', { name: 'Choose a time' }).click();
  await page.getByRole('button', { name: 'Book this time' }).first().click();
  await expect(page.getByTestId('appointment-card')).toContainText('Booked');
  const appointmentMail = await waitForEmail(email, 'Your appointment has been updated');
  expect(`${appointmentMail.Subject}\n${appointmentMail.Text}`).not.toMatch(HEALTH);

  await signOut(page);
  await signIn(page, admin.email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await enrol(page);
  await page.goto('/staff/assignments');
  const assign = page.getByTestId(`assign-${orderId}`);
  await assign.getByLabel('Pharmacist').selectOption(pharmacist.id);
  await assign.getByRole('button', { name: 'Assign pharmacist' }).click();
  await expect(page.getByText('Pharmacist assigned.')).toBeVisible();
  await signOut(page);

  await signIn(page, pharmacist.email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  const secret = await enrol(page);
  await page.goto(`/staff/reviews/${orderId}`);
  await expect(page.getByText(MEDICINE)).toBeVisible();
  await expect(page.getByText('Paid (£59.00')).toBeVisible();
  await page.getByLabel('Date').fill('2026-11-06');
  await page.getByLabel('Time (UK)').fill('10:00');
  await page
    .getByLabel('Clinical notes')
    .fill(
      Array.from({ length: 45 }, () => 'Discussed adherence and what to ask the GP.').join(' '),
    );
  await page.getByRole('checkbox', { name: 'This was a completed two-way conversation' }).check();
  await page.getByRole('button', { name: 'Save consultation' }).click();
  await expect(page.getByText('Consultation recorded.')).toBeVisible();
  await page.getByRole('button', { name: 'Start the report' }).click();
  await page.getByLabel('Key findings').fill(FINDING);
  await page.getByLabel('Medicine').fill(MEDICINE);
  await page
    .getByLabel('Medication-related issue')
    .fill('The patient is unsure why it was started.');
  await page
    .getByLabel('Recommendations')
    .fill('Ask the GP whether this medicine is still needed.');
  await page.getByLabel('Monitoring needs').fill('Review pain at the next GP appointment.');
  await page.getByLabel('Points to discuss with the GP').fill('Indication for long-term use.');
  await page
    .getByLabel('Safety advice')
    .fill('If you feel very unwell, contact your GP or NHS 111. Call 999 in an emergency.');
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText('Report draft saved.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'The clinical information is sufficient' }).check();
  await page.getByRole('checkbox', { name: 'This assessment is clinically adequate' }).check();
  await page.getByRole('button', { name: 'Record checks' }).click();
  await page.getByTestId('approve-report').click();
  await expect(page.getByText('Report approved.')).toBeVisible();
  await page.getByTestId('generate-report').click();
  await expect(page.getByText('The PDF is ready.')).toBeVisible();
  await signOut(page);

  await signIn(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto(`/account/review/${orderId}/report`);
  await expect(page.getByText('has not released a report')).toBeVisible();
  await expect(page.getByText(FINDING)).toHaveCount(0);
  const hiddenPdf = await page.request.get(`/account/review/${orderId}/report/file`);
  expect(hiddenPdf.status()).toBe(404);
  await signOut(page);

  await signIn(page, pharmacist.email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await openAsStaff(page, secret, `/staff/reviews/${orderId}`);
  await page.getByTestId('release-report').click();
  await expect(page.getByText('Report released.')).toBeVisible();
  const releaseMail = await waitForEmail(email, 'There is an update in your account');
  expect(`${releaseMail.Subject}\n${releaseMail.Text}`).not.toMatch(HEALTH);
  await signOut(page);

  await signIn(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto(`/account/review/${orderId}/report`);
  await expect(page.getByTestId('patient-report')).toBeVisible();
  await expect(page.getByText(FINDING)).toBeVisible();
  const pdfResponse = await page.request.get(`/account/review/${orderId}/report/file`);
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
  expect(pdfResponse.headers()['cache-control']).toContain('no-store');
  const bytes = Buffer.from(await pdfResponse.body());
  const pdf = await readPdf(bytes);
  expect(pdf.pageCount).toBeGreaterThan(1);
  const all = pdf.pages.join('\n');
  for (const section of [
    'Patient',
    'Review date',
    'Consultation',
    'Pharmacist',
    'Medicines reviewed',
    'Concerns',
    'Information and documents reviewed',
    'Key findings',
    'Medication-related issues',
    'Recommendations',
    'Monitoring',
    'Points to discuss with the GP',
    'Safety advice',
    'Limitations and disclaimer',
    'About this document',
  ]) {
    expect(all, section).toContain(section);
  }
  expect(all).toContain('DRAFT pending clinical approval');
  expect(all).toContain(MEDICINE);
  expect(all).toContain(FINDING);
  expect(all).toContain('Asha Synthetic');
  expect(all).toContain('2234388');
  expect(all).toContain('still pending');
  expect(pdf.pages[0]).toContain('Patient');
  expect(pdf.pages[0]).not.toContain('About this document');
  expect(pdf.pages.at(-1)).toMatch(/DRAFT pending clinical approval/);
  const shots = await screenshotPdf(bytes, MEDIA, 'report-page');
  expect(shots.length).toBeGreaterThan(1);
});
