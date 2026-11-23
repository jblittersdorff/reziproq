import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// WEB-01: Jede Seite in jeder Sprache als eigene HTML-Datei (statisch auslieferbar).
const root = dirname(fileURLToPath(import.meta.url));
const client = join(root, 'dist/client');
const { render, routes } = await import(join(root, 'dist/server/entry-server.js'));
const template = readFileSync(join(client, 'index.html'), 'utf8');
const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

for (const route of routes) {
  const page = render(route.page, route.locale);
  const alternates = page.alternates
    .map((alt) => `<link rel="alternate" hreflang="${alt.locale}" href="${alt.path}" />`)
    .join('\n    ');
  const html = template
    .replace('<html lang="en">', `<html lang="${page.lang}">`)
    .replace('%TITLE%', escapeHtml(page.title))
    .replace('%DESCRIPTION%', escapeHtml(page.description))
    .replace('<!--alternates-->', alternates)
    .replace('<!--app-->', page.html);
  const target = route.path.endsWith('/')
    ? join(client, route.path, 'index.html')
    : join(client, `${route.path}/index.html`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  // Auch /de/preise ohne Schrägstrich soll die Seite liefern (Server, die .html ergänzen)
  if (!route.path.endsWith('/')) writeFileSync(join(client, `${route.path}.html`), html);
}
console.log(`${routes.length} Seiten vorgerendert.`);
