import { describe, expect, it } from 'vitest';
import { calculateCycleDeadlines, defaultCycleSettings, offsetCycleDate } from './cycle.js';

describe('ZYK-02 Fristen', () => {
  it('berechnet Standardfristen in Kalenderwochen relativ zum JBP-Termin', () => {
    expect(
      calculateCycleDeadlines('2027-06-30', defaultCycleSettings).map(({ step, dueDate }) => [
        step,
        dueDate,
      ]),
    ).toEqual([
      ['feedback', '2027-05-05'],
      ['touchpoints', '2027-05-19'],
      ['supplierPlan', '2027-06-16'],
      ['jbp', '2027-06-30'],
      ['scorecard', '2027-07-21'],
    ]);
  });

  it('verschiebt alle berechneten Fristen ohne gespeicherte Fristwerte', () => {
    const first = calculateCycleDeadlines('2027-06-30', defaultCycleSettings);
    const shifted = calculateCycleDeadlines('2027-07-14', defaultCycleSettings);

    expect(shifted.map(({ dueDate }) => dueDate)).toEqual(
      first.map(({ dueDate }) => (dueDate ? offsetCycleDate(dueDate, 14) : null)),
    );
  });

  it('behandelt Monats- und Jahreswechsel als Kalenderdaten', () => {
    expect(offsetCycleDate('2028-03-01', -7)).toBe('2028-02-23');
    expect(offsetCycleDate('2027-01-03', -7)).toBe('2026-12-27');
  });
});
