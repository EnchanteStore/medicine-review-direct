export const SLOT_MINUTES = 30;
export const MAX_RESCHEDULES = 2;
export const RESCHEDULE_NOTICE_MS = 24 * 60 * 60 * 1000;
export const LONDON_TIME_ZONE = 'Europe/London';

export function canReschedule(
  appointment: { startsAt: Date; rescheduleCount: number; status: string },
  now: Date,
): boolean {
  return (
    appointment.status === 'booked' &&
    appointment.rescheduleCount < MAX_RESCHEDULES &&
    appointment.startsAt.getTime() - now.getTime() >= RESCHEDULE_NOTICE_MS
  );
}

export function canRequestCancellation(appointment: { status: string }): boolean {
  return appointment.status === 'booked';
}

/** Minutes that Europe/London is ahead of UTC at this instant. */
export function londonOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LONDON_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const hour = get('hour') % 24;
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Converts a London wall-clock time to a UTC instant. */
export function londonWallTimeToUtc(date: string, time: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || !clock) throw new RangeError('Use a date YYYY-MM-DD and a time HH:MM');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const corrected = new Date(guess.getTime() - londonOffsetMinutes(guess) * 60_000);
  // Repeat once so a DST boundary uses the offset of the resulting instant.
  return new Date(guess.getTime() - londonOffsetMinutes(corrected) * 60_000);
}

export function formatLondon(instant: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(instant);
}
