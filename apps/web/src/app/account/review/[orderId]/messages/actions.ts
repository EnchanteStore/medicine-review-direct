'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { notifyAccountUpdate } from '@/lib/notifications';
import { friendlyDbError } from '@/lib/order-status';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export async function sendPatientMessageAction(formData: FormData): Promise<void> {
  const orderId = String(formData.get('orderId') ?? '');
  await requireUser(`/account/review/${orderId}/messages`);
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from('review_orders')
    .select('assigned_pharmacist_id')
    .eq('id', orderId)
    .maybeSingle();
  const { error } = await supabase.rpc('send_review_message', {
    p_order_id: orderId,
    p_body: String(formData.get('body') ?? ''),
  });
  const back = `/account/review/${orderId}/messages`;
  if (error) {
    redirect(`${back}?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  }
  if (order?.assigned_pharmacist_id) {
    try {
      const service = createSupabaseServiceClient();
      const { data } = await service.auth.admin.getUserById(order.assigned_pharmacist_id);
      if (data.user?.email) await notifyAccountUpdate(data.user.email);
    } catch {
      console.error('[notify] account update failed');
    }
  }
  revalidatePath(back);
  redirect(`${back}?notice=sent`);
}
