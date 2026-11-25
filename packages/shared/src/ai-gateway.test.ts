import { describe, expect, it } from 'vitest';
import { aiSettingsSchema, centsFromMicrocents, defaultAiSettings } from './ai-gateway.js';

describe('KI-01 Einstellungen KI', () => {
  it('die Startwerte entsprechen der Spec und sind gültig', () => {
    expect(aiSettingsSchema.parse(defaultAiSettings)).toMatchObject({
      publicResearch: false,
      budgetMonthCents: 15_000,
      budgetRunCents: 200,
      maxSteps: 60,
      workers: {},
    });
  });

  it('angefangene Cent zählen, null bleibt null', () => {
    expect(centsFromMicrocents(0)).toBe(0);
    expect(centsFromMicrocents(1)).toBe(1);
    expect(centsFromMicrocents(2_000_000)).toBe(2);
  });
});
