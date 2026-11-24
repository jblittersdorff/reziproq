import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  brandFonts,
  colorFindings,
  cssDeclarations,
  fontFindings,
  htmlFindings,
  paletteOf,
  themeFindings,
} from '../testing/build-checks.js';

// K2-h, Designsprache „Prüfungen beim Bauen“: T-CI1 bis T-CI3 an den Quellen und mit Gegenproben.
// Den ausgelieferten Build prüft e2e/t-ci.spec.ts in App und Website.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const palette = paletteOf(read('../../../../docs/design/designsprache.md'));
const tokens = read('./tokens.css');
const fonts = read('./fonts.css');
const sources: Record<string, string> = {
  'apps/web/src/styles/tokens.css': tokens,
  'apps/web/src/styles/fonts.css': fonts,
  'apps/web/src/index.css': read('../index.css'),
  'apps/website/src/styles.css': read('../../../website/src/styles.css'),
};
const allSources = Object.values(sources).join('\n');

const hexOf = (text: string) =>
  new Set(
    [...text.matchAll(/#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F])/g)].map(
      (match) => `#${(match[1] ?? '').toLowerCase()}`,
    ),
  );

describe('Zerlegen von CSS', () => {
  it('findet Deklarationen in verschachtelten Regeln, nicht in Bedingungen', () => {
    const css =
      '@supports (color:color-mix(in lab,red,red)){.a{color:var(--ink);&:hover{color:var(--text)}}}';
    expect(cssDeclarations(css).map(({ property, value }) => `${property}:${value}`)).toEqual([
      'color:var(--ink)',
      'color:var(--text)',
    ]);
  });

  it('lässt sich von maskierten Zeichen in Selektoren nicht verwirren', () => {
    const css = '.content-\\[\\"\\"\\]{--tw-content:""}.w-\\[calc\\(100\\%\\)\\]{color:#123456}';
    expect(cssDeclarations(css).map(({ property }) => property)).toEqual(['--tw-content', 'color']);
  });
});

describe('T-CI1 Farben', () => {
  it('die Designsprache hat eine Palette', () => {
    expect(palette.size).toBeGreaterThan(20);
    expect(palette).toContain('#0f1b22');
  });

  it('jede Farbe der Designsprache steht in tokens.css', () => {
    const defined = hexOf(tokens);
    expect([...palette].filter((color) => !defined.has(color))).toEqual([]);
  });

  it('tokens.css enthält keine Farbe außerhalb der Designsprache', () => {
    expect([...hexOf(tokens)].filter((color) => !palette.has(color))).toEqual([]);
  });

  it.each(Object.keys(sources))('%s nutzt nur Farben der Palette', (name) => {
    expect(colorFindings(sources[name] ?? '', palette)).toEqual([]);
  });

  it('erkennt Farben außerhalb der Palette', () => {
    for (const css of [
      '.a{color:#123456}',
      '.a{background-color:red}',
      '.a{color:rgb(0 0 0)}',
      '.a{background:oklch(70% .1 180)}',
      `.a{background-image:url("data:image/svg+xml,%3Csvg fill='%23123456'/%3E")}`,
      '.a{--chart-x:#1d1d1f0f}',
    ]) {
      expect(colorFindings(css, palette), css).not.toEqual([]);
    }
  });

  it('lässt Farben der Palette, Deckkraft, Durchsichtiges und Mischungen von Tokens durch', () => {
    for (const css of [
      '.a{color:#fff}',
      '.a{color:#0000}',
      '.a{box-shadow:0 1px 2px #0f1b2222}',
      '.a{background-color:color-mix(in oklab,var(--mint) 20%,transparent)}',
      '@supports (color:color-mix(in lab,red,red)){.a{color:var(--ink)}}',
      '.a{animation:tan 1s}',
    ]) {
      expect(colorFindings(css, palette), css).toEqual([]);
    }
  });
});

describe('T-CI2 Schriften', () => {
  it('Figtree und Outfit kommen als woff2 aus der App selbst', () => {
    expect(fontFindings(fonts)).toEqual([]);
    const files = [...fonts.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1] ?? '');
    expect(files.length).toBeGreaterThanOrEqual(brandFonts.length);
    for (const file of files) {
      expect(existsSync(fileURLToPath(new URL(`../../public${file}`, import.meta.url))), file).toBe(
        true,
      );
    }
  });

  it('die HTML-Vorlagen von App und Website laden nichts von außen', () => {
    expect(htmlFindings(read('../../index.html'))).toEqual([]);
    expect(htmlFindings(read('../../../website/index.html'))).toEqual([]);
  });

  it('erkennt Schriften von außen, fremde und fehlende Schriften', () => {
    const own =
      '@font-face{font-family:"Figtree";src:url(/fonts/figtree.woff2)}@font-face{font-family:Outfit;src:url(/fonts/outfit.woff2)}';
    for (const css of [
      `@import url("https://fonts.googleapis.com/css2?family=Inter");${own}`,
      `${own}@font-face{font-family:Inter;src:url(/fonts/inter.woff2)}`,
      '@font-face{font-family:Figtree;src:local("Figtree")}@font-face{font-family:Outfit;src:url(/fonts/outfit.woff2)}',
      '@font-face{font-family:Figtree;src:url(https://cdn.example.com/figtree.ttf)}@font-face{font-family:Outfit;src:url(/fonts/outfit.woff2)}',
      '@font-face{font-family:Figtree;src:url(/fonts/figtree.woff2)}',
    ]) {
      expect(fontFindings(css), css).not.toEqual([]);
    }
    expect(fontFindings(own)).toEqual([]);
  });

  it('erkennt Stylesheets und Vorverbindungen von außen, nicht aber Links auf Seiten', () => {
    expect(
      htmlFindings(
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree">',
      ),
    ).not.toEqual([]);
    expect(htmlFindings('<link rel="preconnect" href="https://fonts.gstatic.com">')).not.toEqual(
      [],
    );
    expect(htmlFindings('<style>@import url(//cdn.example.com/a.css);</style>')).not.toEqual([]);
    expect(
      htmlFindings(
        '<link rel="alternate" hreflang="de" href="https://reziproq.de/de/"><link rel="stylesheet" href="/assets/index.css">',
      ),
    ).toEqual([]);
  });
});

describe('T-CI3 Ein helles Thema', () => {
  it('die Quellen haben kein dunkles Thema, keinen Farbverlauf und Schatten nur in Tinte', () => {
    expect(themeFindings(allSources)).toEqual([]);
  });

  it('erkennt dunkles Thema, Farbverlauf und farbige Schatten', () => {
    const light = ':root{color-scheme:light}';
    for (const css of [
      `${light}@media (prefers-color-scheme: dark){:root{--ink:#000}}`,
      `${light}.dark{--ink:#000}`,
      ':root{color-scheme:light dark}',
      `${light}.a{color:light-dark(#fff,#000)}`,
      `${light}.a{background-image:linear-gradient(#fff,#000)}`,
      `${light}.a{box-shadow:0 4px 12px #0b7a6a33}`,
      `${light}.a{filter:drop-shadow(0 2px 4px #4fd1b4)}`,
      '.a{color:var(--ink)}',
    ]) {
      expect(themeFindings(css), css).not.toEqual([]);
    }
  });

  it('lässt Schatten in Tinte und Ränder als Schatten ohne Unschärfe durch', () => {
    expect(
      themeFindings(
        ':root{color-scheme:light;--elevation-md:0 4px 12px #0f1b2214,0 1px 3px #0f1b220a}.a{box-shadow:inset 0 0 0 2px #9fd9c8}.b{--tw-shadow:0 1px 2px var(--tw-shadow-color,#0f1b220f)}',
      ),
    ).toEqual([]);
  });
});
