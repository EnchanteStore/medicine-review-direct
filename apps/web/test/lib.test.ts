import { describe, expect, it } from 'vitest';
import { composeIsoDate, splitIsoDate } from '@/lib/date-fields';
import { createMemoryRateLimiter } from '@/lib/rate-limit';
import { safeNextPath } from '@/lib/safe-redirect';

describe('safeNextPath', () => {
  it.each([
    ['/account', '/account'],
    ['/account/profile?tab=1#x', '/account/profile'],
    ['/account?email=patient@example.test', '/account'],
    ['/staff', '/staff'],
  ])('allows same-origin path %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    'https://evil.example/',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'account',
    '/\tevil',
    '',
    null,
    undefined,
    `/${'a'.repeat(600)}`,
  ])('rejects %s', (input) => {
    expect(safeNextPath(input as string | null | undefined)).toBe('/account');
  });

  it('uses the supplied fallback', () => {
    expect(safeNextPath('//x', '/reset-password')).toBe('/reset-password');
  });
});

describe('createMemoryRateLimiter', () => {
  it('allows up to the limit then blocks until the window resets', () => {
    let t = 0;
    const rl = createMemoryRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    expect(rl.hit('k').allowed).toBe(true);
    expect(rl.hit('k').allowed).toBe(true);
    const blocked = rl.hit('k');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(rl.hit('other').allowed).toBe(true);
    t = 1000;
    expect(rl.hit('k').allowed).toBe(true);
  });

  it('bounds memory use', () => {
    const rl = createMemoryRateLimiter({ limit: 1, windowMs: 1000, now: () => 0, maxKeys: 3 });
    for (let i = 0; i < 10; i++) rl.hit(`k${i}`);
    expect(rl.hit('k9').allowed).toBe(false);
  });
});

describe('date fields', () => {
  it('composes and pads', () => {
    expect(composeIsoDate('7', '3', '1956')).toBe('1956-03-07');
    expect(composeIsoDate(' ', '', '')).toBe('');
  });

  it('splits ISO dates for display', () => {
    expect(splitIsoDate('1956-03-07')).toEqual({ day: '7', month: '3', year: '1956' });
    expect(splitIsoDate(null)).toEqual({ day: '', month: '', year: '' });
  });
});
