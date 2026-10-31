import { Building2Icon } from 'lucide-react';
import { SettingsGroup, SettingsLinkRow } from '@/components/ui/settings-group';
import { useMe } from '@/features/auth/use-me';
import { routerLink } from '@/features/shell/navigation';
import { PagePath } from '@/features/shell/page-path';
import { PageHeader } from '@/features/shell/page-header';
import { useT } from '@/lib/i18n';

/**
 * Alle Einstellungen (PLT-11): vorerst nur Organisation; weitere kommen mit ihren Specs. Den Weg
 * hierher sehen nur Admins. Wer die Adresse direkt öffnet, sieht den Hinweis und die Organisation.
 */
export function SettingsPage() {
  const t = useT();
  const me = useMe();
  const permissions = me.data?.permissions;

  return (
    <>
      <PagePath trail={[{ label: t.profile.title, href: '/profil' }]} current={t.settings.title} />
      <PageHeader title={t.settings.title} purpose={t.settings.purpose} />
      {permissions && !permissions.manageSettings && (
        <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
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
        </SettingsGroup>
      )}
    </>
  );
}
