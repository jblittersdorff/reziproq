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
  /** Zahl offener Dinge, z. B. die offenen Fokus-Themen bei Heute */
  badge?: number;
  /** Öffnet etwas über der Seite statt zu verlinken, z. B. Frag Reziproq (E-K0-01) */
  onSelect?: () => void;
}

/**
 * Rahmen jeder angemeldeten Seite (UX-20 `AppShell`, NAV-10 2.0, Vorlage `Main.dc.html`):
 * - ab 761 px Seitenleiste (236 px, so hoch wie der Bildschirm, bleibt beim Scrollen stehen, E-K0-02)
 *   mit Logo, „Frag Reziproq“ mit ⌘K, den Hauptpunkten, nach dem Abstand „Im Hintergrund“, Mein
 *   Agent, Einstellungen und der Person; der aktive Punkt weiß, Symbol Petrol;
 * - bis 760 px Tab-Leiste fest unten (weiß, durchscheinend, Unschärfe) mit fünf Zielen;
 * - Inhalt bis 1200 px; unter der Tab-Leiste 92 px Abstand, damit nichts verdeckt wird.
 */
function AppShell({
  label,
  tabsLabel,
  brand,
  brandHref,
  search,
  items,
  background,
  footer = [],
  settings,
  person,
  tabs,
  activeKey,
  renderLink = defaultRenderLink,
  children,
}: {
  /** Name der Navigation für Screenreader, z. B. „Hauptbereiche“ */
  label: string;
  /** Name der Tab-Leiste; beide Leisten brauchen verschiedene Namen */
  tabsLabel?: string;
  brand: string;
  brandHref: string;
  /** „Frag Reziproq“ mit Kürzel; öffnet die Überlagerung (onOpen) oder verlinkt; ohne Eintrag kein Feld */
  search?: { key: string; label: string; href: string; shortcut?: string; onOpen?: () => void };
  items: ShellItem[];
  /** Zeile „Im Hintergrund: …“ (13 px, Punkt Petrol), solange Reziproq für die Person arbeitet */
  background?: { label: string; href: string };
  /** Punkte nach dem Abstand, vor den Einstellungen, z. B. Mein Agent */
  footer?: ShellItem[];
  settings?: ShellItem;
  /** Person unten in der Seitenleiste; führt zum Profil */
  person?: { initials: string; name: string; href: string; label: string };
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
        // Bleibt beim Scrollen stehen und ist so hoch wie der Bildschirm (Gründer, 23.11.2026;
        // weicht von „nicht fixiert“ in NAV-10 1.1 ab). Eigener Scroll nur, wenn der Bildschirm
        // niedriger ist als die Punkte, damit nichts unerreichbar wird.
        className="hidden w-59 shrink-0 flex-col gap-0.5 border-sidebar-line border-r bg-line-soft px-3 pt-4.5 pb-5 shell:sticky shell:top-0 shell:flex shell:h-svh shell:overflow-y-auto"
      >
        {renderLink({
          href: brandHref,
          className: 'flex min-h-11 items-center px-2.5 pb-3 text-ink no-underline',
          children: <Logo name={brand} />,
        })}
        {search &&
          (search.onOpen ? (
            <button
              type="button"
              onClick={search.onOpen}
              aria-label={search.label}
              aria-keyshortcuts={search.shortcut ? 'Meta+K Control+K' : undefined}
              className={searchClass}
            >
              <SearchContent search={search} />
            </button>
          ) : (
            renderLink({
              href: search.href,
              'aria-label': search.label,
              'aria-current': search.key === activeKey ? 'page' : undefined,
              className: searchClass,
              children: <SearchContent search={search} />,
            })
          ))}
        {items.map((item) => (
          <span key={item.key} className="contents">
            {sideItem(item)}
          </span>
        ))}
        <span className="min-h-6 flex-1" />
        {background &&
          renderLink({
            href: background.href,
            className:
              'mb-1.5 flex min-h-11 gap-2 rounded-nav p-2.5 text-muted-strong text-sm leading-snug no-underline hover:bg-control hover:text-ink',
            children: (
              <>
                <span aria-hidden className="mt-1.25 size-2 shrink-0 rounded-full bg-petrol" />
                <span className="min-w-0">{background.label}</span>
              </>
            ),
          })}
        {footer.map((item) => (
          <span key={item.key} className="contents">
            {sideItem(item)}
          </span>
        ))}
        {settings && sideItem(settings)}
        {person &&
          renderLink({
            href: person.href,
            'aria-label': person.label,
            'aria-current': activeKey === 'profile' ? 'page' : undefined,
            className:
              'flex min-h-11 items-center gap-2.5 rounded-nav px-2.5 pt-3 text-detail text-muted-strong no-underline hover:text-ink',
            children: (
              <>
                <span
                  aria-hidden
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink font-display font-semibold text-mint text-chip"
                >
                  {person.initials}
                </span>
                <span className="min-w-0 truncate">{person.name}</span>
              </>
            ),
          })}
      </nav>
      <div data-slot="shell-main" className="min-w-0 flex-1 pb-23 shell:pb-0">
        {children}
      </div>
      <nav
        aria-label={tabsLabel ?? label}
        data-slot="tab-bar"
        className="z-20 flex justify-around border-sidebar-line border-t bg-card/93 px-1 pt-2 pb-6 backdrop-blur-md max-shell:fixed max-shell:inset-x-0 max-shell:bottom-0 shell:hidden"
      >
        {(tabs ?? items).map((item) => {
          const className = cn(
            'flex min-h-11 min-w-15 flex-col items-center gap-0.5 rounded-nav font-semibold text-tab no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-6',
            item.key === activeKey ? 'text-petrol' : 'text-input-border',
          );
          return (
            <span key={item.key} className="contents">
              {item.onSelect ? (
                <button type="button" onClick={item.onSelect} className={className}>
                  {item.icon}
                  {item.label}
                </button>
              ) : (
                renderLink({
                  href: item.href,
                  'aria-current': item.key === activeKey ? 'page' : undefined,
                  className,
                  children: (
                    <>
                      {item.icon}
                      {item.label}
                    </>
                  ),
                })
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}

const searchClass =
  'mb-3.5 flex min-h-11 items-center gap-2 rounded-nav bg-sidebar-line px-2.5 text-left text-detail text-muted-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4';

function SearchContent({ search }: { search: { label: string; shortcut?: string } }) {
  return (
    <>
      <SearchIcon aria-hidden />
      <span className="flex-1">{search.label}</span>
      {search.shortcut && (
        <kbd className="font-semibold text-input-border text-tab">{search.shortcut}</kbd>
      )}
    </>
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
