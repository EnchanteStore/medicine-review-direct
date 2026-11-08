import { REPORT_LIMITATIONS_DRAFT } from '@mrd/domain';
import { reportView } from './model';

const content = {
  findings: 'Synthetic finding: discuss the indication with the GP.',
  medicationIssues: [
    { medicine: 'Paracetamol', issue: 'The patient is unsure why it was started.' },
  ],
  recommendations: ['Ask the GP whether this medicine is still needed.'],
  monitoring: ['Review pain at the next GP appointment.'],
  gpDiscussionPoints: ['Indication for long-term use.'],
  safetyAdvice: 'If you feel very unwell, contact your GP or NHS 111. Call 999 in an emergency.',
  limitations: REPORT_LIMITATIONS_DRAFT,
};

export function previewReleasedReport() {
  return reportView({
    status: 'released',
    content,
    patientName: 'Synthetic Patient',
    dateOfBirth: '1 June 1952',
    reviewDate: '7 November 2026',
    consultationMethod: 'Telephone',
    consultationWhen: '6 November 2026, 10:00 Europe/London',
    consultationNotes: 'Synthetic notes of a two-way conversation.',
    pharmacistName: 'Asha Synthetic',
    gphcNumber: '0000099',
    medicines: ['Paracetamol 500mg'],
    concerns: 'Why am I on this medicine?',
    documentsReviewed: [],
  });
}

export function previewHiddenReport() {
  return reportView({
    status: 'draft',
    content,
    patientName: 'Synthetic Patient',
    dateOfBirth: '1 June 1952',
    reviewDate: '7 November 2026',
    consultationMethod: 'Telephone',
    consultationWhen: '6 November 2026, 10:00 Europe/London',
    consultationNotes: 'Synthetic notes of a two-way conversation.',
    pharmacistName: 'Asha Synthetic',
    gphcNumber: '0000099',
    medicines: ['Paracetamol 500mg'],
    concerns: 'Why am I on this medicine?',
    documentsReviewed: [],
  });
}
