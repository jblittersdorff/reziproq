import { ArrowLeftRightIcon, Building2Icon, LogOutIcon, SettingsIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup, SettingsLinkRow, SettingsRow } from '@/components/ui/settings-group';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { signedOut } from '@/lib/auth';
import { useLocale, useT } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

/**
 * Profil (PLT-11): wer angemeldet ist, Erscheinungsbild, der Weg zu den Einstellungen und
 * Abmelden. Welche Wege erscheinen, entscheidet die API über /me (can()).
 */
export function ProfilePage() {
  const t = useT();
  const auth = useAuth();
  const me = useMe();
  const { locale } = useLocale();
  const manageSettings = useCan('einstellungen.verwalten');
  const { preference } = useTheme();

  const themeLabel = {
    system: t.profile.themeSystem,
    light: t.profile.themeLight,
    dark: t.profile.themeDark,
  }[preference];

  return (
    <>
      <PageHeader title={t.profile.title} purpose={t.profile.purpose} />

      {me.isError ? (
        <ErrorState title={t.user.failed} />
      ) : !me.data ? (
        <LoadingState label={t.user.loading} />
      ) : (
        <>
          <SettingsGroup title={t.profile.account}>
            <SettingsRow label={t.profile.name}>
              <span className="text-base">{me.data.name}</span>
            </SettingsRow>
            <SettingsRow label={t.profile.email}>
              <span className="text-base">{me.data.email}</span>
            </SettingsRow>
            <SettingsRow label={t.profile.organization}>
              <span className="text-base">
                {me.data.organization?.name ?? t.profile.noOrganization}
              </span>
            </SettingsRow>
            {/* Nur Anzeige: Rolle aus der Datenbank (PLT-05). Entschieden wird per can() im Backend. */}
            {(me.data.orgRole || me.data.isOperator) && (
              <SettingsRow
                label={t.profile.role}
                // Den Betreiber-Hinweis ändert kein Admin, sondern nur pnpm operator:set (UMB-01).
                {...(me.data.orgRole && { description: t.profile.roleDescription })}
              >
                <span className="flex flex-wrap gap-2 sm:justify-end">
                  {me.data.orgRole && <Badge variant="selected">{t.roles[me.data.orgRole]}</Badge>}
                  {me.data.isControlling && <Badge>{t.roles.controlling}</Badge>}
                  {me.data.isOperator && <Badge>{t.profile.operator}</Badge>}
                </span>
              </SettingsRow>
            )}
          </SettingsGroup>

          <SettingsGroup title={t.profile.display}>
            <SettingsLinkRow
              href="/profil/erscheinungsbild"
              label={t.profile.theme}
              value={themeLabel}
              renderLink={routerLink}
            />
            <SettingsLinkRow
              href="/profil/sprache"
              label={t.profile.language}
              value={locale === 'en' ? 'English' : 'Deutsch'}
              renderLink={routerLink}
            />
          </SettingsGroup>

          {(manageSettings || me.data.permissions.viewOrganizationSettings) && (
            <SettingsGroup title={t.profile.settings}>
              {/* Jedes Mitglied sieht die eigene Organisation, alle Einstellungen nur Admins. */}
              {me.data.permissions.viewOrganizationSettings && (
                <SettingsLinkRow
                  href="/einstellungen/organisation"
                  label={t.settings.organization}
                  description={t.settings.organizationHint}
                  icon={<Building2Icon aria-hidden />}
                  renderLink={routerLink}
                />
              )}
              {manageSettings && (
                <SettingsLinkRow
                  href="/einstellungen"
                  label={t.profile.allSettings}
                  icon={<SettingsIcon aria-hidden />}
                  renderLink={routerLink}
                />
              )}
            </SettingsGroup>
          )}

          {/* Nur für das Betreiber-Team von Reziproq; entschieden per can() in der API (UMB-01). */}
          {me.data.permissions.switchCustomer && (
            <SettingsGroup title={t.profile.operator}>
              <SettingsLinkRow
                href="/betreiber/kunden"
                label={t.support.switchCustomer}
                description={t.support.purpose}
                icon={<ArrowLeftRightIcon aria-hidden />}
                renderLink={routerLink}
              />
            </SettingsGroup>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => {
            // Danach „Anmelden“ zeigen statt sofort wieder zu Zitadel zu leiten (PLT-01).
            signedOut.mark();
            void auth.signoutRedirect();
          }}
        >
          <LogOutIcon />
          {t.user.signOut}
        </Button>
      </div>
    </>
  );
}
