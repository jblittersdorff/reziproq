import type * as React from 'react';

import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';

export interface DraftSource {
  key: string;
  label: string;
  href?: string;
}

/**
 * Entwurf von Reziproq (Designsprache Regel 7): weiß, Rand 2 px gestrichelt Petrol, Zeile
 * „Entwurf von Reziproq“ mit Doppelring, Quellen als graue Pillen, darunter Übernehmen,
 * Anpassen oder Verwerfen. Bestätigt wird der Rand fest.
 */
function AiDraft({
  heading,
  sourcesLabel,
  sources,
  confirmed = false,
  actions,
  className,
  children,
}: {
  /** z. B. „Entwurf von Reziproq · Stand 14.11.2026“ */
  heading: React.ReactNode;
  /** z. B. „Quellen“ */
  sourcesLabel: string;
  sources: DraftSource[];
  confirmed?: boolean;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-slot="ai-draft"
      data-confirmed={confirmed || undefined}
      className={cn(
        'flex flex-col gap-3 rounded-lg border-2 border-petrol bg-card p-5',
        confirmed ? 'border-solid' : 'border-dashed',
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold text-petrol-dark text-sm">
        <BrandMark />
        {heading}
      </p>
      <div className="text-sm leading-relaxed">{children}</div>
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-muted-foreground text-sm">{sourcesLabel}</span>
          {sources.map((source) => (
            <SourcePill key={source.key} source={source} />
          ))}
        </div>
      )}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

/** Quelle als graue Pille; als Link mit unsichtbar erweiterter Klickfläche (44 px). */
function SourcePill({ source }: { source: DraftSource }) {
  const look =
    'relative inline-flex min-h-7 items-center rounded-full bg-line-soft px-2.5 font-semibold text-chip text-muted-strong';
  return source.href ? (
    <a
      href={source.href}
      className={cn(
        look,
        'no-underline outline-none after:absolute after:-inset-y-2 hover:bg-line focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      {source.label}
    </a>
  ) : (
    <span className={look}>{source.label}</span>
  );
}

export { AiDraft, SourcePill };
