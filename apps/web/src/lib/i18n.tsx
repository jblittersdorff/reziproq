import { createContext, type ReactNode, use, useCallback, useEffect, useState } from 'react';
import { de, type Messages } from '@/locales/de';
import { en } from '@/locales/en';

export const locales = ['de', 'en'] as const;
export type Locale = (typeof locales)[number];

/**
 * Sprache des Browsers: die erste aus navigator.languages, die Reziproq kann, sonst Deutsch
 * (PLT-09). Sie gilt vor dem Login und beim ersten Login; danach zählt die gespeicherte Sprache.
 */
export function browserLocale(): Locale {
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages;
  for (const tag of preferred) {
    const language = tag.toLowerCase().split('-')[0];
    const match = locales.find((locale) => locale === language);
    if (match) return match;
  }
  return 'de';
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(browserLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Stabil, damit Effekte, die die Sprache setzen, nicht bei jedem Rendern erneut laufen.
  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);

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
