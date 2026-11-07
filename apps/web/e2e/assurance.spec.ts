import { expect, test, type Page } from '@playwright/test';
import { TEST_PASSWORD, createPatient, serviceClient, signIn } from './helpers';

const QUESTIONS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

function tokenTtlSeconds(url: string): number {
  const token = new URL(url).searchParams.get('token');
  if (!token) throw new Error(`signed url has no token: ${url}`);
  const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as {
    exp?: number;
  };
  if (!payload.exp) throw new Error('signed url token has no expiry');
  return payload.exp - Math.floor(Date.now() / 1000);
}

async function tabTo(page: Page, ready: () => Promise<boolean>) {
  for (let i = 0; i < 40; i += 1) {
    if (await ready()) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('keyboard focus did not reach the control');
}

async function answerNoByKeyboard(page: Page) {
  for (const id of QUESTIONS) {
    await tabTo(page, async () =>
      page.evaluate((question) => {
        const active = document.activeElement;
        return active instanceof HTMLInputElement && active.name === `q_${question}`;
      }, id),
    );
    const selected = await page.evaluate(() =>
      document.activeElement instanceof HTMLInputElement ? document.activeElement.value : '',
    );
    if (selected === 'yes') await page.keyboard.press('ArrowDown');
    if (selected === 'unsure') await page.keyboard.press('ArrowUp');
    await expect(page.locator(`#q_${id}-no`)).toBeChecked();
  }
  await tabTo(page, () =>
    page.evaluate(
      () =>
        document.activeElement instanceof HTMLButtonElement &&
        document.activeElement.textContent?.includes('Continue') === true,
    ),
  );
  await page.keyboard.press('Enter');
}

test('keyboard only: routine screening, then booking a slot', async ({ page }) => {
  test.setTimeout(90_000);
  const patient = await createPatient('keyboard');
  const starts = new Date(Date.now() + (12 + Math.floor(Math.random() * 30)) * 24 * 60 * 60 * 1000);
  starts.setUTCHours(14, 0, 0, 0);
  const ends = new Date(starts.getTime() + 60 * 60 * 1000);
  expect(
    (
      await serviceClient().from('pharmacist_availability').insert({
        pharmacist_id: '00000000-0000-4000-a000-000000000011',
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      })
    ).error,
  ).toBeNull();

  await signIn(page, patient.email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('button', { name: 'Start a medication review' }).click();
  await expect(page).toHaveURL(/\/screening$/);
  await page.goto(page.url());
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await answerNoByKeyboard(page);
  await expect(page.getByTestId('outcome-routine')).toBeVisible();

  await page.getByRole('link', { name: 'Continue' }).click();
  await page.getByLabel(/may use the health information I give/).check();
  await page.getByLabel('I agree to have my consultation by telephone or secure video.').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await page.getByLabel('What health conditions do you have?').fill('None relevant');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.locator('#med_0_name').fill('Synthetic medicine');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page
    .getByLabel('What is your main question or concern about your medicines?')
    .fill('A keyboard booking check');
  await page.getByLabel('Telephone').check();
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByRole('button', { name: 'Send to pharmacist' }).click();
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await page.getByRole('button', { name: 'Continue to test checkout' }).click();
  await page.getByRole('button', { name: 'Confirm test payment' }).click();
  await page.getByRole('link', { name: 'Choose a time' }).click();
  await expect(page).toHaveURL(/\/book$/);
  await page.goto(page.url());
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await tabTo(page, () =>
    page.evaluate(
      () =>
        document.activeElement instanceof HTMLButtonElement &&
        document.activeElement.textContent?.includes('Book this time') === true,
    ),
  );
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('appointment-card')).toContainText('Booked');
});

test('a clean document link expires, and a one-second link is rejected', async ({ page }) => {
  test.setTimeout(30_000);
  const patient = await createPatient('signed-url');
  const admin = serviceClient();
  const order = await admin
    .from('review_orders')
    .insert({ patient_id: patient.id })
    .select('id')
    .single();
  expect(order.error).toBeNull();
  const pdf = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const path = `${patient.id}/assurance-note.pdf`;
  const uploaded = await admin.storage.from('patient-documents').upload(path, pdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  expect(uploaded.error).toBeNull();
  const doc = await admin
    .from('documents')
    .insert({
      order_id: order.data!.id,
      patient_id: patient.id,
      storage_path: path,
      original_filename: 'assurance-note.pdf',
      mime_type: 'application/pdf',
      size_bytes: pdf.length,
      scan_status: 'clean',
      scan_engine: 'assurance-marked-clean',
    })
    .select('id')
    .single();
  expect(doc.error).toBeNull();

  await signIn(page, patient.email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  const redirect = await page.request.get(`/api/documents/${doc.data!.id}/open`, {
    maxRedirects: 0,
  });
  expect(redirect.status()).toBeGreaterThanOrEqual(300);
  expect(redirect.status()).toBeLessThan(400);
  const location = redirect.headers().location;
  expect(location).toBeTruthy();
  const ttl = tokenTtlSeconds(location!);
  expect(ttl).toBeGreaterThan(30);
  expect(ttl).toBeLessThanOrEqual(60);
  const fresh = await page.request.get(location!);
  expect(fresh.status()).toBe(200);

  const short = await admin.storage.from('patient-documents').createSignedUrl(path, 1);
  expect(short.error).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 2_500));
  const expired = await page.request.get(short.data!.signedUrl);
  expect(expired.ok()).toBe(false);
});
