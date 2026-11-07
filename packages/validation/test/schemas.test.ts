import { describe, expect, it } from 'vitest';
import {
  ageInYears,
  createProfileSchema,
  forgotPasswordSchema,
  normaliseUkPhone,
  parseIsoDate,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
} from '../src';

const validSignUp = {
  email: '  Test.Patient@Example.com ',
  password: 'correct horse 42',
  confirmPassword: 'correct horse 42',
  confirmAdult: true,
  acceptTerms: true,
};

describe('signUpSchema', () => {
  it('accepts valid input and normalises email', () => {
    const r = signUpSchema.parse(validSignUp);
    expect(r.email).toBe('test.patient@example.com');
  });

  it('rejects short passwords', () => {
    const r = signUpSchema.safeParse({
      ...validSignUp,
      password: 'short1',
      confirmPassword: 'short1',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).password?.[0]).toMatch(/at least 12/);
  });

  it('rejects passwords without a number', () => {
    const pw = 'onlylettershere';
    const r = signUpSchema.safeParse({ ...validSignUp, password: pw, confirmPassword: pw });
    expect(r.success).toBe(false);
  });

  it('rejects passwords over 72 bytes', () => {
    const pw = `a1${'x'.repeat(71)}`;
    const r = signUpSchema.safeParse({ ...validSignUp, password: pw, confirmPassword: pw });
    expect(r.success).toBe(false);
  });

  it('rejects mismatched confirmation', () => {
    const r = signUpSchema.safeParse({ ...validSignUp, confirmPassword: 'different pass 42' });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(toFieldErrors(r.error).confirmPassword).toEqual(['Passwords do not match']);
  });

  it('requires adult confirmation and terms acknowledgement', () => {
    const r = signUpSchema.safeParse({ ...validSignUp, confirmAdult: false, acceptTerms: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = toFieldErrors(r.error);
      expect(e.confirmAdult).toBeDefined();
      expect(e.acceptTerms).toBeDefined();
    }
  });

  it('rejects malformed email', () => {
    expect(signUpSchema.safeParse({ ...validSignUp, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('signIn / forgot / reset', () => {
  it('signIn requires a password', () => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('forgot password validates email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });

  it('reset requires matching strong password', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'new password 99',
        confirmPassword: 'new password 99',
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ password: 'new password 99', confirmPassword: 'nope' })
        .success,
    ).toBe(false);
  });
});

describe('dates', () => {
  it('parses valid ISO dates and rejects impossible ones', () => {
    expect(parseIsoDate('1980-02-29')).not.toBeNull();
    expect(parseIsoDate('1981-02-29')).toBeNull();
    expect(parseIsoDate('2020-13-01')).toBeNull();
    expect(parseIsoDate('01/02/1980')).toBeNull();
  });

  it('calculates age around birthdays', () => {
    const dob = parseIsoDate('2000-06-15')!;
    expect(ageInYears(dob, new Date(Date.UTC(2018, 5, 14)))).toBe(17);
    expect(ageInYears(dob, new Date(Date.UTC(2018, 5, 15)))).toBe(18);
  });
});

describe('phone normalisation', () => {
  it.each([
    ['07700 900982', '+447700900982'],
    ['+44 7700 900982', '+447700900982'],
    ['+44 (0)7700 900982', '+447700900982'],
    ['0044 20 7946 0958', '+442079460958'],
    ['020 7946 0958', '+442079460958'],
  ])('%s -> %s', (input, expected) => {
    expect(normaliseUkPhone(input)).toBe(expected);
  });

  it.each(['12345', '+1 202 555 0100', '09001234567', 'abc'])('rejects %s', (input) => {
    expect(normaliseUkPhone(input)).toBeNull();
  });
});

describe('profileSchema', () => {
  const schema = createProfileSchema(() => new Date(Date.UTC(2026, 10, 7)));
  const valid = {
    givenName: 'Ada',
    familyName: "O'Neill-Smith",
    dateOfBirth: '1950-03-01',
    phoneNumber: '07700 900982',
  };

  it('accepts a valid profile and normalises the phone', () => {
    const r = schema.parse(valid);
    expect(r.phoneNumber).toBe('+447700900982');
    expect(r.familyName).toBe("O'Neill-Smith");
  });

  it('allows an empty phone number', () => {
    expect(schema.parse({ ...valid, phoneNumber: '' }).phoneNumber).toBeNull();
  });

  it('rejects under-18s', () => {
    const r = schema.safeParse({ ...valid, dateOfBirth: '2008-11-08' });
    expect(r.success).toBe(false);
    if (!r.success) expect(toFieldErrors(r.error).dateOfBirth?.[0]).toMatch(/18 or over/);
  });

  it('accepts someone turning 18 today', () => {
    expect(schema.safeParse({ ...valid, dateOfBirth: '2008-11-07' }).success).toBe(true);
  });

  it('rejects future and implausible dates', () => {
    expect(schema.safeParse({ ...valid, dateOfBirth: '2030-01-01' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, dateOfBirth: '1890-01-01' }).success).toBe(false);
  });

  it('rejects names with markup or digits', () => {
    expect(schema.safeParse({ ...valid, givenName: '<script>' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, givenName: 'Ada2' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, givenName: '   ' }).success).toBe(false);
  });

  it('accepts accented names', () => {
    expect(schema.safeParse({ ...valid, givenName: 'Zoë', familyName: 'Ní Bhriain' }).success).toBe(
      true,
    );
  });

  it('rejects invalid phone numbers', () => {
    expect(schema.safeParse({ ...valid, phoneNumber: '12345' }).success).toBe(false);
  });
});
