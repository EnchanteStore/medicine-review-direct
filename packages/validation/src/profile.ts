import { z } from 'zod';

export const MIN_AGE_YEARS = 18;
export const MAX_AGE_YEARS = 120;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses YYYY-MM-DD as a calendar date, rejecting impossible dates like 2023-02-30. */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

export function ageInYears(dateOfBirth: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (on.getUTCMonth() === dateOfBirth.getUTCMonth() && on.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Normalises a UK phone number to E.164 (+44...). Returns null if it is not a
 * plausible UK landline or mobile number. Format checks only; ownership is
 * verified separately (planned for Phase 2).
 */
export function normaliseUkPhone(input: string): string | null {
  const compact = input.replace(/[\s()-]/g, '');
  let national: string;
  if (compact.startsWith('+44')) national = compact.slice(3);
  else if (compact.startsWith('0044')) national = compact.slice(4);
  else if (compact.startsWith('0')) national = compact.slice(1);
  else return null;
  if (national.startsWith('0')) national = national.slice(1);
  if (!/^[1-37]\d{8,9}$/.test(national)) return null;
  return `+44${national}`;
}

const nameSchema = (label: string) =>
  z
    .string({ error: `Enter your ${label}` })
    .trim()
    .min(1, { error: `Enter your ${label}` })
    .max(100, {
      error: `${label[0]?.toUpperCase()}${label.slice(1)} must be 100 characters or fewer`,
    })
    .regex(/^[\p{L}\p{M}' .-]+$/u, {
      error: `${label[0]?.toUpperCase()}${label.slice(1)} must only include letters, spaces, hyphens and apostrophes`,
    });

export function createProfileSchema(today: () => Date = () => new Date()) {
  return z.object({
    givenName: nameSchema('first name'),
    familyName: nameSchema('last name'),
    dateOfBirth: z
      .string({ error: 'Enter your date of birth' })
      .trim()
      .superRefine((value, ctx) => {
        const dob = parseIsoDate(value);
        if (!dob) {
          ctx.addIssue({ code: 'custom', message: 'Enter a real date of birth' });
          return;
        }
        const age = ageInYears(dob, today());
        if (dob.getTime() > today().getTime()) {
          ctx.addIssue({ code: 'custom', message: 'Date of birth must be in the past' });
        } else if (age < MIN_AGE_YEARS) {
          ctx.addIssue({
            code: 'custom',
            message: `This service is only for adults aged ${MIN_AGE_YEARS} or over`,
          });
        } else if (age > MAX_AGE_YEARS) {
          ctx.addIssue({ code: 'custom', message: 'Enter a real date of birth' });
        }
      }),
    phoneNumber: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === '') return null;
        const normalised = normaliseUkPhone(v);
        if (!normalised) {
          ctx.addIssue({
            code: 'custom',
            message: 'Enter a UK phone number, like 07700 900 982 or 020 7946 0958',
          });
          return z.NEVER;
        }
        return normalised;
      }),
  });
}

export const profileSchema = createProfileSchema();
export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileData = z.output<typeof profileSchema>;
