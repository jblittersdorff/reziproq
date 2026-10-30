import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { PromptDialog } from './prompt-dialog';

const PromptContext = createContext<{ openPrompt: () => void } | null>(null);

/**
 * Macht das Prompt-Fenster auf jeder Seite verfügbar: Cmd+K (Mac) oder Ctrl+K (Windows)
 * öffnet und schließt es, wie Spotlight (PLT-12).
 */
export function PromptProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <PromptContext value={{ openPrompt: () => setOpen(true) }}>
      {children}
      <PromptDialog open={open} onOpenChange={setOpen} />
    </PromptContext>
  );
}

export function usePrompt() {
  const value = use(PromptContext);
  if (!value) throw new Error('usePrompt braucht einen PromptProvider');
  return value;
}
