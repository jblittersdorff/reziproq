import { SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Frag-Zeile (Vorlage K2-Akte-Privat, „Frag Reziproq zu Rheintal, zum Beispiel: …“): weiße Gruppe
 * 56 px mit Lupe und grauem Satz. Öffnet Frag Reziproq mit dem Gegenstand der Seite als Kontext;
 * das ist die erlaubte Überlagerung „Frag Reziproq“ (Regel 6, E-K0-01).
 */
function AskRow({
  label,
  example,
  onAsk,
  className,
}: {
  /** z. B. „Frag Reziproq zu Rheintal Elektronik“ */
  label: string;
  /** z. B. „zum Beispiel: „Was hat Rheintal Elektronik zuletzt zugesagt?““ */
  example?: string;
  onAsk: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-slot="ask-row"
      onClick={onAsk}
      className={cn(
        'flex min-h-14 w-full min-w-0 items-center gap-3 rounded-md bg-card px-4 py-3 text-left text-base text-muted-foreground hover:bg-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <SearchIcon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 text-pretty">{example ? `${label}, ${example}` : label}</span>
    </button>
  );
}

export { AskRow };
