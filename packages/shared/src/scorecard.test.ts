import { describe, expect, it } from 'vitest';
import { kpiTrack, parseKpiMonth, parseKpiNumber } from './scorecard.js';

// Tests zu docs/specs/JBP-09.md: Stand „auf Kurs“ für beide Richtungen und die Grenzfälle.
const higher = {
  baseline: '80',
  target: '100',
  direction: 'higher' as const,
  startDate: '2027-01-01',
  targetDate: '2027-12-31',
};
const lower = { ...higher, baseline: '100', target: '50', direction: 'lower' as const };
const at = (period: string, value: string) => [{ period, value }];

describe('JBP-09 Stand einer Kennzahl', () => {
  it('ohne Werte gibt es keinen Stand', () => {
    expect(kpiTrack(higher, [])).toBeNull();
  });

  it('höher ist besser: auf der Linie und darüber auf Kurs, bis 10 % dahinter knapp, sonst nicht', () => {
    // Am Start ist die Linie die Basis 80.
    expect(kpiTrack(higher, at('2027-01-01', '80'))).toBe('on_track');
    expect(kpiTrack(higher, at('2027-01-01', '85'))).toBe('on_track');
    // Genau 10 % hinter 80 (72) ist knapp, darunter nicht auf Kurs.
    expect(kpiTrack(higher, at('2027-01-01', '72'))).toBe('close');
    expect(kpiTrack(higher, at('2027-01-01', '71.99'))).toBe('off');
    // Am Zieltermin ist die Linie das Ziel 100.
    expect(kpiTrack(higher, at('2027-12-31', '100'))).toBe('on_track');
    expect(kpiTrack(higher, at('2027-12-31', '90'))).toBe('close');
    expect(kpiTrack(higher, at('2027-12-31', '89'))).toBe('off');
  });

  it('niedriger ist besser: darüber heißt dahinter', () => {
    expect(kpiTrack(lower, at('2027-01-01', '100'))).toBe('on_track');
    expect(kpiTrack(lower, at('2027-01-01', '95'))).toBe('on_track');
    expect(kpiTrack(lower, at('2027-01-01', '110'))).toBe('close');
    expect(kpiTrack(lower, at('2027-01-01', '110.01'))).toBe('off');
    expect(kpiTrack(lower, at('2027-12-31', '55'))).toBe('close');
    expect(kpiTrack(lower, at('2027-12-31', '56'))).toBe('off');
  });

  it('dazwischen zählt die Linie zum Monat des letzten Werts; nach dem Termin das Ziel', () => {
    // Mitte des Jahres liegt die Linie bei rund 90.
    expect(kpiTrack(higher, at('2027-07-01', '90'))).toBe('on_track');
    expect(kpiTrack(higher, at('2027-07-01', '85'))).toBe('close');
    expect(kpiTrack(higher, at('2028-03-01', '95'))).toBe('close');
    // Es zählt der letzte Monat, nicht die Reihenfolge der Eingabe.
    expect(
      kpiTrack(higher, [
        { period: '2027-12-01', value: '99' },
        { period: '2027-02-01', value: '50' },
      ]),
    ).toBe('on_track');
  });

  it('die Toleranz ist einstellbar; ohne Basis gilt der erste Wert', () => {
    expect(kpiTrack(higher, at('2027-01-01', '76'), 4)).toBe('off');
    expect(kpiTrack(higher, at('2027-01-01', '76'), 5)).toBe('close');
    expect(
      kpiTrack({ ...higher, baseline: null }, [
        { period: '2027-01-01', value: '60' },
        { period: '2027-01-01', value: '60' },
      ]),
    ).toBe('on_track');
  });

  it('Monate und Zahlen aus dem Import', () => {
    expect(parseKpiMonth('2027-03')).toBe('2027-03-01');
    expect(parseKpiMonth('03.2027')).toBe('2027-03-01');
    expect(parseKpiMonth('3/2027')).toBe('2027-03-01');
    expect(parseKpiMonth('2027-13')).toBeNull();
    expect(parseKpiMonth('März 2027')).toBeNull();
    expect(parseKpiNumber('97,5')).toBe('97.5');
    expect(parseKpiNumber('1.234,5')).toBeNull();
    expect(parseKpiNumber('abc')).toBeNull();
  });
});
