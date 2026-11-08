import type { LocalizedText } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { playbookQueryOptions } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

export const playbookPath = '/einstellungen/spielregeln';

/** Kataloge der eigenen Organisation (PLB-01); beim ersten Aufruf kommt der Standardkatalog. */
export function usePlaybook() {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...playbookQueryOptions(accessToken), enabled: accessToken !== '' });
  return { ...query, accessToken };
}

export function useRefreshPlaybook() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['playbook'] });
}

/** Text in der Sprache der Person, sonst Deutsch. */
export function useLocalized() {
  const { locale } = useLocale();
  return (text: LocalizedText) => (locale === 'en' ? text.en : text.de) || text.de;
}
