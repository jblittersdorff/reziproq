import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { useMe } from '@/features/auth/use-me';
import { PageHeader } from '@/features/shell/page-header';
import { healthQueryOptions } from '@/lib/api';
import { type Locale, useLocale, useT } from '@/lib/i18n';
import { type ThemePreference, useTheme } from '@/lib/theme';

/** Darstellung wirkt sofort; Konto zeigt, was die API über die angemeldete Person weiß. */
export function SettingsPage() {
  const t = useT();
  const { preference, setPreference } = useTheme();
  const { locale, setLocale } = useLocale();
  const me = useMe();
  const health = useQuery(healthQueryOptions());

  return (
    <>
      <PageHeader title={t.pages.settings.title} purpose={t.pages.settings.purpose} />

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
        <SettingsRow label={t.settings.language}>
          <SegmentedControl<Locale>
            label={t.settings.language}
            value={locale}
            onChange={setLocale}
            options={[
              { value: 'de', label: t.settings.languageDe },
              { value: 'en', label: t.settings.languageEn },
            ]}
          />
        </SettingsRow>
      </SettingsGroup>

      <div className="flex flex-col gap-3">
        <SettingsGroup title={t.settings.account}>
          <SettingsRow label={t.settings.name}>
            <AccountValue pending={me.isPending} value={me.data?.name} />
          </SettingsRow>
          <SettingsRow label={t.settings.email}>
            <AccountValue pending={me.isPending} value={me.data?.email} />
          </SettingsRow>
          <SettingsRow label={t.settings.connection}>
            {health.isPending ? (
              <Badge>{t.settings.apiChecking}</Badge>
            ) : health.isSuccess ? (
              <Badge variant="success">{t.settings.apiOk}</Badge>
            ) : (
              <Badge variant="danger">{t.settings.apiDown}</Badge>
            )}
          </SettingsRow>
        </SettingsGroup>
        {me.isError && (
          <p role="alert" className="px-4 text-destructive text-sm">
            {t.settings.accountFailed}
          </p>
        )}
      </div>
    </>
  );
}

function AccountValue({ pending, value }: { pending: boolean; value: string | undefined }) {
  const t = useT();
  if (pending) return <span className="text-muted-foreground">{t.settings.loading}</span>;
  return <span className="truncate">{value ?? '–'}</span>;
}
