import type { AiDraft as Draft } from '@reziproq/shared';
import type * as React from 'react';

import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { AiDraftEvidence } from './ai-draft-evidence';
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
  evidence,
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
  evidence?: { draft: Draft; relationshipId: string };
  confirmed?: boolean;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useT().draftEvidence;
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
      {confirmed && evidence?.draft.decidedBy && (
        <p className="text-muted-foreground text-sm">{t.decidedBy(evidence.draft.decidedBy)}</p>
      )}
      {evidence?.draft.claims ? (
        <AiDraftEvidence claims={evidence.draft.claims} relationshipId={evidence.relationshipId} />
      ) : (
        sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-muted-foreground text-sm">{sourcesLabel}</span>
            {sources.map((source) => (
              <SourcePill key={source.key} source={source} />
            ))}
          </div>
        )
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
