import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMe } from '@/features/auth/use-me';
import { PagePath } from '@/features/shell/page-path';
import { PageHeader } from '@/features/shell/page-header';
import { organizationQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';

const countryNames = new Intl.DisplayNames(['de'], { type: 'region' });

/**
 * Einstellungen › Organisation (PLT-02, PLT-11): Name, Land und Mitglieder, nur lesen. Jedes
 * Mitglied sieht sie; die Liste filtert die Datenbank. Admins kommen über alle Einstellungen
 * hierher, alle anderen direkt vom Profil.
 */
export function OrganizationPage() {
  const t = useT();
  const me = useMe();
  const trail = me.data?.permissions.manageSettings
    ? [
        { label: t.profile.title, href: '/profil' },
        { label: t.settings.title, href: '/einstellungen' },
      ]
    : [{ label: t.profile.title, href: '/profil' }];

  return (
    <>
      <PagePath trail={trail} current={t.settings.organization} />
      <PageHeader title={t.settings.organization} purpose={t.settings.organizationPurpose} />
      {me.isError ? (
        <ErrorState title={t.user.failed} />
      ) : !me.data ? (
        <LoadingState label={t.settings.organizationLoading} />
      ) : me.data.permissions.viewOrganizationSettings ? (
        <OrganizationDetails />
      ) : (
        <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
          {t.settings.noOrganization}
        </p>
      )}
    </>
  );
}

function OrganizationDetails() {
  const t = useT();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const organization = useQuery({
    ...organizationQueryOptions(accessToken),
    enabled: accessToken !== '',
  });

  if (organization.isError) return <ErrorState title={t.settings.organizationFailed} />;
  if (!organization.data) return <LoadingState label={t.settings.organizationLoading} />;
  return (
    <>
      <SettingsGroup>
        <SettingsRow label={t.settings.organizationName}>
          <span className="text-base">{organization.data.name}</span>
        </SettingsRow>
        <SettingsRow label={t.settings.organizationCountry}>
          <span className="text-base">
            {organization.data.country
              ? (countryNames.of(organization.data.country) ?? organization.data.country)
              : '–'}
          </span>
        </SettingsRow>
      </SettingsGroup>
      <Table>
        <caption className="sr-only">{t.settings.members}</caption>
        <TableHeader>
          <TableRow>
            <TableHead>{t.settings.memberName}</TableHead>
            <TableHead>{t.settings.memberEmail}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organization.data.members.map((member) => (
            <TableRow key={member.email}>
              <TableCell className="font-medium">{member.name}</TableCell>
              <TableCell className="text-muted-foreground">{member.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
