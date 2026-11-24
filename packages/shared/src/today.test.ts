import { describe, expect, it } from 'vitest';
import { defaultTriageWeight } from './segment.js';
import { euroImpact, impactOf, triageScore, urgencyOf } from './today.js';

// HE-01 Dienst 1: Punktzahl = Wirkung (Euro oder Schwere) × Dringlichkeit (Tage bis Frist) ×
// Segmentgewicht (E-K0-17).

describe('Punktzahl der Triage (HE-01)', () => {
  it('Wirkung in Euro in vier Stufen, Schwere in drei; mit beiden zählt die höhere', () => {
    expect(euroImpact(0)).toBe(1);
    expect(euroImpact(99_999_99)).toBe(1);
    expect(euroImpact(100_000_00)).toBe(2);
    expect(euroImpact(1_000_000_00)).toBe(3);
    expect(euroImpact(10_000_000_00)).toBe(4);
    expect(impactOf({})).toBe(1);
    expect(impactOf({ severity: 'high' })).toBe(3);
    expect(impactOf({ cents: 2_000_000_00, severity: 'low' })).toBe(3);
    expect(impactOf({ cents: 50_000_00, severity: 'medium' })).toBe(2);
  });

  it('Dringlichkeit nach Tagen bis zur Frist', () => {
    const today = '2026-11-24';
    expect(urgencyOf('2026-11-20', today)).toBe(4);
    expect(urgencyOf(today, today)).toBe(3);
    expect(urgencyOf('2026-11-25', today)).toBe(2);
    expect(urgencyOf('2026-12-01', today)).toBe(2);
    expect(urgencyOf('2026-12-02', today)).toBe(1);
    expect(urgencyOf(null, today)).toBe(1);
  });

  it('Segmentgewicht: der strategische Typ zählt doppelt (E-K0-17)', () => {
    expect(defaultTriageWeight({ impactLevel: 3, qualityLevel: 3 })).toBe(2);
    expect(defaultTriageWeight({ impactLevel: 3, qualityLevel: 2 })).toBe(1);
    expect(defaultTriageWeight({ impactLevel: 2, qualityLevel: 2 }, 2)).toBe(2);
    expect(triageScore(2, 4, 2)).toBe(1600);
    expect(triageScore(1, 3, 1.5)).toBe(450);
  });
});
