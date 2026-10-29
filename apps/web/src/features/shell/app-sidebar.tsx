import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import { mainNavItems, type NavItem, settingsNavItem } from './nav-items';
import { UserMenu } from './user-menu';

/**
 * Inhalt der Seitenleiste wie in macOS-Apps: Name oben, Navigation, Nutzer-Menü unten.
 * Wird breit fest angezeigt und in schmalen Fenstern im eingeblendeten Sheet.
 */
export function AppSidebar({
  onNavigate,
  headerAction,
}: {
  /** Schließt das Sheet nach der Wahl einer Seite. */
  onNavigate?: (() => void) | undefined;
  headerAction?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex h-full flex-col gap-4 px-3 py-4">
      <div className="flex min-h-9 items-center justify-between gap-2 px-3">
        <span className="font-semibold text-base">{t.app.name}</span>
        {headerAction}
      </div>
      <nav aria-label={t.app.navigation} className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}
        <div className="mt-auto pt-4">
          <NavLink item={settingsNavItem} onNavigate={onNavigate} />
        </div>
      </nav>
      <UserMenu onNavigate={onNavigate} />
    </div>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: (() => void) | undefined }) {
  const t = useT();
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      // Die Übersicht ist nur auf / aktiv, nicht auf jeder Unterseite.
      activeOptions={{ exact: item.to === '/' }}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-md px-3 py-1.5 text-base transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:bg-primary-soft data-[status=active]:font-medium data-[status=active]:text-primary-soft-foreground"
    >
      <Icon
        className="size-5 shrink-0 text-muted-foreground in-data-[status=active]:text-primary-soft-foreground"
        aria-hidden
      />
      {t.nav[item.label]}
    </Link>
  );
}
