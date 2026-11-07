import { describe, expect, it } from 'vitest';
import {
  LOCAL_TEST_WEBHOOK_SECRET,
  signStripePayload,
  verifyStripeSignature,
} from '@/lib/stripe-signature';

const payload = JSON.stringify({ id: 'evt_local_test', type: 'checkout.session.completed' });

describe('Stripe signature scheme', () => {
  it('accepts a signature it just created', () => {
    const now = 1_700_000_000_000;
    const header = signStripePayload(LOCAL_TEST_WEBHOOK_SECRET, payload, now / 1000);
    expect(verifyStripeSignature(LOCAL_TEST_WEBHOOK_SECRET, payload, header, now)).toBe(true);
  });

  it('rejects a tampered body, a bad signature and an old timestamp', () => {
    const now = 1_700_000_000_000;
    const header = signStripePayload(LOCAL_TEST_WEBHOOK_SECRET, payload, now / 1000);
    expect(verifyStripeSignature(LOCAL_TEST_WEBHOOK_SECRET, payload + ' ', header, now)).toBe(
      false,
    );
    expect(verifyStripeSignature('other-secret', payload, header, now)).toBe(false);
    expect(
      verifyStripeSignature(LOCAL_TEST_WEBHOOK_SECRET, payload, header, now + 10 * 60 * 1000),
    ).toBe(false);
    expect(verifyStripeSignature(LOCAL_TEST_WEBHOOK_SECRET, payload, null, now)).toBe(false);
  });
});
