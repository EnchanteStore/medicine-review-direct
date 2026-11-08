'use server';

import { londonWallTimeToUtc, parseReportContent, ReportContentError } from '@mrd/domain';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { notifyAccountUpdate } from '@/lib/notifications';
import { friendlyDbError } from '@/lib/order-status';
import { loadReportDocument } from '@/lib/report-document';
import { buildReportPdf } from '@/lib/report-pdf';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function orderIdFrom(formData: FormData): string {
  const orderId = String(formData.get('orderId') ?? '');
  if (!ORDER_ID.test(orderId)) redirect('/staff/reviews?error=That%20review%20was%20not%20found');
  return orderId;
}

function go(orderId: string, error?: string, notice?: string): never {
  const params = new URLSearchParams();
  if (error) params.set('error', error);
  if (notice) params.set('notice', notice);
  const query = params.toString();
  redirect(query ? `/staff/reviews/${orderId}?${query}` : `/staff/reviews/${orderId}`);
}

async function notifyUser(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    const service = createSupabaseServiceClient();
    const { data } = await service.auth.admin.getUserById(userId);
    if (data.user?.email) await notifyAccountUpdate(data.user.email);
  } catch {
    console.error('[notify] account update failed');
  }
}

export async function recordConsultationAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const method = String(formData.get('method') ?? '');
  const notes = String(formData.get('notes') ?? '');
  const twoWay = formData.get('twoWay') === 'yes';
  if (method !== 'telephone' && method !== 'secure_video') {
    go(orderId, 'Choose telephone or secure video.');
  }
  if (!twoWay)
    go(orderId, 'Record a completed two-way conversation. A note on its own is not enough.');
  let occurred: Date;
  try {
    occurred = londonWallTimeToUtc(
      String(formData.get('occurredOn') ?? ''),
      String(formData.get('occurredAt') ?? ''),
    );
  } catch {
    go(orderId, 'Enter the date and time of the consultation.');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('pharmacist_record_consultation', {
    p_order_id: orderId,
    p_method: method,
    p_occurred_at: occurred.toISOString(),
    p_two_way_completed: true,
    p_notes: notes,
  });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'Consultation recorded.');
}

function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function saveReportAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const issues = [1, 2]
    .map((index) => ({
      medicine: String(formData.get(`medicine${index}`) ?? '').trim(),
      issue: String(formData.get(`issue${index}`) ?? '').trim(),
    }))
    .filter((item) => item.medicine || item.issue);
  let content: ReturnType<typeof parseReportContent>;
  try {
    content = parseReportContent({
      findings: String(formData.get('findings') ?? ''),
      medicationIssues: issues,
      recommendations: lines(formData.get('recommendations')),
      monitoring: lines(formData.get('monitoring')),
      gpDiscussionPoints: lines(formData.get('gpPoints')),
      safetyAdvice: String(formData.get('safetyAdvice') ?? ''),
      limitations: String(formData.get('limitations') ?? ''),
    });
  } catch (error) {
    go(
      orderId,
      error instanceof ReportContentError ? error.message : 'The report could not be saved.',
    );
  }
  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from('reports')
    .select('id')
    .eq('order_id', orderId)
    .neq('status', 'superseded')
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!report) go(orderId, 'Start the report before saving it.');
  const { error } = await supabase.rpc('pharmacist_save_report_content', {
    p_report_id: report.id,
    p_content: {
      findings: content.findings,
      medicationIssues: content.medicationIssues.map((item) => ({
        medicine: item.medicine,
        issue: item.issue,
      })),
      recommendations: content.recommendations,
      monitoring: content.monitoring,
      gpDiscussionPoints: content.gpDiscussionPoints,
      safetyAdvice: content.safetyAdvice,
      limitations: content.limitations,
    },
  });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'Report draft saved.');
}

export async function createReportAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('pharmacist_create_report', { p_order_id: orderId });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'Draft report started.');
}

export async function confirmReportAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  if (formData.get('information') !== 'yes' || formData.get('adequate') !== 'yes') {
    go(orderId, 'Confirm that the information is sufficient and that the assessment is adequate.');
  }
  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from('reports')
    .select('id')
    .eq('order_id', orderId)
    .neq('status', 'superseded')
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!report) go(orderId, 'Start the report first.');
  const { error } = await supabase.rpc('pharmacist_confirm_report_checks', {
    p_report_id: report.id,
    p_information_sufficient: true,
    p_clinically_adequate: true,
  });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'Checks recorded.');
}

export async function approveReportAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const [{ data: report }, { data: consultation }] = await Promise.all([
    supabase
      .from('reports')
      .select('id')
      .eq('order_id', orderId)
      .neq('status', 'superseded')
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('consultations')
      .select('id')
      .eq('order_id', orderId)
      .eq('two_way_completed', true)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!report || !consultation) go(orderId, 'Record a completed consultation before approval.');
  const { error } = await supabase.rpc('pharmacist_approve_report', {
    p_report_id: report.id,
    p_consultation_id: consultation.id,
  });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'Report approved. Create the PDF next. The patient cannot see it yet.');
}

export async function generateReportAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from('reports')
    .select('id, status, version_no')
    .eq('order_id', orderId)
    .neq('status', 'superseded')
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!report) go(orderId, 'Start the report first.');
  if (report.status === 'generating') {
    await supabase.rpc('pharmacist_set_generation_status', {
      p_report_id: report.id,
      p_status: 'generation_failed',
      p_pdf_path: '',
    });
    go(orderId, 'Generation was interrupted. It has been reset. Try again.');
  }
  if (report.status !== 'clinically_approved' && report.status !== 'generation_failed') {
    go(orderId, 'Approve the report before creating the PDF.');
  }
  const begin = await supabase.rpc('pharmacist_set_generation_status', {
    p_report_id: report.id,
    p_status: 'generating',
    p_pdf_path: '',
  });
  if (begin.error) go(orderId, friendlyDbError(begin.error.message));
  try {
    const model = await loadReportDocument(orderId);
    const bytes = await buildReportPdf(model);
    const path = `${report.id}.pdf`;
    const uploaded = await createSupabaseServiceClient()
      .storage.from('clinical-reports')
      .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
    if (uploaded.error) throw new Error('upload');
    const done = await supabase.rpc('pharmacist_set_generation_status', {
      p_report_id: report.id,
      p_status: 'ready_for_release',
      p_pdf_path: path,
    });
    if (done.error) throw new Error(done.error.message);
  } catch (error) {
    console.error('[report] generation failed', error instanceof Error ? error.name : 'error');
    await supabase.rpc('pharmacist_set_generation_status', {
      p_report_id: report.id,
      p_status: 'generation_failed',
      p_pdf_path: '',
    });
    go(orderId, 'The PDF could not be created. The report was not published. You can try again.');
  }
  revalidatePath(`/staff/reviews/${orderId}`);
  go(
    orderId,
    undefined,
    'The PDF is ready. Release it when you are satisfied. Nothing has been sent to the patient.',
  );
}

export async function releaseReportAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const [{ data: report }, { data: order }] = await Promise.all([
    supabase
      .from('reports')
      .select('id, status, version_no')
      .eq('order_id', orderId)
      .neq('status', 'superseded')
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('review_orders').select('patient_id').eq('id', orderId).maybeSingle(),
  ]);
  if (!report || report.status !== 'ready_for_release') {
    go(orderId, 'Create the PDF before you release the report.');
  }
  const { error } = await supabase.rpc('pharmacist_release_report', { p_report_id: report.id });
  if (error) go(orderId, friendlyDbError(error.message));
  await notifyUser(order?.patient_id ?? null);
  revalidatePath(`/staff/reviews/${orderId}`);
  revalidatePath(`/account/review/${orderId}`);
  go(orderId, undefined, 'Report released. The patient can now read this version.');
}

export async function sendStaffMessageAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const body = String(formData.get('body') ?? '');
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from('review_orders')
    .select('patient_id')
    .eq('id', orderId)
    .maybeSingle();
  const { error } = await supabase.rpc('send_review_message', {
    p_order_id: orderId,
    p_body: body,
  });
  if (error) go(orderId, friendlyDbError(error.message));
  await notifyUser(order?.patient_id ?? null);
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'Message sent. The email does not include what you wrote.');
}

export async function saveGpLetterAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_gp_letter', {
    p_order_id: orderId,
    p_concern: String(formData.get('concern') ?? ''),
    p_findings: String(formData.get('findings') ?? ''),
    p_discussion: String(formData.get('discussion') ?? ''),
  });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'GP letter draft saved. The patient cannot see it yet.');
}

export async function verifyGpRecipientAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const { data: letter } = await supabase
    .from('gp_letters')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!letter) go(orderId, 'Save the GP letter before recording the practice.');
  const { error } = await supabase.rpc('verify_gp_recipient', {
    p_letter_id: letter.id,
    p_name: String(formData.get('recipientName') ?? ''),
    p_practice: String(formData.get('practice') ?? ''),
    p_note: String(formData.get('verificationNote') ?? ''),
  });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'GP practice recorded. This does not send the letter.');
}

export async function approveGpLetterAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const { data: letter } = await supabase
    .from('gp_letters')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!letter) go(orderId, 'Save the GP letter first.');
  const { error } = await supabase.rpc('approve_gp_letter', { p_letter_id: letter.id });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'GP letter approved. It has not been sent.');
}

export async function dispatchGpLetterAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const { data: letter } = await supabase
    .from('gp_letters')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!letter) go(orderId, 'Save the GP letter first.');
  const { error } = await supabase.rpc('record_gp_letter_dispatch', { p_letter_id: letter.id });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'Dispatch recorded. The letter was not transmitted.');
}

export async function recordSafetyNoticeAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const kind = String(formData.get('kind') ?? '');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('record_safety_notice', {
    p_order_id: orderId,
    p_kind: kind,
    p_body: String(formData.get('body') ?? ''),
  });
  if (error) go(orderId, friendlyDbError(error.message));
  revalidatePath(`/staff/reviews/${orderId}`);
  go(orderId, undefined, 'Safety note recorded. This is not a medication review report.');
}

export async function startCorrectionAction(formData: FormData): Promise<void> {
  const orderId = orderIdFrom(formData);
  await requireUser(`/staff/reviews/${orderId}`);
  const supabase = await createSupabaseServerClient();
  const { data: report } = await supabase
    .from('reports')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'released')
    .order('version_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!report) go(orderId, 'There is no released report to correct.');
  const { error } = await supabase.rpc('pharmacist_start_correction', {
    p_report_id: report.id,
    p_reason: String(formData.get('reason') ?? ''),
  });
  if (error) {
    console.error('[report] correction failed', { code: error.code ?? 'unknown' });
    go(orderId, friendlyDbError(error.message));
  }
  revalidatePath(`/staff/reviews/${orderId}`);
  go(
    orderId,
    undefined,
    'A new draft version has been started. The released report is unchanged until you release the new one.',
  );
}
