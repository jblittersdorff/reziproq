import { describe, expect, it } from 'vitest';
import { moneySchema } from './money.js';

describe('moneySchema', () => {
  it('akzeptiert ganze Cent mit Währung', () => {
    expect(moneySchema.parse({ amountCents: 123_45, currency: 'EUR' })).toEqual({
      amountCents: 12345,
      currency: 'EUR',
    });
  });

  it('lehnt Bruchteile von Cent und ungültige Währungen ab', () => {
    expect(moneySchema.safeParse({ amountCents: 12.5, currency: 'EUR' }).success).toBe(false);
    expect(moneySchema.safeParse({ amountCents: 100, currency: 'euro' }).success).toBe(false);
  });
});
