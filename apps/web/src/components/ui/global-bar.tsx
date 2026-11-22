import { MenuIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';
import { defaultRenderLink, type NavItem, type RenderLink } from './nav-link';

// Kopfleiste der Designsprache (Header.dc.html): Grund paper, 68 px, Navigation als Schalter auf
// line-soft, der aktive Punkt weiß mit Schatten.
const linkClass =
  'relative flex min-h-11 items-center rounded-full px-4.5 font-medium text-muted-strong text-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-card aria-[current=page]:font-semibold aria-[current=page]:text-ink aria-[current=page]:shadow-toggle';

/**
 * Globale Leiste oben (PLT-11, NAV-01): links Bildmarke und Name, in der Mitte die
 * Hauptbereiche, rechts Symbole wie Fragen und Profil. Unter der Breite „sidebar“ (Token) zeigt sie
 * nur einen Menüknopf, der auf eine eigene Menüseite führt, kein Overlay.
 */
function GlobalBar({
  label,
  brand,
  brandHref,
  items,
  activeKey,
  actions,
  menuHref,
  menuLabel,
  buyerTabs = false,
  sticky = true,
  renderLink = defaultRenderLink,
  className,
}: {
  /** Name der Navigation für Screenreader */
  label: string;
  brand: string;
  brandHref: string;
  items: NavItem[];
  activeKey?: string | undefined;
  /** Symbole rechts, z. B. Fragen und Profil, jeweils mit aria-label. Mit initials wird das
   *  Ziel ein Tinte-Kreis mit Mint-Initialen (Profil). */
  actions?: (NavItem & { icon: React.ReactNode; initials?: string })[];
  menuHref: string;
  menuLabel: string;
  /** Im Styleguide aus, damit die Beispielleiste nicht über der Seite klebt */
  sticky?: boolean;
  buyerTabs?: boolean;
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <header
      data-slot="global-bar"
      className={cn(
        // Fest 17 Stufen (68 px) hoch inklusive Linie: Die Leiste des Lieferanten klebt genau
        // darunter (top-17).
        'z-20 h-17 border-line border-b bg-paper',
        sticky && 'sticky top-0',
        className,
      )}
    >
      <nav
        aria-label={label}
        className="mx-auto flex h-full w-full max-w-300 items-center gap-6 px-4 sm:px-12"
      >
        {renderLink({
          href: brandHref,
          className:
            'flex min-h-11 items-center gap-2.5 rounded-full font-display font-semibold text-ink text-lg tracking-section focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          children: (
            <>
              <BrandMark className="h-6 w-8.5" />
              {brand}
            </>
          ),
        })}
        <ul
          className={cn(
            'mx-auto hidden flex-wrap items-center gap-0.5 rounded-full bg-line-soft p-1 sidebar:flex',
            buyerTabs &&
              'max-sidebar:fixed max-sidebar:inset-x-0 max-sidebar:bottom-0 max-sidebar:grid max-sidebar:grid-cols-4 max-sidebar:rounded-none max-sidebar:border-t max-sidebar:border-line max-sidebar:bg-paper max-sidebar:pb-[max(var(--spacing),env(safe-area-inset-bottom))]',
          )}
        >
          {items.map((item) => (
            <li key={item.key}>
              {renderLink({
                href: item.href,
                className: cn(
                  linkClass,
                  buyerTabs && 'max-sidebar:justify-center max-sidebar:px-0 max-sidebar:text-xs',
                ),
                'aria-current': item.key === activeKey ? 'page' : undefined,
                children: item.label,
              })}
            </li>
          ))}
        </ul>
        <ul
          className={cn(
            'ml-auto hidden items-center gap-2 sidebar:ml-0 sidebar:flex',
            buyerTabs && 'flex',
          )}
        >
          {actions?.map((action) => (
            <li key={action.key}>
              {renderLink({
                href: action.href,
                className: action.initials
                  ? cn(iconClass, 'p-0.5')
                  : cn(
                      iconClass,
                      buyerTabs && 'sidebar:w-auto sidebar:gap-2 sidebar:px-3',
                      'text-muted-strong hover:bg-line-soft hover:text-ink aria-[current=page]:bg-card aria-[current=page]:text-ink aria-[current=page]:shadow-toggle',
                    ),
                'aria-current': action.key === activeKey ? 'page' : undefined,
                'aria-label': action.label,
                children: action.initials ? (
                  <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-full bg-ink font-display font-semibold text-mint text-sm tracking-wide"
                  >
                    {action.initials}
                  </span>
                ) : (
                  <>
                    {action.icon}
                    {buyerTabs && (
                      <span className="hidden text-sm sidebar:inline">{action.label}</span>
                    )}
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
        <div className={cn('ml-auto sidebar:hidden', buyerTabs && 'hidden')}>
          {renderLink({
            href: menuHref,
            className: cn(iconClass, 'text-muted-strong hover:bg-line-soft hover:text-ink'),
            'aria-label': menuLabel,
            children: <MenuIcon aria-hidden />,
          })}
        </div>
      </nav>
    </header>
  );
}

const iconClass =
  'flex size-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5';

export { GlobalBar };
