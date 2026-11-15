import { describe, expect, it } from 'vitest';
import { amountInRange, annualRange, fiscalYearOf, fiscalYearRange } from './impact.js';

// PNL-10: Jahreswirkung und Wirkung im Geschäftsjahr, mit Testdaten für ein Geschäftsjahr ab April.
describe('PNL-10 Zeiträume', () => {
  const values = [
    // Wirkungsbeginn Februar 2026: Plan 100 je Monat Februar 2026 bis Januar 2027.
    ...Array.from({ length: 12 }, (_, index) => {
      const month = ((index + 1) % 12) + 1;
      const year = index < 11 ? 2026 : 2027;
      return {
        month: `${year}-${String(month).padStart(2, '0')}-01`,
        kind: 'plan' as const,
        valueCents: 100,
      };
    }),
    // Ist im März 2026: 150 statt 100.
    { month: '2026-03-01', kind: 'actual' as const, valueCents: 150 },
    // Plan im Februar 2027 liegt außerhalb der Jahreswirkung, aber im Geschäftsjahr 2026/27.
    { month: '2027-02-01', kind: 'plan' as const, valueCents: 100 },
  ];

  it('Geschäftsjahr ab April', () => {
    expect(fiscalYearRange(2026, 4)).toEqual(['2026-04-01', '2027-04-01']);
    expect(fiscalYearOf('2026-03-15', 4)).toBe(2025);
    expect(fiscalYearOf('2026-04-01', 4)).toBe(2026);
  });

  it('Jahreswirkung: zwölf Monate ab Wirkungsbeginn, Ist vor Plan', () => {
    expect(annualRange('2026-02-10')).toEqual(['2026-02-01', '2027-02-01']);
    expect(amountInRange(values, ...annualRange('2026-02-10'))).toBe(11 * 100 + 150);
  });

  it('Wirkung im Geschäftsjahr ab April: nur dessen Monate', () => {
    // April 2026 bis März 2027: April bis Januar Plan (10 × 100) und Februar 2027 (100).
    expect(amountInRange(values, ...fiscalYearRange(2026, 4))).toBe(11 * 100);
    // Geschäftsjahr 2025/26: Februar 2026 Plan 100 und März 2026 Ist 150.
    expect(amountInRange(values, ...fiscalYearRange(2025, 4))).toBe(250);
  });
});
