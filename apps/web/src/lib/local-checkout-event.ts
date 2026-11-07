/**
 * The only fields the local test checkout is allowed to send to the webhook.
 * No names, medicines, symptoms or questionnaire answers.
 */
export const CHECKOUT_METADATA_KEYS = ['checkout_mode', 'order_id'] as const;

export interface LocalCheckoutSession {
  id: string;
  amountPence: number;
  orderId: string;
}

export function buildLocalCheckoutEvent(session: LocalCheckoutSession, eventId: string) {
  return {
    id: eventId,
    type: 'checkout.session.completed' as const,
    data: {
      object: {
        id: session.id,
        amount_total: session.amountPence,
        currency: 'gbp' as const,
        metadata: {
          checkout_mode: 'local_test_harness' as const,
          order_id: session.orderId,
        },
      },
    },
  };
}
