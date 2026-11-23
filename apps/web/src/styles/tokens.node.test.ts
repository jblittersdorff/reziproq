import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrast, minimumContrast } from '../lib/contrast.js';
import { graphicPairs, textPairs } from './token-pairs.js';

// Tests zu docs/specs/PLT-10.md: feste Werte nur in der Token-Datei, Kontraste nach WCAG AA.

const webRoot = fileURLToPath(new URL('../../', import.meta.url));
const tokensFile = join(webRoot, 'src/styles/tokens.css');

// Diese Dateien dürfen feste Werte enthalten: die Tokens selbst und Tests mit Beispielfarben.
const allowed = new Set([
  tokensFile,
  fileURLToPath(import.meta.url),
  join(webRoot, 'src/lib/contrast.test.ts'),
]);
const skipped = new Set([join(webRoot, 'src/routeTree.gen.ts')]);

type Rule = [kind: string, pattern: RegExp, appliesTo: RegExp];

const code = /\.tsx?$/;
const any = /\.(tsx?|css|html)$/;

const rules: Rule[] = [
  ['Hex-Farbe', /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/, any],
  ['Farbfunktion', /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/, any],
  [
    'Tailwind-Standardfarbe',
    /\b(?:bg|text|border|fill|stroke|ring|outline|from|via|to|shadow|decoration|divide|caret|placeholder)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/,
    any,
  ],
  ['benannte Farbe', /['"`](?:white|black|red|green|blue|gray|grey|yellow|orange)['"`]/, code],
  // Schriftgrößen und Abstände: Tailwind-Klassen wie text-sm oder px-4 lesen die Tokens.
  ['Tailwind-Wert in eckigen Klammern', /\b[\w-]+-\[-?[\d.]+(?:px|rem|em|pt)\]/, code],
  ['feste Länge im Code', /['"`][^'"`\n]*\b\d+(?:\.\d+)?(?:px|rem|em|pt)\b[^'"`\n]*['"`]/, code],
  [
    'feste Schriftgröße oder fester Abstand im Stil',
    /\b(?:fontSize|lineHeight|padding\w*|margin\w*|gap|rowGap|columnGap)\s*:\s*['"`]?-?\d/,
    code,
  ],
  [
    'feste Schriftgröße oder fester Abstand in CSS',
    /\b(?:font-size|line-height|padding[\w-]*|margin[\w-]*|gap|row-gap|column-gap)\s*:\s*-?[\d.]+(?:px|rem|em|pt)\b/,
    /\.(css|html)$/,
  ],
];

/** Alle Zeilen, die einen festen Wert enthalten, als „Datei:Zeile Art: Inhalt“. */
function findHardcoded(file: string, text: string): string[] {
  return text
    .split('\n')
    .flatMap((line, index) =>
      rules
        .filter(([, pattern, appliesTo]) => appliesTo.test(file) && pattern.test(line))
        .map(([kind]) => `${file}:${index + 1} ${kind}: ${line.trim()}`),
    );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return any.test(entry.name) ? [path] : [];
  });
}

describe('Feste Farben, Schriftgrößen und Abstände nur in der Token-Datei', () => {
  it('Prüfung schlägt bei festen Werten außerhalb der Token-Datei fehl', () => {
    const samples: [file: string, line: string][] = [
      ['a.tsx', '<div className="bg-[#ff0000]" />'],
      ['a.tsx', "const color = 'rgb(0, 0, 0)';"],
      ['a.tsx', '<p className="text-blue-600">'],
      ['a.tsx', "fill: 'white',"],
      ['a.tsx', '<div className="mt-[13px]" />'],
      ['a.tsx', "<div style={{ width: '12px' }} />"],
      ['a.tsx', '<div style={{ padding: 12 }} />'],
      ['a.tsx', 'textStyle: { fontSize: 13 },'],
      ['a.css', '.box { margin-top: 0.75rem; }'],
      ['a.css', 'p { font-size: 13px; }'],
      ['a.css', '.x { color: #333; }'],
    ];
    for (const [file, line] of samples) {
      expect(findHardcoded(file, line), line).not.toEqual([]);
    }
    // Tailwind-Stufen und Tokens sind erlaubt.
    expect(findHardcoded('a.tsx', '<div className="mt-4 gap-3 text-sm" />')).toEqual([]);
    expect(findHardcoded('a.css', '.x { padding: var(--spacing-unit); }')).toEqual([]);
  });

  it('enthält in apps/web außerhalb von tokens.css keine festen Werte', () => {
    const files = [...sourceFiles(join(webRoot, 'src')), join(webRoot, 'index.html')].filter(
      (file) => !allowed.has(file) && !skipped.has(file),
    );
    const findings = files.flatMap((file) =>
      findHardcoded(relative(webRoot, file), readFileSync(file, 'utf8')),
    );
    expect(findings, 'Bitte Tailwind-Stufen oder Tokens aus src/styles/tokens.css nutzen').toEqual(
      [],
    );
  });

  // WEB-01: Die Website nutzt dieselben Tokens; für sie gelten dieselben Regeln.
  it('enthält in apps/website keine festen Werte', () => {
    const siteRoot = join(webRoot, '../website');
    const files = [...sourceFiles(join(siteRoot, 'src')), join(siteRoot, 'index.html')];
    const findings = files.flatMap((file) =>
      findHardcoded(relative(siteRoot, file), readFileSync(file, 'utf8')),
    );
    expect(
      findings,
      'Bitte Tailwind-Stufen oder Tokens aus apps/web/src/styles/tokens.css nutzen',
    ).toEqual([]);
  });
});

function readTheme(selector: ':root'): Record<string, string> {
  const css = readFileSync(tokensFile, 'utf8');
  const block = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1];
  if (!block) throw new Error(`Block ${selector} fehlt in tokens.css`);
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map((m) => [m[1], m[2]]),
  );
}

// Designsprache „Zwei Kreise“: es gibt nur ein helles Thema.
describe('Kontrast nach WCAG AA', () => {
  const theme = readTheme(':root');

  it.each(textPairs)('Text %s auf %s mindestens 4,5:1', (fg, bg) => {
    expect(contrast(theme[fg] ?? '', theme[bg] ?? '')).toBeGreaterThanOrEqual(minimumContrast.text);
  });

  it.each(graphicPairs)('Großer Text und Symbole %s auf %s mindestens 3:1', (fg, bg) => {
    expect(contrast(theme[fg] ?? '', theme[bg] ?? '')).toBeGreaterThanOrEqual(
      minimumContrast.large,
    );
  });

  it('es gibt nur ein helles Thema', () => {
    expect(readFileSync(tokensFile, 'utf8')).not.toMatch(/\.dark\s*\{/);
  });
});

describe('Handschrift Bühne (PLT-10, überarbeitet am 8.11.2026)', () => {
  it('nutzt kein Apple-Blau, sondern Petrol als Akzent', () => {
    const css = readFileSync(tokensFile, 'utf8').toLowerCase();
    for (const appleBlue of ['#0071e3', '#0066cc', '#2997ff']) {
      expect(css).not.toContain(appleBlue);
    }
    expect(readTheme(':root').primary).toBe('#0b7a6a');
  });
});
