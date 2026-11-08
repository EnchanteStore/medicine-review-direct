import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, canPatientMessage, canPatientUploadDocument } from '../src';

describe('patient actions', () => {
  it('allows a document only while the questionnaire is still open', () => {
    expect(canPatientUploadDocument('intake')).toBe(true);
    expect(canPatientUploadDocument('questionnaire_submitted')).toBe(true);
    for (const status of ORDER_STATUSES) {
      if (status === 'intake' || status === 'questionnaire_submitted') continue;
      expect(canPatientUploadDocument(status)).toBe(false);
    }
  });

  it('closes messages on a draft, an emergency exclusion, a cancellation or a refund', () => {
    expect(canPatientMessage('draft')).toBe(false);
    expect(canPatientMessage('safety_emergency_excluded')).toBe(false);
    expect(canPatientMessage('cancelled')).toBe(false);
    expect(canPatientMessage('refunded')).toBe(false);
    expect(canPatientMessage('in_review')).toBe(true);
    expect(canPatientMessage('report_released')).toBe(true);
    expect(canPatientMessage('safety_urgent_hold')).toBe(true);
  });
});
