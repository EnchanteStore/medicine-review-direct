'use client';

import { PASSWORD_MIN_LENGTH } from '@mrd/validation';
import { CheckboxField, FormField, Input } from '@mrd/ui';
import Link from 'next/link';
import { useActionState } from 'react';
import { signUpAction } from '@/app/(auth)/actions';
import { initialFormState } from '@/lib/form-state';
import { FormFeedback, SubmitButton, fieldErrors } from './form-kit';

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialFormState);
  const values = state.status === 'error' ? state.values : undefined;

  return (
    <form action={action} noValidate className="space-y-6">
      <FormFeedback
        state={state}
        fields={[
          ['email', 'email'],
          ['password', 'password'],
          ['confirmPassword', 'confirmPassword'],
          ['confirmAdult', 'confirmAdult'],
          ['acceptTerms', 'acceptTerms'],
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

      <FormField
        id="password"
        label="Create a password"
        hint={`Use at least ${PASSWORD_MIN_LENGTH} characters, including a letter and a number. A short phrase is easy to remember.`}
        errors={fieldErrors(state, 'password')}
      >
        {(aria) => (
          <Input {...aria} name="password" type="password" autoComplete="new-password" required />
        )}
      </FormField>

      <FormField
        id="confirmPassword"
        label="Confirm your password"
        errors={fieldErrors(state, 'confirmPassword')}
      >
        {(aria) => (
          <Input {...aria} name="confirmPassword" type="password" autoComplete="new-password" required />
        )}
      </FormField>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-semibold">Before you continue</legend>
        <CheckboxField
          id="confirmAdult"
          name="confirmAdult"
          label="I confirm I am 18 or over and live in England"
          errors={fieldErrors(state, 'confirmAdult')}
        />
        <CheckboxField
          id="acceptTerms"
          name="acceptTerms"
          label={
            <>
              I have read the <Link href="/terms">terms of service</Link> and{' '}
              <Link href="/privacy">privacy notice</Link>
            </>
          }
          errors={fieldErrors(state, 'acceptTerms')}
        />
      </fieldset>

      <SubmitButton pendingText="Creating your account…">Create account</SubmitButton>
    </form>
  );
}
