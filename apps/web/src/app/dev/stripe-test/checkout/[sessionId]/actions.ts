'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { publicEnv } from '@/lib/env';
import { buildLocalCheckoutEvent } from '@/lib/local-checkout-event';
import { LOCAL_TEST_WEBHOOK_SECRET, signStripePayload } from '@/lib/stripe-signature';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f-]{36}$/i;

/** Posts a signed local event to the same webhook a real Stripe test event would use. */
export async function confirmLocalCheckoutAction(formData: FormData): Promise<void> {
  const user = await requireUser('/account');
  const sessionId = String(formData.get('sessionId') ?? '');
  if (!UUID.test(sessionId)) redirect('/account');
  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase
    .from('checkout_sessions')
    .select('id, order_id, amount_pence, currency, provider, status, patient_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (
    !session ||
    session.patient_id !== user.id ||
    session.status !== 'open' ||
    session.provider !== 'local_test_harness'
  ) {
    redirect('/account');
  }
  const event = buildLocalCheckoutEvent(
    { id: session.id, amountPence: session.amount_pence, orderId: session.order_id },
    `evt_local_${crypto.randomUUID()}`,
  );
  const payload = JSON.stringify(event);
  const header = signStripePayload(
    LOCAL_TEST_WEBHOOK_SECRET,
    payload,
    Math.floor(Date.now() / 1000),
  );
  const response = await fetch(`${publicEnv().NEXT_PUBLIC_SITE_URL}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': header },
    body: payload,
  });
  if (!response.ok)
    redirect(
      `/account/review/${session.order_id}/pay?error=${encodeURIComponent('The test payment could not be confirmed.')}`,
    );
  redirect(`/account/review/${session.order_id}?notice=paid`);
}
