import {
  Building2Icon,
  CalendarRangeIcon,
  ClipboardListIcon,
  ReceiptEuroIcon,
  UserCogIcon,
} from 'lucide-react';
import { SettingsGroup, SettingsLinkRow } from '@/components/ui/settings-group';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { MasterDataLinks } from '@/features/master-data/links';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { useT } from '@/lib/i18n';

/**
 * Alle Einstellungen (PLT-11): Organisation, Business Units und Warengruppen (PLT-06). Den Weg
 * hierher sehen nur Admins. Wer die Adresse direkt öffnet, sieht den Hinweis und die Organisation.
 */
export function SettingsPage() {
  const t = useT();
  const me = useMe();
  const permissions = me.data?.permissions;
  const manageSettings = useCan('einstellungen.verwalten');

  return (
    <>
      <PagePath trail={[{ label: t.profile.title, href: '/profil' }]} current={t.settings.title} />
      <PageHeader title={t.settings.title} purpose={t.settings.purpose} />
      {permissions && !manageSettings && (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      )}
      {permissions?.viewOrganizationSettings && (
        <SettingsGroup>
          <SettingsLinkRow
            href="/einstellungen/organisation"
            label={t.settings.organization}
            description={t.settings.organizationHint}
            icon={<Building2Icon aria-hidden />}
            renderLink={routerLink}
          />
          <SettingsLinkRow
            href="/einstellungen/zyklus"
            label={t.settings.cycleSettings.navTitle}
            description={t.settings.cycleSettings.navHint}
            icon={<CalendarRangeIcon aria-hidden />}
            renderLink={routerLink}
          />
          {permissions.viewBuyerAreas && (
            <SettingsLinkRow
              href="/einstellungen/guv-zeilen"
              label={t.settings.pnlLines.navTitle}
              description={t.settings.pnlLines.navHint}
              icon={<ReceiptEuroIcon aria-hidden />}
              renderLink={routerLink}
            />
          )}
          {permissions.viewBuyerAreas && (
            <SettingsLinkRow
              href="/einstellungen/fragebogen"
              label={t.settings.survey.navTitle}
              description={t.settings.survey.navHint}
              icon={<ClipboardListIcon aria-hidden />}
              renderLink={routerLink}
            />
          )}
          {permissions.viewBuyerAreas && (
            <SettingsLinkRow
              href="/einstellungen/rollen"
              label={t.settings.roleDescriptions.navTitle}
              description={t.settings.roleDescriptions.navHint}
              icon={<UserCogIcon aria-hidden />}
              renderLink={routerLink}
            />
          )}
          {permissions.viewBuyerAreas && <MasterDataLinks />}
        </SettingsGroup>
      )}
    </>
  );
}
