import { MenuIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';
import { defaultRenderLink, type NavItem, type RenderLink } from './nav-link';

const linkClass =
  'flex min-h-11 items-center rounded-md px-3 text-base text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:font-medium aria-[current=page]:text-foreground';

/**
 * Globale Leiste oben wie auf apple.com (PLT-11, NAV-01): links der Name, in der Mitte die
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
  /** Symbole rechts, z. B. Fragen und Profil, jeweils mit aria-label */
  actions?: (NavItem & { icon: React.ReactNode })[];
  menuHref: string;
  menuLabel: string;
  /** Im Styleguide aus, damit die Beispielleiste nicht über der Seite klebt */
  sticky?: boolean;
  renderLink?: RenderLink;
  className?: string;
}) {
  return (
    <header
      data-slot="global-bar"
      className={cn('z-20 bg-background/80 backdrop-blur', sticky && 'sticky top-0', className)}
    >
      <nav
        aria-label={label}
        className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-1"
      >
        {renderLink({
          href: brandHref,
          className: cn(linkClass, 'font-semibold text-foreground'),
          children: brand,
        })}
        <ul className="hidden flex-1 items-center justify-center gap-1 sidebar:flex">
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
        <ul className="ml-auto hidden items-center gap-1 sidebar:ml-0 sidebar:flex">
          {actions?.map((action) => (
            <li key={action.key}>
              {renderLink({
                href: action.href,
                className: cn(linkClass, 'size-11 justify-center px-0 [&_svg]:size-5'),
                'aria-current': action.key === activeKey ? 'page' : undefined,
                'aria-label': action.label,
                children: action.icon,
              })}
            </li>
          ))}
        </ul>
        <div className="ml-auto sidebar:hidden">
          {renderLink({
            href: menuHref,
            className: cn(linkClass, 'size-11 justify-center px-0 [&_svg]:size-5'),
            'aria-label': menuLabel,
            children: <MenuIcon aria-hidden />,
          })}
        </div>
      </nav>
    </header>
  );
}

export { GlobalBar };
