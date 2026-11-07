'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { friendlyDbError } from '@/lib/order-status';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function assignPharmacistAction(formData: FormData): Promise<void> {
  await requireUser('/staff/assignments');
  const orderId = String(formData.get('orderId') ?? '');
  const pharmacistId = String(formData.get('pharmacistId') ?? '');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('assign_pharmacist', {
    p_order_id: orderId,
    p_pharmacist_id: pharmacistId,
  });
  if (error) {
    console.error('[assign] failed', { code: error.code ?? 'unknown' });
    redirect(`/staff/assignments?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  }
  revalidatePath('/staff/assignments');
  revalidatePath('/staff/reviews');
  redirect('/staff/assignments?notice=assigned');
}
