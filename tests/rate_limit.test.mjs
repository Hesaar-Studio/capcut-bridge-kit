import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixedWindowRateLimiter } from '../server_rate_limit.ts';

test('fixed window blocks at the configured limit and resets', () => {
  let now = 1000;
  const limit = createFixedWindowRateLimiter(2, 5000, () => now);
  assert.equal(limit('local').allowed, true);
  assert.equal(limit('local').allowed, true);
  assert.deepEqual(limit('local'), { allowed: false, retryAfterSeconds: 5 });
  assert.equal(limit('other').allowed, true);
  now += 5000;
  assert.equal(limit('local').allowed, true);
});
