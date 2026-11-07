'use client';

import { PASSWORD_MIN_LENGTH } from '@mrd/validation';
import { FormField, Input } from '@mrd/ui';
import { useActionState } from 'react';
import { forgotPasswordAction, resetPasswordAction } from '@/app/(auth)/actions';
import { initialFormState } from '@/lib/form-state';
import { FormFeedback, SubmitButton, fieldErrors } from './form-kit';

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState);
  const values = state.status === 'error' ? state.values : undefined;
  return (
    <form action={action} noValidate className="space-y-6">
      <FormFeedback state={state} fields={[['email', 'email']]} />
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
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);
  return (
    <form action={action} noValidate className="space-y-6">
      <FormFeedback
        state={state}
        fields={[
          ['password', 'password'],
          ['confirmPassword', 'confirmPassword'],
        ]}
      />
      <FormField
        id="password"
        label="New password"
        hint={`Use at least ${PASSWORD_MIN_LENGTH} characters, including a letter and a number.`}
        errors={fieldErrors(state, 'password')}
      >
        {(aria) => (
          <Input {...aria} name="password" type="password" autoComplete="new-password" required />
        )}
      </FormField>
      <FormField
        id="confirmPassword"
        label="Confirm new password"
        errors={fieldErrors(state, 'confirmPassword')}
      >
        {(aria) => (
          <Input {...aria} name="confirmPassword" type="password" autoComplete="new-password" required />
        )}
      </FormField>
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
