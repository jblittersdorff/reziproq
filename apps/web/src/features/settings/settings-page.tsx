import {
  BellIcon,
  BotIcon,
  Building2Icon,
  CalendarIcon,
  CalendarRangeIcon,
  ClipboardListIcon,
  DatabaseIcon,
  LightbulbIcon,
  ReceiptEuroIcon,
  UploadIcon,
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
  const canExport = useCan('datenexport.anfordern');
  const canConfigureHints = useCan('hinweise.einstellen');

  return (
    <>
      <PagePath trail={[{ label: t.profile.title, href: '/profil' }]} current={t.settings.title} />
      <PageHeader size="list" title={t.settings.title} purpose={t.settings.purpose} />
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
          <SettingsLinkRow
            href="/einstellungen/erinnerungen"
            label={t.settings.actionReminders.navTitle}
            description={t.settings.actionReminders.navHint}
            icon={<BellIcon aria-hidden />}
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
          {permissions.viewBuyerAreas && manageSettings && (
            <SettingsLinkRow
              href="/einstellungen/daten/import"
              label={t.importBatches.navTitle}
              description={t.importBatches.navHint}
              icon={<UploadIcon aria-hidden />}
              renderLink={routerLink}
            />
          )}
          {permissions.viewBuyerAreas && (
            <SettingsLinkRow
              href="/einstellungen/geschaeftsjahr"
              label={t.impact.portfolio.settingTitle}
              description={t.impact.portfolio.settingHint}
              icon={<CalendarIcon aria-hidden />}
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
          {permissions.viewBuyerAreas && manageSettings && (
            <SettingsLinkRow
              href="/einstellungen/ki"
              label={t.aiSettings.navTitle}
              description={t.aiSettings.navHint}
              icon={<BotIcon aria-hidden />}
              renderLink={routerLink}
            />
          )}
          {canConfigureHints && (
            <SettingsLinkRow
              href="/einstellungen/hinweise"
              label={t.hints.settingsTitle}
              description={t.hints.settingsNavHint}
              icon={<LightbulbIcon aria-hidden />}
              renderLink={routerLink}
            />
          )}
          {canExport && (
            <SettingsLinkRow
              href="/einstellungen/export"
              label={t.settings.dataExport.navTitle}
              description={t.settings.dataExport.navHint}
              icon={<DatabaseIcon aria-hidden />}
              renderLink={routerLink}
            />
          )}
        </SettingsGroup>
      )}
    </>
  );
}
