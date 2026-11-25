import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { BrandMark } from './brand-mark';
import { defaultRenderLink, type RenderLink } from './nav-link';

export type SoWhatTone = 'success' | 'danger' | 'warning' | 'neutral';

export interface SoWhatPoint {
  key: string;
  /** Status als Text, z. B. „Überfällig“, „Wartet“, „Gehalten“ */
  status: string;
  tone: SoWhatTone;
  text: React.ReactNode;
  href?: string;
}

/**
 * „Das Wichtigste“ (UX-20 `SoWhat`, Designsprache 2, Vorlage `P-Zusagen.dc.html`): weiße Gruppe
 * direkt unter „Als Nächstes“, Zeile mit Doppelring, eine Aussage mit Zahl, höchstens drei Punkte
 * mit Status-Chip und einem Satz; ein Punkt mit Ziel ist ein Link. Daneben optional eine
 * Diagrammkarte (`aside`); auf dem Telefon untereinander. Heute (Vorlage `Main.dc.html`): Quellen
 * als Chips neben der Zeile mit Doppelring und eigene Zeilen (`children`) statt der Punkte.
 */
function SoWhat({
  heading,
  statement,
  points = [],
  sources = [],
  children,
  aside,
  source,
  action,
  renderLink = defaultRenderLink,
  className,
}: {
  /** z. B. „Das Wichtigste“ */
  heading: string;
  statement: React.ReactNode;
  points?: SoWhatPoint[];
  /** Quellen als Chips neben der Kopfzeile, z. B. „Postfach“, „Zusagen“, „Hinweise“ */
  sources?: string[];
  /** Eigene Zeilen statt der Punkte, z. B. eine RowGroup ohne Label */
  children?: React.ReactNode;
  aside?: React.ReactNode;
  /** Quellzeile unten, z. B. „Quellen: Ergebnisse, Hinweise · Stand 23.11.“ */
  source?: React.ReactNode;
  /** Zweitaktion klein unten, z. B. „Stimmt nicht“ */
  action?: React.ReactNode;
  renderLink?: RenderLink;
  className?: string;
}) {
  if (points.length > 3) throw new Error('SoWhat zeigt höchstens drei Punkte.');
  return (
    <div
      data-slot="so-what"
      className={cn(
        // minmax(0, …): lange Zeilen kürzen sich, statt die Karte über den Rand zu schieben
        'grid grid-cols-[minmax(0,1fr)] gap-5.5',
        aside && 'wide:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]',
        className,
      )}
    >
      <section className="flex min-w-0 flex-col gap-3 rounded-lg bg-card p-5">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-petrol-dark text-sm">
          <BrandMark />
          {heading}
          {sources.map((name) => (
            <Badge key={name} variant="neutral" className="font-normal">
              {name}
            </Badge>
          ))}
        </p>
        <p className="font-display font-semibold text-lg tracking-section">{statement}</p>
        {children}
        {points.length > 0 && (
          <ul className="flex flex-col divide-y divide-row-line">
            {points.map((point) => {
              const content = (
                <>
                  <Badge variant={point.tone} className="shrink-0">
                    {point.status}
                  </Badge>
                  <span className="min-w-0 flex-1 text-base">{point.text}</span>
                  {point.href && (
                    <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-ring-open" />
                  )}
                </>
              );
              const row = 'flex min-h-12 items-center gap-3 py-2';
              return (
                <li key={point.key}>
                  {point.href ? (
                    renderLink({
                      href: point.href,
                      className: cn(row, 'text-text no-underline hover:text-ink'),
                      children: content,
                    })
                  ) : (
                    <span className={row}>{content}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {(source || action) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {source && <p className="text-chip text-input-border">{source}</p>}
            {action}
          </div>
        )}
      </section>
      {aside}
    </div>
  );
}

export { SoWhat };
