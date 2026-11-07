'use client';

import { FormField, Input, Label, cn } from '@mrd/ui';
import { useActionState } from 'react';
import { updateProfileAction } from '@/app/account/profile/actions';
import type { FormState } from '@/lib/form-state';
import { FormFeedback, SubmitButton, fieldErrors } from './form-kit';

export interface ProfileFormValues {
  givenName: string;
  familyName: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  phoneNumber: string;
}

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {
    status: 'idle',
  });
  const v = (state.status !== 'idle' && state.values) || initial;
  const dobErrors = fieldErrors(state, 'dateOfBirth');

  return (
    <form action={action} noValidate className="space-y-6">
      <FormFeedback
        state={state}
        fields={[
          ['givenName', 'givenName'],
          ['familyName', 'familyName'],
          ['dateOfBirth', 'dobDay'],
          ['phoneNumber', 'phoneNumber'],
        ]}
      />

      <FormField id="givenName" label="First name" errors={fieldErrors(state, 'givenName')}>
        {(aria) => (
          <Input {...aria} name="givenName" autoComplete="given-name" defaultValue={v.givenName} />
        )}
      </FormField>

      <FormField id="familyName" label="Last name" errors={fieldErrors(state, 'familyName')}>
        {(aria) => (
          <Input
            {...aria}
            name="familyName"
            autoComplete="family-name"
            defaultValue={v.familyName}
          />
        )}
      </FormField>

      <fieldset
        aria-describedby={cn('dob-hint', dobErrors && 'dob-error')}
        className={cn('space-y-2', dobErrors && 'border-l-4 border-danger-700 pl-3')}
      >
        <legend className="font-semibold">Date of birth</legend>
        <p id="dob-hint" className="text-sm text-ink-600">
          For example, 27 3 1956. You must be 18 or over to use this service.
        </p>
        {dobErrors ? (
          <p id="dob-error" className="text-sm font-semibold text-danger-700">
            <span className="sr-only">Error: </span>
            {dobErrors.join('. ')}
          </p>
        ) : null}
        <div className="flex gap-4">
          {(
            [
              ['dobDay', 'Day', 'w-20', 'bday-day', v.dobDay],
              ['dobMonth', 'Month', 'w-20', 'bday-month', v.dobMonth],
              ['dobYear', 'Year', 'w-28', 'bday-year', v.dobYear],
            ] as const
          ).map(([name, label, width, autoComplete, value]) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                name={name}
                inputMode="numeric"
                autoComplete={autoComplete}
                defaultValue={value}
                className={width}
                aria-invalid={dobErrors ? true : undefined}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <FormField
        id="phoneNumber"
        label="UK phone number (optional)"
        hint="We may use this to call you for your consultation."
        errors={fieldErrors(state, 'phoneNumber')}
      >
        {(aria) => (
          <Input
            {...aria}
            name="phoneNumber"
            type="tel"
            autoComplete="tel"
            defaultValue={v.phoneNumber}
          />
        )}
      </FormField>

      <SubmitButton pendingText="Saving…">Save details</SubmitButton>
    </form>
  );
}
