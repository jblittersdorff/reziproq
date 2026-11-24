import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { DateCircle } from './date-circle';
import { defaultRenderLink, type RenderLink } from './nav-link';

export type DateListTone = 'neutral' | 'shared' | 'success' | 'warning' | 'danger';

export interface DateListItem {
  key: string;
  /** JJJJ-MM-TT; ohne Datum kein Kreis (z. B. „Wartet auf andere“) */
  date?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Art oder Frist als Chip; Status immer als Text */
  chip?: { label: string; tone: DateListTone };
  href?: string;
}

/**
 * Liste mit Datumskreisen (Vorlage `Main.dc.html`, „Termine und Fristen“, „Wartet auf andere“):
 * Kreis 44 px mit Ring, Titel, graue Unterzeile und rechts ein Chip. Mit Ziel ist die Zeile ein
 * Link, sonst nicht klickbar.
 */
function DateList({
  items,
  locale,
  label,
  renderLink = defaultRenderLink,
  className,
}: {
  items: DateListItem[];
  locale: string;
  /** Name der Liste für Screenreader */
  label?: string;
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      data-slot="date-list"
      className={cn('flex flex-col divide-y divide-row-line', className)}
    >
      {items.map((item) => {
        const content = (
          <>
            {item.date && <DateCircle date={item.date} locale={locale} variant="ring" size="sm" />}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <b className="font-semibold text-ink text-row">{item.title}</b>
              {item.sub && <span className="text-muted-foreground">{item.sub}</span>}
            </span>
            {item.chip && (
              <Badge variant={item.chip.tone} className="shrink-0">
                {item.chip.label}
              </Badge>
            )}
            {item.href && (
              <ChevronRightIcon
                aria-hidden
                className="size-4 shrink-0 self-center text-ring-open"
              />
            )}
          </>
        );
        const row = 'flex min-h-11 items-start gap-3.5 py-3 first:pt-0.5';
        return (
          <li key={item.key}>
            {item.href ? (
              renderLink({
                href: item.href,
                className: cn(row, 'text-ink no-underline hover:text-petrol-dark'),
                children: content,
              })
            ) : (
              <span className={row}>{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export { DateList };
