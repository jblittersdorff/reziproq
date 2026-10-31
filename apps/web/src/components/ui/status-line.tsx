import { CircleCheckIcon } from 'lucide-react';
import { useEffect } from 'react';

/** Wie lange die Rückmeldezeile stehen bleibt, bevor sie verschwindet. */
export const statusLineDurationMs = 4000;

/**
 * Rückmeldezeile (NAV-04): ruhige Zeile oben im Seitenfluss nach dem Speichern, kein Toast.
 * Sie verschwindet nach kurzer Zeit; bei „Bewegung reduzieren“ ohne Animation.
 */
function StatusLine({
  message,
  onHidden,
  durationMs = statusLineDurationMs,
}: {
  message: string;
  /** Wird nach Ablauf gerufen; die Seite blendet die Zeile dann aus. */
  onHidden: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onHidden, durationMs);
    return () => window.clearTimeout(timer);
  }, [onHidden, durationMs]);

  return (
    <p
      role="status"
      data-slot="status-line"
      className="flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-success-soft-foreground animate-in fade-in-0 motion-reduce:animate-none"
    >
      <CircleCheckIcon className="size-5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export { StatusLine };
