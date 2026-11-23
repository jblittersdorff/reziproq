// WEB-01: Seiten der Website mit ihren Pfaden je Sprache. Englisch ohne Präfix, Deutsch unter /de.

export const locales = ['en', 'de'] as const;
export type Locale = (typeof locales)[number];

export const pages = {
  home: { en: '/', de: '/de/' },
  howItWorks: { en: '/how-it-works', de: '/de/so-funktioniert-es' },
  platform: { en: '/platform', de: '/de/plattform' },
  suppliers: { en: '/suppliers', de: '/de/lieferanten' },
  security: { en: '/security', de: '/de/sicherheit' },
  pricing: { en: '/pricing', de: '/de/preise' },
  pilot: { en: '/pilot', de: '/de/pilot' },
  company: { en: '/company', de: '/de/unternehmen' },
  contact: { en: '/contact', de: '/de/kontakt' },
  login: { en: '/login', de: '/de/anmelden' },
  legal: { en: '/legal', de: '/de/rechtliches' },
} as const satisfies Record<string, Record<Locale, string>>;

export type PageKey = keyof typeof pages;
export const pageKeys = Object.keys(pages) as PageKey[];

export function pathOf(page: PageKey, locale: Locale, hash?: string): string {
  return `${pages[page][locale]}${hash ? `#${hash}` : ''}`;
}

const normalize = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path);

/** Seite und Sprache zu einem Pfad; unbekannt: null */
export function match(pathname: string): { page: PageKey; locale: Locale } | null {
  const wanted = normalize(pathname.replace(/\/index\.html$/, '/'));
  for (const page of pageKeys) {
    for (const locale of locales) {
      if (normalize(pages[page][locale]) === wanted) return { page, locale };
    }
  }
  if (wanted === '/de') return { page: 'home', locale: 'de' };
  return null;
}

/** Adresse der App; im Betrieb z. B. https://app.reziproq.de */
export const appUrl =
  (import.meta.env?.VITE_APP_URL as string | undefined) ?? 'http://localhost:5173';
/** Adresse für Anfragen, solange es keinen Maildienst gibt (Block C) */
export const contactEmail = 'hello@reziproq.de';
