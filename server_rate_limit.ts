export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateWindow {
  count: number;
  resetAt: number;
}

/** Small fixed-window limiter for the single-user, loopback AI API. */
export function createFixedWindowRateLimiter(
  maxRequests: number,
  windowMs: number,
  now: () => number = Date.now,
): (key: string) => RateLimitDecision {
  const windows = new Map<string, RateWindow>();

  return (key: string): RateLimitDecision => {
    const currentTime = now();
    let window = windows.get(key);
    if (!window || currentTime >= window.resetAt) {
      window = { count: 0, resetAt: currentTime + windowMs };
      windows.set(key, window);
    }

    if (window.count >= maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - currentTime) / 1000)),
      };
    }

    window.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  };
}
