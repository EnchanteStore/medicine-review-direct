import { describe, expect, it } from 'vitest';
import { canRequestCancellation, canReschedule, formatLondon, londonWallTimeToUtc } from '../src';

describe('booking rules', () => {
  const starts = new Date('2026-12-10T10:00:00Z');

  it('allows a reschedule more than 24 hours ahead, up to twice', () => {
    const now = new Date('2026-12-08T10:00:00Z');
    expect(canReschedule({ startsAt: starts, rescheduleCount: 0, status: 'booked' }, now)).toBe(
      true,
    );
    expect(canReschedule({ startsAt: starts, rescheduleCount: 2, status: 'booked' }, now)).toBe(
      false,
    );
  });

  it('refuses a reschedule inside 24 hours or after cancellation', () => {
    const now = new Date('2026-12-10T00:00:00Z');
    expect(canReschedule({ startsAt: starts, rescheduleCount: 0, status: 'booked' }, now)).toBe(
      false,
    );
    expect(
      canReschedule(
        { startsAt: starts, rescheduleCount: 0, status: 'cancellation_requested' },
        new Date('2026-12-01T00:00:00Z'),
      ),
    ).toBe(false);
  });

  it('allows a cancellation request only while booked', () => {
    expect(canRequestCancellation({ status: 'booked' })).toBe(true);
    expect(canRequestCancellation({ status: 'cancellation_requested' })).toBe(false);
  });

  it('converts London wall time to UTC in GMT and BST', () => {
    expect(londonWallTimeToUtc('2026-12-01', '10:00').toISOString()).toBe(
      '2026-12-01T10:00:00.000Z',
    );
    expect(londonWallTimeToUtc('2026-07-01', '10:00').toISOString()).toBe(
      '2026-07-01T09:00:00.000Z',
    );
  });

  it('formats an instant in Europe/London', () => {
    expect(formatLondon(new Date('2026-12-01T10:00:00Z'))).toContain('10:00');
    expect(formatLondon(new Date('2026-07-01T09:00:00Z'))).toContain('10:00');
  });
});
