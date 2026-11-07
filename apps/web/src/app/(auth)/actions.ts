'use server';

import {
  CURRENT_TERMS_VERSION,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
} from '@mrd/validation';
import { redirect } from 'next/navigation';
import { clientIp, getCurrentUser } from '@/lib/auth';
import { publicEnv } from '@/lib/env';
import { formCheckbox, formString, type FormState } from '@/lib/form-state';
import { authRateLimits } from '@/lib/rate-limit';
import { safeNextPath } from '@/lib/safe-redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const GENERIC_ERROR = 'Something went wrong. Please try again in a few minutes.';

function rateLimited(values?: Record<string, string>): FormState {
  return {
    status: 'error',
    code: 'rate_limited',
    message: 'Too many attempts. Please wait 15 minutes and try again.',
    ...(values ? { values } : {}),
  };
}

// Log only the error code: never emails, passwords or other personal data.
function logAuthError(action: string, code: string | undefined) {
  console.error(`[auth] ${action} failed`, { code: code ?? 'unknown' });
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    email: formString(formData, 'email'),
    password: formString(formData, 'password'),
    confirmPassword: formString(formData, 'confirmPassword'),
    confirmAdult: formCheckbox(formData, 'confirmAdult'),
    acceptTerms: formCheckbox(formData, 'acceptTerms'),
  };
  const values = { email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values };
  }

  const ip = await clientIp();
  if (!authRateLimits.signUp.hit(ip).allowed) return rateLimited(values);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      data: { terms_version: CURRENT_TERMS_VERSION, adult_declaration: 'true' },
    },
  });

  if (error) {
    if (error.code === 'weak_password') {
      return {
        status: 'error',
        fieldErrors: { password: ['Choose a stronger password that is harder to guess'] },
        values,
      };
    }
    // An existing account gets the same response as a new one, so the form
    // cannot be used to find out who has an account. Re-registering an
    // unconfirmed email re-sends its confirmation, which Auth throttles per
    // user; that throttle is also treated as success for the same reason.
    const indistinguishable = ['user_already_exists', 'email_exists', 'over_email_send_rate_limit'];
    if (!indistinguishable.includes(error.code ?? '')) {
      if (error.status === 429) return rateLimited(values);
      logAuthError('sign-up', error.code);
      return { status: 'error', message: GENERIC_ERROR, values };
    }
  }

  redirect('/sign-up/check-email');
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: formString(formData, 'email'), password: formString(formData, 'password') };
  const next = safeNextPath(formString(formData, 'next'));
  const values = { email: raw.email };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values };
  }

  const ip = await clientIp();
  const ipOk = authRateLimits.signInPerIp.hit(ip).allowed;
  const emailOk = authRateLimits.signInPerEmail.hit(parsed.data.email).allowed;
  if (!ipOk || !emailOk) return rateLimited(values);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === 'email_not_confirmed') {
      return {
        status: 'error',
        code: 'email_not_confirmed',
        message:
          'You need to confirm your email address before you can sign in. Check your inbox for the link we sent you.',
        values,
      };
    }
    if (error.status === 429) return rateLimited(values);
    if (error.code !== 'invalid_credentials') logAuthError('sign-in', error.code);
    return { status: 'error', message: 'Your email address or password is incorrect.', values };
  }

  redirect(next);
}

export async function resendVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formString(formData, 'email') });
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
  }
  const ip = await clientIp();
  if (!authRateLimits.resendVerificationPerIp.hit(ip).allowed) return rateLimited();
  if (!authRateLimits.resendVerificationPerEmail.hit(parsed.data.email).allowed)
    return rateLimited();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm` },
  });
  if (error && error.status !== 429) logAuthError('resend-verification', error.code);
  return {
    status: 'success',
    message:
      'If your account still needs confirming, we have sent a new link to your email address.',
  };
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = { email: formString(formData, 'email') };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values: raw };
  }
  const ip = await clientIp();
  const ipOk = authRateLimits.passwordResetPerIp.hit(ip).allowed;
  const emailOk = authRateLimits.passwordResetPerEmail.hit(parsed.data.email).allowed;
  if (!ipOk || !emailOk) return rateLimited(raw);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/reset-password`,
  });
  if (error && error.status !== 429) logAuthError('password-reset-request', error.code);

  // Same message whether or not the account exists.
  return {
    status: 'success',
    message:
      'If an account exists for that email address, we have sent a link to reset your password. The link expires in 1 hour.',
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formString(formData, 'password'),
    confirmPassword: formString(formData, 'confirmPassword'),
  });
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return {
      status: 'error',
      message:
        'Your password reset link has expired or has already been used. Please request a new one.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'same_password') {
      return {
        status: 'error',
        fieldErrors: { password: ['Your new password must be different from your old password'] },
      };
    }
    if (error.code === 'weak_password') {
      return {
        status: 'error',
        fieldErrors: { password: ['Choose a stronger password that is harder to guess'] },
      };
    }
    logAuthError('password-update', error.code);
    return { status: 'error', message: GENERIC_ERROR };
  }

  redirect('/account?notice=password-updated');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in?notice=signed-out');
}
