import type { z } from 'zod';

export type FieldErrors = Record<string, string[]>;

/** Flattens Zod issues into a field -> messages map suitable for form rendering. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
