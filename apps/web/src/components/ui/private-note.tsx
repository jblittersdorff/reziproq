import { LockIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';

/**
 * Private Fläche der Designsprache (Regel 6, Tabelle „Privat“, Vorlagen K1-Kurz-Pruefen, Erledigt,
 * K1-Mappe): Fläche line-soft, Rand gestrichelt ring-open, Schloss und Titel, optional der Chip
 * „privat“. Für Hinweise und Inhalte, die nur die eigene Seite sieht. `statement` ist die Aussage
 * von „Das Wichtigste“ in Outfit 19 (Vorlage K2-Akte-Privat), wie in `SoWhat`.
 */
function PrivateNote({
  title,
  chip,
  statement,
  label,
  className,
  children,
}: {
  title: React.ReactNode;
  /** z. B. „privat“; ohne Angabe kein Chip */
  chip?: string;
  /** Aussage mit Zahl, z. B. „Rheintal steht im Segment „Strategisch“, 25 Punkte über der Grenze.“ */
  statement?: React.ReactNode;
  /** Name der Fläche für Screenreader, z. B. „Das Wichtigste“ */
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      data-slot="private-note"
      aria-label={label}
      className={cn(
        'flex flex-col gap-3 rounded-lg border-2 border-ring-open border-dashed bg-line-soft p-4',
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold text-muted-strong text-sm">
        <LockIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
        <span className="min-w-0 flex-1">{title}</span>
        {chip && (
          <Badge variant="plain" className="ml-auto">
            {chip}
          </Badge>
        )}
      </p>
      {statement && (
        <p className="text-balance font-display font-semibold text-ink text-lg tracking-section">
          {statement}
        </p>
      )}
      {children && <div className="text-base leading-relaxed">{children}</div>}
    </section>
  );
}

export { PrivateNote };
