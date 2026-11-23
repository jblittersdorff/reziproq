import { createContext, type ReactNode, useContext } from 'react';
import { de } from './content/de';
import { type Content, en } from './content/en';
import { type Locale, type PageKey, pathOf } from './site';

export const content: Record<Locale, Content> = { en, de };

interface SiteState {
  locale: Locale;
  page: PageKey;
  text: Content;
  /** Pfad einer Seite in der aktuellen Sprache */
  href: (page: PageKey, hash?: string) => string;
}

const SiteContext = createContext<SiteState | null>(null);

export function SiteProvider({
  locale,
  page,
  children,
}: {
  locale: Locale;
  page: PageKey;
  children: ReactNode;
}) {
  return (
    <SiteContext.Provider
      value={{
        locale,
        page,
        text: content[locale],
        href: (target, hash) => pathOf(target, locale, hash),
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite(): SiteState {
  const state = useContext(SiteContext);
  if (!state) throw new Error('SiteProvider fehlt');
  return state;
}
