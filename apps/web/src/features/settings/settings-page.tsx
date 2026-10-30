import { Building2Icon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { useMe } from '@/features/auth/use-me';
import { PageHeader } from '@/features/shell/page-header';
import { useT } from '@/lib/i18n';
import { type ThemePreference, useTheme } from '@/lib/theme';

/** Erscheinungsbild wirkt sofort; den Abschnitt Organisation sehen nur Admins (PLT-11). */
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
      {me.data?.permissions.viewOrganizationSettings && (
        <section aria-labelledby="einstellungen-organisation" className="flex flex-col gap-2">
          <h2 id="einstellungen-organisation" className="px-4 font-semibold text-sm">
            {t.settings.organization}
          </h2>
          <EmptyState
            icon={<Building2Icon aria-hidden />}
            title={t.settings.organizationTitle}
            description={t.settings.organizationDescription}
          />
        </section>
      )}
    </>
  );
}
