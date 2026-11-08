import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// PLT-11: Alle Texte stehen in der Übersetzungsdatei. Sucht in den Seiten nach Text, der direkt
// im JSX steht statt aus de.ts/en.ts (oder dem Textkatalog des Styleguides) zu kommen.

const src = fileURLToPath(new URL('../', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : [];
  });
}

const rules: [kind: string, pattern: RegExp][] = [
  // >Text< zwischen Tags, mit mindestens zwei Buchstaben
  ['Text im JSX', /(?<!=)>\s*[A-Za-zÄÖÜäöüß][^<>{}]*[A-Za-zÄÖÜäöüß.!?…][^<>{}]*</],
  // Beschriftungen als feste Zeichenkette
  [
    'feste Beschriftung',
    /\b(?:aria-label|placeholder|title|label|alt|description)="[^"]*[A-Za-zÄÖÜäöüß]{2}/,
  ],
];

/** Fundstellen als „Datei:Zeile Art“; Kommentare zählen nicht. */
export function findHardcodedTexts(file: string, text: string): string[] {
  return text.split('\n').flatMap((line, index) => {
    const code = line.replace(/\{\/\*.*?\*\/\}/g, '').replace(/^\s*(\/\/|\*|\/\*).*/, '');
    return rules
      .filter(([, pattern]) => pattern.test(code))
      .map(([kind]) => `${file}:${index + 1} ${kind}`);
  });
}

describe('Alle Texte stehen in der Übersetzungsdatei (PLT-11)', () => {
  it('erkennt feste Texte', () => {
    expect(findHardcodedTexts('a.tsx', '<h1>Einstellungen</h1>')).not.toEqual([]);
    expect(findHardcodedTexts('a.tsx', '<Button aria-label="Menü öffnen" />')).not.toEqual([]);
    expect(findHardcodedTexts('a.tsx', '<h1>{t.settings.title}</h1>')).toEqual([]);
    expect(findHardcodedTexts('a.tsx', '{/* Nur für Admins */}')).toEqual([]);
  });

  it('kein Text der App steht direkt im Code', () => {
    const findings = sourceFiles(src).flatMap((file) =>
      findHardcodedTexts(relative(src, file), readFileSync(file, 'utf8')),
    );
    expect(findings).toEqual([]);
  });
});
