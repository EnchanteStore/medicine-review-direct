import { describe, expect, it } from 'vitest';
import { CHECKOUT_METADATA_KEYS, buildLocalCheckoutEvent } from '@/lib/local-checkout-event';

const HEALTH = /paracetamol|blood pressure|symptom|questionnaire|diagnosis|dob|date of birth/i;

describe('local checkout event', () => {
  it('sends only the checkout mode and the order id', () => {
    const event = buildLocalCheckoutEvent(
      {
        id: '11111111-1111-4111-8111-111111111111',
        amountPence: 5900,
        orderId: '22222222-2222-4222-8222-222222222222',
      },
      'evt_local_test',
    );
    expect(Object.keys(event.data.object.metadata).sort()).toEqual(
      [...CHECKOUT_METADATA_KEYS].sort(),
    );
    expect(event.data.object.metadata.checkout_mode).toBe('local_test_harness');
    expect(event.data.object.amount_total).toBe(5900);
    expect(JSON.stringify(event)).not.toMatch(HEALTH);
    expect(event.data.object.currency).toBe('gbp');
  });
});
