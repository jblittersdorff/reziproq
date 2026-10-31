import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';

import { cn } from '@/lib/utils';

/** Wie lange die Rückmeldezeile stehen bleibt, bevor sie verschwindet. */
export const statusLineDurationMs = 4000;

/**
 * Rückmeldezeile (NAV-04): ruhige Zeile oben im Seitenfluss nach dem Speichern, kein Toast.
 * Sie verschwindet nach kurzer Zeit; bei „Bewegung reduzieren“ ohne Animation.
 *
 * Als Warnung (UMB-02) bleibt sie stehen, bis die Seite sie entfernt, und trägt einen Knopf.
 */
function StatusLine({
  message,
  description,
  action,
  tone = 'success',
  onHidden,
  durationMs = statusLineDurationMs,
}: {
  message: string;
  description?: string;
  action?: ReactNode;
  tone?: 'success' | 'warning';
  /** Wird nach Ablauf gerufen; die Seite blendet die Zeile dann aus. Ohne: Sie bleibt stehen. */
  onHidden?: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!onHidden) return;
    const timer = window.setTimeout(onHidden, durationMs);
    return () => window.clearTimeout(timer);
  }, [onHidden, durationMs]);

  const Icon = tone === 'warning' ? CircleAlertIcon : CircleCheckIcon;

  return (
    <div
      role={tone === 'warning' ? 'alert' : 'status'}
      data-slot="status-line"
      className={cn(
        'flex flex-col gap-3 rounded-lg px-4 py-3 animate-in fade-in-0 motion-reduce:animate-none sm:flex-row sm:items-center',
        tone === 'warning'
          ? 'bg-warning-soft text-warning-soft-foreground'
          : 'bg-success-soft text-success-soft-foreground',
      )}
    >
      <div className="flex flex-1 items-start gap-2">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className={cn(description && 'font-semibold')}>{message}</p>
          {description && <p className="text-sm">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export { StatusLine };
