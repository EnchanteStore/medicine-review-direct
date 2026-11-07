'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { friendlyDbError } from '@/lib/order-status';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function recordGpConsentAction(formData: FormData): Promise<void> {
  const orderId = String(formData.get('orderId') ?? '');
  await requireUser(`/account/review/${orderId}/gp-letter`);
  const granted = formData.get('consent') === 'yes';
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('record_gp_letter_consent', {
    p_order_id: orderId,
    p_granted: granted,
  });
  const back = `/account/review/${orderId}/gp-letter`;
  if (error) redirect(`${back}?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  revalidatePath(back);
  redirect(`${back}?notice=${granted ? 'granted' : 'refused'}`);
}
