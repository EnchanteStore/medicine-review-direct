export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  hit(key: string): RateLimitResult;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window, in-memory limiter. Suitable for a single server process and
 * local development only; production needs a shared store (Postgres or Redis)
 * behind the same interface. Supabase Auth applies its own per-IP limits too.
 */
export function createMemoryRateLimiter(opts: {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
}): RateLimiter {
  const { limit, windowMs, now = Date.now, maxKeys = 10_000 } = opts;
  const windows = new Map<string, Window>();

  return {
    hit(key) {
      const t = now();
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        if (windows.size >= maxKeys) {
          for (const [k, v] of windows) if (v.resetAt <= t) windows.delete(k);
          if (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string);
        }
        w = { count: 0, resetAt: t + windowMs };
        windows.set(key, w);
      }
      w.count += 1;
      const allowed = w.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - w.count),
        retryAfterSeconds: allowed ? 0 : Math.ceil((w.resetAt - t) / 1000),
      };
    },
  };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Per-email limits are strict; per-IP limits are looser because many patients
// can share one IP (households, care homes, mobile networks).
export const authRateLimits = {
  signUp: createMemoryRateLimiter({ limit: 20, windowMs: FIFTEEN_MINUTES }),
  signInPerIp: createMemoryRateLimiter({ limit: 50, windowMs: FIFTEEN_MINUTES }),
  signInPerEmail: createMemoryRateLimiter({ limit: 10, windowMs: FIFTEEN_MINUTES }),
  passwordResetPerIp: createMemoryRateLimiter({ limit: 20, windowMs: FIFTEEN_MINUTES }),
  passwordResetPerEmail: createMemoryRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES }),
  resendVerificationPerIp: createMemoryRateLimiter({ limit: 20, windowMs: FIFTEEN_MINUTES }),
  resendVerificationPerEmail: createMemoryRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES }),
};
