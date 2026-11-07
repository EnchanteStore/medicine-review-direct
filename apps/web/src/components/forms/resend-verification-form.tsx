'use client';

import { FormField, Input } from '@mrd/ui';
import { useActionState } from 'react';
import { resendVerificationAction } from '@/app/(auth)/actions';
import { initialFormState } from '@/lib/form-state';
import { FormFeedback, SubmitButton, fieldErrors } from './form-kit';

export function ResendVerificationForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, initialFormState);
  return (
    <form
      action={action}
      noValidate
      className="space-y-4 rounded-md border border-sand-200 bg-white p-5"
    >
      <h2 className="text-lg">Send a new confirmation link</h2>
      <FormFeedback state={state} fields={[['email', 'resend-email']]} />
      <FormField id="resend-email" label="Email address" errors={fieldErrors(state, 'email')}>
        {(aria) => (
          <Input
            {...aria}
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={email}
            required
          />
        )}
      </FormField>
      <SubmitButton pendingText="Sending…">Send new link</SubmitButton>
    </form>
  );
}
