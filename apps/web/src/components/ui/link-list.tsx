import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';
import { defaultRenderLink, type RenderLink } from './nav-link';

/**
 * Liste von Zeilen auf einer Karte (UMB-05), wie in den Einstellungen auf dem iPhone: Titel links,
 * Stand rechts, Pfeil. Jede Zeile führt zu ihrer Seite.
 */
function LinkList({
  label,
  items,
  renderLink = defaultRenderLink,
  className,
}: {
  /** Name der Liste für Screenreader */
  label: string;
  items: { key: string; href: string; title: React.ReactNode; status?: React.ReactNode }[];
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      data-slot="link-list"
      className={cn('overflow-hidden rounded-xl bg-card', className)}
    >
      {items.map((item) => (
        <li key={item.key} className="border-border border-b last:border-b-0">
          {renderLink({
            href: item.href,
            className:
              'flex min-h-14 items-center gap-4 px-5 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
            children: (
              <>
                <span className="flex-1 font-medium">{item.title}</span>
                {item.status && (
                  <span className="text-right text-muted-foreground text-sm">{item.status}</span>
                )}
                <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </>
            ),
          })}
        </li>
      ))}
    </ul>
  );
}

export { LinkList };
