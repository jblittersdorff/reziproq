import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// AK-01, BZ-01 (K2-c.7b): Inventar Kapitel 2 in docs/inventar.md. Jede Zeile hat einen Test, der ihre
// Information am neuen Ort prüft und die ID im Namen trägt, oder sie folgt mit dem genannten Paket.

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const self = fileURLToPath(import.meta.url);

/** Zeilen, deren neuer Ort erst mit einem späteren Paket entsteht */
const later: Record<string, string> = {
  'T2-I15': 'K2-e', // Entwurf „Runde vorschlagen“, „Wie die Runde entstand“
  'T2-I16': 'K2-e', // Bewertungsrunde in der Linse Segmente, Nachnominieren
  'T2-I17': 'K2-e', // Bewertung in Kurz prüfen
  'T2-I18': 'K2-e', // Segment-Mappe
  'T2-I28': 'K2-f', // Entwurf „Welle vorbereitet“ in Kurz prüfen
  'T2-I29': 'K2-f', // Feedback als Objekt
};

function inventoryRows(): string[] {
  const doc = readFileSync(join(root, 'docs/inventar.md'), 'utf8');
  return [...doc.matchAll(/^\| (T2-I\d{2}) \|/gm)].map((match) => match[1] ?? '');
}

function testFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return testFiles(path);
    return /\.(test|spec)\.tsx?$/.test(name) && path !== self ? [path] : [];
  });
}

/** Inventar-IDs in Namen von Tests (it, test, describe) der App, ihrer E2E-Tests und der API */
function namedRows(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of ['apps/web/src', 'apps/web/e2e', 'apps/api/src'].flatMap((dir) =>
    testFiles(join(root, dir)),
  )) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\b(?:it|test|describe)(?:\.\w+)?\(\s*(['"`])(.*?)\1/g)) {
      for (const id of match[2]?.match(/T2-I\d{2}/g) ?? []) {
        found.set(id, [...(found.get(id) ?? []), relative(root, file)]);
      }
    }
  }
  return found;
}

describe('Inventar Kapitel 2 (AK-01, BZ-01)', () => {
  const rows = inventoryRows();
  const named = namedRows();

  it('docs/inventar.md führt die dreißig Zeilen des Kapitels', () => {
    expect(rows).toEqual(
      Array.from({ length: 30 }, (_, index) => `T2-I${String(index + 1).padStart(2, '0')}`),
    );
  });

  it('jede Zeile hat einen Test mit ihrer ID im Namen oder folgt mit ihrem Paket', () => {
    expect(rows.filter((id) => !named.has(id) && !later[id])).toEqual([]);
  });

  it('was schon einen Test hat, steht nicht mehr unter den folgenden Zeilen', () => {
    expect(Object.keys(later).filter((id) => named.has(id))).toEqual([]);
  });
});
