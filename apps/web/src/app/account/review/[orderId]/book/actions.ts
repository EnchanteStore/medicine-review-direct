'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { friendlyDbError } from '@/lib/order-status';
import { notifyAppointmentUpdate } from '@/lib/notifications';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f-]{36}$/i;

export async function bookSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser('/account');
  const orderId = String(formData.get('orderId') ?? '');
  const pharmacistId = String(formData.get('pharmacistId') ?? '');
  const startsAt = String(formData.get('startsAt') ?? '');
  if (!UUID.test(orderId) || !UUID.test(pharmacistId) || !startsAt) redirect('/account');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('book_appointment', {
    p_order_id: orderId,
    p_pharmacist_id: pharmacistId,
    p_starts: startsAt,
  });
  if (error) {
    console.error('[booking] failed', { code: error.code ?? 'unknown' });
    redirect(
      `/account/review/${orderId}/book?error=${encodeURIComponent(friendlyDbError(error.message))}`,
    );
  }
  if (user.email) await notifyAppointmentUpdate(user.email);
  revalidatePath(`/account/review/${orderId}`);
  redirect(`/account/review/${orderId}/appointment`);
}

export async function rescheduleAction(formData: FormData): Promise<void> {
  const user = await requireUser('/account');
  const orderId = String(formData.get('orderId') ?? '');
  const appointmentId = String(formData.get('appointmentId') ?? '');
  const pharmacistId = String(formData.get('pharmacistId') ?? '');
  const startsAt = String(formData.get('startsAt') ?? '');
  if (![orderId, appointmentId, pharmacistId].every((id) => UUID.test(id)) || !startsAt)
    redirect('/account');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('reschedule_appointment', {
    p_appointment_id: appointmentId,
    p_pharmacist_id: pharmacistId,
    p_starts: startsAt,
  });
  if (error) {
    redirect(
      `/account/review/${orderId}/appointment?error=${encodeURIComponent(friendlyDbError(error.message))}`,
    );
  }
  if (user.email) await notifyAppointmentUpdate(user.email);
  redirect(`/account/review/${orderId}/appointment?notice=moved`);
}

export async function requestCancellationAction(formData: FormData): Promise<void> {
  const user = await requireUser('/account');
  const orderId = String(formData.get('orderId') ?? '');
  const appointmentId = String(formData.get('appointmentId') ?? '');
  if (!UUID.test(orderId) || !UUID.test(appointmentId)) redirect('/account');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('request_cancellation', { p_appointment_id: appointmentId });
  if (error) {
    redirect(
      `/account/review/${orderId}/appointment?error=${encodeURIComponent(friendlyDbError(error.message))}`,
    );
  }
  if (user.email) await notifyAppointmentUpdate(user.email);
  redirect(`/account/review/${orderId}/appointment?notice=cancellation`);
}
