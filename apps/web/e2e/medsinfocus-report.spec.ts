import { expect, type Page, test } from '@playwright/test';
import {
  TEST_PASSWORD,
  createPatient,
  createStaff,
  serviceClient,
  signIn,
  signOut,
  totp,
} from './helpers';

const FINDING = 'Synthetic finding marker: discuss the indication with the GP.';
const CORRECTED = 'Synthetic corrected finding: the monitoring point was clarified.';
const PHARMACIST_NAME = 'Nia Approver';

let patientEmail = '';
let pharmacistEmail = '';
let pharmacistSecret = '';
let orderId = '';

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

async function signInAndLand(page: Page, email: string) {
  await signIn(page, email, TEST_PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
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

async function seedBookedReview(patientId: string): Promise<string> {
  const admin = serviceClient();
  const created = await admin
    .from('review_orders')
    .insert({ patient_id: patientId })
    .select('id')
    .single();
  if (created.error || !created.data) throw created.error ?? new Error('order was not created');
  const id = created.data.id;
  const step = async (status: string) => {
    const updated = await admin.from('review_orders').update({ status }).eq('id', id);
    if (updated.error) throw new Error(`${status}: ${updated.error.message}`);
  };
  const screening = await admin.from('safety_screenings').insert({
    order_id: id,
    patient_id: patientId,
    ruleset_version: '2026-11-draft.2',
    answers: { Q1: 'no', Q2: 'no', Q3: 'no', Q4: 'no' },
    outcome: 'routine',
  });
  if (screening.error) throw new Error(screening.error.message);
  await step('intake');
  const questionnaire = await admin.from('questionnaire_submissions').insert({
    order_id: id,
    patient_id: patientId,
    status: 'submitted',
    version_no: 1,
    answers: {
      conditions: 'High blood pressure',
      allergies: 'None known',
      mainConcern: 'Why am I on this medicine?',
      goals: 'Understand my medicines',
      consultationMethod: 'telephone',
    },
    medications: [
      {
        name: 'Paracetamol',
        strength: '500mg',
        formulation: 'tablets',
        dose: 'One tablet',
        frequency: 'When needed',
        route: 'oral',
        indication: 'Pain',
        notes: '',
        dontKnow: [],
      },
    ],
    submitted_at: new Date().toISOString(),
  });
  if (questionnaire.error) throw new Error(questionnaire.error.message);
  await step('questionnaire_submitted');
  await step('awaiting_payment');
  const payment = await admin.from('payments').insert({
    order_id: id,
    patient_id: patientId,
    amount_pence: 5900,
    status: 'succeeded',
    source: 'manual_audited',
    receipt_number: `R-MIF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  });
  if (payment.error) throw new Error(payment.error.message);
  await step('paid');
  await step('consultation_booked');
  return id;
}

async function writeAndApprove(page: Page, finding: string) {
  await page.getByLabel('Key findings').fill(finding);
  await page.getByLabel('Medicine').fill('Paracetamol');
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
  await expect(page.getByText('Checks recorded.')).toBeVisible();
  await page.getByTestId('approve-report').click();
  await expect(page.getByText('Report approved.')).toBeVisible();
  await page.getByTestId('generate-report').click();
  await expect(page.getByText('The PDF is ready.')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('the released report shows the approving pharmacist’s own name', async ({ page }) => {
  test.setTimeout(180_000);
  const patient = await createPatient('mif-report-patient');
  const pharmacist = await createStaff('mif-report-pharmacist', 'pharmacist');
  const admin = await createStaff('mif-report-admin', 'clinical_admin');
  const named = await serviceClient()
    .from('profiles')
    .update({ given_name: 'Nia', family_name: 'Approver' })
    .eq('id', pharmacist.id);
  if (named.error) throw new Error(named.error.message);
  patientEmail = patient.email;
  pharmacistEmail = pharmacist.email;
  orderId = await seedBookedReview(patient.id);

  await signInAndLand(page, admin.email);
  await enrol(page);
  await page.goto('/staff/assignments');
  const form = page.getByTestId(`assign-${orderId}`);
  await form.getByLabel('Pharmacist').selectOption(pharmacist.id);
  await form.getByRole('button', { name: 'Assign pharmacist' }).click();
  await expect(page.getByText('Pharmacist assigned.')).toBeVisible();
  await signOut(page);

  await signInAndLand(page, pharmacist.email);
  pharmacistSecret = await enrol(page);
  await page.goto(`/staff/reviews/${orderId}`);
  await page.getByLabel('Date').fill('2026-11-06');
  await page.getByLabel('Time (UK)').fill('10:00');
  await page
    .getByLabel('Clinical notes')
    .fill('Synthetic notes of a completed two-way telephone conversation.');
  await page.getByRole('checkbox', { name: 'This was a completed two-way conversation' }).check();
  await page.getByRole('button', { name: 'Save consultation' }).click();
  await expect(page.getByText('Consultation recorded.')).toBeVisible();
  await page.getByRole('button', { name: 'Start the report' }).click();
  await expect(page.getByText('Draft report started.')).toBeVisible();
  await writeAndApprove(page, FINDING);
  await expect(page.getByTestId('report-panel')).toContainText(`Approved by ${PHARMACIST_NAME}`);
  await expect(page.getByTestId('report-panel')).toContainText('GPhC 0000099');
  await page.getByTestId('release-report').click();
  await expect(page.getByText('Report released.')).toBeVisible();
  await signOut(page);

  await signInAndLand(page, patient.email);
  await page.goto(`/account/review/${orderId}/report`);
  const report = page.getByTestId('patient-report');
  await expect(report.getByRole('heading', { name: 'Pharmacist' })).toBeVisible();
  await expect(report).toContainText(PHARMACIST_NAME);
  await expect(report).toContainText('GPhC number: 0000099');
  await expect(report).toContainText(FINDING);
  await expect(report).not.toContainText('replaces an earlier version');
});

test('a correction leaves the old report superseded and shows the new version', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signInAndLand(page, pharmacistEmail);
  await openAsStaff(page, pharmacistSecret, `/staff/reviews/${orderId}`);
  await page
    .getByLabel('Reason for a new version')
    .fill('Corrected the findings after a further check of the notes.');
  await page.getByRole('button', { name: 'Start a corrected version' }).click();
  await expect(page.getByText('A new draft version has been started.')).toBeVisible();
  await expect(page.getByTestId('report-status')).toHaveText('draft');
  await writeAndApprove(page, CORRECTED);
  await page.getByTestId('release-report').click();
  await expect(page.getByText('Report released.')).toBeVisible();
  await expect(page.getByTestId('report-panel')).toContainText('Version 2');
  await expect(page.getByTestId('report-panel')).toContainText(`Approved by ${PHARMACIST_NAME}`);
  await signOut(page);

  await signInAndLand(page, patientEmail);
  await page.goto(`/account/review/${orderId}/report`);
  const report = page.getByTestId('patient-report');
  await expect(report).toContainText('This report replaces an earlier version.');
  await expect(report).toContainText(CORRECTED);
  await expect(report).toContainText(PHARMACIST_NAME);
  await expect(report).not.toContainText(FINDING);

  const stored = await serviceClient()
    .from('reports')
    .select('status, version_no, approver_display_name')
    .eq('order_id', orderId);
  if (stored.error) throw new Error(stored.error.message);
  const rows = stored.data ?? [];
  expect(rows.find((row) => row.status === 'superseded')?.version_no).toBe(1);
  expect(rows.find((row) => row.status === 'released')).toMatchObject({
    version_no: 2,
    approver_display_name: PHARMACIST_NAME,
  });
});
