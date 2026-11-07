import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  REPORT_LIMITATIONS_DRAFT,
  companyRecordLine,
  pharmacistRegistrationNote,
  resolveBusinessConfig,
  type ReportDocumentModel,
} from '@mrd/domain';
import { buildReportPdf } from '@/lib/report-pdf';

describe('report PDF', () => {
  it('builds a multi-page print document from the agreed sections', async () => {
    const config = resolveBusinessConfig({});
    const notes = Array.from(
      { length: 80 },
      (_, index) => `Synthetic consultation line ${index + 1}.`,
    ).join('\n');
    const model: ReportDocumentModel = {
      tradingName: 'PharmReview (provisional trading name)',
      patientName: 'Synthetic Patient',
      dateOfBirth: '1 June 1952',
      reviewDate: '7 November 2026',
      consultationMethod: 'Telephone',
      consultationWhen: '6 November 2026, 10:00 Europe/London',
      consultationNotes: notes,
      pharmacistName: 'Asha Synthetic',
      gphcNumber: '0000099',
      registrationNote: pharmacistRegistrationNote(config),
      medicines: ['Paracetamol 500mg tablets'],
      concerns: 'Why am I on this medicine?',
      documentsReviewed: ['synthetic-note.pdf'],
      content: {
        findings: 'The indication should be discussed with the GP.',
        medicationIssues: [
          { medicine: 'Paracetamol', issue: 'The patient is unsure why it was started.' },
        ],
        recommendations: ['Ask the GP whether this medicine is still needed.'],
        monitoring: ['Review pain at the next GP appointment.'],
        gpDiscussionPoints: ['Indication for long-term use.'],
        safetyAdvice:
          'If you feel very unwell, contact your GP or NHS 111. Call 999 in an emergency.',
        limitations: REPORT_LIMITATIONS_DRAFT,
      },
      companyLine: companyRecordLine(config),
    };

    const bytes = await buildReportPdf(model);
    expect(Buffer.from(bytes.subarray(0, 5)).toString('ascii')).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
