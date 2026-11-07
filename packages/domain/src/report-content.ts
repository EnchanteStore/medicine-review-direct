import type { BusinessConfig } from './business';

/**
 * Structured clinical writing for a medication review. DRAFT pending clinical
 * approval. Nothing in here is an instruction to start, stop or change a
 * medicine without the prescriber.
 */
export interface MedicationIssue {
  medicine: string;
  issue: string;
}

export interface ReportContent {
  findings: string;
  medicationIssues: MedicationIssue[];
  recommendations: string[];
  monitoring: string[];
  gpDiscussionPoints: string[];
  safetyAdvice: string;
  limitations: string;
}

/** Shown on every report. Avoids phrases that tell someone to change a medicine. */
export const REPORT_LIMITATIONS_DRAFT =
  'DRAFT pending clinical approval. This review is for discussion with the prescriber. It is not an instruction to alter any medicine by yourself. PharmReview is not an emergency service. If you have a life-threatening emergency, call 999. For urgent advice, contact your GP or NHS 111.';

/** Shown wherever a patient or pharmacist can write a message. */
export const MESSAGING_OUT_OF_HOURS_WARNING =
  'This is not an emergency service. Messages are not monitored 24 hours a day, including overnight, at weekends and on bank holidays. If you have a life-threatening emergency, call 999. For urgent medical advice, contact your GP or NHS 111. Do not wait for a reply.';

/**
 * Phrases that tell a patient to change a medicine on their own.
 * Kept in step with app.assert_no_direct_medicine_change in the database.
 */
const DIRECT_MEDICINE_CHANGE: readonly RegExp[] = [
  /\bstop taking\b/i,
  /\bstop your medicine\b/i,
  /\bdo not take\b/i,
  /\bdon't take\b/i,
  /\bdo not start\b/i,
  /\bstart taking\b/i,
  /\bchange your dose\b/i,
  /\bincrease your dose\b/i,
  /\bdecrease your dose\b/i,
  /\bdouble your dose\b/i,
  /\bhalve your dose\b/i,
  /\byou should stop\b/i,
  /\byou must stop\b/i,
  /\byou need to stop\b/i,
  /\byou should start\b/i,
  /\byou must start\b/i,
];

export class ReportContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportContentError';
  }
}

/** The matched phrase, or null when the text does not give a direct instruction. */
export function findDirectMedicineInstruction(text: string): string | null {
  for (const pattern of DIRECT_MEDICINE_CHANGE) {
    const match = pattern.exec(text);
    if (match?.[0]) return match[0];
  }
  return null;
}

function cleanLine(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new ReportContentError(`${label} must be text.`);
  const text = value.trim();
  if (text.length < 1 || text.length > max) {
    throw new ReportContentError(`${label} must be between 1 and ${max} characters.`);
  }
  const hit = findDirectMedicineInstruction(text);
  if (hit) {
    throw new ReportContentError(
      `Remove "${hit}". Say what to discuss with the prescriber. Do not tell the patient to start, stop or change a medicine on their own.`,
    );
  }
  return text;
}

function cleanList(value: unknown, label: string, min: number): string[] {
  if (!Array.isArray(value)) throw new ReportContentError(`${label} must be a list.`);
  if (value.length < min || value.length > 20) {
    throw new ReportContentError(`${label} needs between ${min} and 20 items.`);
  }
  return value.map((item, index) => cleanLine(item, `${label} ${index + 1}`, 1000));
}

export function parseReportContent(value: unknown): ReportContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReportContentError('Report content is incomplete.');
  }
  const record = value as Record<string, unknown>;
  const issues = record.medicationIssues;
  if (!Array.isArray(issues) || issues.length < 1 || issues.length > 20) {
    throw new ReportContentError('Add at least one medication-related issue.');
  }
  const medicationIssues = issues.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ReportContentError(`Issue ${index + 1} is incomplete.`);
    }
    const row = item as Record<string, unknown>;
    return {
      medicine: cleanLine(row.medicine, `Medicine ${index + 1}`, 200),
      issue: cleanLine(row.issue, `Issue ${index + 1}`, 1000),
    };
  });
  return {
    findings: cleanLine(record.findings, 'Key findings', 4000),
    medicationIssues,
    recommendations: cleanList(record.recommendations, 'Recommendation', 1),
    monitoring: cleanList(record.monitoring, 'Monitoring need', 1),
    gpDiscussionPoints: cleanList(record.gpDiscussionPoints, 'Point to discuss with the GP', 1),
    safetyAdvice: cleanLine(record.safetyAdvice, 'Safety advice', 2000),
    limitations: cleanLine(record.limitations, 'Limitations', 2000),
  };
}

export interface ReportDocumentModel {
  tradingName: string;
  patientName: string;
  dateOfBirth: string;
  reviewDate: string;
  consultationMethod: string;
  consultationWhen: string;
  consultationNotes: string;
  pharmacistName: string;
  gphcNumber: string;
  registrationNote: string;
  medicines: string[];
  concerns: string;
  documentsReviewed: string[];
  content: ReportContent;
  companyLine: string;
}

export interface ReportSection {
  title: string;
  body: string;
}

/** The agreed report sections, in order. The PDF and the patient page both use this. */
export function reportSections(model: ReportDocumentModel): ReportSection[] {
  const issues = model.content.medicationIssues
    .map((item) => `${item.medicine}: ${item.issue}`)
    .join('\n\n');
  const bullets = (items: string[]) => items.map((item) => `- ${item}`).join('\n');
  return [
    {
      title: 'Patient',
      body: `${model.patientName}\nDate of birth: ${model.dateOfBirth}`,
    },
    { title: 'Review date', body: model.reviewDate },
    {
      title: 'Consultation',
      body: `${model.consultationMethod}\n${model.consultationWhen}\n\n${model.consultationNotes}`,
    },
    {
      title: 'Pharmacist',
      body: `${model.pharmacistName}\nGPhC number: ${model.gphcNumber}\n\n${model.registrationNote}`,
    },
    {
      title: 'Medicines reviewed',
      body: model.medicines.length > 0 ? model.medicines.join('\n') : 'None recorded',
    },
    { title: 'Concerns', body: model.concerns || 'None recorded' },
    {
      title: 'Information and documents reviewed',
      body:
        model.documentsReviewed.length > 0
          ? model.documentsReviewed.join('\n')
          : 'No scanned documents were on file.',
    },
    { title: 'Key findings', body: model.content.findings },
    { title: 'Medication-related issues', body: issues },
    { title: 'Recommendations', body: bullets(model.content.recommendations) },
    { title: 'Monitoring', body: bullets(model.content.monitoring) },
    {
      title: 'Points to discuss with the GP',
      body: bullets(model.content.gpDiscussionPoints),
    },
    { title: 'Safety advice', body: model.content.safetyAdvice },
    { title: 'Limitations and disclaimer', body: model.content.limitations },
    {
      title: 'About this document',
      body: `${model.tradingName}\n${model.companyLine}\nClinical wording in this template is DRAFT pending clinical approval.`,
    },
  ];
}

/** Uses the company record. Does not claim a live GPhC check that has not happened. */
export function pharmacistRegistrationNote(config: BusinessConfig): string {
  const name = config.facts.superintendentPharmacistName;
  const gphc = config.facts.superintendentPharmacistGphc;
  const lead = name.value && gphc.value ? `${name.value} (GPhC ${gphc.value})` : 'not recorded';
  const check =
    name.status === 'verified' && gphc.status === 'verified'
      ? 'The clinical lead details are marked verified in configuration.'
      : 'A live GPhC register check is still pending.';
  return `The GPhC number on this report is the number recorded for the pharmacist who approved it. The clinical lead on the company record is ${lead}. ${check} This service is not described as a registered pharmacy premises.`;
}

export function companyRecordLine(config: BusinessConfig): string {
  const facts = config.facts;
  const company = facts.companyLegalName.value ?? 'Company name not recorded';
  const number = facts.companyNumber.value ?? 'not recorded';
  const office = facts.registeredAddress.value ?? 'not recorded';
  return `${company}, company number ${number}. Registered office: ${office}. Company details are as recorded by the owner and are not independently re-checked in this document.`;
}
