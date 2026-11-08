import type * as React from 'react';

import { cn } from '@/lib/utils';
import { defaultRenderLink, type NavItem, type RenderLink } from './nav-link';

const linkClass =
  'relative flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-semibold aria-[current=page]:text-foreground';

// Der aktive Bereich trägt eine Linie unten (Handschrift Bühne).
const activeLine =
  'after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 aria-[current=page]:after:opacity-100';

/**
 * Lokale Leiste eines Lieferanten unter der globalen Leiste (NAV-06): links der Name, in der Mitte die Bereiche, rechts Platz für „Nächster Schritt“.
 * Bleibt beim Scrollen oben stehen und bricht auf schmalen Bildschirmen um.
 */
function LocalBar({
  label,
  name,
  nameIcon,
  nameHref,
  items,
  activeKey,
  action,
  sticky = true,
  renderLink = defaultRenderLink,
  className,
}: {
  label: string;
  name: string;
  /** z. B. das Monogramm des Lieferanten (UMB-05), dekorativ */
  nameIcon?: React.ReactNode;
  nameHref: string;
  items: NavItem[];
  activeKey?: string | undefined;
  /** z. B. der Knopf „Nächster Schritt“ (ZYK-01) */
  action?: React.ReactNode;
  sticky?: boolean;
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <div
      data-slot="local-bar"
      className={cn(
        'z-10 border-border border-b bg-background/90 backdrop-blur',
        sticky && 'sticky top-13',
        className,
      )}
    >
      <nav
        aria-label={label}
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1"
      >
        {renderLink({
          href: nameHref,
          // Schmal: Name in eigener Zeile, darunter brechen die Bereiche nebeneinander um.
          className: cn(
            linkClass,
            'w-full gap-2.5 font-semibold text-base text-foreground sm:w-auto',
          ),
          children: (
            <>
              {nameIcon}
              {name}
            </>
          ),
        })}
        <ul className="flex flex-1 flex-wrap items-center gap-1">
          {items.map((item) => (
            <li key={item.key}>
              {renderLink({
                href: item.href,
                className: cn(linkClass, activeLine),
                'aria-current': item.key === activeKey ? 'page' : undefined,
                children: item.label,
              })}
            </li>
          ))}
        </ul>
        {action}
      </nav>
    </div>
  );
}

export { LocalBar };
