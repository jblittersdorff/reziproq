import type { UserLocale } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/ui/form-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { useMe } from '@/features/auth/use-me';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath, useGoBack } from '@/features/shell/page-path';
import { saveLocale } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';

/**
 * Sprache als Formularseite (PLT-09), wie das Erscheinungsbild. Gespeichert wird in der Datenbank,
 * damit sie auf jedem Gerät und für spätere E-Mails gilt. Nach dem Speichern wechselt die
 * Oberfläche sofort, ohne Neuladen und ohne Neuanmeldung.
 */
export function LanguagePage() {
  const t = useT();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const me = useMe();
  const { locale, setLocale } = useLocale();
  // Bis zur ersten Auswahl gilt die gespeicherte Sprache, nicht die des Browsers vor dem Laden.
  const [picked, setChoice] = useState<UserLocale | null>(null);
  const choice = picked ?? me.data?.locale ?? locale;
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const goBack = useGoBack('/profil');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFailed(false);
    setSaving(true);
    try {
      await saveLocale(auth.user?.access_token ?? '', choice);
      setLocale(choice);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      goBack();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PagePath trail={[{ label: t.profile.title, href: '/profil' }]} current={t.language.title} />
      <PageHeader title={t.language.title} purpose={t.language.purpose} />
      <form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
        <SettingsGroup>
          <SettingsRow label={t.language.title} description={t.language.description}>
            <SegmentedControl<UserLocale>
              label={t.language.title}
              value={choice}
              onChange={setChoice}
              // Jede Sprache heißt in sich selbst, damit man sie auch ohne die andere findet.
              options={[
                { value: 'de', label: 'Deutsch' },
                { value: 'en', label: 'English' },
              ]}
            />
          </SettingsRow>
        </SettingsGroup>
        {failed && (
          <p role="alert" className="text-destructive">
            {t.language.failed}
          </p>
        )}
        <FormActions>
          <Button type="button" variant="secondary" onClick={goBack}>
            {t.language.cancel}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t.language.saving : t.language.save}
          </Button>
        </FormActions>
      </form>
    </>
  );
}
