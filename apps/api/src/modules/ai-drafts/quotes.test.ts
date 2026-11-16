import { describe, expect, it } from 'vitest';
import { longestSharedRun, quotes } from './quotes.js';

describe('PUL-08 Prüfung auf Zitate', () => {
  const source =
    'Die Abstimmung bei Änderungen am Bauteil dauert oft mehrere Wochen, das kostet uns Zeit.';

  it('zählt die längste gemeinsame Wortfolge ohne Satzzeichen und Großschreibung', () => {
    expect(longestSharedRun('die abstimmung bei ÄNDERUNGEN, am Bauteil', [source])).toBe(6);
  });

  it('acht Wörter am Stück sind erlaubt, neun gelten als Zitat', () => {
    expect(quotes('Die Abstimmung bei Änderungen am Bauteil dauert oft.', [source])).toBe(false);
    expect(quotes('Die Abstimmung bei Änderungen am Bauteil dauert oft mehrere.', [source])).toBe(
      true,
    );
  });
});
