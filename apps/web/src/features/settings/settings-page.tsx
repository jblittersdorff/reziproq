import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
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
import { PageHeader } from '@/features/shell/page-header';
import { organizationQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { type ThemePreference, useTheme } from '@/lib/theme';

/** Erscheinungsbild wirkt sofort; den Abschnitt Organisation sieht jedes Mitglied (PLT-02). */
export function SettingsPage() {
  const t = useT();
  const { preference, setPreference } = useTheme();
  const me = useMe();

  return (
    <>
      <PageHeader title={t.settings.title} purpose={t.settings.purpose} />

      <SettingsGroup title={t.settings.display}>
        <SettingsRow label={t.settings.theme} description={t.settings.themeDescription}>
          <SegmentedControl<ThemePreference>
            label={t.settings.theme}
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'system', label: t.settings.themeSystem },
              { value: 'light', label: t.settings.themeLight },
              { value: 'dark', label: t.settings.themeDark },
            ]}
          />
        </SettingsRow>
      </SettingsGroup>

      {/* Ob der Abschnitt erscheint, entscheidet can() in der API, nicht die Oberfläche. */}
      {/* Nur Anzeige: Welche Rollen die API im Token findet (PLT-01). Entschieden wird per can(). */}
      {me.data && (
        <SettingsGroup title={t.settings.account}>
          <SettingsRow label={t.settings.roles} description={t.settings.rolesDescription}>
            {me.data.roles.length > 0 ? (
              <span className="flex flex-wrap justify-end gap-2">
                {me.data.roles.map((role) => (
                  <Badge key={role} variant="selected">
                    {role}
                  </Badge>
                ))}
              </span>
            ) : (
              <Badge variant="warning">{t.settings.rolesNone}</Badge>
            )}
          </SettingsRow>
          {me.data.roles.length === 0 && (
            <p className="px-4 py-3 text-muted-foreground text-sm">{t.settings.rolesNoneHint}</p>
          )}
        </SettingsGroup>
      )}

      {/* Ob der Abschnitt erscheint, entscheidet die API: jedes Mitglied einer Organisation (PLT-02). */}
      {me.data?.permissions.viewOrganizationSettings && <OrganizationSection />}
    </>
  );
}

const countryNames = new Intl.DisplayNames(['de'], { type: 'region' });

/** Name, Land und Mitglieder der eigenen Organisation; die Liste filtert die Datenbank (PLT-02). */
function OrganizationSection() {
  const t = useT();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const organization = useQuery({
    ...organizationQueryOptions(accessToken),
    enabled: accessToken !== '',
  });

  return (
    <section aria-labelledby="einstellungen-organisation" className="flex flex-col gap-4">
      <h2 id="einstellungen-organisation" className="px-4 font-semibold text-sm">
        {t.settings.organization}
      </h2>
      {organization.isError ? (
        <ErrorState title={t.settings.organizationFailed} />
      ) : !organization.data ? (
        <LoadingState label={t.settings.organizationLoading} className="px-4" />
      ) : (
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
      )}
    </section>
  );
}
