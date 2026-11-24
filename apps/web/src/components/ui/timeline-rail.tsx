import type * as React from 'react';
import { cn } from '@/lib/utils';
import { DateCircle } from './date-circle';
import { defaultRenderLink, type RenderLink } from './nav-link';

/** Art eines Eintrags; die Farbe ergänzt den Text, ersetzt ihn nie */
export type TimelineTone = 'meeting' | 'deadline' | 'approval' | 'commitment' | 'risk';

const toneClass: Record<TimelineTone, string> = {
  meeting: 'text-petrol',
  deadline: 'text-warning-soft-foreground',
  approval: 'text-petrol-dark',
  commitment: 'text-warning-soft-foreground',
  risk: 'text-destructive-soft-foreground',
};

export interface TimelineRailItem {
  key: string;
  /** JJJJ-MM-TT */
  date: string;
  /** Art als Text, z. B. „Termin · JBP“ */
  kind: string;
  tone: TimelineTone;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** öffnet das Objekt; ohne Ziel kein Link */
  href?: string;
}

/**
 * Terminschiene (NAV-10 1.1, Vorlage `Uebersicht.dc.html`): Datumskreise auf einer Linie,
 * beginnend mit „Heute“ in Tinte; je Eintrag Art in Farbe und Text, Titel und eine Unterzeile.
 * Ein Klick öffnet das Objekt. Auf dem Telefon scrollt die Schiene seitwärts in ihrem Rahmen.
 */
function TimelineRail({
  label,
  locale,
  today,
  items,
  renderLink = defaultRenderLink,
  className,
}: {
  /** Name der Liste für Screenreader */
  label: string;
  locale: string;
  /** Erster Kreis „Heute“; ohne Angabe fehlt er */
  today?: Omit<TimelineRailItem, 'tone'>;
  items: TimelineRailItem[];
  renderLink?: RenderLink;
  className?: string;
}) {
  const entry = (item: Omit<TimelineRailItem, 'tone'> & { tone?: TimelineTone }, now: boolean) => {
    const content = (
      <>
        <DateCircle date={item.date} locale={locale} next={now} variant="ring" />
        <span
          className={cn(
            'font-semibold text-chip',
            now ? 'text-ink' : item.tone ? toneClass[item.tone] : '',
          )}
        >
          {item.kind}
        </span>
        <b className="font-semibold text-sm leading-snug">{item.title}</b>
        {item.sub && <span className="text-detail text-input-border leading-snug">{item.sub}</span>}
      </>
    );
    const box = 'relative flex flex-col gap-1.5 text-ink no-underline';
    return (
      <li
        key={item.key}
        data-now={now || undefined}
        className="flex min-w-29 shrink-0 grow basis-0 snap-start"
      >
        {item.href ? (
          renderLink({
            href: item.href,
            className: cn(box, 'w-full rounded-nav hover:text-petrol-dark'),
            children: content,
          })
        ) : (
          <span className={box}>{content}</span>
        )}
      </li>
    );
  };
  return (
    <ol
      aria-label={label}
      data-slot="timeline-rail"
      className={cn(
        // Linie durch die Mitte der Kreise (56 px Kreis, 6 px Abstand oben)
        'relative flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-0.5 pt-1.5 pb-1 before:absolute before:inset-x-0 before:top-8 before:h-0.5 before:bg-line',
        className,
      )}
    >
      {today && entry(today, true)}
      {items.map((item) => entry(item, false))}
    </ol>
  );
}

export { TimelineRail };
