import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('erlaubt nach Ablauf einer Minute wieder Anfragen', () => {
    let now = 0;
    const limiter = new RateLimiter({ perMinute: 1, now: () => now });
    expect(limiter.tryAcquire('u')).toBe(true);
    expect(limiter.tryAcquire('u')).toBe(false);
    now = 60_000;
    expect(limiter.tryAcquire('u')).toBe(true);
  });
});
