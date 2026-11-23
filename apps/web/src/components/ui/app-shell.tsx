import { SearchIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';
import { Logo } from './brand-mark';
import { defaultRenderLink, type RenderLink } from './nav-link';

export interface ShellItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Zahl offener Dinge, z. B. bei Mein Tag */
  badge?: number;
}

/**
 * Rahmen jeder angemeldeten Seite (UX-20 `AppShell`, NAV-10 1.1, Vorlage `Main.dc.html`):
 * - ab 761 px Seitenleiste (236 px, nicht fixiert) mit Logo, „Suchen oder fragen“ mit ⌘K, den
 *   Hauptpunkten, Einstellungen und der Person; der aktive Punkt weiß, Symbol Petrol;
 * - bis 760 px Tab-Leiste fest unten (weiß, durchscheinend, Unschärfe) mit fünf Zielen;
 * - Inhalt bis 1200 px; unter der Tab-Leiste 92 px Abstand, damit nichts verdeckt wird.
 */
function AppShell({
  label,
  brand,
  brandHref,
  search,
  items,
  settings,
  person,
  tabs,
  activeKey,
  renderLink = defaultRenderLink,
  children,
}: {
  /** Name der Navigation für Screenreader, z. B. „Hauptbereiche“ */
  label: string;
  brand: string;
  brandHref: string;
  /** „Suchen oder fragen“ mit Kürzel; ohne Eintrag kein Suchfeld */
  search?: { label: string; href: string; shortcut?: string };
  items: ShellItem[];
  settings?: ShellItem;
  person?: { initials: string; name: string };
  /** Ziele der Tab-Leiste (fünf); fehlt die Angabe, gelten die Hauptpunkte */
  tabs?: ShellItem[];
  activeKey: string | undefined;
  renderLink?: RenderLink;
  children: React.ReactNode;
}) {
  const sideItem = (item: ShellItem) =>
    renderLink({
      href: item.href,
      'aria-current': item.key === activeKey ? 'page' : undefined,
      className: cn(
        'flex min-h-11 items-center gap-2.5 rounded-nav px-2.5 text-base no-underline [&_svg]:size-5',
        item.key === activeKey
          ? 'bg-card font-semibold text-ink shadow-nav [&_svg]:text-petrol'
          : 'font-medium text-muted-strong hover:bg-control hover:text-ink [&_svg]:text-input-border',
      ),
      children: (
        <>
          {item.icon}
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <b className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-petrol px-1.5 text-micro text-primary-foreground">
              {item.badge}
            </b>
          )}
        </>
      ),
    });

  return (
    <div data-slot="app-shell" className="flex min-h-svh bg-background">
      <nav
        aria-label={label}
        data-slot="sidebar"
        className="hidden w-59 shrink-0 flex-col gap-0.5 border-sidebar-line border-r bg-line-soft px-3 pt-4.5 pb-5 shell:flex"
      >
        {renderLink({
          href: brandHref,
          className: 'flex min-h-11 items-center px-2.5 pb-3 text-ink no-underline',
          children: <Logo name={brand} />,
        })}
        {search &&
          renderLink({
            href: search.href,
            className:
              'mb-3.5 flex min-h-11 items-center gap-2 rounded-nav bg-sidebar-line px-2.5 text-detail text-muted-foreground no-underline [&_svg]:size-4',
            children: (
              <>
                <SearchIcon aria-hidden />
                <span className="flex-1">{search.label}</span>
                {search.shortcut && (
                  <kbd className="font-semibold text-input-border text-tab">{search.shortcut}</kbd>
                )}
              </>
            ),
          })}
        {items.map((item) => (
          <span key={item.key} className="contents">
            {sideItem(item)}
          </span>
        ))}
        <span className="flex-1" />
        {settings && sideItem(settings)}
        {person && (
          <span className="flex items-center gap-2.5 px-2.5 pt-3 text-detail text-muted-strong">
            <span
              aria-hidden
              className="inline-flex size-8 items-center justify-center rounded-full bg-ink font-display font-semibold text-mint text-chip"
            >
              {person.initials}
            </span>
            {person.name}
          </span>
        )}
      </nav>
      <div data-slot="shell-main" className="min-w-0 flex-1 pb-23 shell:pb-0">
        {children}
      </div>
      <nav
        aria-label={label}
        data-slot="tab-bar"
        className="z-20 flex justify-around border-sidebar-line border-t bg-card/93 px-1 pt-2 pb-6 backdrop-blur-md max-shell:fixed max-shell:inset-x-0 max-shell:bottom-0 shell:hidden"
      >
        {(tabs ?? items).map((item) => (
          <span key={item.key} className="contents">
            {renderLink({
              href: item.href,
              'aria-current': item.key === activeKey ? 'page' : undefined,
              className: cn(
                'flex min-h-11 min-w-15 flex-col items-center gap-0.5 font-semibold text-tab no-underline [&_svg]:size-6',
                item.key === activeKey ? 'text-petrol' : 'text-input-border',
              ),
              children: (
                <>
                  {item.icon}
                  {item.label}
                </>
              ),
            })}
          </span>
        ))}
      </nav>
    </div>
  );
}

/** Inhalt einer Seite im Rahmen: bis 1200 px, Ränder wie in den Vorlagen, Gruppen mit 22 px Abstand */
function ShellContent({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="shell-content"
      className={cn(
        'mx-auto flex w-full min-w-0 max-w-300 flex-col gap-5.5 px-4 pt-4 pb-16 sm:px-10 shell:pt-7 [&>*]:min-w-0',
        className,
      )}
      {...props}
    />
  );
}

export { AppShell, ShellContent };
