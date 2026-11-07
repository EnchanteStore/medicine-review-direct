import { describe, expect, it } from 'vitest';
import { resolveBusinessConfig } from '../src/business';
import {
  MESSAGING_OUT_OF_HOURS_WARNING,
  REPORT_LIMITATIONS_DRAFT,
  ReportContentError,
  companyRecordLine,
  findDirectMedicineInstruction,
  parseReportContent,
  pharmacistRegistrationNote,
  reportSections,
  type ReportContent,
  type ReportDocumentModel,
} from '../src/report-content';

const content: ReportContent = {
  findings: 'The indication for the pain medicine should be discussed with the GP.',
  medicationIssues: [
    { medicine: 'Paracetamol', issue: 'The patient is unsure why it was started.' },
  ],
  recommendations: ['Ask the GP whether this medicine is still needed.'],
  monitoring: ['Review pain and use at the next GP appointment.'],
  gpDiscussionPoints: ['Indication for long-term use.'],
  safetyAdvice: 'If you feel very unwell, contact your GP or NHS 111. Call 999 in an emergency.',
  limitations: REPORT_LIMITATIONS_DRAFT,
};

describe('report content', () => {
  it('accepts a discussion with the prescriber and the standard disclaimer', () => {
    expect(parseReportContent(content)).toEqual(content);
    expect(findDirectMedicineInstruction(REPORT_LIMITATIONS_DRAFT)).toBeNull();
  });

  it.each([
    'Please stop taking this medicine',
    'You must stop the tablet today',
    'Do not take it tomorrow',
    "Don't take the morning dose",
    'Start taking two tablets',
    'Change your dose this week',
    'Increase your dose',
    'You should start a new tablet',
  ])('rejects a direct instruction: %s', (text) => {
    expect(findDirectMedicineInstruction(text)).not.toBeNull();
    expect(() =>
      parseReportContent({
        ...content,
        recommendations: [text],
      }),
    ).toThrow(ReportContentError);
  });

  it('requires an issue, a recommendation, monitoring and a GP point', () => {
    expect(() => parseReportContent({ ...content, medicationIssues: [] })).toThrow(
      /medication-related issue/,
    );
    expect(() => parseReportContent({ ...content, recommendations: [] })).toThrow(/Recommendation/);
    expect(() => parseReportContent({ ...content, monitoring: [] })).toThrow(/Monitoring/);
    expect(() => parseReportContent({ ...content, gpDiscussionPoints: [] })).toThrow(/GP/);
  });
});

describe('report sections', () => {
  const config = resolveBusinessConfig({});
  const model: ReportDocumentModel = {
    tradingName: config.tradingName,
    patientName: 'Synthetic Patient',
    dateOfBirth: '1 June 1952',
    reviewDate: '7 November 2026',
    consultationMethod: 'Telephone',
    consultationWhen: '7 November 2026, 10:00 Europe/London',
    consultationNotes: 'Synthetic notes of a two-way conversation.',
    pharmacistName: 'Asha Synthetic',
    gphcNumber: '0000099',
    registrationNote: pharmacistRegistrationNote(config),
    medicines: ['Paracetamol 500mg'],
    concerns: 'Why am I on this medicine?',
    documentsReviewed: ['synthetic-note.pdf'],
    content,
    companyLine: companyRecordLine(config),
  };

  it('includes the agreed sections and marks the register check as pending', () => {
    const titles = reportSections(model).map((section) => section.title);
    expect(titles).toEqual([
      'Patient',
      'Review date',
      'Consultation',
      'Pharmacist',
      'Medicines reviewed',
      'Concerns',
      'Information and documents reviewed',
      'Key findings',
      'Medication-related issues',
      'Recommendations',
      'Monitoring',
      'Points to discuss with the GP',
      'Safety advice',
      'Limitations and disclaimer',
      'About this document',
    ]);
    const pharmacist = reportSections(model).find((section) => section.title === 'Pharmacist');
    expect(pharmacist?.body).toContain('Asha Synthetic');
    expect(pharmacist?.body).toContain('0000099');
    expect(pharmacist?.body).toContain('Cheuk Kin Sung');
    expect(pharmacist?.body).toContain('2234388');
    expect(pharmacist?.body).toContain('still pending');
    expect(pharmacist?.body).toContain('not described as a registered pharmacy premises');
    const about = reportSections(model).find((section) => section.title === 'About this document');
    expect(about?.body).toContain('PHARMA247 LTD');
    expect(about?.body).toContain('17365383');
    expect(about?.body).toContain('DRAFT pending clinical approval');
  });

  it('warns that messages are not an emergency service', () => {
    expect(MESSAGING_OUT_OF_HOURS_WARNING).toMatch(/not an emergency service/i);
    expect(MESSAGING_OUT_OF_HOURS_WARNING).toMatch(/not monitored 24 hours/i);
    expect(MESSAGING_OUT_OF_HOURS_WARNING).toMatch(/call 999/);
  });
});
