import type { FieldErrors } from '@mrd/validation';

export type FormState =
  | { status: 'idle' }
  | {
      status: 'error';
      message?: string;
      fieldErrors?: FieldErrors;
      /** Non-sensitive values to re-populate the form. Never includes passwords. */
      values?: Record<string, string>;
      code?: 'email_not_confirmed' | 'rate_limited';
    }
  | { status: 'success'; message: string; values?: Record<string, string> };

export const initialFormState: FormState = { status: 'idle' };

export function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

export function formCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on';
}
