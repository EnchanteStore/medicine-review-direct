import {
  DEFAULT_TRADING_NAME,
  canPatientMessage,
  canPatientUploadDocument,
  companyRecordLine,
  formatLondon,
  isVisibleToPatient,
  parseReportContent,
  pharmacistRegistrationNote,
  reportSections,
  resolveBusinessConfig,
  shortEmergencyWarning,
  type OrderStatus,
  type ReportDocumentModel,
  type ReportSection,
  type ReportStatus,
} from '@mrd/domain';

const REPORT_STATUSES: readonly ReportStatus[] = [
  'draft',
  'clinically_approved',
  'generating',
  'generation_failed',
  'ready_for_release',
  'released',
];

export function isReportStatus(value: string): value is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(value);
}

export interface WebsiteLink {
  label: string;
  url: string;
}

export function websiteReviewUrl(siteUrl: string, orderId: string, path = ''): string {
  const base = siteUrl.replace(/\/$/, '');
  return `${base}/account/review/${orderId}${path}`;
}

export interface HomeAction {
  id: string;
  label: string;
  detail: string;
}

export function homeActions(input: {
  siteUrl: string;
  orderId: string | null;
  status: OrderStatus | null;
  hasAppointment: boolean;
}): { summary: string; actions: HomeAction[]; links: WebsiteLink[] } {
  if (!input.orderId || !input.status) {
    return {
      summary: 'You have no review in the app yet. A new review is started on the website.',
      actions: [],
      links: [{ label: 'Open the website', url: `${input.siteUrl.replace(/\/$/, '')}/account` }],
    };
  }
  const pay = websiteReviewUrl(input.siteUrl, input.orderId, '/pay');
  const book = websiteReviewUrl(input.siteUrl, input.orderId, '/book');
  const site = websiteReviewUrl(input.siteUrl, input.orderId);
  const links: WebsiteLink[] = [];
  const actions: HomeAction[] = [];

  switch (input.status) {
    case 'draft':
      actions.push({
        id: 'screening',
        label: 'Safety questions needed',
        detail: 'Answer them on the website before you tell us about your medicines.',
      });
      links.push({ label: 'Continue on the website', url: site });
      break;
    case 'safety_emergency_excluded':
      actions.push({
        id: 'emergency',
        label: 'Stopped: emergency symptoms',
        detail:
          'This request is closed. If you have a life-threatening emergency, call 999 immediately.',
      });
      break;
    case 'safety_urgent_hold':
      actions.push({
        id: 'urgent',
        label: 'Paused: urgent exclusion',
        detail:
          'Contact your GP or NHS 111. A pharmacist must check this request before it continues.',
      });
      break;
    case 'intake':
    case 'questionnaire_submitted':
      actions.push({
        id: 'questionnaire',
        label: input.status === 'intake' ? 'Questionnaire in progress' : 'Questionnaire sent',
        detail: 'Payment is completed on the website. This app does not take a card payment.',
      });
      if (canPatientUploadDocument(input.status)) {
        actions.push({
          id: 'documents',
          label: 'You can add a document',
          detail:
            'A PDF or photo. It is not scanned, and a pharmacist cannot see it until a scanner marks it clean.',
        });
      }
      links.push({ label: 'Pay on the website', url: pay });
      break;
    case 'awaiting_payment':
      actions.push({
        id: 'pay',
        label: 'Waiting for payment',
        detail: 'Finish payment on the website. This app does not take a card payment.',
      });
      links.push({ label: 'Continue on the website', url: pay });
      break;
    case 'paid':
      actions.push({
        id: 'book',
        label: 'Paid, appointment not booked',
        detail: 'Choose a time on the website. Booking stays on the website.',
      });
      links.push({ label: 'Choose a time on the website', url: book });
      break;
    case 'consultation_booked':
      actions.push({
        id: 'booked',
        label: 'Appointment booked',
        detail: input.hasAppointment
          ? 'Your time is shown below. Messages are not monitored overnight.'
          : 'Your appointment is booked. The time is on the website if it is not shown here.',
      });
      break;
    case 'in_review':
      actions.push({
        id: 'review',
        label: 'With your pharmacist',
        detail: 'A report appears here only after they release it. Drafts stay hidden.',
      });
      break;
    case 'report_released':
      actions.push({
        id: 'report',
        label: 'Report available',
        detail: 'Your pharmacist has released your report.',
      });
      break;
    case 'declined':
      actions.push({
        id: 'declined',
        label: 'Not suitable for this service',
        detail: 'This is not a completed medication review report. Please speak to your GP.',
      });
      break;
    case 'cancelled':
    case 'refunded':
    case 'completed':
      actions.push({
        id: 'closed',
        label: 'Closed',
        detail: 'There is nothing further to do on this review in the app.',
      });
      break;
    default:
      actions.push({
        id: 'unknown',
        label: 'In progress',
        detail: 'Open the website if you are not sure what to do next.',
      });
      links.push({ label: 'Open the website', url: site });
  }

  if (canPatientMessage(input.status)) {
    actions.push({
      id: 'messages',
      label: 'Messages',
      detail: 'You can write to your pharmacist. This is not an emergency service.',
    });
  }
  return { summary: actions[0]?.detail ?? 'Open the website for the next step.', actions, links };
}

export function appointmentLine(input: {
  startsAt: string | null;
  method: string | null;
  status: string | null;
}): string {
  if (!input.startsAt) return 'No appointment is booked.';
  const when = formatLondon(new Date(input.startsAt));
  const method =
    input.method === 'telephone'
      ? 'Telephone'
      : input.method === 'secure_video'
        ? 'Secure video'
        : 'Consultation';
  return `${method}, ${when}${input.status ? ` (${input.status})` : ''}`;
}

export interface ReleasedReportInput {
  status: string | null;
  content: unknown;
  patientName: string;
  dateOfBirth: string;
  reviewDate: string;
  consultationMethod: string;
  consultationWhen: string;
  consultationNotes: string;
  pharmacistName: string;
  gphcNumber: string;
  medicines: string[];
  concerns: string;
  documentsReviewed: string[];
}

export type ReportView =
  { visible: false; message: string } | { visible: true; sections: ReportSection[] };

const HIDDEN = 'Your pharmacist has not released a report. Drafts are not shown here.';

export function reportView(input: ReleasedReportInput): ReportView {
  if (!input.status || !isReportStatus(input.status) || !isVisibleToPatient(input.status)) {
    return { visible: false, message: HIDDEN };
  }
  try {
    const content = parseReportContent(input.content);
    const business = resolveBusinessConfig({});
    const model: ReportDocumentModel = {
      tradingName: `${DEFAULT_TRADING_NAME} (provisional trading name)`,
      patientName: input.patientName || 'Not recorded',
      dateOfBirth: input.dateOfBirth || 'Not recorded',
      reviewDate: input.reviewDate || 'Not recorded',
      consultationMethod: input.consultationMethod || 'Not recorded',
      consultationWhen: input.consultationWhen || 'Not recorded',
      consultationNotes: input.consultationNotes || 'Not recorded',
      pharmacistName: input.pharmacistName || 'Not recorded',
      gphcNumber: input.gphcNumber || 'Not recorded',
      registrationNote: pharmacistRegistrationNote(business),
      medicines: input.medicines,
      concerns: input.concerns || 'None recorded',
      documentsReviewed: input.documentsReviewed,
      content,
      companyLine: companyRecordLine(business),
    };
    return { visible: true, sections: reportSections(model) };
  } catch {
    return { visible: false, message: 'This report could not be shown.' };
  }
}

export function emergencyBanner(): { heading: string; body: string } {
  const copy = shortEmergencyWarning(DEFAULT_TRADING_NAME);
  return { heading: copy.heading, body: copy.paragraphs.join('\n\n') };
}
