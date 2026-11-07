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

  it('safety escalation blocks routine checkout', () => {
    expect(canTransitionOrder('safety_escalated', 'awaiting_payment')).toBe(false);
    expect(canTransitionOrder('safety_escalated', 'paid')).toBe(false);
    expect(canStartCheckout('safety_escalated')).toBe(false);
  });

  it('cannot be paid without passing through awaiting_payment', () => {
    expect(canTransitionOrder('draft', 'paid')).toBe(false);
    expect(canTransitionOrder('questionnaire_submitted', 'paid')).toBe(false);
    expect(() => assertOrderTransition('awaiting_payment', 'paid')).not.toThrow();
  });

  it('booking requires payment', () => {
    expect(canTransitionOrder('awaiting_payment', 'consultation_booked')).toBe(false);
    expect(isOrderPaid('awaiting_payment')).toBe(false);
    expect(isOrderPaid('consultation_booked')).toBe(true);
  });

  it('has the expected terminal states', () => {
    expect(terminalStates(ORDER_TRANSITIONS).sort()).toEqual([
      'cancelled',
      'completed',
      'refunded',
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
    expect(hasClinicalAccess([{ role: 'clinical_admin', verificationStatus: 'verified' }])).toBe(
      true,
    );
  });

  it('hasVerifiedRole checks role and status', () => {
    const grants = [{ role: 'ops_admin', verificationStatus: 'verified' } as const];
    expect(hasVerifiedRole(grants, 'ops_admin')).toBe(true);
    expect(hasVerifiedRole(grants, 'pharmacist')).toBe(false);
  });
});

describe('pricing', () => {
  it('formats pence as GBP', () => {
    expect(formatGBP(5900)).toBe('£59');
    expect(formatGBP(7900)).toBe('£79');
    expect(formatGBP(5950)).toBe('£59.50');
  });

  it('rejects invalid amounts', () => {
    expect(() => formatGBP(-1)).toThrow(RangeError);
    expect(() => formatGBP(59.5)).toThrow(RangeError);
  });

  it('computes launch discount', () => {
    const p = { pricePence: 5900, standardPricePence: 7900 };
    expect(isDiscounted(p)).toBe(true);
    expect(savingPence(p)).toBe(2000);
    expect(isDiscounted({ pricePence: 7900, standardPricePence: null })).toBe(false);
  });
});
