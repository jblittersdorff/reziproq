import { describe, expect, it } from 'vitest';
import { planYearOf } from './akte.js';

// AK-01 (K2-c.1): Jahr eines Gemeinsamen Plans aus seiner Anlage

describe('Jahr eines Gemeinsamen Plans', () => {
  it('angelegt ab Oktober gilt er fürs Folgejahr, sonst fürs laufende', () => {
    expect(planYearOf('2025-12-05T11:00:00.000Z')).toBe(2026);
    expect(planYearOf('2026-10-01T08:00:00.000Z')).toBe(2027);
    expect(planYearOf('2026-09-30T20:00:00.000Z')).toBe(2026);
    expect(planYearOf('2026-03-15T09:00:00.000Z')).toBe(2026);
  });
});
