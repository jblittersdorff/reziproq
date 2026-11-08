import { useQuery } from '@tanstack/react-query';
import { useToken } from '@/features/ratings/use-rating';
import { decisionsQueryOptions } from '@/lib/api';

export function useDecisions(relationshipId: string) {
  const accessToken = useToken();
  return useQuery({
    ...decisionsQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
}
