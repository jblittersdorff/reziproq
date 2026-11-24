import type * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusDotTone = 'success' | 'warning' | 'danger' | 'neutral';

/**
 * Ampelpunkt mit Text (NAV-10 1.1, Lieferantenliste; Vorlage `A-Lieferanten.dc.html`): ein Punkt
 * in der Statusfarbe und immer der Status als Text daneben, nie nur Farbe (Designsprache Regel
 * „Status immer als Text“).
 */
function StatusDot({
  tone,
  label,
  className,
}: {
  tone: StatusDotTone;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      data-slot="status-dot"
      data-tone={tone}
      className={cn('inline-flex shrink-0 items-center gap-1.5 font-semibold', className)}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          tone === 'success' && 'bg-success',
          // Designsprache, Farben: „Ampelpunkt Achtung“ ist amber (nie als Textfarbe)
          tone === 'warning' && 'bg-signal-amber',
          tone === 'danger' && 'bg-destructive',
          tone === 'neutral' && 'bg-ring-open',
        )}
      />
      {label}
    </span>
  );
}

export { StatusDot };
