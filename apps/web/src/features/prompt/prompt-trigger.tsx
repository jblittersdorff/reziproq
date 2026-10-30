import { IconSparkles } from '@tabler/icons-react';
import { useT } from '@/lib/i18n';
import { usePrompt } from './prompt-provider';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

/** Großes Feld auf der Übersicht; es öffnet dasselbe Fenster wie Cmd+K (PLT-12). */
export function PromptTrigger() {
  const t = useT();
  const { openPrompt } = usePrompt();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={openPrompt}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-input bg-background px-4 text-left text-lg text-muted-foreground transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <IconSparkles aria-hidden className="size-6 shrink-0" />
      <span className="flex-1">{t.prompt.placeholder}</span>
      <kbd className="hidden rounded-md bg-muted px-2 py-0.5 font-sans text-sm sm:inline">
        {isMac ? t.prompt.shortcutMac : t.prompt.shortcutOther}
      </kbd>
    </button>
  );
}
