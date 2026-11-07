'use server';

import {
  ACTIVE_RULESET,
  ScreeningValidationError,
  evaluateScreening,
  type ScreeningAnswer,
} from '@mrd/domain';
import {
  DONT_KNOW,
  MAX_MEDICATIONS,
  MEDICATION_DONT_KNOW_FIELDS,
  checkUpload,
  concernsStepSchema,
  healthStepSchema,
  isEmptyMedication,
  medicationDraftSchema,
  questionnaireSubmissionSchema,
  toFieldErrors,
  type FieldErrors,
} from '@mrd/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { formString, type FormState } from '@/lib/form-state';
import { getDraft } from '@/lib/intake';
import { scanUpload } from '@/lib/malware-scan';
import { notifyAccountUpdate } from '@/lib/notifications';
import { friendlyDbError } from '@/lib/order-status';
import type { Json } from '@/lib/supabase/database.types';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const CURRENT_CONSENT_VERSION = 'draft-2026-11';
const UUID = /^[0-9a-f-]{36}$/i;

function orderIdFrom(formData: FormData): string {
  const id = formString(formData, 'orderId');
  if (!UUID.test(id)) redirect('/account');
  return id;
}

function dbError(action: string, error: { code?: string; message?: string }): FormState {
  console.error(`[intake] ${action} failed`, { code: error.code ?? 'unknown' });
  return { status: 'error', message: friendlyDbError(error.message) };
}

export async function startReviewAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireUser('/account');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('start_review_order');
  if (error || !data) return dbError('start', error ?? {});
  redirect(`/account/review/${data}/screening`);
}

export async function submitScreeningAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser('/account');
  const orderId = orderIdFrom(formData);
  const answers: Record<string, ScreeningAnswer | null> = {};
  const fieldErrors: FieldErrors = {};
  for (const q of ACTIVE_RULESET.questions) {
    const v = formString(formData, `q_${q.id}`);
    answers[q.id] = v === 'yes' || v === 'no' || v === 'unsure' ? v : null;
    if (!answers[q.id]) fieldErrors[`q_${q.id}`] = ['Choose yes, no or not sure'];
  }
  const values = Object.fromEntries(Object.entries(answers).map(([k, v]) => [`q_${k}`, v ?? '']));
  if (Object.keys(fieldErrors).length > 0) return { status: 'error', fieldErrors, values };
  try {
    evaluateScreening(ACTIVE_RULESET, answers);
  } catch (e) {
    if (e instanceof ScreeningValidationError)
      return { status: 'error', message: 'Please answer every question.', values };
    throw e;
  }
  const supabase = await createSupabaseServerClient();
  if (formData.get('priorConcernConfirmed') === 'on') {
    const confirmed = await supabase.rpc('confirm_prior_safety_concern', { p_order_id: orderId });
    if (confirmed.error) {
      const state = dbError('prior-concern', confirmed.error);
      return state.status === 'error' ? { ...state, values } : state;
    }
  }
  const { error } = await supabase.rpc('submit_safety_screening', {
    p_order_id: orderId,
    p_answers: answers,
  });
  if (error) return dbError('screening', error);
  redirect(`/account/review/${orderId}/outcome`);
}

export async function acknowledgeAdviceAction(formData: FormData): Promise<void> {
  await requireUser('/account');
  const orderId = orderIdFrom(formData);
  const screeningId = formString(formData, 'screeningId');
  if (UUID.test(screeningId)) {
    const supabase = await createSupabaseServerClient();
    await supabase.rpc('acknowledge_safety_advice', { p_screening_id: screeningId });
  }
  redirect(`/account/review/${orderId}/outcome?acknowledged=1`);
}

export async function consentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser('/account');
  const orderId = orderIdFrom(formData);
  const health = formData.get('healthData') === 'on';
  const remote = formData.get('remoteConsultation') === 'on';
  const fieldErrors: FieldErrors = {};
  if (!health) fieldErrors.healthData = ['You must agree to this to continue with a review'];
  if (!remote)
    fieldErrors.remoteConsultation = ['You must agree to this to continue with a review'];
  if (Object.keys(fieldErrors).length > 0) return { status: 'error', fieldErrors };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('consents').insert([
    {
      consent_type: 'health_data_processing',
      document_version: CURRENT_CONSENT_VERSION,
      granted: true,
      source: 'intake',
    },
    {
      consent_type: 'remote_consultation',
      document_version: CURRENT_CONSENT_VERSION,
      granted: true,
      source: 'intake',
    },
  ]);
  if (error) return dbError('consent', error);
  redirect(`/account/review/${orderId}/questionnaire/1`);
}

type Med = Record<string, unknown> & { dontKnow?: string[] };

function parseMedications(formData: FormData): Med[] {
  const count = Math.min(Number(formData.get('medCount') ?? 0) || 0, MAX_MEDICATIONS);
  const meds: Med[] = [];
  for (let i = 0; i < count; i++) {
    const get = (f: string) => formString(formData, `med_${i}_${f}`);
    meds.push({
      name: get('name'),
      strength: get('strength'),
      formulation: get('formulation'),
      dose: get('dose'),
      frequency: get('frequency'),
      route: get('route'),
      indication: get('indication'),
      notes: get('notes'),
      dontKnow: MEDICATION_DONT_KNOW_FIELDS.filter(
        (f) => formData.get(`med_${i}_dk_${f}`) === 'on',
      ),
    });
  }
  return meds;
}

export async function saveQuestionnaireStepAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser('/account');
  const orderId = orderIdFrom(formData);
  const step = Number(formString(formData, 'step'));
  const intent = formString(formData, 'intent') || 'next';
  const draft = await getDraft(orderId);
  const answers: Record<string, string> = { ...(draft?.answers ?? {}) };
  let medications = (draft?.medications ?? []) as Med[];
  const fieldErrors: FieldErrors = {};

  if (step === 1) {
    const conditionsDk = formData.get('conditionsDontKnow') === 'on';
    const allergiesDk = formData.get('allergiesDontKnow') === 'on';
    const parsed = healthStepSchema.safeParse({
      conditions: formString(formData, 'conditions'),
      allergies: formString(formData, 'allergies'),
    });
    if (!parsed.success) return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
    answers.conditions = conditionsDk ? DONT_KNOW : parsed.data.conditions;
    answers.allergies = allergiesDk ? DONT_KNOW : parsed.data.allergies;
  } else if (step === 2) {
    medications = parseMedications(formData);
    if (intent === 'add') {
      if (medications.length < MAX_MEDICATIONS) medications.push({ name: '', dontKnow: [] });
    } else if (intent.startsWith('remove-')) {
      const idx = Number(intent.slice('remove-'.length));
      medications = medications.filter((_, i) => i !== idx);
    }
    const kept: Med[] = [];
    medications.forEach((m, i) => {
      const keepEmpty = intent === 'add' && i === medications.length - 1;
      if (!keepEmpty && isEmptyMedication(m as never)) return;
      const r = medicationDraftSchema.safeParse(m);
      if (!r.success) {
        for (const [k, v] of Object.entries(toFieldErrors(r.error)))
          fieldErrors[`med_${i}_${k}`] = v;
      } else if (intent === 'next' && !r.data.name) {
        fieldErrors[`med_${i}_name`] = ['Enter the name of the medicine, or remove this row'];
      }
      kept.push(m);
    });
    medications = kept;
    if (intent === 'next' && medications.length === 0)
      fieldErrors.medications = ['Add at least one medicine'];
  } else if (step === 3) {
    const raw = {
      mainConcern: formString(formData, 'mainConcern'),
      goals: formString(formData, 'goals'),
      consultationMethod: formString(formData, 'consultationMethod'),
    };
    if (intent === 'next') {
      const parsed = concernsStepSchema.safeParse(raw);
      if (!parsed.success)
        return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values: raw };
    }
    answers.mainConcern = raw.mainConcern.trim().slice(0, 2000);
    answers.goals = raw.goals.trim().slice(0, 2000);
    if (raw.consultationMethod) answers.consultationMethod = raw.consultationMethod;
  } else {
    redirect(`/account/review/${orderId}`);
  }

  if (Object.keys(fieldErrors).length > 0 && intent === 'next') {
    return { status: 'error', fieldErrors };
  }

  const nextStep = intent === 'next' ? step + 1 : step;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_questionnaire_draft', {
    p_order_id: orderId,
    p_step: Math.max(draft?.current_step ?? 1, nextStep),
    p_answers: answers,
    p_medications: medications as unknown as Json,
  });
  if (error) return dbError('save-draft', error);
  revalidatePath(`/account/review/${orderId}`, 'layout');
  if (intent === 'next') redirect(`/account/review/${orderId}/questionnaire/${nextStep}`);
  if (intent === 'save') return { status: 'success', message: 'Your answers have been saved.' };
  redirect(`/account/review/${orderId}/questionnaire/${step}`);
}

export async function submitQuestionnaireAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser('/account');
  const orderId = orderIdFrom(formData);
  const draft = await getDraft(orderId);
  if (!draft) return { status: 'error', message: 'There is no questionnaire to send.' };
  const answers = { ...draft.answers };
  for (const k of ['conditions', 'allergies'] as const)
    if (answers[k] === DONT_KNOW) answers[k] = '';
  const parsed = questionnaireSubmissionSchema.safeParse({
    answers,
    medications: draft.medications,
  });
  if (!parsed.success) {
    const e = toFieldErrors(parsed.error);
    const missing: string[] = [];
    if (Object.keys(e).some((k) => k.startsWith('medications'))) missing.push('Your medicines');
    if (Object.keys(e).some((k) => k.startsWith('answers')))
      missing.push('Your questions and concerns');
    return {
      status: 'error',
      message: `Some answers are missing or need changing in: ${missing.join(', ')}.`,
    };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('submit_questionnaire', { p_order_id: orderId });
  if (error) return dbError('submit', error);
  if (user.email) await notifyAccountUpdate(user.email);
  revalidatePath('/account', 'layout');
  redirect(`/account/review/${orderId}?notice=submitted`);
}

export async function amendQuestionnaireAction(formData: FormData): Promise<void> {
  await requireUser('/account');
  const orderId = orderIdFrom(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('start_questionnaire_amendment', { p_order_id: orderId });
  if (error) console.error('[intake] amend failed', { code: error.code ?? 'unknown' });
  redirect(`/account/review/${orderId}/questionnaire/1`);
}

export async function uploadDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser('/account');
  const orderId = orderIdFrom(formData);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', fieldErrors: { file: ['Choose a file to upload'] } };
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const check = checkUpload({ name: file.name, type: file.type, size: file.size, head });
  if (!check.ok) return { status: 'error', fieldErrors: { file: [check.error] } };

  const scan = await scanUpload();
  const path = `${user.id}/${orderId}/${crypto.randomUUID()}-${check.safeName}`;
  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from('patient-documents')
    .upload(path, file, { contentType: check.mimeType, upsert: false });
  if (uploadError) {
    console.error('[intake] upload failed', { code: 'storage' });
    return { status: 'error', message: 'We could not upload your file. Please try again.' };
  }
  const { error } = await supabase.rpc('register_document', {
    p_order_id: orderId,
    p_storage_path: path,
    p_filename: check.safeName,
    p_mime: check.mimeType,
    p_size: file.size,
  });
  if (error) return dbError('register-document', error);
  revalidatePath(`/account/review/${orderId}/documents`);
  return {
    status: 'success',
    message:
      scan.status === 'not_scanned'
        ? 'Your file has been uploaded. It is waiting for a security scan before a pharmacist can see it.'
        : 'Your file has been uploaded.',
  };
}

export async function requestDeletionAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  await requireUser('/account/settings');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('request_account_deletion');
  if (error) return dbError('deletion-request', error);
  revalidatePath('/account/settings');
  return {
    status: 'success',
    message:
      'We have received your request. We will review it and tell you what we can delete. Clinical records we must keep will not be deleted.',
  };
}
