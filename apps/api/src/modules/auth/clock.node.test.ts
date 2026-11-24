import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// DM-01, K1-a.2: Alle Dienste und Jobs lesen die Zeit über die Uhr je Mandant (currentTime, in SQL
// app_now). Echtzeit für Technik heißt ausdrücklich systemTime bzw. app_system_now. Der Test
// verbietet jedes andere Lesen der Systemuhr in apps/api/src/modules und apps/api/src/common.
// performance.now() misst Laufzeiten und liest keine Uhrzeit; es bleibt erlaubt.

const src = fileURLToPath(new URL('../../', import.meta.url));

const rules: [kind: string, pattern: RegExp][] = [
  ['new Date() ohne Argument', /new Date\(\)/],
  ['Date.now()', /(?<![\w.])Date\.now\(\)/],
  ['now() in SQL', /(?<![\w.])now\(\)/],
  ['current_date oder current_timestamp in SQL', /\b(current_date|current_timestamp)\b/i],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** Fundstellen „Datei:Zeile Art“; Kommentare zählen mit, damit kein Beispiel zur Vorlage wird. */
function clockFindings(files: string[], read: (file: string) => string): string[] {
  return files.flatMap((file) =>
    read(file)
      .split('\n')
      .flatMap((line, index) =>
        rules
          .filter(([, pattern]) => pattern.test(line))
          .map(([kind]) => `${relative(src, file)}:${index + 1} ${kind}`),
      ),
  );
}

describe('Uhr je Mandant (DM-01)', () => {
  it('Kein Dienst und kein Job liest die Systemuhr außerhalb von currentTime und systemTime', () => {
    const files = [...sourceFiles(join(src, 'modules')), ...sourceFiles(join(src, 'common'))];
    expect(files.length).toBeGreaterThan(200);
    expect(clockFindings(files, (file) => readFileSync(file, 'utf8'))).toEqual([]);
  });

  it('Die Prüfung findet jede verbotene Form', () => {
    const lines = [
      'const a = new Date();',
      'const b = Date.now();',
      'sql`update x set at = now()`',
      'sql`where due < current_date`',
      'const c = currentTime(); const d = systemTime(); const e = new Date(value);',
      'sql`set at = app_now()`, performance.now()',
    ];
    const findings = clockFindings([join(src, 'probe.ts')], () => lines.join('\n'));
    expect(findings).toEqual([
      'probe.ts:1 new Date() ohne Argument',
      'probe.ts:2 Date.now()',
      'probe.ts:3 now() in SQL',
      'probe.ts:4 current_date oder current_timestamp in SQL',
    ]);
  });
});
