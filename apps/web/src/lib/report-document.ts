import 'server-only';
import {
  companyRecordLine,
  formatLondon,
  parseReportContent,
  pharmacistRegistrationNote,
  type ReportDocumentModel,
} from '@mrd/domain';
import { getBusinessConfig } from './site';
import { createSupabaseServerClient } from './supabase/server';

function formatDateOnly(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function textField(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field.trim() : '';
}

function medicineLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) return [];
    const extra = ['strength', 'dose', 'frequency']
      .map((key) => (typeof row[key] === 'string' ? row[key].trim() : ''))
      .filter(Boolean);
    return [extra.length > 0 ? `${name} (${extra.join(', ')})` : name];
  });
}

function methodLabel(method: string): string {
  if (method === 'telephone') return 'Telephone';
  if (method === 'secure_video') return 'Secure video';
  return method;
}

/** Builds the print model from rows the signed-in user is allowed to read. */
export async function loadReportDocument(orderId: string): Promise<ReportDocumentModel> {
  const supabase = await createSupabaseServerClient();
  const [{ data: report }, { data: order }, { data: questionnaire }, { data: documents }] =
    await Promise.all([
      supabase
        .from('reports')
        .select(
          'content, approver_display_name, approver_gphc_number, consultation_id, status, version_no',
        )
        .eq('order_id', orderId)
        .neq('status', 'superseded')
        .order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('review_orders').select('patient_id').eq('id', orderId).maybeSingle(),
      supabase
        .from('questionnaire_submissions')
        .select('answers, medications')
        .eq('order_id', orderId)
        .eq('status', 'submitted')
        .order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('documents')
        .select('original_filename, scan_status')
        .eq('order_id', orderId)
        .eq('scan_status', 'clean'),
    ]);
  if (!report || !order || !report.consultation_id) {
    throw new Error('report is not ready to generate');
  }
  const [{ data: profile }, { data: consultation }] = await Promise.all([
    supabase
      .from('profiles')
      .select('given_name, family_name, date_of_birth')
      .eq('id', order.patient_id)
      .maybeSingle(),
    supabase
      .from('consultations')
      .select('method, occurred_at, clinical_notes, two_way_completed')
      .eq('id', report.consultation_id)
      .maybeSingle(),
  ]);
  if (
    !profile?.given_name ||
    !profile.family_name ||
    !profile.date_of_birth ||
    !consultation?.two_way_completed
  ) {
    throw new Error('report is not ready to generate');
  }
  if (!report.approver_display_name || !report.approver_gphc_number) {
    throw new Error('report is not ready to generate');
  }
  const config = getBusinessConfig();
  const occurred = new Date(consultation.occurred_at);
  return {
    tradingName: config.tradingNameProvisional
      ? `${config.tradingName} (provisional trading name)`
      : config.tradingName,
    patientName: `${profile.given_name} ${profile.family_name}`,
    dateOfBirth: formatDateOnly(profile.date_of_birth),
    reviewDate: formatDateOnly(consultation.occurred_at),
    consultationMethod: methodLabel(consultation.method),
    consultationWhen: formatLondon(occurred),
    consultationNotes: consultation.clinical_notes,
    pharmacistName: report.approver_display_name,
    gphcNumber: report.approver_gphc_number,
    registrationNote: pharmacistRegistrationNote(config),
    medicines: medicineLines(questionnaire?.medications),
    concerns: textField(questionnaire?.answers, 'mainConcern') || 'None recorded',
    documentsReviewed: (documents ?? []).map((doc) => doc.original_filename),
    content: parseReportContent(report.content),
    companyLine: companyRecordLine(config),
  };
}
