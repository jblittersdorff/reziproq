/**
 * Prüfungen beim Bauen (K2-h; Designsprache, Abschnitt „Prüfungen beim Bauen“):
 *
 * - T-CI1 Farben: Im Build stehen nur Farben der Designsprache, auch mit Deckkraft.
 * - T-CI2 Schriften: Figtree und Outfit kommen als Dateien aus dem eigenen Build; nichts wird von
 *   Google oder einem anderen Dienst geladen.
 * - T-CI3 Ein helles Thema: kein dunkles Thema, kein Farbverlauf, Schatten nur in Tinte.
 *
 * Reine Funktionen über CSS und HTML als Text. Die Tests lesen die Dateien und rufen sie auf:
 * `build-checks.node.test.ts` (Quellen und Gegenproben) und `e2e/t-ci.spec.ts` in App und Website
 * (ausgelieferter Build).
 */

/** Die Schriften der Designsprache; jede andere eigene Schrift ist ein Fund. */
export const brandFonts = ['Figtree', 'Outfit'] as const;

/** Tinte: die einzige Farbe für Schatten (Designsprache, Form) */
const ink = '#0f1b22';

/**
 * Alle Farben der Designsprache: jeder Hex-Wert im Dokument, sechsstellig und klein geschrieben.
 * Schreibweisen mit Deckkraft (`#0f1b2222`) zählen mit ihrer Grundfarbe.
 */
export function paletteOf(markdown: string): Set<string> {
  return new Set(
    [...markdown.matchAll(/#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F])/g)].map(
      (match) => `#${(match[1] ?? '').toLowerCase()}`,
    ),
  );
}

/** `#abc` → `#aabbcc`, `#abcd` → `#aabbccdd`, klein geschrieben */
export function expandHex(hex: string): string {
  const digits = hex.slice(1).toLowerCase();
  return digits.length === 3 || digits.length === 4
    ? `#${[...digits].map((digit) => digit + digit).join('')}`
    : `#${digits}`;
}

/** Farbe der Palette, auch mit Deckkraft; völlig durchsichtig zählt nicht als Farbe. */
export function inPalette(hex: string, palette: ReadonlySet<string>): boolean {
  const full = expandHex(hex);
  if (full.length === 9 && full.endsWith('00')) return true;
  return palette.has(full.slice(0, 7));
}

export interface CssDeclaration {
  /** Nummer des Blocks, damit mehrere `@font-face` getrennt bleiben */
  block: number;
  /** Selektor oder At-Regel des Blocks */
  rule: string;
  property: string;
  value: string;
}

/**
 * Zerlegt CSS in Deklarationen, auch bei verschachtelten Regeln. Bedingungen von `@media` und
 * `@supports` sind keine Deklarationen (Tailwind prüft dort etwa `color-mix(in lab, red, red)`).
 * Kommentare fallen vorher weg; Zeichenketten und Klammern trennen nicht.
 */
export function cssDeclarations(css: string): CssDeclaration[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations: CssDeclaration[] = [];
  const blocks: { id: number; rule: string }[] = [];
  let blockCount = 0;
  let start = 0;
  let depth = 0;
  const add = (end: number) => {
    const block = blocks.at(-1);
    const declaration = text.slice(start, end).trim();
    const colon = declaration.indexOf(':');
    const property = declaration.slice(0, colon).trim().toLowerCase();
    if (!block || colon < 1 || !/^-{0,2}[a-z][\w-]*$/.test(property)) return;
    declarations.push({
      block: block.id,
      rule: block.rule,
      property,
      value: declaration.slice(colon + 1).trim(),
    });
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    // Maskierte Zeichen in Selektoren wie `.content-\[\"\"\]` oder `.w-\[calc\(…\)\]`
    if (char === '\\') index++;
    else if (char === '"' || char === "'") index = closingQuote(text, index);
    else if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth > 0) continue;
    else if (char === '{') {
      blocks.push({ id: blockCount++, rule: text.slice(start, index).trim() });
      start = index + 1;
    } else if (char === ';' || char === '}') {
      add(index);
      if (char === '}') blocks.pop();
      start = index + 1;
    }
  }
  return declarations;
}

function closingQuote(text: string, from: number): number {
  const quote = text[from];
  for (let index = from + 1; index < text.length; index++) {
    if (text[index] === '\\') index++;
    else if (text[index] === quote) return index;
  }
  return text.length;
}

/** Teilt an einem Zeichen außerhalb von Klammern und Zeichenketten. */
export function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '\\') index++;
    else if (char === '"' || char === "'") index = closingQuote(value, index);
    else if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && char === separator) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

const hexPattern = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;

// Alle benannten Farben aus CSS Color 4, ohne transparent und currentcolor
const namedColors =
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen';
const namedPattern = new RegExp(
  `(?<![\\w-])(?:${namedColors.replaceAll(' ', '|')})(?![\\w-])`,
  'gi',
);

// color-mix() mischt Tokens mit durchsichtig (Deckkraft wie `bg-mint/20`); seine Farben prüfen die
// Muster für Hex-Werte und Namen.
const colorFunctionPattern = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;

/** Eigenschaften mit frei gewählten Namen: „tan“ oder „navy“ sind dort keine Farben. */
const identProperties = new Set([
  'animation',
  'animation-name',
  'anchor-name',
  'container',
  'container-name',
  'counter-increment',
  'counter-reset',
  'counter-set',
  'font',
  'font-family',
  'grid-area',
  'grid-column',
  'grid-row',
  'grid-template-areas',
  'list-style',
  'list-style-type',
  'position-anchor',
  'transition',
  'transition-property',
  'view-transition-name',
  'will-change',
]);

/** Wert ohne Zeichenketten und Adressen; Farben in Daten-Adressen (SVG) bleiben lesbar. */
function colorText(value: string): string {
  const dataUris = [
    ...value.matchAll(/url\(\s*(?:"(data:[^"]*)"|'(data:[^']*)'|(data:[^)\s]*))\s*\)/gi),
  ].map((match) => (match[1] ?? match[2] ?? match[3] ?? '').replaceAll('%23', '#'));
  const rest = value
    .replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi, 'url()')
    .replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""');
  return [rest, ...dataUris].join(' ');
}

/** Farben eines CSS-Werts außerhalb der Palette */
function offPalette(value: string, palette: ReadonlySet<string>): string[] {
  const text = colorText(value);
  return [
    ...[...text.matchAll(hexPattern)]
      .map((match) => match[0])
      .filter((hex) => !inPalette(hex, palette)),
    ...[...text.matchAll(namedPattern)].map((match) => match[0]),
    ...[...text.matchAll(colorFunctionPattern)].map((match) => `${match[0]}…)`),
  ];
}

const shorten = (text: string) => (text.length > 90 ? `${text.slice(0, 87)}…` : text);
const where = ({ rule, property, value }: CssDeclaration) =>
  `${shorten(rule)} { ${property}: ${shorten(value)} }`;

/** T-CI1: jede Farbe im CSS stammt aus der Palette der Designsprache. */
export function colorFindings(css: string, palette: ReadonlySet<string>): string[] {
  return cssDeclarations(css).flatMap((declaration) =>
    identProperties.has(declaration.property)
      ? []
      : offPalette(declaration.value, palette).map(
          (color) => `${where(declaration)}: ${color} steht nicht in der Designsprache`,
        ),
  );
}

const fontServices =
  /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|fast\.fonts\.net|cloud\.typography\.com/gi;

/** Adresse auf einem anderen Rechner (mit Schema oder `//`); `data:` und Pfade sind eigene. */
export const isExternal = (url: string) => /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(url.trim());

const unquote = (text: string) => text.trim().replace(/^(["'])(.*)\1$/, '$2');

/** `@import` und Dateien (`url()`) von einem anderen Rechner */
function externalReferences(css: string): string[] {
  const findings: string[] = [];
  for (const match of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)) {
    if (isExternal(match[1] ?? '')) findings.push(`@import von außen: ${match[1]}`);
  }
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)/gi)) {
    if (isExternal(match[1] ?? '')) findings.push(`Datei von außen: ${match[1]}`);
  }
  return findings;
}

/**
 * T-CI2 im CSS: eigene Schriften sind genau Figtree und Outfit, als woff2 aus dem eigenen Build;
 * kein `@import` und keine Datei von außen, kein Schriftendienst.
 */
export function fontFindings(css: string): string[] {
  const findings = [
    ...[...css.matchAll(fontServices)].map((match) => `Schriftendienst ${match[0]}`),
    ...externalReferences(css),
  ];
  const faces = new Map<number, CssDeclaration[]>();
  for (const declaration of cssDeclarations(css)) {
    if (declaration.rule.toLowerCase() !== '@font-face') continue;
    faces.set(declaration.block, [...(faces.get(declaration.block) ?? []), declaration]);
  }
  const families = new Set<string>();
  for (const face of faces.values()) {
    const family = unquote(face.find((entry) => entry.property === 'font-family')?.value ?? '');
    families.add(family);
    if (!(brandFonts as readonly string[]).includes(family)) {
      findings.push(`Schrift ${family || 'ohne Namen'} gehört nicht zur Designsprache`);
    }
    const sources = face.filter((entry) => entry.property === 'src').map((entry) => entry.value);
    const files = sources.flatMap((source) =>
      [...source.matchAll(/url\(\s*["']?([^"')]+)/gi)].map((match) => match[1] ?? ''),
    );
    if (files.length === 0)
      findings.push(`Schrift ${family} ohne eigene Datei (local() reicht nicht)`);
    for (const file of files) {
      if (!/\.woff2(?:[?#].*)?$/i.test(file))
        findings.push(`Schrift ${family}: ${file} ist kein woff2`);
    }
  }
  for (const font of brandFonts) {
    if (!families.has(font)) findings.push(`Schrift ${font} fehlt als eigene Datei (@font-face)`);
  }
  return findings;
}

/**
 * T-CI2 im HTML: Stylesheets, Schriften und Vorverbindungen kommen nicht von außen. Links auf
 * andere Seiten (`alternate`, `canonical`) laden nichts und zählen nicht.
 */
export function htmlFindings(html: string): string[] {
  const findings = [...html.matchAll(fontServices)].map((match) => `Schriftendienst ${match[0]}`);
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1] ?? '';
    const href = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1] ?? '';
    if (/stylesheet|preload|preconnect|dns-prefetch|prefetch/i.test(rel) && isExternal(href)) {
      findings.push(`lädt von außen: ${tag}`);
    }
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    findings.push(...externalReferences(match[1] ?? ''));
  }
  return findings;
}

const lengthPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em)?$/;

/** Unschärfe einer Schattenebene (dritte Länge), 0 ohne Angabe */
function blurOf(layer: string): number {
  const lengths = splitTopLevel(layer, ' ').filter((part) => lengthPattern.test(part));
  return lengths.length >= 3 ? Number.parseFloat(lengths[2] ?? '0') : 0;
}

/** Ebenen eines Schattens; bei `drop-shadow()` der Inhalt der Klammer */
function shadowLayers({ property, value }: CssDeclaration): string[] {
  if (property.includes('shadow') || property.startsWith('--elevation')) {
    return splitTopLevel(value, ',');
  }
  return [...value.matchAll(/drop-shadow\(((?:[^()]|\([^()]*\))*)\)/gi)].map(
    (match) => match[1] ?? '',
  );
}

/** T-CI3: ein helles Thema, kein Farbverlauf, Schatten (mit Unschärfe) nur in Tinte. */
export function themeFindings(css: string): string[] {
  const declarations = cssDeclarations(css);
  const findings = [...css.matchAll(/prefers-color-scheme\s*:\s*dark/gi)].map(
    () => 'dunkles Thema: @media (prefers-color-scheme: dark)',
  );
  const rules = new Set(declarations.map((declaration) => declaration.rule));
  for (const rule of rules) {
    if (/(?:^|[\s,>+~(])\.dark(?![\w-])|\[data-(?:theme|mode)=["']?dark/i.test(rule)) {
      findings.push(`dunkles Thema: ${shorten(rule)}`);
    }
  }
  for (const declaration of declarations) {
    const { property, value } = declaration;
    if (property === 'color-scheme' && /dark/i.test(value))
      findings.push(`dunkles Thema: ${where(declaration)}`);
    if (/light-dark\(/i.test(value)) findings.push(`dunkles Thema: ${where(declaration)}`);
    if (/(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(value)) {
      findings.push(`Farbverlauf: ${where(declaration)}`);
    }
    for (const layer of shadowLayers(declaration)) {
      if (blurOf(layer) === 0) continue;
      const colors = [...colorText(layer).matchAll(hexPattern)].map((match) => expandHex(match[0]));
      const named = [...colorText(layer).matchAll(namedPattern)].map((match) => match[0]);
      const colored = [
        ...colors.filter((hex) => !hex.startsWith(ink) && !/^#[0-9a-f]{6}00$/.test(hex)),
        ...named,
      ];
      for (const color of colored)
        findings.push(`Schatten nicht in Tinte (${color}): ${where(declaration)}`);
    }
  }
  const light = declarations.some(
    ({ rule, property, value }) =>
      property === 'color-scheme' &&
      /^light$/i.test(value.trim()) &&
      rule.split(',').some((selector) => [':root', 'html'].includes(selector.trim())),
  );
  if (!light) findings.push('color-scheme: light fehlt an :root oder html');
  return findings;
}
