import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import {
  TEST_PASSWORD,
  countEmails,
  createPatient,
  expectNoA11yViolations,
  getMessage,
  signIn,
  waitForEmail,
} from './helpers';

const QUESTION_IDS = [
  'E1',
  'E2',
  'E3',
  'E4',
  'E5',
  'E6',
  'E7',
  'U1',
  'U2',
  'U3',
  'U4',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
];

async function startReview(page: Page, email: string) {
  await signIn(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('button', { name: 'Start a medication review' }).click();
  await expect(page).toHaveURL(/\/account\/review\/[0-9a-f-]+\/screening$/);
  return page.url().split('/review/')[1]!.split('/')[0]!;
}

async function answerScreening(page: Page, answers: Record<string, 'yes' | 'no' | 'unsure'>) {
  for (const id of QUESTION_IDS) {
    await page.locator(`#q_${id}-${answers[id] ?? 'no'}`).check();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function patientApi(email: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  return client;
}

test.describe.configure({ mode: 'serial' });

test('emergency answers stop intake and block purchase (UI and database)', async ({ page }) => {
  const patient = await createPatient('emergency');
  const orderId = await startReview(page, patient.email);

  const full = page.getByTestId('emergency-warning-full');
  await expect(full).toContainText('If you have a life-threatening emergency');
  await expect(page.getByText('Draft: awaiting clinical approval')).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'There is a problem' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Choose yes, no or not sure' }).first(),
  ).toBeVisible();

  await answerScreening(page, { E1: 'yes' });
  await expect(page).toHaveURL(new RegExp(`/review/${orderId}/outcome$`));
  await expect(page.getByTestId('outcome-emergency')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Call 999 now if this is happening' }),
  ).toBeVisible();
  await expect(page.getByText('We have stopped this request')).toBeVisible();
  await expect(page.getByText(/will not contact emergency services for you/)).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'I have read this advice' }).click();
  await expect(page.getByText('You have confirmed you have read this advice.')).toBeVisible();

  // No way forward in the UI: consent and questionnaire routes bounce back to the review page.
  await page.goto(`/account/review/${orderId}/questionnaire/1`);
  await expect(page).toHaveURL(new RegExp(`/review/${orderId}$`));
  await expect(page.getByTestId('order-status')).toContainText('Stopped: emergency symptoms');
  await expect(page.getByRole('button', { name: /pay|book/i })).toHaveCount(0);
  await page.goto(`/account/review/${orderId}/screening`);
  await expect(page).toHaveURL(new RegExp(`/review/${orderId}/outcome$`));

  // Database: the patient cannot re-screen, move the order on, or reach payment.
  const api = await patientApi(patient.email);
  const rescreen = await api.rpc('submit_safety_screening', {
    p_order_id: orderId,
    p_answers: Object.fromEntries(QUESTION_IDS.map((q) => [q, 'no'])),
  });
  expect(rescreen.error?.message).toContain('already been screened');
  const pay = await api
    .from('review_orders')
    .update({ status: 'awaiting_payment' })
    .eq('id', orderId);
  expect(pay.error?.code).toBe('42501');
  const draft = await api.rpc('save_questionnaire_draft', {
    p_order_id: orderId,
    p_step: 1,
    p_answers: {},
    p_medications: [],
  });
  expect(draft.error).not.toBeNull();

  await page.goto('/account');
  await expect(page.getByTestId('dashboard-review-status')).toContainText(
    'Stopped: emergency symptoms',
  );
});

test('urgent answers pause the request until a pharmacist reassesses it', async ({ page }) => {
  const patient = await createPatient('urgent');
  const orderId = await startReview(page, patient.email);
  await answerScreening(page, { U3: 'yes' });
  await expect(page.getByTestId('outcome-urgent')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Contact your GP or NHS 111 today' }),
  ).toBeVisible();
  await expect(page.getByText(/until a pharmacist has checked that it is suitable/)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto('/account');
  await expect(page.getByTestId('dashboard-review-status')).toContainText(
    'Paused: needs help today',
  );
  await expect(page.getByRole('button', { name: 'Start a medication review' })).toHaveCount(0);

  const api = await patientApi(patient.email);
  const { data } = await api.rpc('start_review_order');
  expect(data).toBe(orderId);
});

test('routine intake: consent, multi-step questionnaire with drafts, submission, amendment and generic email', async ({
  page,
}) => {
  const patient = await createPatient('routine');
  const orderId = await startReview(page, patient.email);
  await answerScreening(page, { R1: 'yes', R3: 'unsure' });
  await expect(page.getByTestId('outcome-routine')).toBeVisible();
  await expect(page.getByText('This does not mean your medicines are safe')).toBeVisible();
  await page.getByRole('link', { name: 'Continue' }).click();

  // Consent
  await expect(page).toHaveURL(new RegExp(`/review/${orderId}/consent$`));
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await expect(
    page.getByRole('link', { name: 'You must agree to this to continue with a review' }).first(),
  ).toBeVisible();
  await page.getByLabel(/may use the health information I give/).check();
  await page.getByLabel('I agree to have my consultation by telephone or secure video.').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();

  // Step 1
  await expect(page).toHaveURL(new RegExp(`/questionnaire/1$`));
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await expect(page.getByTestId('emergency-banner-short')).toBeVisible();
  await page
    .getByLabel('What health conditions do you have?')
    .fill('Synthetic: high blood pressure');
  await page.locator('#allergiesDontKnow').check();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Save and continue' }).click();

  // Draft is saved: leave and come back via the dashboard
  await expect(page).toHaveURL(new RegExp(`/questionnaire/2$`));
  await page.goto('/account');
  await expect(page.getByTestId('dashboard-review-status')).toContainText(
    'Questionnaire in progress',
  );
  await page.getByRole('link', { name: 'Continue questionnaire' }).click();
  await expect(page).toHaveURL(new RegExp(`/questionnaire/2$`));

  // Step 2: medicines, add and remove rows
  await page.locator('#med_0_name').fill('Synthetic Warfarin');
  await page.locator('#med_0_strength').fill('3mg');
  await page.locator('#med_0_dk_indication').check();
  await page.getByRole('button', { name: 'Add another medicine' }).click();
  await expect(page.locator('#med_1_name')).toBeVisible();
  await page.locator('#med_1_name').fill('Synthetic Amlodipine');
  await page.getByRole('button', { name: 'Add another medicine' }).click();
  await page.locator('#med_2_name').fill('To be removed');
  await page.getByRole('button', { name: 'Remove medicine 3' }).click();
  await expect(page.locator('#med_2_name')).toHaveCount(0);
  await expect(page.locator('#med_0_name')).toHaveValue('Synthetic Warfarin');
  await expect(page.locator('#med_0_dk_indication')).toBeChecked();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Save and continue' }).click();

  // Step 3: validation then success
  await expect(page).toHaveURL(new RegExp(`/questionnaire/3$`));
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(
    page.getByRole('link', { name: /Tell us your main question or concern/ }),
  ).toBeVisible();
  await page
    .getByLabel('What is your main question or concern about your medicines?')
    .fill('Synthetic: are my tablets still needed?');
  await page.getByLabel('Secure video call').check();
  await page.getByRole('button', { name: 'Save and continue' }).click();

  // Step 4: full warning at the checkpoint, summary, submit
  await expect(page).toHaveURL(new RegExp(`/questionnaire/4$`));
  await expect(page.getByTestId('emergency-warning-full')).toBeVisible();
  await expect(page.getByText('Synthetic Warfarin, 3mg')).toBeVisible();
  await expect(page.getByText("I don't know")).toBeVisible();
  await expect(page.getByText('Secure video call')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Send to pharmacist' }).click();

  await expect(page).toHaveURL(new RegExp(`/review/${orderId}\\?notice=submitted$`));
  await expect(page.getByTestId('order-status')).toContainText('Questionnaire sent');
  await expect(page.getByTestId('order-status')).toContainText(
    'Payment and booking are switched off',
  );
  await expect(page.getByText('Version 1: current')).toBeVisible();

  // Generic notification only: no health details
  const email = await waitForEmail(patient.email, 'There is an update in your account');
  expect(email.Text).not.toMatch(/warfarin|amlodipine|blood pressure|tablets/i);
  expect(email.Subject).toBe('There is an update in your account');

  // Controlled amendment creates version 2 and keeps version 1
  await page.getByRole('button', { name: 'Change my answers' }).click();
  await expect(page).toHaveURL(new RegExp(`/questionnaire/1$`));
  await page.goto(`/account/review/${orderId}/questionnaire/4`);
  await page.getByRole('button', { name: 'Send to pharmacist' }).click();
  await expect(page.getByText('Version 2: current')).toBeVisible();
  await expect(page.getByText('Version 1: replaced by a later version')).toBeVisible();
  expect(await countEmails(patient.email)).toBeGreaterThanOrEqual(2);

  // Submitted versions are not editable by the patient
  await page.goto(`/account/review/${orderId}/questionnaire/2`);
  await expect(page).toHaveURL(new RegExp(`/review/${orderId}$`));
});

test('private document upload with type checks and stubbed scanning', async ({ page }) => {
  const patient = await createPatient('docs');
  await startReview(page, patient.email);
  await answerScreening(page, {});
  await page.getByRole('link', { name: 'Continue' }).click();
  await page.getByLabel(/may use the health information I give/).check();
  await page.getByLabel('I agree to have my consultation by telephone or secure video.').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  const orderId = page.url().split('/review/')[1]!.split('/')[0]!;

  await page.goto(`/account/review/${orderId}/documents`);
  await expect(
    page.getByText('Security scanning of uploaded files is not yet switched on'),
  ).toBeVisible();

  await page.getByLabel('Choose a file').setInputFiles({
    name: 'not-really.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('this is plain text pretending to be a PDF'),
  });
  await page.getByRole('button', { name: 'Upload file' }).click();
  await expect(
    page.getByRole('link', { name: 'The selected file must be a PDF, JPG or PNG' }),
  ).toBeVisible();

  await page.getByLabel('Choose a file').setInputFiles({
    name: 'repeat-prescription.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% synthetic test document\n%%EOF\n'),
  });
  await page.getByRole('button', { name: 'Upload file' }).click();
  await expect(
    page.getByText('It is waiting for a security scan before a pharmacist can see it.'),
  ).toBeVisible();
  await expect(page.getByText('repeat-prescription.pdf')).toBeVisible();
  await expect(page.getByText('Waiting for security scan')).toBeVisible();
  await expectNoA11yViolations(page);

  // Another patient cannot read the file from storage
  const other = await createPatient('docs-other');
  const api = await patientApi(other.email);
  const { data: list } = await api.storage.from('patient-documents').list(patient.id);
  expect(list ?? []).toEqual([]);
});

test('account deletion request records retention without erasing clinical records', async ({
  page,
}) => {
  const patient = await createPatient('deletion');
  await signIn(page, patient.email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/account/settings');
  await expect(page.getByText('We must keep clinical records')).toBeVisible();
  await page.getByRole('button', { name: 'Request account deletion' }).click();
  await expect(page.getByTestId('deletion-request-status')).toContainText('Received');
  await page.reload();
  await expect(page.getByTestId('deletion-request-status')).toContainText('Received');
  await expect(page.getByRole('button', { name: 'Request account deletion' })).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test('notification email to a seeded inbox contains no health details', async () => {
  // Guard against template drift: the template text itself is checked in unit tests too.
  const msgs = await fetch(
    `${process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'}/api/v1/search?query=${encodeURIComponent('subject:"There is an update in your account"')}&limit=1`,
  );
  const body = (await msgs.json()) as { messages: { ID: string }[] };
  const first = body.messages[0];
  expect(first).toBeDefined();
  const msg = await getMessage(first!.ID);
  expect(msg.Text).toContain('we do not include any details in emails');
});
