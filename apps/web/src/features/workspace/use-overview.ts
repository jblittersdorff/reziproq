import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { supplierOverviewQueryOptions } from '@/lib/api';

/** Kopf und Kennzahlen des Arbeitsbereichs (NAV-06), gelesen aus den Modulen. */
export function useOverview(relationshipId: string) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  return useQuery({
    ...supplierOverviewQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
}
