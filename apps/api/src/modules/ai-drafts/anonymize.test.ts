import { describe, expect, it } from 'vitest';
import { withoutNames } from './anonymize.js';

describe('SEG-11 Namen aus Texten an die KI entfernen', () => {
  it('ersetzt bekannte Namen ganz und in Teilen, auch ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    expect(withoutNames('Laut Anna Berg und berg selbst ist Anna zufrieden.', ['Anna Berg'])).toBe(
      'Laut [Person] und [Person] selbst ist [Person] zufrieden.',
    );
  });

  it('ersetzt Anreden mit Nachnamen, auch unbekannte', () => {
    expect(withoutNames('Herr Müller vom Lieferanten reagiert spät.', [])).toBe(
      '[Person] vom Lieferanten reagiert spät.',
    );
  });

  it('lässt Wörter stehen, die einen Namensteil nur enthalten', () => {
    expect(withoutNames('Bergbau und Annahme', ['Anna Berg'])).toBe('Bergbau und Annahme');
  });
});
