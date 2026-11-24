import { SettingsGroup, SettingsLinkRow } from '@/components/ui/settings-group';
import { useT } from '@/lib/i18n';
import { routerLink, useNavTargets } from './navigation';
import { PageHeader } from './page-header';

/** Menü auf schmalen Bildschirmen (PLT-11): eine eigene Seite mit allen Zielen, kein Overlay. */
export function MenuPage() {
  const t = useT();
  const { main, agent, actions } = useNavTargets();
  return (
    <>
      <PageHeader size="list" title={t.menu.title} purpose={t.menu.purpose} />
      <nav aria-label={t.menu.title}>
        <SettingsGroup>
          {[...main, ...(agent ? [agent] : []), ...actions].map((target) => {
            const Icon = target.icon;
            return (
              <SettingsLinkRow
                key={target.key}
                href={target.href}
                label={target.label}
                icon={<Icon aria-hidden />}
                renderLink={routerLink}
              />
            );
          })}
        </SettingsGroup>
      </nav>
    </>
  );
}
