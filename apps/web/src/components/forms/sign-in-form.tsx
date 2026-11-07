'use client';

import { FormField, Input } from '@mrd/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { signInAction } from '@/app/(auth)/actions';
import { initialFormState } from '@/lib/form-state';
import { FormFeedback, SubmitButton, fieldErrors } from './form-kit';
import { ResendVerificationForm } from './resend-verification-form';

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  const values = state.status === 'error' ? state.values : undefined;
  const unverified = state.status === 'error' && state.code === 'email_not_confirmed';

  return (
    <div className="space-y-8">
      <form action={action} noValidate className="space-y-6">
        <input type="hidden" name="next" value={next} />
        <FormFeedback
          state={state}
          fields={[
            ['email', 'email'],
            ['password', 'password'],
          ]}
        />

        <FormField id="email" label="Email address" errors={fieldErrors(state, 'email')}>
          {(aria) => (
            <Input
              {...aria}
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              defaultValue={values?.email ?? ''}
              required
            />
          )}
        </FormField>

        <FormField id="password" label="Password" errors={fieldErrors(state, 'password')}>
          {(aria) => (
            <Input {...aria} name="password" type="password" autoComplete="current-password" required />
          )}
        </FormField>

        <div className="flex flex-wrap items-center gap-6">
          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
          <Link href="/forgot-password">Forgotten your password?</Link>
        </div>
      </form>

      {unverified ? <ResendVerificationForm email={values?.email ?? ''} /> : null}
    </div>
  );
}
