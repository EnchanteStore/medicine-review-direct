import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;
// Supabase Auth hashes with bcrypt, which only considers the first 72 bytes.
export const PASSWORD_MAX_LENGTH = 72;

/** Version of the draft terms/privacy notice acknowledged at sign-up. */
export const CURRENT_TERMS_VERSION = 'draft-2026-11';

export const emailSchema = z
  .string({ error: 'Enter your email address' })
  .trim()
  .toLowerCase()
  .min(1, { error: 'Enter your email address' })
  .max(254, { error: 'Email address is too long' })
  .pipe(z.email({ error: 'Enter an email address in the correct format, like name@example.com' }));

export const passwordSchema = z
  .string({ error: 'Enter a password' })
  .min(PASSWORD_MIN_LENGTH, {
    error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  .refine((v) => new TextEncoder().encode(v).length <= PASSWORD_MAX_LENGTH, {
    error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer`,
  })
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), {
    error: 'Password must include at least one letter and one number',
  });

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    confirmAdult: z.literal(true, { error: 'You must confirm you are 18 or over' }),
    acceptTerms: z.literal(true, {
      error: 'You must confirm you have read the terms and privacy notice',
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Enter your password' }).max(PASSWORD_MAX_LENGTH * 4),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
