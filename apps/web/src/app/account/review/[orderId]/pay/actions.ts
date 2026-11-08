'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { friendlyDbError } from '@/lib/order-status';
import { mayCallStripeTestApi } from '@/lib/stripe-mode';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f-]{36}$/i;

export async function startCheckoutAction(formData: FormData): Promise<void> {
  await requireUser('/account');
  const orderId = String(formData.get('orderId') ?? '');
  if (!UUID.test(orderId)) redirect('/account');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('begin_checkout', { p_order_id: orderId });
  if (error || !data) {
    console.error('[payment] checkout failed', { code: error?.code ?? 'unknown' });
    redirect(
      `/account/review/${orderId}/pay?error=${encodeURIComponent(friendlyDbError(error?.message))}`,
    );
  }
  const session = data as { session_id?: string; provider?: string };
  if (!session.session_id) redirect('/account');
  if (session.provider === 'local_test_harness') {
    redirect(`/dev/stripe-test/checkout/${session.session_id}`);
  }
  // A Stripe test session is not sent to Stripe from this preparation.
  // Without an sk_test_ key the local harness remains the only checkout.
  if (!mayCallStripeTestApi(process.env.STRIPE_SECRET_KEY)) {
    redirect(
      `/account/review/${orderId}/pay?error=${encodeURIComponent('Stripe test checkout is not configured.')}`,
    );
  }
  redirect(
    `/account/review/${orderId}/pay?error=${encodeURIComponent('Stripe test checkout is prepared but not called from this server.')}`,
  );
}
