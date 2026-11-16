import type { Response } from 'express';
import { escapeHtml } from './print-document.js';

// Bausteine der Druckseiten (QBR-06, QS-03): Titelseite, Abschnitt, Zeilenliste, private Fläche,
// Fußzeile und der Versand als Datei. Jede Druckseite setzt sich daraus zusammen.

export type PrintLocale = 'de' | 'en';

const h = escapeHtml;

export function printDateTime(locale: PrintLocale, iso: string): string {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

export function printDate(locale: PrintLocale, iso: string): string {
  return new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

export function cover(eyebrow: string, title: string, facts: string[]): string {
  return `<header class="cover"><p class="eyebrow">${h(eyebrow)}</p><h1>${h(title)}</h1><p class="facts">${facts
    .filter(Boolean)
    .map((fact) => `<span>${h(fact)}</span>`)
    .join('')}</p></header>`;
}

/** Abschnitt; inner ist bereits sicheres HTML. */
export function section(title: string, inner: string, key?: string): string {
  return `<section${key ? ` data-section="${h(key)}"` : ''}><h2>${h(title)}</h2>${inner}</section>`;
}

/** Zeilen mit Titel links und Angaben rechts; Status immer als Wort. */
export function rows(
  items: { title: string; meta: (string | null | undefined)[] }[],
  empty: string,
) {
  if (items.length === 0) return `<p class="empty">${h(empty)}</p>`;
  return `<ul class="rows">${items
    .map(
      (item) =>
        `<li><span>${h(item.title)}</span><span class="meta">${item.meta
          .filter((part): part is string => Boolean(part))
          .map(h)
          .join(' · ')}</span></li>`,
    )
    .join('')}</ul>`;
}

export function paragraph(text: string, empty: string): string {
  return text.trim() ? `<p class="protocol">${h(text)}</p>` : `<p class="empty">${h(empty)}</p>`;
}

/** Private Fläche (Designsprache Regel 6): gestrichelt, mit Kennzeichen „Intern“. */
export function privateSection(title: string, chip: string, inner: string): string {
  return `<section class="private" data-section="internal"><h2>${h(title)}<span class="chip">${h(chip)}</span></h2>${inner}</section>`;
}

export function footer(text: string): string {
  return `<footer>${h(text)}</footer>`;
}

/** PDF als Datei ausliefern, nicht zwischenspeichern. */
export function sendPdf(response: Response, buffer: Buffer, fileName: string): void {
  const safe = fileName.replace(/[\\/:*?"<>|]/g, '-');
  response
    .type('application/pdf')
    .setHeader('Cache-Control', 'no-store')
    .setHeader(
      'Content-Disposition',
      `attachment; filename="${safe.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    )
    .send(buffer);
}

export const footerText = {
  de: (date: string) =>
    `Erzeugt mit Reziproq am ${date}. Enthält nur, was die eigene Seite sehen darf.`,
  en: (date: string) => `Created with Reziproq on ${date}. Contains only what your side may see.`,
};
