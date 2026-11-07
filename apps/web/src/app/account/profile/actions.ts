'use server';

import { profileSchema, toFieldErrors } from '@mrd/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { composeIsoDate } from '@/lib/date-fields';
import { formString, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in?next=/account/profile');

  const values = {
    givenName: formString(formData, 'givenName'),
    familyName: formString(formData, 'familyName'),
    dobDay: formString(formData, 'dobDay'),
    dobMonth: formString(formData, 'dobMonth'),
    dobYear: formString(formData, 'dobYear'),
    phoneNumber: formString(formData, 'phoneNumber'),
  };
  const parsed = profileSchema.safeParse({
    givenName: values.givenName,
    familyName: values.familyName,
    dateOfBirth: composeIsoDate(values.dobDay, values.dobMonth, values.dobYear),
    phoneNumber: values.phoneNumber,
  });
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  // RLS restricts this to the user's own row; the explicit filter keeps intent clear.
  const { data, error } = await supabase
    .from('profiles')
    .update({
      given_name: parsed.data.givenName,
      family_name: parsed.data.familyName,
      date_of_birth: parsed.data.dateOfBirth,
      phone_number: parsed.data.phoneNumber,
    })
    .eq('id', user.id)
    .select('id');

  if (error || !data || data.length !== 1) {
    console.error('[profile] update failed', { code: error?.code ?? 'no_row' });
    return {
      status: 'error',
      message: 'We could not save your details. Please check them and try again.',
      values,
    };
  }

  revalidatePath('/account', 'layout');
  return { status: 'success', message: 'Your details have been saved.', values };
}
