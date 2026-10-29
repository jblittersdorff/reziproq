import { describe, expect, it } from 'vitest';
import { meResponseSchema } from './me.js';

describe('meResponseSchema', () => {
  it('akzeptiert Name und E-Mail', () => {
    expect(meResponseSchema.parse({ name: 'Ada Lovelace', email: 'ada@example.com' })).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
  });

  it('lehnt fehlende oder ungültige Werte ab', () => {
    expect(meResponseSchema.safeParse({ name: '', email: 'ada@example.com' }).success).toBe(false);
    expect(meResponseSchema.safeParse({ name: 'Ada', email: 'keine-mail' }).success).toBe(false);
    expect(meResponseSchema.safeParse({ name: 'Ada' }).success).toBe(false);
  });
});
