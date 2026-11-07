import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  assertOrderTransition,
  canStartCheckout,
  canTransitionOrder,
  formatGBP,
  hasClinicalAccess,
  hasVerifiedRole,
  isDiscounted,
  isOrderPaid,
  savingPence,
  terminalStates,
} from '../src';

describe('order lifecycle', () => {
  it('every transition target is a known status', () => {
    for (const s of ORDER_STATUSES) {
      for (const t of ORDER_TRANSITIONS[s]) expect(ORDER_STATUSES).toContain(t);
    }
  });

  it('emergency exclusion is terminal: no path to intake, payment or booking', () => {
    expect(ORDER_TRANSITIONS.safety_emergency_excluded).toEqual([]);
  });

  it('urgent hold leaves only to intake (after reassessment), declined or cancelled', () => {
    expect([...ORDER_TRANSITIONS.safety_urgent_hold].sort()).toEqual([
      'cancelled',
      'declined',
      'intake',
    ]);
    expect(canTransitionOrder('safety_urgent_hold', 'awaiting_payment')).toBe(false);
  });

  it('checkout needs a submitted questionnaire, open payments and no urgent hold', () => {
    const base = {
      status: 'questionnaire_submitted' as const,
      paymentsOpen: true,
      patientHasUrgentHold: false,
    };
    expect(canStartCheckout(base)).toBe(true);
    expect(canStartCheckout({ ...base, paymentsOpen: false })).toBe(false);
    expect(canStartCheckout({ ...base, patientHasUrgentHold: true })).toBe(false);
    expect(canStartCheckout({ ...base, status: 'safety_emergency_excluded' })).toBe(false);
    expect(canStartCheckout({ ...base, status: 'intake' })).toBe(false);
  });

  it('cannot be paid without passing through awaiting_payment', () => {
    expect(canTransitionOrder('questionnaire_submitted', 'paid')).toBe(false);
    expect(() => assertOrderTransition('awaiting_payment', 'paid')).not.toThrow();
  });

  it('a declined service cannot reach report_released', () => {
    expect(canTransitionOrder('declined', 'report_released')).toBe(false);
    expect(isOrderPaid('awaiting_payment')).toBe(false);
  });

  it('has the expected terminal states', () => {
    expect(terminalStates(ORDER_TRANSITIONS).sort()).toEqual([
      'cancelled',
      'completed',
      'refunded',
      'safety_emergency_excluded',
    ]);
  });
});

describe('roles', () => {
  it('ops admins never get clinical access', () => {
    expect(hasClinicalAccess([{ role: 'ops_admin', verificationStatus: 'verified' }])).toBe(false);
  });

  it('unverified or suspended clinicians do not get clinical access', () => {
    expect(hasClinicalAccess([{ role: 'pharmacist', verificationStatus: 'pending' }])).toBe(false);
    expect(hasClinicalAccess([{ role: 'pharmacist', verificationStatus: 'suspended' }])).toBe(
      false,
    );
    expect(hasClinicalAccess([{ role: 'pharmacist', verificationStatus: 'verified' }])).toBe(true);
  });

  it('hasVerifiedRole checks role and status', () => {
    const grants = [{ role: 'ops_admin', verificationStatus: 'verified' } as const];
    expect(hasVerifiedRole(grants, 'ops_admin')).toBe(true);
    expect(hasVerifiedRole(grants, 'pharmacist')).toBe(false);
  });
});

describe('pricing', () => {
  it('formats pence as GBP without adding VAT', () => {
    expect(formatGBP(5900)).toBe('£59');
    expect(formatGBP(5950)).toBe('£59.50');
  });

  it('rejects invalid amounts', () => {
    expect(() => formatGBP(-1)).toThrow(RangeError);
  });

  it('computes launch discount', () => {
    expect(isDiscounted({ pricePence: 5900, standardPricePence: 7900 })).toBe(true);
    expect(savingPence({ pricePence: 5900, standardPricePence: 7900 })).toBe(2000);
  });
});
