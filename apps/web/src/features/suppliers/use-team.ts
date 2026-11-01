import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { teamQueryOptions } from '@/lib/api';

/** Internes Team einer Beziehung (PLT-05b). */
export function useTeam(relationshipId: string) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...teamQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}
