import { applyCategoryLabel, type CategoryLabel, defaultCategoryLabel } from '@reziproq/shared';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  /** WG-01: Bezeichnung der Warengruppe dieser Organisation, z. B. „Werkstoffgruppe“ */
  categoryLabel: CategoryLabel;
  setCategoryLabel: (label: CategoryLabel) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(browserLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Stabil, damit Effekte, die die Sprache setzen, nicht bei jedem Rendern erneut laufen.
  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const [categoryLabel, setLabelState] = useState<CategoryLabel>(defaultCategoryLabel);
  const setCategoryLabel = useCallback(
    (next: CategoryLabel) =>
      setLabelState((current) =>
        current.singular === next.singular && current.plural === next.plural ? current : next,
      ),
    [],
  );
  const value = useMemo(
    () => ({ locale, setLocale, categoryLabel, setCategoryLabel }),
    [locale, setLocale, categoryLabel, setCategoryLabel],
  );

  return <LocaleContext value={value}>{children}</LocaleContext>;
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

/** Ersetzt in allen Texten „Warengruppe(n)“ durch die Bezeichnung; auch in Textfunktionen. */
function labelled<T>(value: T, label: CategoryLabel): T {
  if (typeof value === 'string') return applyCategoryLabel(value, label) as T;
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => labelled(fn(...args), label)) as T;
  }
  if (Array.isArray(value)) return value.map((entry) => labelled(entry, label)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, labelled(entry, label)]),
    ) as T;
  }
  return value;
}

const labelledCache = new WeakMap<object, Map<string, unknown>>();

/** Texte mit der Bezeichnung des Kunden; je Katalog und Bezeichnung nur einmal umgeschrieben. */
function withLabel<T extends object>(messages: T, label: CategoryLabel): T {
  if (
    label.singular === defaultCategoryLabel.singular &&
    label.plural === defaultCategoryLabel.plural
  ) {
    return messages;
  }
  const key = `${label.singular}|${label.plural}`;
  let byLabel = labelledCache.get(messages);
  if (!byLabel) {
    byLabel = new Map();
    labelledCache.set(messages, byLabel);
  }
  if (!byLabel.has(key)) byLabel.set(key, labelled(messages, label));
  return byLabel.get(key) as T;
}

export function useMessages<T>(messages: { de: T; en: T }): T {
  const { locale, categoryLabel } = useLocale();
  const chosen = messages[locale];
  return chosen && typeof chosen === 'object'
    ? withLabel(chosen as T & object, categoryLabel)
    : chosen;
}

const catalogs = { de, en } satisfies Record<Locale, Messages>;

/**
 * Die Texte der App in der gewählten Sprache, aus src/locales/. Mit eigener Bezeichnung der
 * Warengruppe (WG-01) steht überall das Wort des Kunden.
 */
export function useT(): Messages {
  const { locale, categoryLabel } = useLocale();
  return withLabel(catalogs[locale], categoryLabel);
}
