import { renderToString } from 'react-dom/server';
import { App } from './app';
import { content } from './i18n';
import { type Locale, locales, type PageKey, pageKeys, pathOf } from './site';

/** Eine Seite in einer Sprache als HTML, mit Titel und Beschreibung für den Kopf */
export function render(page: PageKey, locale: Locale) {
  const text = content[locale];
  return {
    html: renderToString(<App page={page} locale={locale} />),
    title: text.meta.titles[page],
    description: text.meta.description,
    lang: locale,
    alternates: locales.map((other) => ({ locale: other, path: pathOf(page, other) })),
  };
}

export const routes = pageKeys.flatMap((page) =>
  locales.map((locale) => ({ page, locale, path: pathOf(page, locale) })),
);
