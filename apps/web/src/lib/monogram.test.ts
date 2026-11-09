import { describe, expect, it } from 'vitest';
import { monogram } from './monogram';

// Test zu docs/specs/UMB-05.md: Monogramm ohne Rechtsform und ohne „(Demo)“.

describe('Monogramm', () => {
  it.each([
    ['Rheintal Elektronik GmbH (Demo)', 'RE'],
    ['Alpha GmbH', 'AL'],
    ['Silesia Guss Sp. z o.o. (Demo)', 'SG'],
    ['Bajío Fundición S.A. de C.V. (Demo)', 'BF'],
    ['Test-Lieferant (Demo)', 'TE'],
    ['Midwest Molding Inc.', 'MM'],
    ['(Demo)', '?'],
  ])('%s → %s', (name, expected) => {
    expect(monogram(name)).toBe(expected);
  });
});
