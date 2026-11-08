import { useQuery } from '@tanstack/react-query';
import { useToken } from '@/features/ratings/use-rating';
import { segmentationQueryOptions } from '@/lib/api';

export function useSegmentation(relationshipId: string) {
  const accessToken = useToken();
  return useQuery({
    ...segmentationQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
}
