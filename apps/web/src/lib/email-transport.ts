export const SES_REGION = 'eu-west-2';

export const SES_ADDRESSES = {
  hello: 'hello@medsinfocus.co.uk',
  support: 'support@medsinfocus.co.uk',
  noreply: 'noreply@medsinfocus.co.uk',
} as const;

const SES_FROM = new Set<string>(Object.values(SES_ADDRESSES));

export interface EmailEnv {
  MAILPIT_URL?: string;
  ENVIRONMENT?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SES_REGION?: string;
  SES_FROM_EMAIL?: string;
  /** Must be the exact string "true" before any SES request is allowed. */
  SES_SEND_ENABLED?: string;
}

export type EmailTransport =
  | { kind: 'mailpit'; url: string }
  | { kind: 'ses'; region: typeof SES_REGION; from: string; send: boolean }
  | { kind: 'none'; reason: 'credentials_absent' | 'region_not_london' | 'from_not_allowed' };

function mailpitIsLocal(url: string | undefined): url is string {
  return Boolean(url && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url));
}

/**
 * Local development uses Mailpit. SES in London is selected only when the
 * access key, secret, region and a named From address are all present.
 * Without those, nothing is sent. SES_SEND_ENABLED must also be true before
 * a request would be made; this preparation does not set that.
 */
export function selectEmailTransport(env: EmailEnv): EmailTransport {
  if (env.ENVIRONMENT === 'development' && mailpitIsLocal(env.MAILPIT_URL)) {
    return { kind: 'mailpit', url: env.MAILPIT_URL };
  }
  const key = env.AWS_ACCESS_KEY_ID?.trim();
  const secret = env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!key || !secret) return { kind: 'none', reason: 'credentials_absent' };
  if (env.AWS_SES_REGION?.trim() !== SES_REGION)
    return { kind: 'none', reason: 'region_not_london' };
  const from = env.SES_FROM_EMAIL?.trim() ?? '';
  if (!SES_FROM.has(from)) return { kind: 'none', reason: 'from_not_allowed' };
  return { kind: 'ses', region: SES_REGION, from, send: env.SES_SEND_ENABLED === 'true' };
}

export function emailWillSend(transport: EmailTransport): boolean {
  if (transport.kind === 'mailpit') return true;
  if (transport.kind === 'ses') return transport.send;
  return false;
}
