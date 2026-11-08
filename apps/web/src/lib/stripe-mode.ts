import { CHECKOUT_METADATA_KEYS } from './local-checkout-event';

export type StripeKeyClass = 'live_refused' | 'test' | 'absent';

/** A live secret is refused. Anything that is not an sk_test_ key stays on the local harness. */
export function classifyStripeSecret(key: string | undefined): StripeKeyClass {
  const value = key?.trim() ?? '';
  if (!value) return 'absent';
  if (value.startsWith('sk_live_') || value.includes('sk_live_')) return 'live_refused';
  if (/^sk_test_[A-Za-z0-9_]+$/.test(value)) return 'test';
  return 'absent';
}

export interface StripeTestCheckout {
  orderId: string;
  amountPence: number;
  successOrigin: string;
}

/**
 * Body for a Stripe Checkout Session in test mode. The amount is the database
 * price in pence. No VAT is added. Metadata is only the mode and the order id.
 */
export function buildStripeTestCheckoutBody(input: StripeTestCheckout): Record<string, string> {
  if (!Number.isInteger(input.amountPence) || input.amountPence <= 0) {
    throw new Error('Checkout amount must be the database price in pence');
  }
  const success = `${input.successOrigin}/account/review/${input.orderId}`;
  const cancel = `${input.successOrigin}/account/review/${input.orderId}/pay`;
  return {
    mode: 'payment',
    'line_items[0][price_data][currency]': 'gbp',
    'line_items[0][price_data][unit_amount]': String(input.amountPence),
    'line_items[0][price_data][product_data][name]': 'Medication review',
    'line_items[0][quantity]': '1',
    'metadata[checkout_mode]': 'stripe_test',
    'metadata[order_id]': input.orderId,
    success_url: success,
    cancel_url: cancel,
  };
}

export function stripeTestMetadataKeys(body: Record<string, string>): string[] {
  return Object.keys(body)
    .filter((key) => key.startsWith('metadata['))
    .map((key) => key.slice('metadata['.length, -1))
    .sort();
}

export const STRIPE_TEST_METADATA_KEYS = CHECKOUT_METADATA_KEYS;

/**
 * Whether this process may call api.stripe.com. Absent and live keys never may.
 * The local harness is used instead when this is false.
 */
export function mayCallStripeTestApi(key: string | undefined): boolean {
  return classifyStripeSecret(key) === 'test';
}

/** Stable key for one checkout session. It is not an email address or a clinical note. */
export function stripeTestIdempotencyKey(sessionId: string): string {
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId) && !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new Error('Idempotency key must be the checkout session id');
  }
  return `checkout_${sessionId}`;
}
