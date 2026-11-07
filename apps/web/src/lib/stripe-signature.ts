import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Local harness only. This is not a Stripe secret and must not be used for live events. */
export const LOCAL_TEST_WEBHOOK_SECRET = 'whsec_local_test_only';

export function payloadHash(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

/** Stripe's documented scheme: HMAC-SHA256 of `${timestamp}.${payload}`. */
export function signStripePayload(
  secret: string,
  payload: string,
  timestampSeconds: number,
): string {
  const signature = createHmac('sha256', secret)
    .update(`${timestampSeconds}.${payload}`)
    .digest('hex');
  return `t=${timestampSeconds},v1=${signature}`;
}

export function verifyStripeSignature(
  secret: string,
  payload: string,
  header: string | null,
  nowMs: number = Date.now(),
  toleranceSeconds = 300,
): boolean {
  if (!header || !secret) return false;
  const pieces = header.split(',').map((part) => part.trim());
  const timestamp = Number(pieces.find((part) => part.startsWith('t='))?.slice(2));
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return pieces.some((part) => {
    if (!part.startsWith('v1=')) return false;
    const given = part.slice(3);
    if (given.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  });
}
