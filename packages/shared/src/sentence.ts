import { z } from 'zod';

// G-6, HE-01 Dienst 2: Der Code rechnet, Reziproq formuliert. Ein Satz mit einer Zahl wird nur
// angezeigt, wenn jede Zahl in den Fakten steht; sonst gilt eine Vorlage ohne Zahl. Verglichen wird
// als Ziffernfolge ohne Punkt und Komma, damit „1.250.000“, „1250000“ und „3,5“ zu „3.5“ passen
// (wie der Filter für Suchanfragen in KI-11).

/** Zahl oder Name hinter einem Satz, mit Herkunft (gleich mit SentenceFact in packages/db) */
export const sentenceFactSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  source: z.object({
    objectType: z.string().min(1),
    objectId: z.uuid().optional(),
    label: z.string(),
  }),
});
export type SentenceFact = z.infer<typeof sentenceFactSchema>;

/** Zahlen in einem Text als Ziffernfolgen ohne Trennzeichen */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d.,]*/g) ?? []).map((value) => value.replace(/[.,]/g, ''));
}

/** Jede Zahl im Satz steht in den Fakten. Ein Satz ohne Zahl ist immer belegt. */
export function sentenceBacked(sentence: string, facts: readonly SentenceFact[]): boolean {
  const known = new Set(facts.flatMap((fact) => numbersIn(String(fact.value))));
  return numbersIn(sentence).every((value) => known.has(value));
}

/**
 * Der Satz, wenn jede seiner Zahlen belegt ist; sonst die Vorlage. Eine Vorlage mit Zahl ist ein
 * Fehler im Code und wird nie angezeigt.
 */
export function backedSentence(
  sentence: string | null | undefined,
  facts: readonly SentenceFact[],
  template: string,
): string {
  if (numbersIn(template).length > 0) throw new Error('Vorlage ohne Zahl erwartet');
  return sentence && sentenceBacked(sentence, facts) ? sentence : template;
}
