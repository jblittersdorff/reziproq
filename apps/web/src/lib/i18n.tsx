import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { de, type Messages } from '@/locales/de';
import { en } from '@/locales/en';

export const locales = ['de', 'en'] as const;
export type Locale = (typeof locales)[number];

// Bis zur englischen Oberfläche (PLT-09) startet die App immer auf Deutsch.
// Der Styleguide kann die Sprache trotzdem umschalten, um beide Texte zu prüfen.
function initialLocale(): Locale {
  return 'de';
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => setLocaleState(next);

  return <LocaleContext value={{ locale, setLocale }}>{children}</LocaleContext>;
}

export function useLocale(): LocaleContextValue {
  const value = use(LocaleContext);
  if (!value) throw new Error('useLocale braucht einen LocaleProvider');
  return value;
}

/** Texte je Sprache; die englischen Texte müssen dieselben Schlüssel haben wie die deutschen. */
export function defineMessages<T>(messages: { de: T; en: NoInfer<T> }) {
  return messages;
}

export function useMessages<T>(messages: { de: T; en: T }): T {
  return messages[useLocale().locale];
}

const catalogs = { de, en } satisfies Record<Locale, Messages>;

/** Die Texte der App in der gewählten Sprache, aus src/locales/. */
export function useT(): Messages {
  return catalogs[useLocale().locale];
}
