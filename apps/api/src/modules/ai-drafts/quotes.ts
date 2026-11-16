import { maxQuotedWords } from '@reziproq/shared';

const words = (text: string) =>
  text
    .toLocaleLowerCase('de')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);

/**
 * PUL-08: Länge der längsten Wortfolge, die die Ausgabe wörtlich mit einer Quelle teilt
 * (ohne Groß- und Kleinschreibung und Satzzeichen).
 */
export function longestSharedRun(output: string, sources: string[]): number {
  const out = words(output);
  let longest = 0;
  for (const source of sources) {
    const src = words(source);
    // Dynamische Programmierung über gemeinsame Teilfolgen am Stück
    let previous = new Array<number>(src.length + 1).fill(0);
    for (let i = 1; i <= out.length; i += 1) {
      const current = new Array<number>(src.length + 1).fill(0);
      for (let j = 1; j <= src.length; j += 1) {
        if (out[i - 1] === src[j - 1]) {
          current[j] = (previous[j - 1] ?? 0) + 1;
          if ((current[j] ?? 0) > longest) longest = current[j] ?? 0;
        }
      }
      previous = current;
    }
  }
  return longest;
}

/** Mehr als acht Wörter am Stück aus einem Freitext gelten als Zitat. */
export const quotes = (output: string, sources: string[]) =>
  longestSharedRun(output, sources) > maxQuotedWords;
