import { describe, expect, it } from 'vitest';
import { backedSentence, numbersIn, type SentenceFact, sentenceBacked } from './sentence.js';

// HE-01 Dienst 2, G-6, T1-HE2 und TN-10: Ein Satz mit einer Zahl, die nicht in den Fakten steht,
// wird nie angezeigt; dann gilt die Vorlage ohne Zahl.

const fact = (key: string, value: number | string): SentenceFact => ({
  key,
  value,
  source: { objectType: 'action', label: 'Frist' },
});

describe('Satz mit Zahl (G-6)', () => {
  it('liest Zahlen als Ziffernfolgen ohne Trennzeichen', () => {
    expect(numbersIn('Spend 1.250.000 € bei 3,5 % und 12 Tagen')).toEqual(['1250000', '35', '12']);
    expect(numbersIn('Ohne Zahl.')).toEqual([]);
  });

  it('T1-HE2: Ein Satz ist nur belegt, wenn jede Zahl in den Fakten steht', () => {
    const facts = [fact('overdue_days', 3), fact('spend', 1_250_000), fact('supplier', 'Werk 7')];
    expect(sentenceBacked('Seit 3 Tagen überfällig, Spend 1.250.000 €, Werk 7.', facts)).toBe(true);
    expect(sentenceBacked('Seit 4 Tagen überfällig.', facts)).toBe(false);
    expect(sentenceBacked('Seit 3 Tagen überfällig, 20 % über Plan.', facts)).toBe(false);
    expect(sentenceBacked('Heute fällig.', [])).toBe(true);
  });

  it('TN-10: Ein unbelegter Satz wird durch die Vorlage ohne Zahl ersetzt', () => {
    const template = 'Braucht deine Entscheidung.';
    expect(backedSentence('Seit 99 Tagen überfällig.', [fact('overdue_days', 3)], template)).toBe(
      template,
    );
    expect(backedSentence('Seit 3 Tagen überfällig.', [fact('overdue_days', 3)], template)).toBe(
      'Seit 3 Tagen überfällig.',
    );
    expect(backedSentence(null, [], template)).toBe(template);
  });

  it('Eine Vorlage mit Zahl ist ein Fehler im Code', () => {
    expect(() => backedSentence('Satz', [], 'In 3 Tagen.')).toThrow('Vorlage ohne Zahl');
  });
});
