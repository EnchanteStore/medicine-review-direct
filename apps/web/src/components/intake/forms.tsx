'use client';

import type { ScreeningQuestion } from '@mrd/domain';
import { Button, CheckboxField, FormField, Input, Label, Textarea, cn } from '@mrd/ui';
import { MEDICATION_DONT_KNOW_FIELDS } from '@mrd/validation';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  consentAction,
  requestDeletionAction,
  saveQuestionnaireStepAction,
  startReviewAction,
  submitQuestionnaireAction,
  submitScreeningAction,
  uploadDocumentAction,
} from '@/app/account/review/actions';
import { FormFeedback, SubmitButton, fieldErrors } from '@/components/forms/form-kit';
import { initialFormState, type FormState } from '@/lib/form-state';

function IntentButton({
  intent,
  children,
  variant = 'primary',
}: {
  intent: string;
  children: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="intent" value={intent} variant={variant} disabled={pending}>
      {children}
    </Button>
  );
}

export function StartReviewForm() {
  const [state, action] = useActionState(startReviewAction, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <FormFeedback state={state} fields={[]} />
      <SubmitButton pendingText="Starting…">Start a medication review</SubmitButton>
    </form>
  );
}

const ANSWER_LABELS = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['unsure', 'Not sure'],
] as const;

export function ScreeningForm({
  orderId,
  groups,
}: {
  orderId: string;
  groups: { title: string; intro: string; questions: ScreeningQuestion[] }[];
}) {
  const [state, action] = useActionState(submitScreeningAction, initialFormState);
  const values = state.status === 'error' ? state.values : undefined;
  const all = groups.flatMap((g) => g.questions);
  return (
    <form action={action} noValidate className="space-y-8">
      <input type="hidden" name="orderId" value={orderId} />
      <FormFeedback state={state} fields={all.map((q) => [`q_${q.id}`, `q_${q.id}-yes`])} />
      {groups.map((g) => (
        <section key={g.title} className="space-y-5">
          <div>
            <h2 className="text-2xl">{g.title}</h2>
            <p className="mt-1 text-ink-700">{g.intro}</p>
          </div>
          {g.questions.map((q) => {
            const errors = fieldErrors(state, `q_${q.id}`);
            return (
              <fieldset
                key={q.id}
                aria-describedby={errors ? `q_${q.id}-error` : undefined}
                className={cn(
                  'space-y-3 rounded-md border border-sand-200 bg-white p-4',
                  errors && 'border-l-4 border-l-danger-700',
                )}
              >
                <legend className="px-1 font-semibold">{q.text}</legend>
                {errors ? (
                  <p id={`q_${q.id}-error`} className="text-sm font-semibold text-danger-700">
                    <span className="sr-only">Error: </span>
                    {errors.join('. ')}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  {ANSWER_LABELS.map(([value, label]) => (
                    <div key={value} className="flex items-center gap-3">
                      <input
                        type="radio"
                        id={`q_${q.id}-${value}`}
                        name={`q_${q.id}`}
                        value={value}
                        defaultChecked={values?.[`q_${q.id}`] === value}
                        className="size-7 accent-teal-700"
                      />
                      <label htmlFor={`q_${q.id}-${value}`}>{label}</label>
                    </div>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </section>
      ))}
      <SubmitButton pendingText="Checking…">Continue</SubmitButton>
    </form>
  );
}

export function ConsentForm({ orderId, brand }: { orderId: string; brand: string }) {
  const [state, action] = useActionState(consentAction, initialFormState);
  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="orderId" value={orderId} />
      <FormFeedback
        state={state}
        fields={[
          ['healthData', 'healthData'],
          ['remoteConsultation', 'remoteConsultation'],
        ]}
      />
      <CheckboxField
        id="healthData"
        name="healthData"
        errors={fieldErrors(state, 'healthData')}
        label={`I agree that ${brand} and its pharmacists may use the health information I give, including documents I upload, to provide my medication review.`}
      />
      <CheckboxField
        id="remoteConsultation"
        name="remoteConsultation"
        errors={fieldErrors(state, 'remoteConsultation')}
        label="I agree to have my consultation by telephone or secure video."
      />
      <SubmitButton pendingText="Saving…">Agree and continue</SubmitButton>
    </form>
  );
}

function StepShell({
  orderId,
  step,
  state,
  fields,
  children,
}: {
  orderId: string;
  step: number;
  state: FormState;
  fields: [string, string][];
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Implicit submission (Enter key) uses the first submit button: make it a plain save. */}
      <button
        type="submit"
        name="intent"
        value="save"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        Save
      </button>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="step" value={step} />
      <FormFeedback state={state} fields={fields} />
      {children}
      <div className="flex flex-wrap gap-3 border-t border-sand-200 pt-6">
        <IntentButton intent="next">Save and continue</IntentButton>
        <IntentButton intent="save" variant="secondary">
          Save draft
        </IntentButton>
      </div>
    </>
  );
}

export function HealthStepForm({
  orderId,
  answers,
}: {
  orderId: string;
  answers: Record<string, string>;
}) {
  const [state, action] = useActionState(saveQuestionnaireStepAction, initialFormState);
  return (
    <form action={action} noValidate className="space-y-6">
      <StepShell
        orderId={orderId}
        step={1}
        state={state}
        fields={[
          ['conditions', 'conditions'],
          ['allergies', 'allergies'],
        ]}
      >
        <FormField
          id="conditions"
          label="What health conditions do you have?"
          hint="For example high blood pressure, diabetes or asthma. Your pharmacist needs this to check your medicines suit you."
          errors={fieldErrors(state, 'conditions')}
        >
          {(aria) => (
            <Textarea
              {...aria}
              name="conditions"
              defaultValue={answers.conditions === 'dont_know' ? '' : (answers.conditions ?? '')}
            />
          )}
        </FormField>
        <CheckboxField
          id="conditionsDontKnow"
          name="conditionsDontKnow"
          label="I don't know"
          defaultChecked={answers.conditions === 'dont_know'}
        />
        <FormField
          id="allergies"
          label="Do you have any allergies to medicines?"
          hint="Tell us what happened if you can. Write 'none' if you have none."
          errors={fieldErrors(state, 'allergies')}
        >
          {(aria) => (
            <Textarea
              {...aria}
              name="allergies"
              defaultValue={answers.allergies === 'dont_know' ? '' : (answers.allergies ?? '')}
            />
          )}
        </FormField>
        <CheckboxField
          id="allergiesDontKnow"
          name="allergiesDontKnow"
          label="I don't know"
          defaultChecked={answers.allergies === 'dont_know'}
        />
      </StepShell>
    </form>
  );
}

type MedicationValues = { [field: string]: string | string[] | undefined; dontKnow?: string[] };

const MED_FIELDS = [
  ['name', 'Medicine name', 'As written on the box or label, for example Amlodipine'],
  ['strength', 'Strength', 'For example 5mg'],
  ['formulation', 'Form', 'For example tablet, inhaler, cream'],
  ['dose', 'Dose', 'How much you take each time'],
  ['frequency', 'How often', 'For example once a day in the morning'],
  ['route', 'How you take it', 'For example by mouth, inhaled, on the skin'],
  ['indication', 'What it is for', 'If you know'],
] as const;

const DK_LABELS: Record<string, string> = {
  strength: 'strength',
  dose: 'dose',
  frequency: 'how often',
  indication: 'what it is for',
};

export function MedicinesStepForm({
  orderId,
  medications,
}: {
  orderId: string;
  medications: MedicationValues[];
}) {
  const [state, action] = useActionState(saveQuestionnaireStepAction, initialFormState);
  const rows: MedicationValues[] =
    medications.length > 0 ? medications : [{ name: '', dontKnow: [] }];
  return (
    <form action={action} noValidate className="space-y-6">
      <input type="hidden" name="medCount" value={rows.length} />
      <StepShell
        orderId={orderId}
        step={2}
        state={state}
        fields={[
          ['medications', 'med_0_name'],
          ...rows.flatMap((_, i) =>
            MED_FIELDS.map(([f]) => [`med_${i}_${f}`, `med_${i}_${f}`] as [string, string]),
          ),
        ]}
      >
        <p className="text-ink-700">
          Include prescribed medicines, ones you buy yourself, vitamins and herbal remedies. If you
          are not sure about something, tick &quot;I don&apos;t know&quot;. Your pharmacist will
          check everything with you: we do not check spellings or doses automatically.
        </p>
        {rows.map((m, i) => (
          <fieldset
            key={i}
            className="space-y-4 rounded-md border border-sand-200 bg-white p-4 sm:p-5"
          >
            <legend className="px-1 text-lg font-semibold">Medicine {i + 1}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {MED_FIELDS.map(([f, label, hint]) => (
                <FormField
                  key={f}
                  id={`med_${i}_${f}`}
                  label={label}
                  hint={hint}
                  errors={fieldErrors(state, `med_${i}_${f}`)}
                >
                  {(aria) => (
                    <Input {...aria} name={`med_${i}_${f}`} defaultValue={(m[f] as string) ?? ''} />
                  )}
                </FormField>
              ))}
            </div>
            <FormField
              id={`med_${i}_notes`}
              label="Anything else about this medicine"
              errors={fieldErrors(state, `med_${i}_notes`)}
            >
              {(aria) => (
                <Textarea
                  {...aria}
                  name={`med_${i}_notes`}
                  defaultValue={(m.notes as string) ?? ''}
                  className="min-h-20"
                />
              )}
            </FormField>
            <fieldset>
              <legend className="mb-2 font-semibold">I don&apos;t know the…</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {MEDICATION_DONT_KNOW_FIELDS.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`med_${i}_dk_${f}`}
                      name={`med_${i}_dk_${f}`}
                      defaultChecked={m.dontKnow?.includes(f)}
                      className="size-6 accent-teal-700"
                    />
                    <label htmlFor={`med_${i}_dk_${f}`}>{DK_LABELS[f]}</label>
                  </div>
                ))}
              </div>
            </fieldset>
            {rows.length > 1 ? (
              <IntentButton intent={`remove-${i}`} variant="ghost">
                {`Remove medicine ${i + 1}`}
              </IntentButton>
            ) : null}
          </fieldset>
        ))}
        <IntentButton intent="add" variant="secondary">
          Add another medicine
        </IntentButton>
      </StepShell>
    </form>
  );
}

export function ConcernsStepForm({
  orderId,
  answers,
}: {
  orderId: string;
  answers: Record<string, string>;
}) {
  const [state, action] = useActionState(saveQuestionnaireStepAction, initialFormState);
  const v = (state.status === 'error' && state.values) || answers;
  const methodErrors = fieldErrors(state, 'consultationMethod');
  return (
    <form action={action} noValidate className="space-y-6">
      <StepShell
        orderId={orderId}
        step={3}
        state={state}
        fields={[
          ['mainConcern', 'mainConcern'],
          ['consultationMethod', 'method-telephone'],
        ]}
      >
        <FormField
          id="mainConcern"
          label="What is your main question or concern about your medicines?"
          hint="This helps your pharmacist focus the review on what matters to you."
          errors={fieldErrors(state, 'mainConcern')}
        >
          {(aria) => <Textarea {...aria} name="mainConcern" defaultValue={v.mainConcern ?? ''} />}
        </FormField>
        <FormField
          id="goals"
          label="What would you like to get from the review? (optional)"
          errors={fieldErrors(state, 'goals')}
        >
          {(aria) => <Textarea {...aria} name="goals" defaultValue={v.goals ?? ''} />}
        </FormField>
        <fieldset
          aria-describedby={methodErrors ? 'method-error' : undefined}
          className={cn('space-y-3', methodErrors && 'border-l-4 border-danger-700 pl-3')}
        >
          <legend className="font-semibold">How would you like to speak to the pharmacist?</legend>
          {methodErrors ? (
            <p id="method-error" className="text-sm font-semibold text-danger-700">
              <span className="sr-only">Error: </span>
              {methodErrors.join('. ')}
            </p>
          ) : null}
          {(
            [
              ['telephone', 'Telephone'],
              ['secure_video', 'Secure video call'],
              ['no_preference', 'No preference'],
            ] as const
          ).map(([value, label]) => (
            <div key={value} className="flex items-center gap-3">
              <input
                type="radio"
                id={`method-${value}`}
                name="consultationMethod"
                value={value}
                defaultChecked={v.consultationMethod === value}
                className="size-7 accent-teal-700"
              />
              <Label htmlFor={`method-${value}`} className="font-normal">
                {label}
              </Label>
            </div>
          ))}
        </fieldset>
      </StepShell>
    </form>
  );
}

export function SubmitQuestionnaireForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(submitQuestionnaireAction, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <FormFeedback state={state} fields={[]} />
      <SubmitButton pendingText="Sending…">Send to pharmacist</SubmitButton>
    </form>
  );
}

export function UploadForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(uploadDocumentAction, initialFormState);
  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="orderId" value={orderId} />
      <FormFeedback state={state} fields={[['file', 'file']]} />
      <FormField
        id="file"
        label="Choose a file"
        hint="PDF, JPG or PNG, up to 10MB."
        errors={fieldErrors(state, 'file')}
      >
        {(aria) => (
          <input
            {...aria}
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="block w-full text-base file:mr-4 file:min-h-12 file:rounded-md file:border-2 file:border-teal-700 file:bg-white file:px-4 file:font-semibold file:text-teal-800"
          />
        )}
      </FormField>
      <SubmitButton pendingText="Uploading…">Upload file</SubmitButton>
    </form>
  );
}

export function DeletionRequestForm() {
  const [state, action] = useActionState(requestDeletionAction, initialFormState);
  return (
    <form action={action} className="space-y-4">
      <FormFeedback state={state} fields={[]} />
      {state.status === 'success' ? null : (
        <Button type="submit" variant="danger">
          Request account deletion
        </Button>
      )}
    </form>
  );
}
