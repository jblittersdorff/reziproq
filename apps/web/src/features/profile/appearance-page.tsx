import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/ui/form-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import { PageHeader } from '@/features/shell/page-header';
import { useT } from '@/lib/i18n';
import { type ThemePreference, useTheme } from '@/lib/theme';

/**
 * Erscheinungsbild als Formularseite (PLT-11, NAV-02). Gespeichert wird nur im Browser.
 * Speichern und Abbrechen führen zur vorigen Seite.
 */
export function AppearancePage() {
  const t = useT();
  const { preference, setPreference } = useTheme();
  const [choice, setChoice] = useState<ThemePreference>(preference);
  const goBack = useGoBack('/profil');

  return (
    <>
      <PagePath
        trail={[{ label: t.profile.title, href: '/profil' }]}
        current={t.appearance.title}
      />
      <PageHeader title={t.appearance.title} purpose={t.appearance.purpose} />
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          setPreference(choice);
          goBack();
        }}
      >
        <SettingsGroup>
          <SettingsRow label={t.appearance.title} description={t.appearance.description}>
            <SegmentedControl<ThemePreference>
              label={t.appearance.title}
              value={choice}
              onChange={setChoice}
              options={[
                { value: 'system', label: t.profile.themeSystem },
                { value: 'light', label: t.profile.themeLight },
                { value: 'dark', label: t.profile.themeDark },
              ]}
            />
          </SettingsRow>
        </SettingsGroup>
        <FormActions>
          <Button type="button" variant="secondary" onClick={goBack}>
            {t.appearance.cancel}
          </Button>
          <Button type="submit">{t.appearance.save}</Button>
        </FormActions>
      </form>
    </>
  );
}
