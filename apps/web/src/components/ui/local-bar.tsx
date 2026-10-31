import type * as React from 'react';

import { cn } from '@/lib/utils';
import { defaultRenderLink, type NavItem, type RenderLink } from './nav-link';

const linkClass =
  'flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-medium aria-[current=page]:text-foreground';

/**
 * Lokale Leiste eines Lieferanten unter der globalen Leiste (NAV-06), wie die Produktleiste auf
 * apple.com: links der Name, in der Mitte die Bereiche, rechts Platz für „Nächster Schritt“.
 * Bleibt beim Scrollen oben stehen und bricht auf schmalen Bildschirmen um.
 */
function LocalBar({
  label,
  name,
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
      className={cn('z-10 bg-muted/90 backdrop-blur', sticky && 'sticky top-13', className)}
    >
      <nav
        aria-label={label}
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1"
      >
        {renderLink({
          href: nameHref,
          // Schmal: Name in eigener Zeile, darunter brechen die Bereiche nebeneinander um.
          className: cn(linkClass, 'w-full font-semibold text-base text-foreground sm:w-auto'),
          children: name,
        })}
        <ul className="flex flex-1 flex-wrap items-center gap-1">
          {items.map((item) => (
            <li key={item.key}>
              {renderLink({
                href: item.href,
                className: linkClass,
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
