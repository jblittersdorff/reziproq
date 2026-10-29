import { describe, expect, it } from 'vitest';
import { helloQuerySchema } from './hello.js';

describe('helloQuerySchema', () => {
  it('setzt einen Standardnamen', () => {
    expect(helloQuerySchema.parse({})).toEqual({ name: 'Welt' });
  });

  it('lehnt zu lange Namen ab', () => {
    expect(helloQuerySchema.safeParse({ name: 'x'.repeat(51) }).success).toBe(false);
  });
});
