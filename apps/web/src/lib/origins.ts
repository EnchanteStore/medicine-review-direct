/** Canonical public origin. DNS is not pointed here yet. */
export const PRODUCTION_ORIGIN = 'https://medsinfocus.co.uk';

/** Local development. Not a public host. */
export const DEVELOPMENT_ORIGINS = ['http://127.0.0.1:3000', 'http://localhost:3000'] as const;

/**
 * The only staging host the app will accept, and only when STAGING_SITE_URL
 * is set to it. This does not create a DNS record.
 */
export const STAGING_ORIGIN = 'https://staging.medsinfocus.co.uk';

const PRODUCTION_HOSTS = new Set(['medsinfocus.co.uk', 'www.medsinfocus.co.uk']);

export interface OriginEnv {
  NEXT_PUBLIC_SITE_URL?: string;
  STAGING_SITE_URL?: string;
  [key: string]: string | undefined;
}

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string, env: OriginEnv = {}): boolean {
  if ((DEVELOPMENT_ORIGINS as readonly string[]).includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return false;
    if (url.protocol === 'https:' && PRODUCTION_HOSTS.has(url.hostname)) return true;
    const staging = originOf(env.STAGING_SITE_URL);
    return staging === STAGING_ORIGIN && origin === STAGING_ORIGIN;
  } catch {
    return false;
  }
}

/** Production, the local dev servers, and staging only when it is explicitly configured. */
export function authCallbackAllowlist(env: OriginEnv = {}): string[] {
  const list = [PRODUCTION_ORIGIN, ...DEVELOPMENT_ORIGINS];
  if (originOf(env.STAGING_SITE_URL) === STAGING_ORIGIN) list.push(STAGING_ORIGIN);
  return list;
}

/**
 * Auth emails may return only to /auth/confirm on an allowlisted origin.
 * The URL has no query string, so it cannot carry an email address or any clinical detail.
 */
export function authCallbackUrl(siteUrl: string | undefined, env: OriginEnv = {}): string {
  const origin = originOf(siteUrl);
  const allowed = origin && isAllowedOrigin(origin, env) ? origin : DEVELOPMENT_ORIGINS[0];
  return `${allowed}/auth/confirm`;
}
