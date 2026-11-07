'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { friendlyDbError } from '@/lib/order-status';
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
  if (session.provider !== 'local_test_harness' || !session.session_id) {
    redirect(
      `/account/review/${orderId}/pay?error=${encodeURIComponent('Live card checkout is not connected.')}`,
    );
  }
  redirect(`/dev/stripe-test/checkout/${session.session_id}`);
}
