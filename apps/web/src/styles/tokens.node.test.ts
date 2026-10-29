import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const webRoot = fileURLToPath(new URL('../../', import.meta.url));
const tokensFile = join(webRoot, 'src/styles/tokens.css');

// Diese Dateien dürfen feste Farbwerte enthalten.
const allowed = new Set([tokensFile, fileURLToPath(import.meta.url)]);
const skipped = new Set([join(webRoot, 'src/routeTree.gen.ts')]);

const colorPatterns: [string, RegExp][] = [
  ['Hex-Farbe', /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/],
  ['Farbfunktion', /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/],
  [
    'Tailwind-Standardfarbe',
    /\b(?:bg|text|border|fill|stroke|ring|outline|from|via|to|shadow|decoration|divide|caret|placeholder)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/,
  ],
  ['benannte Farbe', /['"`](?:white|black|red|green|blue|gray|grey|yellow|orange)['"`]/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css|html)$/.test(entry.name) ? [path] : [];
  });
}

describe('Farben nur aus den Design-Tokens', () => {
  it('enthält außerhalb von tokens.css keine festen Farbwerte', () => {
    const files = [...sourceFiles(join(webRoot, 'src')), join(webRoot, 'index.html')];
    const findings = files
      .filter((file) => !allowed.has(file) && !skipped.has(file))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((line, index) =>
            colorPatterns
              .filter(([, pattern]) => pattern.test(line))
              .map(([kind]) => `${relative(webRoot, file)}:${index + 1} ${kind}: ${line.trim()}`),
          ),
      );
    expect(findings, 'Farben bitte als Token in src/styles/tokens.css anlegen').toEqual([]);
  });
});

// Kontrast nach WCAG 2.2: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function readTheme(selector: ':root' | '.dark'): Record<string, string> {
  const css = readFileSync(tokensFile, 'utf8');
  const block = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1];
  if (!block) throw new Error(`Block ${selector} fehlt in tokens.css`);
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map((m) => [m[1], m[2]]),
  );
}

// [Vordergrund, Hintergrund] – Text braucht 4,5:1
const textPairs: [string, string][] = [
  ['foreground', 'background'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['primary', 'background'],
  ['primary-foreground', 'primary'],
  ['primary-soft-foreground', 'primary-soft'],
  ['success', 'background'],
  ['warning', 'background'],
  ['destructive', 'background'],
  ['destructive-foreground', 'destructive'],
  ['success-soft-foreground', 'success-soft'],
  ['warning-soft-foreground', 'warning-soft'],
  ['destructive-soft-foreground', 'destructive-soft'],
  ['chart-label', 'background'],
  ['chart-axis', 'background'],
  ['chart-label', 'chart-field'],
  ...[1, 2, 3, 4, 5].map((n): [string, string] => [`chart-seq-label-${n}`, `chart-seq-${n}`]),
];

// Bedienelemente und bedeutungstragende Grafik brauchen 3:1
const graphicPairs: [string, string][] = [
  ['input', 'background'],
  ['ring', 'background'],
  ['chart-accent', 'background'],
  ['chart-buyer', 'background'],
  ['chart-supplier', 'background'],
  ['chart-strong', 'background'],
];

describe.each([':root', '.dark'] as const)('Kontrast nach WCAG AA (%s)', (selector) => {
  const theme = readTheme(selector);

  it.each(textPairs)('Text %s auf %s', (fg, bg) => {
    expect(contrast(theme[fg] ?? '', theme[bg] ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(graphicPairs)('Grafik %s auf %s', (fg, bg) => {
    expect(contrast(theme[fg] ?? '', theme[bg] ?? '')).toBeGreaterThanOrEqual(3);
  });
});
