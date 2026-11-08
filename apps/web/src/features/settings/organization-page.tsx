import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { organizationQueryOptions } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * Einstellungen › Organisation (PLT-02, PLT-05): Name, Land und Mitglieder mit Rolle und
 * Controlling. Jedes Mitglied sieht sie; Admins öffnen über den Namen die Seite des Mitglieds.
 */
export function OrganizationPage() {
  const t = useT();
  const me = useMe();
  const manageSettings = useCan('einstellungen.verwalten');
  const [message, hideMessage] = useFlash();
  const trail = manageSettings
    ? [
        { label: t.profile.title, href: '/profil' },
        { label: t.settings.title, href: '/einstellungen' },
      ]
    : [{ label: t.profile.title, href: '/profil' }];

  return (
    <>
      <PagePath trail={trail} current={t.settings.organization} />
      <PageHeader title={t.settings.organization} purpose={t.settings.organizationPurpose} />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
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
  const format = useFormat();
  const auth = useAuth();
  const changeRoles = useCan('rollen.aendern');
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
          <span className="text-base">{format.country(organization.data.country)}</span>
        </SettingsRow>
      </SettingsGroup>
      <Table>
        <caption className="sr-only">{t.settings.members}</caption>
        <TableHeader>
          <TableRow>
            <TableHead>{t.settings.memberName}</TableHead>
            <TableHead>{t.settings.memberEmail}</TableHead>
            <TableHead>{t.settings.memberRole}</TableHead>
            <TableHead>{t.settings.memberControlling}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organization.data.members.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">
                {changeRoles ? (
                  <Link
                    to="/einstellungen/organisation/$nutzer"
                    params={{ nutzer: member.id }}
                    aria-label={t.settings.memberEdit(member.name)}
                    className="inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {member.name}
                  </Link>
                ) : (
                  member.name
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{member.email}</TableCell>
              <TableCell>
                <Badge variant={member.orgRole === 'admin' ? 'selected' : 'neutral'}>
                  {t.roles[member.orgRole]}
                </Badge>
              </TableCell>
              <TableCell>{member.isControlling ? t.roles.controlling : '–'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
