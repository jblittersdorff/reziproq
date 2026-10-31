import { Link, type LinkProps } from '@tanstack/react-router';
import { LayoutDashboardIcon, type LucideIcon, SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMe } from '@/features/auth/use-me';
import { useT } from '@/lib/i18n';
import { areas } from './areas';
import { UserMenu } from './user-menu';

/**
 * Inhalt der Seitenleiste wie in macOS-Apps: Name oben, Übersicht und die sechs Bereiche,
 * abgesetzt die Einstellungen, unten das Nutzer-Menü.
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
  const me = useMe();
  // Solange /me lädt, die Bereiche zeigen, damit die Seitenleiste nicht springt.
  const showBuyerAreas =
    !me.data || (me.data.organization !== null && me.data.permissions.viewBuyerAreas);
  return (
    <div className="flex h-full flex-col gap-4 px-3 py-4">
      <div className="flex min-h-11 items-center justify-between gap-2 px-3">
        <span className="font-semibold text-base">{t.app.name}</span>
        {headerAction}
      </div>
      <nav aria-label={t.app.navigation} className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {/* Ohne Organisation oder ohne Feature buyer keine Käuferbereiche (PLT-02). */}
        {showBuyerAreas && (
          <>
            <NavLink to="/uebersicht" icon={LayoutDashboardIcon} onNavigate={onNavigate}>
              {t.nav.overview}
            </NavLink>
            {areas.map((area) => (
              <NavLink key={area.key} to={area.to} icon={area.icon} onNavigate={onNavigate}>
                {t.areas[area.key].title}
              </NavLink>
            ))}
          </>
        )}
        <div className="mt-auto pt-4">
          <NavLink to="/einstellungen" icon={SettingsIcon} onNavigate={onNavigate}>
            {t.nav.settings}
          </NavLink>
        </div>
      </nav>
      <UserMenu onNavigate={onNavigate} />
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  onNavigate,
  children,
}: {
  to: NonNullable<LinkProps['to']>;
  icon: LucideIcon;
  onNavigate?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-base transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[status=active]:bg-primary-soft data-[status=active]:font-medium data-[status=active]:text-primary-soft-foreground"
    >
      <Icon
        className="size-5 shrink-0 text-muted-foreground in-data-[status=active]:text-primary-soft-foreground"
        aria-hidden
      />
      {children}
    </Link>
  );
}
