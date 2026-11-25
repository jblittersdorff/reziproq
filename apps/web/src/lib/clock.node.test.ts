import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// DM-01 (K1-b.4): Die Oberfläche rechnet „heute“ und „jetzt“ mit der Fachzeit (lib/clock.ts,
// appNow), im Demo-Mandanten also mit der Demo-Uhr. Die Systemuhr lesen nur die Uhr selbst und
// Technik mit Grund; jede andere Stelle schlägt hier an.

const src = fileURLToPath(new URL('../', import.meta.url));

/** Ausnahmen mit Grund: Technik, die Echtzeit braucht */
const allowed: Record<string, string> = {
  'lib/clock.ts': 'die Uhr selbst',
  'lib/demo-session.ts': 'Ablauf des Demo-Tokens',
  'features/auth/require-login.tsx': 'Entwurf beim Neuanmelden läuft in Echtzeit ab',
  'features/auth/reauth-notice.tsx': 'Entwurf beim Neuanmelden läuft in Echtzeit ab',
};

const rules: [kind: string, pattern: RegExp][] = [
  ['new Date() ohne Argument', /new Date\(\)/],
  ['Date.now()', /(?<![\w.])Date\.now\(\)/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'testing' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function findings(files: string[], read: (file: string) => string): string[] {
  return files.flatMap((file) => {
    const name = relative(src, file);
    if (allowed[name]) return [];
    return read(file)
      .split('\n')
      .flatMap((line, index) =>
        rules
          .filter(([, pattern]) => pattern.test(line))
          .map(([kind]) => `${name}:${index + 1} ${kind}`),
      );
  });
}

describe('Fachzeit der Oberfläche (DM-01)', () => {
  it('keine Seite liest die Systemuhr außer der Uhr selbst und benannter Technik', () => {
    const files = sourceFiles(src);
    expect(files.length).toBeGreaterThan(200);
    expect(findings(files, (file) => readFileSync(file, 'utf8'))).toEqual([]);
  });

  it('die Prüfung findet jede verbotene Form', () => {
    const lines = ['const a = new Date();', 'const b = Date.now();', 'const c = appNow();'];
    expect(findings([join(src, 'probe.ts')], () => lines.join('\n'))).toEqual([
      'probe.ts:1 new Date() ohne Argument',
      'probe.ts:2 Date.now()',
    ]);
  });
});
