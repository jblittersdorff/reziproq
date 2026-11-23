import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Eingeklappter Bereich (UX-20 `Collapsible`, Designsprache 2): weiße Zeile 52 px mit Titel und
 * Pfeil, der beim Öffnen dreht. Für Leitfragen, Hilfen, Herleitung, Verlauf, Protokoll und
 * „Wer sieht was“. Beim Laden eingeklappt; öffnet mit Klick und Tastatur (`<details>`).
 */
function Collapsible({
  title,
  defaultOpen = false,
  className,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      data-slot="collapsible"
      open={defaultOpen || undefined}
      className={cn('group rounded-md bg-card', className)}
    >
      <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-4 font-medium text-base text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-input-border transition-transform group-open:rotate-90"
        />
      </summary>
      <div className="flex flex-col gap-3 px-4 pt-1 pb-4 text-base">{children}</div>
    </details>
  );
}

export { Collapsible };
