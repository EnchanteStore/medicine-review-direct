'use server';

import { redirect } from 'next/navigation';
import { getStaffGrants, requireUser } from '@/lib/auth';
import { formString } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isStaff } from '@mrd/domain';

export type MfaState =
  | { status: 'idle' }
  | { status: 'enrolling'; factorId: string; qrCode: string; secret: string; error?: string }
  | { status: 'error'; message: string; factorId?: string };

async function requireStaffUser() {
  await requireUser('/staff');
  if (!isStaff(await getStaffGrants())) redirect('/account');
}

export async function startEnrolmentAction(
  _prev: MfaState,
  _formData: FormData,
): Promise<MfaState> {
  await requireStaffUser();
  const supabase = await createSupabaseServerClient();
  // Remove abandoned, unverified factors so repeated attempts do not pile up.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified')
      await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${Date.now()}`,
  });
  if (error || !data) {
    console.error('[mfa] enrol failed', { code: error?.code ?? 'unknown' });
    return { status: 'error', message: 'We could not start set-up. Please try again.' };
  }
  return {
    status: 'enrolling',
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyCodeAction(prev: MfaState, formData: FormData): Promise<MfaState> {
  await requireStaffUser();
  const factorId = formString(formData, 'factorId');
  const code = formString(formData, 'code').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) {
    return prev.status === 'enrolling'
      ? { ...prev, error: 'Enter the 6-digit code from your authenticator app' }
      : {
          status: 'error',
          message: 'Enter the 6-digit code from your authenticator app',
          factorId,
        };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    return prev.status === 'enrolling'
      ? { ...prev, error: 'That code is not right. Check the time on your device and try again.' }
      : { status: 'error', message: 'That code is not right. Please try again.', factorId };
  }
  redirect('/staff');
}
