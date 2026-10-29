import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber } from './money';

describe('formatMoney', () => {
  it('formatiert Cent-Beträge je Sprache', () => {
    const money = { amountCents: 1_234_567, currency: 'EUR' };
    expect(formatMoney(money, 'de')).toBe('12.345,67 €');
    expect(formatMoney(money, 'en')).toBe('€12,345.67');
  });

  it('kürzt große Beträge und zeigt auf Wunsch das Vorzeichen', () => {
    expect(
      formatMoney({ amountCents: 90_000_000, currency: 'EUR' }, 'en', {
        compact: true,
        signed: true,
      }),
    ).toBe('+€900k');
  });

  it('lehnt Bruchteile von Cent ab', () => {
    expect(() => formatMoney({ amountCents: 10.5, currency: 'EUR' }, 'de')).toThrow();
  });
});

describe('formatNumber', () => {
  it('nutzt das Dezimalzeichen der Sprache', () => {
    expect(formatNumber(3.25, 'de')).toBe('3,3');
    expect(formatNumber(3.25, 'en')).toBe('3.3');
  });
});
