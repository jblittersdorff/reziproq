import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { type TeamSide, teamQueryOptions } from '@/lib/api';

/** Team einer Beziehung, aus Sicht der eigenen Seite (PLT-05b, PLB-04). */
export function useTeam(relationshipId: string, side: TeamSide = 'buyer') {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...teamQueryOptions(accessToken, relationshipId, side),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}
