import { ORDER_STATUSES } from '@mrd/domain';
import { describe, expect, it } from 'vitest';
import { accountUpdateEmail } from '@/lib/notification-templates';
import { describeOrder, friendlyDbError } from '@/lib/order-status';

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  hasConsents: true,
  draftStep: 2,
  paymentsOpen: false,
};

describe('describeOrder', () => {
  it('has a description for every order status', () => {
    for (const status of ORDER_STATUSES) {
      const v = describeOrder({ ...base, status });
      expect(v.label.length).toBeGreaterThan(0);
    }
  });

  it('emergency exclusion tells the patient to call 999 and offers no booking', () => {
    const v = describeOrder({ ...base, status: 'safety_emergency_excluded' });
    expect(v.tone).toBe('danger');
    expect(v.message).toContain('call 999 immediately');
    expect(v.next?.href).toMatch(/\/outcome$/);
  });

  it('urgent hold points to GP or NHS 111 and pharmacist reassessment', () => {
    const v = describeOrder({ ...base, status: 'safety_urgent_hold' });
    expect(v.message).toMatch(/GP or NHS 111/);
    expect(v.message).toMatch(/pharmacist must check/);
  });

  it('routes intake to consent first, then the saved questionnaire step', () => {
    expect(describeOrder({ ...base, status: 'intake', hasConsents: false }).next?.href).toMatch(
      /\/consent$/,
    );
    expect(describeOrder({ ...base, status: 'intake' }).next?.href).toMatch(/\/questionnaire\/2$/);
  });

  it('is honest that payments are switched off before launch', () => {
    expect(describeOrder({ ...base, status: 'questionnaire_submitted' }).message).toMatch(
      /switched off/,
    );
    expect(
      describeOrder({ ...base, status: 'questionnaire_submitted', paymentsOpen: true }).message,
    ).toMatch(/not a live card payment/);
  });
});

describe('friendlyDbError', () => {
  it('maps known database errors and hides unknown ones', () => {
    expect(friendlyDbError('intake is closed until the live service is approved')).toMatch(
      /not accepting/,
    );
    expect(friendlyDbError('relation "secret_table" does not exist')).toBe(
      'Something went wrong. Please try again.',
    );
    expect(friendlyDbError(undefined)).toBe('Something went wrong. Please try again.');
  });
});

describe('notification templates', () => {
  it('contain no health details and repeat emergency advice', () => {
    const n = accountUpdateEmail('PharmReview');
    expect(n.subject).toBe('There is an update in your account');
    expect(`${n.subject} ${n.text}`).not.toMatch(
      /medicine|medication|tablet|report|screening|symptom|questionnaire|warfarin/i,
    );
    expect(n.text).toContain('call 999');
  });
});
