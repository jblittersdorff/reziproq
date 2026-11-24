import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Kopf einer Seite (NAV-10 Seitenregel 1, Designsprache 2, Vorlagen `Main.dc.html`,
 * `Uebersicht.dc.html`): optional der Zurück-Link darüber, großer Titel (Outfit 700, 36 px, auf
 * dem Telefon 30 px), darunter eine graue Zeile zum Ort; rechts z. B. ein Umschalter oder der
 * Fortschritt. Der Titel nennt die Aufgabe.
 */
function PageTitle({
  title,
  where,
  back,
  aside,
  className,
}: {
  title: React.ReactNode;
  where?: React.ReactNode;
  /** Zurück-Link (BackLink); die Startseiten der vier Hauptpunkte haben keinen */
  back?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header data-slot="page-title" className={cn('flex min-w-0 flex-col gap-1', className)}>
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-balance font-bold font-display text-title-phone tracking-title shell:text-title">
            {title}
          </h1>
          {where && <p className="text-base text-muted-foreground">{where}</p>}
        </div>
        {aside}
      </div>
    </header>
  );
}

export { PageTitle };
