import { mkdir } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import {
  TEST_PASSWORD,
  createPatient,
  createStaff,
  countEmails,
  expectNoA11yViolations,
  serviceClient,
  signIn,
  signOut,
  totp,
  waitForEmail,
} from './helpers';

const MEDIA = '/cursor/stores/bc-aebf795e-5d25-4fe7-8cd8-05a4db3de130/media/phase-4';
const FINDING = 'Synthetic finding marker: discuss the indication with the GP.';
const MESSAGE = 'Synthetic marker phrase for the message only.';

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
  const orderId = created.data.id;
  const step = async (status: string) => {
    const updated = await admin.from('review_orders').update({ status }).eq('id', orderId);
    if (updated.error) throw new Error(`${status}: ${updated.error.message}`);
  };
  const screening = await admin.from('safety_screenings').insert({
    order_id: orderId,
    patient_id: patientId,
    ruleset_version: '2026-11-draft.2',
    answers: { Q1: 'no', Q2: 'no', Q3: 'no', Q4: 'no' },
    outcome: 'routine',
  });
  if (screening.error) throw new Error(screening.error.message);
  await step('intake');
  const questionnaire = await admin.from('questionnaire_submissions').insert({
    order_id: orderId,
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
    order_id: orderId,
    patient_id: patientId,
    amount_pence: 5900,
    status: 'succeeded',
    source: 'manual_audited',
    receipt_number: `R-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  });
  if (payment.error) throw new Error(payment.error.message);
  await step('paid');
  await step('consultation_booked');
  const pdf = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const cleanPath = `${patientId}/synthetic-note.pdf`;
  const uploaded = await admin.storage.from('patient-documents').upload(cleanPath, pdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  const docs = await admin.from('documents').insert([
    {
      order_id: orderId,
      patient_id: patientId,
      storage_path: cleanPath,
      original_filename: 'synthetic-note.pdf',
      mime_type: 'application/pdf',
      size_bytes: pdf.length,
      scan_status: 'clean',
      scan_engine: 'e2e-marked-clean',
    },
    {
      order_id: orderId,
      patient_id: patientId,
      storage_path: `${patientId}/hidden-unscanned.pdf`,
      original_filename: 'hidden-unscanned.pdf',
      mime_type: 'application/pdf',
      size_bytes: pdf.length,
      scan_status: 'pending_scan',
      scan_engine: 'stub-not-scanned',
    },
  ]);
  if (docs.error) throw new Error(docs.error.message);
  return orderId;
}

test('pharmacist records, approves, generates and releases; others are denied', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await mkdir(MEDIA, { recursive: true });
  const patient = await createPatient('phase4-patient');
  const other = await createPatient('phase4-other');
  const pharmacist = await createStaff('phase4-pharmacist', 'pharmacist');
  const stranger = await createStaff('phase4-stranger', 'pharmacist');
  const admin = await createStaff('phase4-admin', 'clinical_admin');
  await serviceClient()
    .from('profiles')
    .update({ given_name: 'Asha', family_name: 'Synthetic' })
    .eq('id', pharmacist.id);
  const orderId = await seedBookedReview(patient.id);

  await signInAndLand(page, admin.email);
  await enrol(page);
  await page.goto('/staff/assignments');
  const form = page.getByTestId(`assign-${orderId}`);
  await form.getByLabel('Pharmacist').selectOption(pharmacist.id);
  await form.getByRole('button', { name: 'Assign pharmacist' }).click();
  await expect(page.getByText('Pharmacist assigned.')).toBeVisible();
  await signOut(page);

  await signInAndLand(page, pharmacist.email);
  const secret = await enrol(page);
  await page.goto(`/staff/reviews/${orderId}`);
  await expect(page.getByTestId('pharmacist-review')).toBeVisible();
  await expect(page.getByText('Paracetamol')).toBeVisible();
  await expect(page.getByText('Why am I on this medicine?')).toBeVisible();
  await expect(page.getByText('Paid (£59.00')).toBeVisible();
  await expect(page.getByText('synthetic-note.pdf')).toBeVisible();
  await expect(page.getByText('hidden-unscanned.pdf')).toHaveCount(0);
  await expect(page.getByTestId('out-of-hours')).toContainText('not an emergency service');
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${MEDIA}/pharmacist-workspace.png`, fullPage: true });

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
  await page.getByLabel('Key findings').fill(FINDING);
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
  await expect(page.getByTestId('report-status')).toHaveText('ready_for_release');
  await page.screenshot({ path: `${MEDIA}/report-ready.png`, fullPage: true });
  await signOut(page);

  await signInAndLand(page, patient.email);
  await page.goto(`/account/review/${orderId}/report`);
  await expect(page.getByText('has not released a report')).toBeVisible();
  await expect(page.getByText(FINDING)).toHaveCount(0);
  await page.goto(`/account/review/${orderId}/gp-letter`);
  await page.getByRole('button', { name: 'I agree to a letter for my GP for this review' }).click();
  await expect(page.getByText('Your agreement is recorded for this review.')).toBeVisible();
  await signOut(page);

  await signInAndLand(page, pharmacist.email);
  await openAsStaff(page, secret, `/staff/reviews/${orderId}`);
  await page.getByTestId('release-report').click();
  await expect(page.getByText('Report released.')).toBeVisible();
  const releaseMail = await waitForEmail(patient.email, 'There is an update in your account');
  expect(releaseMail.Text).not.toContain('Paracetamol');
  expect(releaseMail.Text).not.toContain(FINDING);
  const beforeMessage = await countEmails(patient.email);
  await page.getByLabel('Message').fill(MESSAGE);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Message sent.')).toBeVisible();
  await expect
    .poll(() => countEmails(patient.email), { timeout: 20_000 })
    .toBeGreaterThan(beforeMessage);
  const messageMail = await waitForEmail(patient.email, 'There is an update in your account');
  expect(messageMail.Text).not.toContain(MESSAGE);
  expect(messageMail.Text).not.toContain('Paracetamol');

  await page.getByLabel('Patient concern').fill('Why the pain medicine was started.');
  await page.getByLabel('Findings').fill('The indication should be discussed with the GP.');
  await page.getByLabel('Points for the GP to consider').fill('Ask whether it is still needed.');
  await page.getByRole('button', { name: 'Save GP letter' }).click();
  await expect(page.getByText('GP letter draft saved.')).toBeVisible();
  await page.getByLabel('GP name').fill('Dr Synthetic');
  await page.getByLabel('Practice name').fill('Example Practice');
  await page
    .getByLabel('How you checked it')
    .fill('Checked the practice name with the patient during the consultation.');
  await page.getByRole('button', { name: 'Record checked practice' }).click();
  await expect(page.getByText('GP practice recorded.')).toBeVisible();
  await page.getByRole('button', { name: 'Approve GP letter' }).click();
  await expect(page.getByText('GP letter approved.')).toBeVisible();
  await page.getByRole('button', { name: 'Record that the letter is on file' }).click();
  await expect(page.getByText('The letter was not transmitted.')).toBeVisible();
  await signOut(page);

  await signInAndLand(page, patient.email);
  await page.goto('/account');
  await expect(page.getByTestId('dashboard-messages')).toContainText('1 unread');
  await expect(page.getByText(MESSAGE)).toHaveCount(0);
  await page.goto(`/account/review/${orderId}/report`);
  await expect(page.getByTestId('patient-report')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Key findings' })).toBeVisible();
  await expect(page.getByText(FINDING)).toBeVisible();
  await expect(page.getByText('DRAFT pending clinical approval').first()).toBeVisible();
  await expect(page.getByText('Asha Synthetic')).toBeVisible();
  await expect(page.getByText('still pending')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.screenshot({ path: `${MEDIA}/patient-report.png`, fullPage: true });
  await page.goto(`/account/review/${orderId}/messages`);
  await expect(page.getByText(MESSAGE)).toBeVisible();
  await expect(page.getByTestId('out-of-hours')).toContainText('not monitored 24 hours');
  await page.screenshot({ path: `${MEDIA}/messages.png`, fullPage: true });
  await page.goto(`/account/review/${orderId}/gp-letter`);
  await expect(page.getByText('Not transmitted')).toBeVisible();
  await expect(page.getByText('Example Practice')).toBeVisible();
  await signOut(page);

  await signInAndLand(page, other.email);
  const denied = await page.goto(`/account/review/${orderId}/report`);
  expect(denied?.status()).toBe(404);
  await signOut(page);

  await signInAndLand(page, stranger.email);
  await enrol(page);
  await page.goto('/staff/reviews');
  await expect(page.getByText('Synthetic Patient')).toHaveCount(0);
  const hidden = await page.goto(`/staff/reviews/${orderId}`);
  expect(hidden?.status()).toBe(404);
});
