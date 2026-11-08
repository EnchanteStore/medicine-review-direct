export const DEFAULT_AFTER_SIGN_IN = '/account';

/**
 * Returns a same-origin relative path or the fallback. Prevents open redirects
 * via `next=` parameters (e.g. `//evil.example`, `/\evil.example`, `https://...`).
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_SIGN_IN,
): string {
  if (!value || typeof value !== 'string') return fallback;
  if (value.length > 512) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  // Reject control characters, which some browsers strip before resolving the URL.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  try {
    const url = new URL(value, 'http://internal.invalid');
    if (url.origin !== 'http://internal.invalid') return fallback;
    // The next path is a route only. A query or hash could carry an email address
    // or a clinical detail, so neither is kept.
    return url.pathname;
  } catch {
    return fallback;
  }
}
