import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { readStored, writeStored } from './storage';

export const locales = ['de', 'en'] as const;
export type Locale = (typeof locales)[number];

const storageKey = 'reziproq-locale';

function initialLocale(): Locale {
  const stored = readStored(storageKey);
  if (stored === 'de' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
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

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    writeStored(storageKey, next);
  };

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
