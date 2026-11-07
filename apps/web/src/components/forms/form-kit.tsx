'use client';

import { Alert, Button, ErrorSummary } from '@mrd/ui';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/form-state';

export function SubmitButton({ children, pendingText }: { children: string; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function fieldErrors(state: FormState, field: string): string[] | undefined {
  return state.status === 'error' ? state.fieldErrors?.[field] : undefined;
}

/**
 * Error summary (field errors in form order, linked to their inputs) plus any
 * form-level message. `fields` maps schema field names to input ids.
 */
export function FormFeedback({
  state,
  fields,
}: {
  state: FormState;
  fields: [field: string, inputId: string][];
}) {
  if (state.status === 'success') {
    return (
      <Alert tone="success" role="status">
        <p>{state.message}</p>
      </Alert>
    );
  }
  if (state.status !== 'error') return null;

  const summary = fields.flatMap(([field, inputId]) =>
    (state.fieldErrors?.[field] ?? []).map((message) => ({ field: inputId, message })),
  );
  return (
    <>
      <ErrorSummary errors={summary} />
      {state.message ? (
        <Alert tone="danger">
          <p>{state.message}</p>
        </Alert>
      ) : null}
    </>
  );
}
