'use server';

import { londonWallTimeToUtc } from '@mrd/domain';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function addAvailabilityAction(formData: FormData): Promise<void> {
  await requireUser('/staff/availability');
  const date = String(formData.get('date') ?? '');
  const start = String(formData.get('start') ?? '');
  const end = String(formData.get('end') ?? '');
  let starts: Date;
  let ends: Date;
  try {
    starts = londonWallTimeToUtc(date, start);
    ends = londonWallTimeToUtc(date, end);
  } catch {
    redirect('/staff/availability?error=Enter%20a%20valid%20date%20and%20time');
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_availability', {
    p_starts: starts.toISOString(),
    p_ends: ends.toISOString(),
  });
  if (error) {
    console.error('[availability] failed', { code: error.code ?? 'unknown' });
    redirect('/staff/availability?error=That%20time%20could%20not%20be%20saved');
  }
  revalidatePath('/staff/availability');
  redirect('/staff/availability?notice=saved');
}
