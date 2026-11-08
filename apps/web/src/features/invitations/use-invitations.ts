import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { invitationsQueryOptions } from '@/lib/api';

/** Einladungen an Personen des Lieferanten (LIF-01a), nur für die einladende Organisation. */
export function useInvitations(relationshipId: string) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...invitationsQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

/** Nach Einladen oder Zurückziehen: Liste neu laden und den Lieferanten (Status draft/active). */
export function useRefreshInvitations() {
  const queryClient = useQueryClient();
  return (relationshipId: string) =>
    queryClient.invalidateQueries({ queryKey: ['suppliers', relationshipId] });
}
