import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { readStored, writeStored } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

// Muss zum Skript in index.html passen, das den Modus vor dem ersten Zeichnen setzt.
const storageKey = 'reziproq-theme';
const darkQuery = '(prefers-color-scheme: dark)';

function initialPreference(): ThemePreference {
  const stored = readStored(storageKey);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Vorübergehender Modus einer einzelnen Seite, ohne die Wahl des Nutzers zu ändern. */
  setOverride: (override: ThemePreference | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [override, setOverride] = useState<ThemePreference | null>(null);
  const effective = override ?? preference;

  useEffect(() => {
    const media = window.matchMedia(darkQuery);
    const apply = () => {
      const dark = effective === 'dark' || (effective === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [effective]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    writeStored(storageKey, next);
  };

  return <ThemeContext value={{ preference, setPreference, setOverride }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme braucht einen ThemeProvider');
  return value;
}

/**
 * Modus nur für die aufrufende Seite, z. B. den Umschalter im Styleguide (PLT-10).
 * Wird nicht gespeichert; beim Verlassen der Seite gilt wieder die Wahl des Nutzers.
 * Wirkt auf das ganze Dokument, damit auch Dialoge und Sheets im Portal mitwechseln.
 */
export function usePageTheme(): [ThemePreference, (preference: ThemePreference) => void] {
  const { preference, setOverride } = useTheme();
  // Startet mit der Wahl des Nutzers, damit beim Öffnen nichts umspringt.
  const [pageTheme, setPageTheme] = useState<ThemePreference>(preference);

  useEffect(() => {
    setOverride(pageTheme);
  }, [pageTheme, setOverride]);
  useEffect(() => () => setOverride(null), [setOverride]);

  return [pageTheme, setPageTheme];
}
