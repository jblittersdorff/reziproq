import { printAssets } from './print-assets.js';

/** Text sicher in HTML einsetzen. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Druck-Layout (QBR-06), Baustein für alle Exporte: A4, Farben, Schriften, Radien nur aus den
 * Tokens. In Schwarz-Weiß lesbar: Text in der Textfarbe, Status immer als Wort, Flächen nur hell,
 * Trennung über Linien statt über Farbe.
 */
const printCss = `
@page { size: A4; margin: 18mm 16mm 20mm; }
* { box-sizing: border-box; }
html { font-family: var(--font-family-sans); color: var(--text); background: var(--card);
  font-size: 10.5pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; }
h1, h2, h3 { font-family: var(--font-family-display); font-weight: 600; margin: 0; text-wrap: balance; }
h1 { font-size: 24pt; line-height: 1.08; letter-spacing: var(--letter-spacing-title-work); }
h2 { font-size: 14pt; letter-spacing: var(--letter-spacing-section); margin: 0 0 6pt; }
h3 { font-size: 11pt; margin: 0 0 4pt; }
p { margin: 0; }
.brand { display: flex; align-items: center; gap: 6pt; font-family: var(--font-family-display);
  font-weight: 600; font-size: 11pt; color: var(--ink); }
.eyebrow { font-weight: 600; color: var(--muted-foreground); font-size: 9.5pt; }
.cover { display: flex; flex-direction: column; gap: 12pt; padding-bottom: 14pt;
  border-bottom: 1.5pt solid var(--ink); margin-bottom: 16pt; }
.facts { display: flex; flex-wrap: wrap; gap: 4pt 18pt; color: var(--muted-strong); }
section { break-inside: avoid-page; margin: 0 0 16pt; }
ul.rows, ol.rows { list-style: none; margin: 0; padding: 0; border-top: 0.75pt solid var(--line); }
.rows li { display: flex; gap: 10pt; justify-content: space-between; padding: 5pt 0;
  border-bottom: 0.75pt solid var(--line); break-inside: avoid; }
.rows li .meta { color: var(--muted-strong); text-align: right; white-space: nowrap; }
ol.agenda { margin: 0; padding-left: 16pt; }
ol.agenda li { padding: 2pt 0; }
.chip { display: inline-block; padding: 1pt 6pt; border-radius: 999px; font-size: 8.5pt;
  font-weight: 600; border: 0.75pt solid var(--muted-strong); color: var(--text); }
.private { border: 1.25pt dashed var(--ring-open); background: var(--line-soft);
  border-radius: var(--corner-md); padding: 10pt 12pt; }
.private .chip { margin-left: 6pt; }
.empty { color: var(--muted-foreground); }
.protocol { white-space: pre-wrap; }
footer { margin-top: 18pt; padding-top: 6pt; border-top: 0.75pt solid var(--line);
  color: var(--muted-foreground); font-size: 8.5pt; }
`;

const brandMark = `<svg width="22" height="16" viewBox="0 0 28 20" fill="none" stroke-width="2" aria-hidden="true">
<path d="M14 3.07A8 8 0 0 1 14 16.93A8 8 0 0 1 14 3.07Z" style="fill: var(--mint)"></path>
<circle cx="10" cy="10" r="8" style="stroke: var(--ink)"></circle>
<circle cx="18" cy="10" r="8" style="stroke: var(--petrol)"></circle></svg>`;

/** Ganzes HTML-Dokument für den Druck; body ist bereits sicheres HTML. */
export function printDocument({
  lang,
  title,
  body,
}: {
  lang: 'de' | 'en';
  title: string;
  body: string;
}): string {
  const { tokensCss, fontsCss } = printAssets();
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${fontsCss}</style>
<style>${tokensCss}</style>
<style>${printCss}</style>
</head>
<body>
<div class="brand">${brandMark}Reziproq</div>
${body}
</body>
</html>`;
}
