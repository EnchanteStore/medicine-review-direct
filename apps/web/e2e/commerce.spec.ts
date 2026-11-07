import { expect, test } from '@playwright/test';
import {
  TEST_PASSWORD,
  createPatient,
  expectNoA11yViolations,
  serviceClient,
  signIn,
  waitForEmail,
} from './helpers';

const QUESTIONS = ['Q1', 'Q2', 'Q3', 'Q4'];

test('a cleared review can pay in the local test harness and then book a real open slot', async ({
  page,
}) => {
  const patient = await createPatient('commerce');
  const starts = new Date(Date.now() + (8 + Math.floor(Math.random() * 40)) * 24 * 60 * 60 * 1000);
  starts.setUTCHours(9, 0, 0, 0);
  const ends = new Date(starts.getTime() + 60 * 60 * 1000);
  const { error: availabilityError } = await serviceClient()
    .from('pharmacist_availability')
    .insert({
      pharmacist_id: '00000000-0000-4000-a000-000000000011',
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
    });
  expect(availabilityError).toBeNull();

  await signIn(page, patient.email, TEST_PASSWORD);
  await page.getByRole('button', { name: 'Start a medication review' }).click();
  for (const id of QUESTIONS) await page.locator(`#q_${id}-no`).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('link', { name: 'Continue' }).click();
  await page.getByLabel(/may use the health information I give/).check();
  await page.getByLabel('I agree to have my consultation by telephone or secure video.').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await page.getByLabel('What health conditions do you have?').fill('Synthetic: none relevant');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.locator('#med_0_name').fill('Synthetic medicine');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page
    .getByLabel('What is your main question or concern about your medicines?')
    .fill('Synthetic question');
  await page.getByLabel('Secure video call').check();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Send to pharmacist' }).click();
  await expect(page.getByRole('link', { name: 'Continue to checkout' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue to checkout' }).click();

  await expect(page.getByTestId('checkout-test-banner')).toBeVisible();
  await expect(page.getByTestId('checkout-price')).toContainText('£59');
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Continue to test checkout' }).click();
  await expect(page.getByTestId('local-harness-banner')).toContainText('This is not Stripe');
  await expect(page.getByTestId('harness-amount')).toContainText('£59');
  await page.getByRole('button', { name: 'Confirm test payment' }).click();

  await expect(page.getByRole('heading', { name: 'Paid, appointment not booked' })).toBeVisible();
  await page.getByRole('link', { name: 'Choose a time' }).click();
  await expect(page.getByRole('button', { name: 'Book this time' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Book this time' }).first().click();
  await expect(page.getByTestId('appointment-card')).toContainText('Booked');
  await expect(page.getByTestId('appointment-card')).toContainText('Secure video');

  const email = await waitForEmail(patient.email, 'Your appointment has been updated');
  expect(email.Subject).toBe('Your appointment has been updated');
  expect(`${email.Subject} ${email.Text}`).not.toMatch(/medicine|symptom|warfarin|questionnaire/i);

  await page.goto('/account');
  await expect(page.getByTestId('dashboard-review-status')).toContainText('Appointment booked');
});
