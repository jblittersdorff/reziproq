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
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  useEffect(() => {
    const media = window.matchMedia(darkQuery);
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    writeStored(storageKey, next);
  };

  return <ThemeContext value={{ preference, setPreference }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme braucht einen ThemeProvider');
  return value;
}
